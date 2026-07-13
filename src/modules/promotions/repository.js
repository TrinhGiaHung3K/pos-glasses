function createPromotionsRepository(db) {
    return {
        async findByCode(code) {
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
                    description,
                    start_date,
                    end_date
                FROM promotions
                WHERE UPPER(code) = UPPER(?)
                LIMIT 1`,
                [code]
            );
            return rows;
        },

        async findAll() {
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
                    description,
                    start_date,
                    end_date
                FROM promotions
                ORDER BY id DESC`
            );
            return rows;
        },

        async findById(id) {
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
                    description,
                    start_date,
                    end_date
                FROM promotions
                WHERE id = ?
                LIMIT 1`,
                [id]
            );
            return rows[0] || null;
        },

        async create(promo) {
            const [result] = await db.execute(
                `INSERT INTO promotions
                (code, discount_type, discount_percent, discount_value,
                 min_order_amount, max_uses, used_count, is_active,
                 description, start_date, end_date)
                VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
                [
                    promo.code,
                    promo.discount_type,
                    promo.discount_percent,
                    promo.discount_value,
                    promo.min_order_amount,
                    promo.max_uses,
                    promo.is_active,
                    promo.description,
                    promo.start_date,
                    promo.end_date
                ]
            );
            return result;
        },

        async update(id, promo) {
            const [result] = await db.execute(
                `UPDATE promotions
                SET code = ?,
                    discount_type = ?,
                    discount_percent = ?,
                    discount_value = ?,
                    min_order_amount = ?,
                    max_uses = ?,
                    is_active = ?,
                    description = ?,
                    start_date = ?,
                    end_date = ?
                WHERE id = ?`,
                [
                    promo.code,
                    promo.discount_type,
                    promo.discount_percent,
                    promo.discount_value,
                    promo.min_order_amount,
                    promo.max_uses,
                    promo.is_active,
                    promo.description,
                    promo.start_date,
                    promo.end_date,
                    id
                ]
            );
            return result;
        },

        async setActive(id, isActive) {
            const [result] = await db.execute(
                `UPDATE promotions
                SET is_active = ?
                WHERE id = ?`,
                [isActive ? 1 : 0, id]
            );
            return result;
        },

        async remove(id) {
            const [result] = await db.execute(
                "DELETE FROM promotions WHERE id = ?",
                [id]
            );
            return result;
        }
    };
}

module.exports = {
    createPromotionsRepository
};
