const { applyMovementOnConnection } = require("../stock/repository");
const { STOCK_TYPES } = require("../stock/types");
const { createLoyaltyRepository } = require("../loyalty/repository");
const { resolveTierFromSpend } = require("../loyalty/policy");

function sanitizeLimit(limit) {
    const parsed = Number.parseInt(limit, 10);

    if (Number.isNaN(parsed) || parsed < 1) {
        return 5;
    }

    return Math.min(parsed, 50);
}

function buildInClause(values) {
    return values.map(() => "?").join(", ");
}

function createOrdersRepository(db) {
    const loyaltyRepo = createLoyaltyRepository(db);

    return {
        getCustomerLoyalty(customerId) {
            return loyaltyRepo.getCustomerLoyalty(customerId);
        },

        async createOrder(order) {
            const [result] = await db.execute(
                `INSERT INTO orders
                (customer_id, user_id, table_id, table_order_id, source, status, total_amount, coupon_code, discount_percent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    order.customer_id,
                    order.user_id,
                    order.table_id,
                    order.table_order_id,
                    order.source,
                    order.status,
                    order.total_amount,
                    order.coupon_code,
                    order.discount_percent
                ]
            );
            return result;
        },

        async findProductStockById(productId) {
            const [rows] = await db.execute(
                "SELECT quantity FROM products WHERE id = ?",
                [productId]
            );
            return rows[0] || null;
        },

        async findProductsByIds(ids) {
            if (!ids.length) {
                return [];
            }

            const [rows] = await db.execute(
                `SELECT id, name, price, quantity, cost_price
                FROM products
                WHERE id IN (${buildInClause(ids)})`,
                ids
            );
            return rows;
        },

        async findPromotionByCode(code) {
            const [rows] = await db.execute(
                `SELECT
                    id,
                    code,
                    discount_type,
                    discount_percent,
                    discount_value,
                    min_order_amount,
                    max_uses,
                    used_count,
                    is_active,
                    start_date,
                    end_date,
                    description
                FROM promotions
                WHERE UPPER(code) = UPPER(?)
                LIMIT 1`,
                [code]
            );
            return rows[0] || null;
        },

        async findStaffPerformanceByUserId(userId) {
            const [rows] = await db.execute(
                `SELECT
                    u.id,
                    u.username,
                    u.role,
                    COUNT(o.id) AS order_count,
                    SUM(CASE WHEN o.customer_id IS NOT NULL THEN 1 ELSE 0 END) AS member_order_count,
                    IFNULL(SUM(o.total_amount - IFNULL(o.refunded_amount, 0)), 0) AS total_revenue
                FROM users u
                LEFT JOIN orders o
                    ON o.user_id = u.id
                    AND o.status IN ('completed', 'partial_refund')
                    AND o.source = 'pos'
                WHERE u.id = ?
                GROUP BY u.id, u.username, u.role
                LIMIT 1`,
                [userId]
            );
            return rows[0] || null;
        },

        async findIdempotency(userId, key) {
            const [rows] = await db.execute(
                `SELECT order_id, response_json
                FROM checkout_idempotency
                WHERE user_id = ? AND idempotency_key = ?
                LIMIT 1`,
                [userId, key]
            );
            return rows[0] || null;
        },

        async saveIdempotency(userId, key, orderId, response) {
            try {
                await db.execute(
                    `INSERT INTO checkout_idempotency
                    (idempotency_key, user_id, order_id, response_json)
                    VALUES (?, ?, ?, ?)`,
                    [key, userId, orderId, JSON.stringify(response)]
                );
            } catch (error) {
                if (error && (error.code === "ER_NO_SUCH_TABLE" || error.errno === 1146)) {
                    return;
                }
                if (error && (error.code === "ER_DUP_ENTRY" || error.errno === 1062)) {
                    return;
                }
                throw error;
            }
        },

        async createOrderDetailWithStockUpdate(detail) {
            const connection = await db.getConnection();

            try {
                await connection.beginTransaction();

                const [productRows] = await connection.execute(
                    `SELECT id, name, price, quantity, cost_price
                    FROM products
                    WHERE id = ?
                    FOR UPDATE`,
                    [detail.product_id]
                );
                const product = productRows[0];
                if (!product) {
                    const error = new Error("Không tìm thấy sản phẩm");
                    error.status = 404;
                    throw error;
                }
                if (Number(product.quantity) < Number(detail.quantity)) {
                    const error = new Error(`Sản phẩm ${product.name} không đủ tồn kho`);
                    error.status = 400;
                    throw error;
                }

                const unitPrice = detail.price != null ? detail.price : product.price;
                const unitCost = detail.cost_price != null
                    ? detail.cost_price
                    : (Number(product.cost_price) || 0);

                const [insertResult] = await connection.execute(
                    `INSERT INTO order_details
                    (order_id, product_id, quantity, price, cost_price)
                    VALUES (?, ?, ?, ?, ?)`,
                    [
                        detail.order_id,
                        detail.product_id,
                        detail.quantity,
                        unitPrice,
                        unitCost
                    ]
                );

                await applyMovementOnConnection(connection, {
                    product_id: detail.product_id,
                    type: STOCK_TYPES.SALE,
                    qty: detail.quantity,
                    unit_cost: unitCost,
                    ref_type: "order",
                    ref_id: detail.order_id,
                    note: "Legacy order detail",
                    created_by: detail.user_id || null
                });

                await connection.commit();
                return insertResult;
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        },

        async checkout(request) {
            const connection = await db.getConnection();

            try {
                await connection.beginTransaction();

                // Lock + validate stock (product + optional variant)
                for (const item of request.items) {
                    const [stockRows] = await connection.execute(
                        "SELECT id, quantity, cost_price, price FROM products WHERE id = ? FOR UPDATE",
                        [item.product_id]
                    );
                    const stock = stockRows[0];

                    if (!stock || Number(stock.quantity) < item.quantity) {
                        const error = new Error("Sản phẩm không đủ tồn kho");
                        error.status = 400;
                        throw error;
                    }

                    if (item.cost_price == null) {
                        item.cost_price = Number(stock.cost_price) || 0;
                    }

                    if (item.variant_id) {
                        const [variantRows] = await connection.execute(
                            `SELECT id, product_id, quantity, price_override
                            FROM product_variants WHERE id = ? FOR UPDATE`,
                            [item.variant_id]
                        );
                        const variant = variantRows[0];
                        if (!variant || Number(variant.product_id) !== Number(item.product_id)) {
                            const error = new Error("Biến thể sản phẩm không hợp lệ");
                            error.status = 400;
                            throw error;
                        }
                        if (Number(variant.quantity) < item.quantity) {
                            const error = new Error("Biến thể không đủ tồn kho");
                            error.status = 400;
                            throw error;
                        }
                        if (variant.price_override != null && item.price == null) {
                            item.price = Number(variant.price_override);
                        }
                    }
                }

                if (request.coupon_code && request.promotion_id) {
                    const [promoRows] = await connection.execute(
                        `SELECT id, max_uses, used_count, is_active
                        FROM promotions
                        WHERE id = ?
                        FOR UPDATE`,
                        [request.promotion_id]
                    );
                    const promo = promoRows[0];
                    if (!promo || Number(promo.is_active) !== 1) {
                        const error = new Error("Mã giảm giá không tồn tại hoặc đã hết hạn");
                        error.status = 400;
                        throw error;
                    }
                    if (promo.max_uses != null && Number(promo.used_count) >= Number(promo.max_uses)) {
                        const error = new Error("Mã giảm giá đã hết lượt sử dụng");
                        error.status = 400;
                        throw error;
                    }
                    await connection.execute(
                        `UPDATE promotions
                        SET used_count = used_count + 1
                        WHERE id = ?`,
                        [request.promotion_id]
                    );
                }

                const pointsEarned = Number(request.points_earned) || 0;
                const pointsRedeemed = Number(request.points_redeemed) || 0;
                const pointsDiscount = Number(request.points_discount_amount) || 0;

                let orderResult;
                try {
                    [orderResult] = await connection.execute(
                        `INSERT INTO orders
                        (customer_id, user_id, shift_id, table_id, table_order_id, source, status,
                            subtotal_amount, discount_amount, total_amount,
                            coupon_code, discount_percent,
                            manual_discount_type, manual_discount_value,
                            payment_method, payment_status, amount_paid, change_amount,
                            points_earned, points_redeemed, points_discount_amount)
                        VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            request.customer_id,
                            request.user_id,
                            request.shift_id || null,
                            request.source,
                            request.status,
                            request.subtotal_amount,
                            request.discount_amount,
                            request.total_amount,
                            request.coupon_code,
                            request.discount_percent,
                            request.manual_discount_type,
                            request.manual_discount_value,
                            request.payment_method,
                            request.payment_status || "paid",
                            request.amount_paid,
                            request.change_amount,
                            pointsEarned,
                            pointsRedeemed,
                            pointsDiscount
                        ]
                    );
                } catch (error) {
                    // Fallback if points / shift columns not migrated yet
                    if (error && (error.code === "ER_BAD_FIELD_ERROR" || error.errno === 1054)) {
                        [orderResult] = await connection.execute(
                            `INSERT INTO orders
                            (customer_id, user_id, table_id, table_order_id, source, status,
                                subtotal_amount, discount_amount, total_amount,
                                coupon_code, discount_percent,
                                manual_discount_type, manual_discount_value,
                                payment_method, amount_paid, change_amount)
                            VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                request.customer_id,
                                request.user_id,
                                request.source,
                                request.status,
                                request.subtotal_amount,
                                request.discount_amount,
                                request.total_amount,
                                request.coupon_code,
                                request.discount_percent,
                                request.manual_discount_type,
                                request.manual_discount_value,
                                request.payment_method,
                                request.amount_paid,
                                request.change_amount
                            ]
                        );
                    } else {
                        throw error;
                    }
                }

                const orderId = orderResult.insertId;

                for (const item of request.items) {
                    try {
                        await connection.execute(
                            `INSERT INTO order_details
                            (order_id, product_id, variant_id, quantity, price, cost_price, refunded_quantity)
                            VALUES (?, ?, ?, ?, ?, ?, 0)`,
                            [
                                orderId,
                                item.product_id,
                                item.variant_id || null,
                                item.quantity,
                                item.price,
                                item.cost_price != null ? item.cost_price : 0
                            ]
                        );
                    } catch (error) {
                        if (error && (error.code === "ER_BAD_FIELD_ERROR" || error.errno === 1054)) {
                            await connection.execute(
                                `INSERT INTO order_details
                                (order_id, product_id, quantity, price, cost_price, refunded_quantity)
                                VALUES (?, ?, ?, ?, ?, 0)`,
                                [
                                    orderId,
                                    item.product_id,
                                    item.quantity,
                                    item.price,
                                    item.cost_price != null ? item.cost_price : 0
                                ]
                            );
                        } else {
                            throw error;
                        }
                    }

                    if (item.variant_id) {
                        await connection.execute(
                            `UPDATE product_variants
                            SET quantity = quantity - ?
                            WHERE id = ? AND quantity >= ?`,
                            [item.quantity, item.variant_id, item.quantity]
                        );
                    }

                    await applyMovementOnConnection(connection, {
                        product_id: item.product_id,
                        type: request.defer_payment ? STOCK_TYPES.RESERVE_OUT : STOCK_TYPES.SALE,
                        qty: item.quantity,
                        unit_cost: item.cost_price,
                        ref_type: "order",
                        ref_id: orderId,
                        note: item.variant_id
                            ? `POS checkout variant #${item.variant_id}`
                            : request.defer_payment ? "Bank transfer reservation" : "POS checkout",
                        created_by: request.user_id
                    });
                }

                // Loyalty in same TX
                if (!request.defer_payment && request.customer_id && (pointsEarned > 0 || pointsRedeemed > 0 || Number(request.total_amount) > 0)) {
                    try {
                        const netSpend = Number(request.total_amount) || 0;
                        const [custRows] = await connection.execute(
                            "SELECT lifetime_spend FROM customers WHERE id = ?",
                            [request.customer_id]
                        );
                        const prevSpend = Number(custRows[0]?.lifetime_spend) || 0;
                        const newTier = resolveTierFromSpend(prevSpend + netSpend);

                        await createLoyaltyRepository(db).applyCheckoutLoyalty(connection, {
                            customerId: request.customer_id,
                            orderId,
                            pointsEarned,
                            pointsRedeemed,
                            netSpend,
                            newTier,
                            createdBy: request.user_id
                        });
                    } catch (error) {
                        // points_ledger may not exist yet mid-deploy
                        if (!(error && (error.code === "ER_NO_SUCH_TABLE" || error.errno === 1146))) {
                            throw error;
                        }
                    }
                }

                await connection.commit();

                return {
                    orderId
                };
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        },

        async findOrderHeaderById(orderId) {
            const [rows] = await db.execute(
                `SELECT
                    o.*,
                    COALESCE(c.name, 'Khách lẻ') AS customer_name,
                    u.username
                FROM orders o
                LEFT JOIN customers c ON o.customer_id = c.id
                LEFT JOIN users u ON o.user_id = u.id
                WHERE o.id = ?
                LIMIT 1`,
                [orderId]
            );
            return rows[0] || null;
        },

        async findOrderLinesById(orderId) {
            const [rows] = await db.execute(
                `SELECT
                    od.id,
                    od.order_id,
                    od.product_id,
                    od.variant_id,
                    od.quantity,
                    od.price,
                    od.cost_price,
                    od.refunded_quantity,
                    p.name AS product_name,
                    p.sku
                FROM order_details od
                LEFT JOIN products p ON p.id = od.product_id
                WHERE od.order_id = ?
                ORDER BY od.id`,
                [orderId]
            );
            return rows;
        },

        async voidOrder({ orderId, userId, reason, lines }) {
            const connection = await db.getConnection();

            try {
                await connection.beginTransaction();

                const [orderRows] = await connection.execute(
                    `SELECT id, status, total_amount, customer_id, shift_id, payment_method,
                        promotion_id, coupon_code,
                        COALESCE(points_earned, 0) AS points_earned,
                        COALESCE(points_redeemed, 0) AS points_redeemed
                    FROM orders
                    WHERE id = ?
                    FOR UPDATE`,
                    [orderId]
                );
                const order = orderRows[0];

                if (!order) {
                    const error = new Error("Không tìm thấy hóa đơn");
                    error.status = 404;
                    throw error;
                }

                if (String(order.status) !== "completed") {
                    const error = new Error("Chỉ hủy được hóa đơn đã hoàn tất");
                    error.status = 400;
                    throw error;
                }

                for (const line of lines) {
                    const restoreQty = Number(line.quantity) - Number(line.refunded_quantity || 0);
                    if (restoreQty <= 0 || !line.product_id) {
                        continue;
                    }

                    await applyMovementOnConnection(connection, {
                        product_id: line.product_id,
                        type: STOCK_TYPES.SALE_VOID,
                        qty: restoreQty,
                        unit_cost: line.cost_price,
                        ref_type: "order_void",
                        ref_id: orderId,
                        note: reason,
                        created_by: userId
                    });

                    if (line.variant_id) {
                        await connection.execute(
                            `UPDATE product_variants
                            SET quantity = quantity + ?
                            WHERE id = ?`,
                            [restoreQty, line.variant_id]
                        );
                    }

                    await connection.execute(
                        `UPDATE order_details
                        SET refunded_quantity = quantity
                        WHERE id = ?`,
                        [line.id]
                    );
                }

                if (order.customer_id) {
                    try {
                        await createLoyaltyRepository(db).reverseOrderLoyalty(connection, {
                            customerId: order.customer_id,
                            orderId,
                            pointsEarned: Number(order.points_earned) || 0,
                            pointsRedeemed: Number(order.points_redeemed) || 0,
                            netSpend: Number(order.total_amount) || 0,
                            createdBy: userId
                        });
                    } catch (error) {
                        if (!(error && (error.code === "ER_NO_SUCH_TABLE" || error.errno === 1146
                            || error.code === "ER_BAD_FIELD_ERROR" || error.errno === 1054))) {
                            throw error;
                        }
                    }
                }

                // Restore promotion capacity when voiding a couponed order
                if (order.promotion_id || order.coupon_code) {
                    try {
                        if (order.promotion_id) {
                            await connection.execute(
                                `UPDATE promotions
                                SET used_count = GREATEST(0, used_count - 1)
                                WHERE id = ?`,
                                [order.promotion_id]
                            );
                        } else if (order.coupon_code) {
                            await connection.execute(
                                `UPDATE promotions
                                SET used_count = GREATEST(0, used_count - 1)
                                WHERE UPPER(code) = UPPER(?)`,
                                [order.coupon_code]
                            );
                        }
                    } catch (error) {
                        if (!(error && (error.code === "ER_NO_SUCH_TABLE" || error.errno === 1146
                            || error.code === "ER_BAD_FIELD_ERROR" || error.errno === 1054))) {
                            throw error;
                        }
                    }
                }

                await connection.execute(
                    `UPDATE orders
                    SET status = 'voided',
                        void_reason = ?,
                        voided_at = NOW(),
                        voided_by = ?,
                        refunded_amount = total_amount
                    WHERE id = ?`,
                    [reason, userId, orderId]
                );

                await connection.commit();
                return {
                    orderId,
                    status: "voided",
                    shift_id: order.shift_id || null,
                    payment_method: order.payment_method || null,
                    total_amount: Number(order.total_amount) || 0
                };
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        },

        async refundOrder({ orderId, userId, reason, refundLines, refundAmount, nextStatus }) {
            const connection = await db.getConnection();

            try {
                await connection.beginTransaction();

                const [orderRows] = await connection.execute(
                    `SELECT id, status, total_amount, refunded_amount, customer_id, shift_id,
                        payment_method, promotion_id, coupon_code,
                        COALESCE(points_earned, 0) AS points_earned,
                        COALESCE(points_redeemed, 0) AS points_redeemed
                    FROM orders
                    WHERE id = ?
                    FOR UPDATE`,
                    [orderId]
                );
                const order = orderRows[0];

                if (!order) {
                    const error = new Error("Không tìm thấy hóa đơn");
                    error.status = 404;
                    throw error;
                }

                if (!["completed", "partial_refund"].includes(String(order.status))) {
                    const error = new Error("Hóa đơn không thể hoàn tiền ở trạng thái hiện tại");
                    error.status = 400;
                    throw error;
                }

                for (const line of refundLines) {
                    await applyMovementOnConnection(connection, {
                        product_id: line.product_id,
                        type: STOCK_TYPES.RETURN_IN,
                        qty: line.refund_qty,
                        unit_cost: line.cost_price,
                        ref_type: "order_refund",
                        ref_id: orderId,
                        note: reason,
                        created_by: userId
                    });

                    if (line.variant_id) {
                        await connection.execute(
                            `UPDATE product_variants
                            SET quantity = quantity + ?
                            WHERE id = ?`,
                            [line.refund_qty, line.variant_id]
                        );
                    }

                    await connection.execute(
                        `UPDATE order_details
                        SET refunded_quantity = refunded_quantity + ?
                        WHERE id = ?`,
                        [line.refund_qty, line.id]
                    );
                }

                // Reverse loyalty proportionally to this refund chunk
                if (order.customer_id && refundAmount > 0) {
                    try {
                        const orderTotal = Math.max(0, Number(order.total_amount) || 0);
                        const ratio = orderTotal > 0
                            ? Math.min(1, Number(refundAmount) / orderTotal)
                            : 0;
                        const reverseEarn = Math.round((Number(order.points_earned) || 0) * ratio);
                        const reverseRedeem = Math.round((Number(order.points_redeemed) || 0) * ratio);
                        await createLoyaltyRepository(db).reverseOrderLoyalty(connection, {
                            customerId: order.customer_id,
                            orderId,
                            pointsEarned: reverseEarn,
                            pointsRedeemed: reverseRedeem,
                            netSpend: refundAmount,
                            createdBy: userId
                        });
                    } catch (error) {
                        if (!(error && (error.code === "ER_NO_SUCH_TABLE" || error.errno === 1146
                            || error.code === "ER_BAD_FIELD_ERROR" || error.errno === 1054))) {
                            throw error;
                        }
                    }
                }

                // Full refund restores promotion usage capacity
                if (nextStatus === "refunded" && (order.promotion_id || order.coupon_code)) {
                    try {
                        if (order.promotion_id) {
                            await connection.execute(
                                `UPDATE promotions
                                SET used_count = GREATEST(0, used_count - 1)
                                WHERE id = ?`,
                                [order.promotion_id]
                            );
                        } else if (order.coupon_code) {
                            await connection.execute(
                                `UPDATE promotions
                                SET used_count = GREATEST(0, used_count - 1)
                                WHERE UPPER(code) = UPPER(?)`,
                                [order.coupon_code]
                            );
                        }
                    } catch (error) {
                        if (!(error && (error.code === "ER_NO_SUCH_TABLE" || error.errno === 1146
                            || error.code === "ER_BAD_FIELD_ERROR" || error.errno === 1054))) {
                            throw error;
                        }
                    }
                }

                await connection.execute(
                    `UPDATE orders
                    SET status = ?,
                        void_reason = COALESCE(?, void_reason),
                        voided_at = CASE WHEN ? IN ('refunded', 'partial_refund') THEN NOW() ELSE voided_at END,
                        voided_by = COALESCE(?, voided_by),
                        refunded_amount = refunded_amount + ?
                    WHERE id = ?`,
                    [nextStatus, reason, nextStatus, userId, refundAmount, orderId]
                );

                await connection.commit();
                return {
                    orderId,
                    status: nextStatus,
                    refund_amount: refundAmount,
                    shift_id: order.shift_id || null,
                    payment_method: order.payment_method || null
                };
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        },

        async findDetailsById(orderId) {
            const [rows] = await db.execute(
                `SELECT
                    o.id AS order_id,
                    COALESCE(c.name, 'Khách lẻ') AS customer_name,
                    c.phone AS customer_phone,
                    c.email AS customer_email,
                    u.username,
                    st.code AS table_code,
                    st.name AS table_name,
                    o.source,
                    o.status,
                    o.coupon_code,
                    o.discount_percent,
                    o.subtotal_amount,
                    o.discount_amount,
                    o.manual_discount_type,
                    o.manual_discount_value,
                    o.payment_method,
                    o.amount_paid,
                    o.change_amount,
                    o.void_reason,
                    o.voided_at,
                    o.voided_by,
                    o.refunded_amount,
                    od.id AS order_detail_id,
                    od.product_id,
                    p.name AS product_name,
                    od.quantity,
                    od.refunded_quantity,
                    od.price,
                    od.cost_price,
                    o.total_amount,
                    o.created_at
                FROM orders o
                LEFT JOIN customers c ON o.customer_id = c.id
                LEFT JOIN users u ON o.user_id = u.id
                LEFT JOIN store_tables st ON o.table_id = st.id
                JOIN order_details od ON o.id = od.order_id
                LEFT JOIN products p ON od.product_id = p.id
                WHERE o.id = ?`,
                [orderId]
            );
            return rows;
        },

        async findAll(filters = {}) {
            const where = [];
            const params = [];

            if (filters.status) {
                where.push("o.status = ?");
                params.push(String(filters.status));
            }
            if (filters.source) {
                where.push("o.source = ?");
                params.push(String(filters.source));
            }
            if (filters.payment_method) {
                where.push("o.payment_method = ?");
                params.push(String(filters.payment_method));
            }
            if (filters.from) {
                where.push("o.created_at >= ?");
                params.push(filters.from);
            }
            if (filters.to) {
                where.push("o.created_at <= ?");
                params.push(filters.to);
            }
            if (filters.user_id) {
                where.push("o.user_id = ?");
                params.push(Number(filters.user_id));
            }

            const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

            const selectSql = `SELECT
                    o.id,
                    COALESCE(c.name, 'Khách lẻ') AS customer_name,
                    u.username,
                    st.code AS table_code,
                    st.name AS table_name,
                    o.source,
                    o.status,
                    o.payment_method,
                    o.total_amount,
                    o.refunded_amount,
                    o.created_at
                FROM orders o
                LEFT JOIN customers c ON o.customer_id = c.id
                LEFT JOIN users u ON o.user_id = u.id
                LEFT JOIN store_tables st ON o.table_id = st.id
                ${whereSql}
                ORDER BY o.id DESC`;

            if (!filters.paginate) {
                const [rows] = await db.execute(selectSql, params);
                return { items: rows, total: rows.length };
            }

            const [countRows] = await db.execute(
                `SELECT COUNT(*) AS total
                FROM orders o
                ${whereSql}`,
                params
            );
            const limit = Number(filters.limit) || 50;
            const offset = Number(filters.offset) || 0;
            const [rows] = await db.execute(
                `${selectSql} LIMIT ${limit} OFFSET ${offset}`,
                params
            );
            return {
                items: rows,
                total: Number(countRows[0]?.total || 0)
            };
        },

        async finalizePendingPayment(orderId) {
            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();
                const [rows] = await connection.execute(
                    `SELECT * FROM orders WHERE id = ? FOR UPDATE`, [orderId]
                );
                const order = rows[0];
                if (!order) {
                    const error = new Error("Không tìm thấy hóa đơn");
                    error.status = 404;
                    throw error;
                }
                if (order.status !== "payment_pending" || order.payment_status !== "pending") {
                    const error = new Error("Hóa đơn không còn chờ thanh toán");
                    error.status = 409;
                    throw error;
                }

                const pointsEarned = Number(order.points_earned) || 0;
                const pointsRedeemed = Number(order.points_redeemed) || 0;
                if (order.customer_id) {
                    const [custRows] = await connection.execute(
                        "SELECT lifetime_spend FROM customers WHERE id = ?", [order.customer_id]
                    );
                    const prevSpend = Number(custRows[0]?.lifetime_spend) || 0;
                    await createLoyaltyRepository(db).applyCheckoutLoyalty(connection, {
                        customerId: order.customer_id,
                        orderId: order.id,
                        pointsEarned,
                        pointsRedeemed,
                        netSpend: Number(order.total_amount) || 0,
                        newTier: resolveTierFromSpend(prevSpend + Number(order.total_amount || 0)),
                        createdBy: order.user_id
                    });
                }

                await connection.execute(
                    `UPDATE stock_movements SET type = ?, note = 'POS checkout after bank confirmation'
                     WHERE ref_type = 'order' AND ref_id = ? AND type = ?`,
                    [STOCK_TYPES.SALE, order.id, STOCK_TYPES.RESERVE_OUT]
                );
                await connection.execute(
                    `UPDATE orders SET status = 'completed', payment_status = 'paid',
                        amount_paid = total_amount WHERE id = ?`,
                    [order.id]
                );
                await connection.commit();
                return {
                    order_id: Number(order.id),
                    status: "completed",
                    payment_status: "paid",
                    shift_id: order.shift_id ? Number(order.shift_id) : null,
                    payment_method: order.payment_method,
                    total_amount: Number(order.total_amount)
                };
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        },

        async cancelPendingPayment(orderId, reason) {
            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();
                const [rows] = await connection.execute(
                    `SELECT * FROM orders WHERE id = ? FOR UPDATE`, [orderId]
                );
                const order = rows[0];
                if (!order || order.status !== "payment_pending" || order.payment_status !== "pending") {
                    await connection.rollback();
                    return { cancelled: false };
                }
                const [lines] = await connection.execute(
                    `SELECT product_id, variant_id, quantity, cost_price FROM order_details WHERE order_id = ?`,
                    [order.id]
                );
                for (const line of lines) {
                    if (line.variant_id) {
                        await connection.execute(
                            "UPDATE product_variants SET quantity = quantity + ? WHERE id = ?",
                            [line.quantity, line.variant_id]
                        );
                    }
                    await applyMovementOnConnection(connection, {
                        product_id: line.product_id,
                        type: STOCK_TYPES.RESERVE_RELEASE,
                        qty: line.quantity,
                        unit_cost: line.cost_price,
                        ref_type: "order",
                        ref_id: order.id,
                        note: reason,
                        created_by: order.user_id
                    });
                }
                if (order.promotion_id) {
                    await connection.execute(
                        "UPDATE promotions SET used_count = GREATEST(0, used_count - 1) WHERE id = ?",
                        [order.promotion_id]
                    );
                }
                await connection.execute(
                    `UPDATE orders SET status = 'cancelled', payment_status = 'expired', void_reason = ?
                     WHERE id = ?`, [reason, order.id]
                );
                await connection.commit();
                return { cancelled: true, order_id: Number(order.id) };
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        },

        async findLatest(limit = 5) {
            const safeLimit = sanitizeLimit(limit);

            const [rows] = await db.execute(
                `SELECT
                    o.id,
                    COALESCE(c.name, 'Khách lẻ') AS customer_name,
                    u.username,
                    st.code AS table_code,
                    st.name AS table_name,
                    o.source,
                    o.status,
                    o.total_amount,
                    o.created_at
                FROM orders o
                LEFT JOIN customers c ON o.customer_id = c.id
                LEFT JOIN users u ON o.user_id = u.id
                LEFT JOIN store_tables st ON o.table_id = st.id
                ORDER BY o.id DESC
                LIMIT ${safeLimit}`
            );
            return rows;
        }
    };
}

module.exports = {
    createOrdersRepository,
    sanitizeLimit
};
