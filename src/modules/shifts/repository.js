function createShiftsRepository(db) {
    return {
        async findOpenByUser(userId) {
            const [rows] = await db.execute(
                `SELECT * FROM shifts
                WHERE user_id = ? AND status = 'open'
                ORDER BY id DESC
                LIMIT 1`,
                [userId]
            );
            return rows[0] || null;
        },

        async findById(id) {
            const [rows] = await db.execute(
                `SELECT s.*, u.username AS opened_by_name
                FROM shifts s
                LEFT JOIN users u ON u.id = s.user_id
                WHERE s.id = ?
                LIMIT 1`,
                [id]
            );
            return rows[0] || null;
        },

        async list({ page = 1, limit = 30, userId = null, status = null } = {}) {
            const where = [];
            const params = [];
            if (userId) {
                where.push("s.user_id = ?");
                params.push(Number(userId));
            }
            if (status) {
                where.push("s.status = ?");
                params.push(String(status));
            }
            const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
            const safeLimit = Math.min(100, Math.max(1, Number(limit) || 30));
            const safePage = Math.max(1, Number(page) || 1);
            const offset = (safePage - 1) * safeLimit;

            const [countRows] = await db.execute(
                `SELECT COUNT(*) AS total FROM shifts s ${whereSql}`,
                params
            );
            const [items] = await db.execute(
                `SELECT s.*, u.username AS opened_by_name
                FROM shifts s
                LEFT JOIN users u ON u.id = s.user_id
                ${whereSql}
                ORDER BY s.id DESC
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

        async open({ userId, openingCash, note }) {
            const [result] = await db.execute(
                `INSERT INTO shifts (user_id, status, opening_cash, note)
                VALUES (?, 'open', ?, ?)`,
                [userId, openingCash, note]
            );
            return this.findById(result.insertId);
        },

        async close({ id, closingCash, expectedCash, variance, closedBy, note }) {
            await db.execute(
                `UPDATE shifts
                SET status = 'closed',
                    closed_at = NOW(),
                    closing_cash = ?,
                    expected_cash = ?,
                    variance = ?,
                    closed_by = ?,
                    note = COALESCE(?, note)
                WHERE id = ? AND status = 'open'`,
                [closingCash, expectedCash, variance, closedBy, note, id]
            );
            return this.findById(id);
        },

        /**
         * Called after successful POS checkout (best-effort).
         */
        async recordSale(shiftId, { paymentMethod, totalAmount }) {
            if (!shiftId) return;
            const method = String(paymentMethod || "cash");
            const total = Math.max(0, Number(totalAmount) || 0);
            const cashCol = method === "cash" ? total : 0;
            const cardCol = method === "card" ? total : 0;
            const bankCol = method === "bank_transfer" ? total : 0;

            await db.execute(
                `UPDATE shifts
                SET order_count = order_count + 1,
                    cash_sales = cash_sales + ?,
                    card_sales = card_sales + ?,
                    bank_sales = bank_sales + ?
                WHERE id = ? AND status = 'open'`,
                [cashCol, cardCol, bankCol, shiftId]
            );
        },

        async recordVoid(shiftId) {
            if (!shiftId) return;
            await db.execute(
                `UPDATE shifts
                SET void_count = void_count + 1
                WHERE id = ?`,
                [shiftId]
            );
        },

        async recomputeFromOrders(shiftId) {
            // Net sales = total_amount - refunded_amount for open/completed statuses
            const [rows] = await db.execute(
                `SELECT
                    COALESCE(SUM(CASE WHEN status IN ('completed','partial_refund') THEN 1 ELSE 0 END), 0) AS order_count,
                    COALESCE(SUM(CASE WHEN payment_method = 'cash'
                        AND status IN ('completed','partial_refund')
                        THEN (total_amount - IFNULL(refunded_amount, 0)) ELSE 0 END), 0) AS cash_sales,
                    COALESCE(SUM(CASE WHEN payment_method = 'card'
                        AND status IN ('completed','partial_refund')
                        THEN (total_amount - IFNULL(refunded_amount, 0)) ELSE 0 END), 0) AS card_sales,
                    COALESCE(SUM(CASE WHEN payment_method = 'bank_transfer'
                        AND status IN ('completed','partial_refund')
                        THEN (total_amount - IFNULL(refunded_amount, 0)) ELSE 0 END), 0) AS bank_sales,
                    COALESCE(SUM(CASE WHEN status IN ('voided', 'refunded') THEN 1 ELSE 0 END), 0) AS void_count
                FROM orders
                WHERE shift_id = ?`,
                [shiftId]
            );
            const stats = rows[0] || {};
            await db.execute(
                `UPDATE shifts
                SET order_count = ?,
                    cash_sales = ?,
                    card_sales = ?,
                    bank_sales = ?,
                    void_count = ?
                WHERE id = ?`,
                [
                    Number(stats.order_count) || 0,
                    Number(stats.cash_sales) || 0,
                    Number(stats.card_sales) || 0,
                    Number(stats.bank_sales) || 0,
                    Number(stats.void_count) || 0,
                    shiftId
                ]
            );
            return this.findById(shiftId);
        }
    };
}

module.exports = {
    createShiftsRepository
};
