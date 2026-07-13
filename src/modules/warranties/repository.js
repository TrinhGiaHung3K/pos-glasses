function createWarrantiesRepository(db) {
    return {
        async findBySerial(serial) {
            const [rows] = await db.execute(
                `SELECT w.*,
                    c.name AS customer_name,
                    c.phone AS customer_phone,
                    p.name AS product_name,
                    p.sku AS product_sku
                FROM warranties w
                LEFT JOIN customers c ON c.id = w.customer_id
                LEFT JOIN products p ON p.id = w.product_id
                WHERE w.serial_number = ?
                LIMIT 1`,
                [serial]
            );
            return rows[0] || null;
        },

        async findById(id) {
            const [rows] = await db.execute(
                `SELECT w.*,
                    c.name AS customer_name,
                    p.name AS product_name
                FROM warranties w
                LEFT JOIN customers c ON c.id = w.customer_id
                LEFT JOIN products p ON p.id = w.product_id
                WHERE w.id = ?
                LIMIT 1`,
                [id]
            );
            return rows[0] || null;
        },

        async list({ q = "", page = 1, limit = 30, status = null } = {}) {
            const where = [];
            const params = [];
            if (q) {
                where.push("(w.serial_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)");
                const like = `%${q}%`;
                params.push(like, like, like);
            }
            if (status) {
                where.push("w.status = ?");
                params.push(status);
            }
            const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
            const safeLimit = Math.min(100, Math.max(1, Number(limit) || 30));
            const safePage = Math.max(1, Number(page) || 1);
            const offset = (safePage - 1) * safeLimit;

            const [countRows] = await db.execute(
                `SELECT COUNT(*) AS total
                FROM warranties w
                LEFT JOIN customers c ON c.id = w.customer_id
                ${whereSql}`,
                params
            );
            const [items] = await db.execute(
                `SELECT w.*,
                    c.name AS customer_name,
                    c.phone AS customer_phone,
                    p.name AS product_name
                FROM warranties w
                LEFT JOIN customers c ON c.id = w.customer_id
                LEFT JOIN products p ON p.id = w.product_id
                ${whereSql}
                ORDER BY w.id DESC
                LIMIT ${safeLimit} OFFSET ${offset}`,
                params
            );

            return {
                items,
                page: safePage,
                limit: safeLimit,
                total: Number(countRows[0]?.total || 0)
            };
        },

        async create(row) {
            const [result] = await db.execute(
                `INSERT INTO warranties
                (order_id, product_id, customer_id, serial_number, months,
                 start_date, end_date, note, status, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    row.order_id,
                    row.product_id,
                    row.customer_id,
                    row.serial_number,
                    row.months,
                    row.start_date,
                    row.end_date,
                    row.note,
                    row.status || "active",
                    row.created_by
                ]
            );
            return this.findById(result.insertId);
        },

        async updateStatus(id, status, note) {
            await db.execute(
                `UPDATE warranties SET status = ?, note = COALESCE(?, note) WHERE id = ?`,
                [status, note, id]
            );
            return this.findById(id);
        }
    };
}

module.exports = {
    createWarrantiesRepository
};
