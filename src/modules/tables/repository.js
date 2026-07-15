function createTablesRepository(db) {
    return {
        async findAll() {
            const [rows] = await db.execute(
                `SELECT id, code, name, qr_token, is_active, created_at, updated_at
                FROM store_tables
                ORDER BY code`
            );
            return rows;
        },

        async findActiveByToken(token) {
            const [rows] = await db.execute(
                `SELECT id, code, name, qr_token
                FROM store_tables
                WHERE qr_token = ? AND is_active = 1`,
                [token]
            );
            return rows[0] || null;
        },

        async findAvailableProducts() {
            const [rows] = await db.execute(
                `SELECT id, category_id, name, sku, price, original_price, quantity, image
                FROM products
                WHERE quantity > 0
                ORDER BY name`
            );
            return rows;
        },

        async create(table) {
            const [result] = await db.execute(
                `INSERT INTO store_tables (code, name, qr_token, is_active)
                VALUES (?, ?, ?, ?)`,
                [table.code, table.name, table.qr_token, table.is_active]
            );
            return result;
        },

        async update(id, table) {
            const [result] = await db.execute(
                `UPDATE store_tables
                SET code = ?,
                    name = ?,
                    qr_token = COALESCE(?, qr_token),
                    is_active = ?
                WHERE id = ?`,
                [table.code, table.name, table.qr_token, table.is_active, id]
            );
            return result;
        },

        async setActive(id, isActive) {
            const [result] = await db.execute(
                "UPDATE store_tables SET is_active = ? WHERE id = ?",
                [isActive, id]
            );
            return result;
        }
    };
}

module.exports = {
    createTablesRepository
};
