function staffPerformanceSelect(whereClause = "") {
    return `SELECT
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
        ${whereClause}
        GROUP BY u.id, u.username, u.role`;
}

function createStaffPerformanceRepository(db) {
    return {
        async findByUserId(userId) {
            const [rows] = await db.execute(
                `${staffPerformanceSelect("WHERE u.id = ?")}
                LIMIT 1`,
                [userId]
            );
            return rows[0] || null;
        },

        async findAll() {
            const [rows] = await db.execute(
                `${staffPerformanceSelect("WHERE u.role IN ('admin', 'staff')")}
                ORDER BY total_revenue DESC, member_order_count DESC, u.id ASC`
            );
            return rows;
        }
    };
}

module.exports = {
    createStaffPerformanceRepository,
    staffPerformanceSelect
};
