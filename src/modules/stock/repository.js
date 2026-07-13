const { stockDelta, ALL_STOCK_TYPES, STOCK_TYPES } = require("./types");

function sanitizeLimit(limit, fallback = 50, max = 200) {
    const parsed = Number.parseInt(limit, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
        return fallback;
    }
    return Math.min(parsed, max);
}

function sanitizePage(page) {
    const parsed = Number.parseInt(page, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
        return 1;
    }
    return parsed;
}

/**
 * Apply a single stock movement inside an existing transaction connection.
 * Always locks the product row (FOR UPDATE).
 */
async function applyMovementOnConnection(connection, movement) {
    const type = String(movement.type || "").trim();
    const productId = Number(movement.product_id);
    const qty = Math.abs(Number(movement.qty) || 0);

    if (!ALL_STOCK_TYPES.has(type)) {
        const error = new Error("Loại biến động kho không hợp lệ");
        error.status = 400;
        throw error;
    }

    if (!Number.isInteger(productId) || productId < 1) {
        const error = new Error("Sản phẩm không hợp lệ");
        error.status = 400;
        throw error;
    }

    if (!Number.isInteger(qty) || qty < 1) {
        const error = new Error("Số lượng biến động phải là số nguyên dương");
        error.status = 400;
        throw error;
    }

    const [rows] = await connection.execute(
        `SELECT id, name, quantity, cost_price
        FROM products
        WHERE id = ?
        FOR UPDATE`,
        [productId]
    );
    const product = rows[0];

    if (!product) {
        const error = new Error("Sản phẩm không tồn tại");
        error.status = 404;
        throw error;
    }

    const previousQty = Number(product.quantity) || 0;
    const delta = stockDelta(type, qty);
    const nextQty = previousQty + delta;

    if (nextQty < 0) {
        const error = new Error(
            `Sản phẩm ${product.name} không đủ tồn kho (còn ${previousQty})`
        );
        error.status = 400;
        throw error;
    }

    const unitCost = movement.unit_cost != null
        ? Number(movement.unit_cost)
        : Number(product.cost_price) || 0;

    // Weighted-average cost on purchase_in when unit_cost is provided
    let nextCost = Number(product.cost_price) || 0;
    if (
        type === STOCK_TYPES.PURCHASE_IN
        && movement.unit_cost != null
        && Number(movement.unit_cost) >= 0
        && nextQty > 0
    ) {
        const incomingCost = Number(movement.unit_cost) || 0;
        if (previousQty > 0 && nextCost > 0) {
            nextCost = Math.round(
                ((previousQty * nextCost) + (qty * incomingCost)) / nextQty
            );
        } else {
            nextCost = Math.round(incomingCost);
        }
    }

    await connection.execute(
        `UPDATE products
        SET quantity = ?,
            cost_price = ?
        WHERE id = ?`,
        [nextQty, nextCost, productId]
    );

    const [insertResult] = await connection.execute(
        `INSERT INTO stock_movements
        (product_id, type, qty, unit_cost, ref_type, ref_id, note, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            productId,
            type,
            qty,
            unitCost,
            movement.ref_type || null,
            movement.ref_id != null ? Number(movement.ref_id) : null,
            movement.note || null,
            movement.created_by != null ? Number(movement.created_by) : null
        ]
    );

    return {
        movement_id: insertResult.insertId,
        product_id: productId,
        product_name: product.name,
        type,
        qty,
        unit_cost: unitCost,
        previous_quantity: previousQty,
        quantity: nextQty,
        delta
    };
}

function createStockRepository(db) {
    return {
        applyMovementOnConnection,

        async withTransaction(work) {
            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();
                const result = await work(connection);
                await connection.commit();
                return result;
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        },

        async applyMovements(movements) {
            return this.withTransaction(async (connection) => {
                const results = [];
                for (const movement of movements) {
                    results.push(await applyMovementOnConnection(connection, movement));
                }
                return results;
            });
        },

        async listMovements({ product_id, type, page = 1, limit = 50 } = {}) {
            const safePage = sanitizePage(page);
            const safeLimit = sanitizeLimit(limit);
            const offset = (safePage - 1) * safeLimit;
            const where = [];
            const params = [];

            if (product_id) {
                where.push("sm.product_id = ?");
                params.push(Number(product_id));
            }
            if (type) {
                where.push("sm.type = ?");
                params.push(String(type));
            }

            const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

            const [countRows] = await db.execute(
                `SELECT COUNT(*) AS total
                FROM stock_movements sm
                ${whereSql}`,
                params
            );

            const [rows] = await db.execute(
                `SELECT
                    sm.id,
                    sm.product_id,
                    p.name AS product_name,
                    p.sku,
                    sm.type,
                    sm.qty,
                    sm.unit_cost,
                    sm.ref_type,
                    sm.ref_id,
                    sm.note,
                    sm.created_by,
                    u.username AS created_by_name,
                    sm.created_at
                FROM stock_movements sm
                JOIN products p ON p.id = sm.product_id
                LEFT JOIN users u ON u.id = sm.created_by
                ${whereSql}
                ORDER BY sm.id DESC
                LIMIT ${safeLimit} OFFSET ${offset}`,
                params
            );

            return {
                items: rows,
                page: safePage,
                limit: safeLimit,
                total: Number(countRows[0]?.total || 0)
            };
        },

        async getInventorySummary() {
            const [rows] = await db.execute(
                `SELECT
                    COUNT(*) AS total_skus,
                    IFNULL(SUM(quantity), 0) AS total_units,
                    IFNULL(SUM(quantity * cost_price), 0) AS stock_value,
                    SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END) AS out_of_stock,
                    SUM(CASE WHEN quantity > 0 AND quantity <= 5 THEN 1 ELSE 0 END) AS low_stock
                FROM products`
            );
            return rows[0];
        },

        async findLowStock(threshold = 5) {
            const safeThreshold = Math.max(0, Number(threshold) || 5);
            const [rows] = await db.execute(
                `SELECT id, name, sku, quantity, cost_price, price
                FROM products
                WHERE quantity <= ?
                ORDER BY quantity ASC, name ASC
                LIMIT 50`,
                [safeThreshold]
            );
            return rows;
        }
    };
}

module.exports = {
    createStockRepository,
    applyMovementOnConnection
};
