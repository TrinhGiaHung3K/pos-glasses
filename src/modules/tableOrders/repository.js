const { applyMovementOnConnection } = require("../stock/repository");
const { STOCK_TYPES } = require("../stock/types");

function buildInClause(values) {
    return values.map(() => "?").join(", ");
}

function groupRowsByOrder(rows) {
    if (rows.length === 0) {
        return null;
    }

    const first = rows[0];

    return {
        id: first.id,
        table_id: first.table_id,
        table_code: first.table_code,
        table_name: first.table_name,
        status: first.status,
        confirmed_order_id: first.confirmed_order_id,
        created_at: first.created_at,
        confirmed_at: first.confirmed_at,
        cancelled_at: first.cancelled_at,
        items: rows
            .filter((row) => row.item_id)
            .map((row) => ({
                id: row.item_id,
                product_id: row.product_id,
                quantity: row.quantity,
                unit_price_snapshot: row.unit_price_snapshot,
                product_name_snapshot: row.product_name_snapshot
            }))
    };
}

function createTableOrdersRepository(db) {
    return {
        async findActiveTableByToken(token) {
            const [rows] = await db.execute(
                `SELECT id, code, name
                FROM store_tables
                WHERE qr_token = ? AND is_active = 1`,
                [token]
            );
            return rows[0] || null;
        },

        async findProductsByIds(ids) {
            if (!ids.length) {
                return [];
            }

            const [rows] = await db.execute(
                `SELECT id, name, price, original_price, quantity, cost_price, original_cost_price
                FROM products
                WHERE id IN (${buildInClause(ids)})`,
                ids
            );
            return rows;
        },

        async createPendingTableOrder(request) {
            const connection = await db.getConnection();

            try {
                await connection.beginTransaction();

                const [orderResult] = await connection.execute(
                    `INSERT INTO table_orders (table_id, status)
                    VALUES (?, 'pending')`,
                    [request.table_id]
                );

                for (const item of request.items) {
                    await connection.execute(
                        `INSERT INTO table_order_items
                        (table_order_id, product_id, quantity, unit_price_snapshot, product_name_snapshot)
                        VALUES (?, ?, ?, ?, ?)`,
                        [
                            orderResult.insertId,
                            item.product_id,
                            item.quantity,
                            item.unit_price_snapshot,
                            item.product_name_snapshot
                        ]
                    );
                }

                await connection.commit();
                return orderResult;
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        },

        async findPending() {
            const [rows] = await db.execute(
                `SELECT
                    tor.id,
                    tor.table_id,
                    st.code AS table_code,
                    st.name AS table_name,
                    tor.status,
                    tor.created_at,
                    COUNT(toi.id) AS item_count,
                    SUM(toi.quantity * toi.unit_price_snapshot) AS total_amount
                FROM table_orders tor
                JOIN store_tables st ON st.id = tor.table_id
                LEFT JOIN table_order_items toi ON toi.table_order_id = tor.id
                WHERE tor.status = 'pending'
                GROUP BY tor.id, tor.table_id, st.code, st.name, tor.status, tor.created_at
                ORDER BY tor.created_at ASC`
            );
            return rows;
        },

        async findOrderWithItems(id) {
            const [rows] = await db.execute(
                `SELECT
                    tor.id,
                    tor.table_id,
                    st.code AS table_code,
                    st.name AS table_name,
                    tor.status,
                    tor.confirmed_order_id,
                    tor.created_at,
                    tor.confirmed_at,
                    tor.cancelled_at,
                    toi.id AS item_id,
                    toi.product_id,
                    toi.quantity,
                    toi.unit_price_snapshot,
                    toi.product_name_snapshot
                FROM table_orders tor
                JOIN store_tables st ON st.id = tor.table_id
                LEFT JOIN table_order_items toi ON toi.table_order_id = tor.id
                WHERE tor.id = ?
                ORDER BY toi.id`,
                [id]
            );
            return groupRowsByOrder(rows);
        },

        async findPendingOrderWithItems(id) {
            const [rows] = await db.execute(
                `SELECT
                    tor.id,
                    tor.table_id,
                    st.code AS table_code,
                    st.name AS table_name,
                    tor.status,
                    tor.confirmed_order_id,
                    tor.created_at,
                    tor.confirmed_at,
                    tor.cancelled_at,
                    toi.id AS item_id,
                    toi.product_id,
                    toi.quantity,
                    toi.unit_price_snapshot,
                    toi.product_name_snapshot
                FROM table_orders tor
                JOIN store_tables st ON st.id = tor.table_id
                LEFT JOIN table_order_items toi ON toi.table_order_id = tor.id
                WHERE tor.id = ? AND tor.status = 'pending'
                ORDER BY toi.id`,
                [id]
            );
            return groupRowsByOrder(rows);
        },

        async confirmPendingOrder(request) {
            const connection = await db.getConnection();

            try {
                await connection.beginTransaction();

                for (const item of request.items) {
                    const [stockRows] = await connection.execute(
                        "SELECT quantity, cost_price FROM products WHERE id = ? FOR UPDATE",
                        [item.product_id]
                    );
                    const stock = stockRows[0];

                    if (!stock || Number(stock.quantity) < item.quantity) {
                        const error = new Error("Not enough stock");
                        error.status = 400;
                        throw error;
                    }

                    item.cost_price = item.cost_price != null
                        ? item.cost_price
                        : (Number(stock.cost_price) || 0);
                }

                const [orderResult] = await connection.execute(
                    `INSERT INTO orders
                    (customer_id, user_id, table_id, table_order_id, source, status,
                     subtotal_amount, discount_amount, total_amount,
                     coupon_code, discount_percent, payment_method, amount_paid, change_amount)
                    VALUES (NULL, ?, ?, ?, 'qr', 'completed', ?, 0, ?, NULL, 0, 'cash', ?, 0)`,
                    [
                        request.user_id,
                        request.table_id,
                        request.table_order_id,
                        request.total_amount,
                        request.total_amount,
                        request.total_amount
                    ]
                );

                for (const item of request.items) {
                    await connection.execute(
                        `INSERT INTO order_details
                        (order_id, product_id, quantity, price, cost_price, refunded_quantity)
                        VALUES (?, ?, ?, ?, ?, 0)`,
                        [
                            orderResult.insertId,
                            item.product_id,
                            item.quantity,
                            item.price,
                            item.cost_price != null ? item.cost_price : 0
                        ]
                    );
                    await applyMovementOnConnection(connection, {
                        product_id: item.product_id,
                        type: STOCK_TYPES.SALE,
                        qty: item.quantity,
                        unit_cost: item.cost_price,
                        ref_type: "order",
                        ref_id: orderResult.insertId,
                        note: "QR table confirm",
                        created_by: request.user_id
                    });
                }

                await connection.execute(
                    `UPDATE table_orders
                    SET status = 'confirmed',
                        confirmed_order_id = ?,
                        confirmed_at = NOW()
                    WHERE id = ? AND status = 'pending'`,
                    [orderResult.insertId, request.table_order_id]
                );

                await connection.commit();

                return {
                    orderId: orderResult.insertId
                };
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        },

        async cancelPendingOrder(id) {
            const [result] = await db.execute(
                `UPDATE table_orders
                SET status = 'cancelled',
                    cancelled_at = NOW()
                WHERE id = ? AND status = 'pending'`,
                [id]
            );
            return result;
        }
    };
}

module.exports = {
    createTableOrdersRepository
};
