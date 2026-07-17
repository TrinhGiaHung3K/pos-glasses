function rangeToDates(range, from, to) {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    let start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const normalized = String(range || "today").toLowerCase();

    if (normalized === "7d") {
        start.setDate(start.getDate() - 6);
    } else if (normalized === "30d") {
        start.setDate(start.getDate() - 29);
    } else if (normalized === "custom" && from && to) {
        start = new Date(from);
        start.setHours(0, 0, 0, 0);
        const customEnd = new Date(to);
        customEnd.setHours(23, 59, 59, 999);
        return { start, end: customEnd, label: "custom" };
    }

    return {
        start,
        end,
        label: normalized === "7d" || normalized === "30d" ? normalized : "today"
    };
}

function previousPeriod(start, end) {
    const duration = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - duration);
    return { start: prevStart, end: prevEnd };
}

function toMysqlDateTime(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function deltaPct(current, previous) {
    if (!previous) {
        return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 1000) / 10;
}

function createDashboardRepository(db) {
    return {
        async getSummary(query = {}) {
            const { start, end, label } = rangeToDates(query.range, query.from, query.to);
            const prev = previousPeriod(start, end);
            const startSql = toMysqlDateTime(start);
            const endSql = toMysqlDateTime(end);
            const prevStartSql = toMysqlDateTime(prev.start);
            const prevEndSql = toMysqlDateTime(prev.end);

            const [[catalog]] = await db.execute(
                `SELECT
                    (SELECT COUNT(*) FROM products) AS totalProducts,
                    (SELECT COUNT(*) FROM customers) AS totalCustomers,
                    (SELECT COUNT(*) FROM products WHERE quantity <= 5) AS lowStockCount`
            );

            const [[period]] = await db.execute(
                `SELECT
                    COUNT(*) AS totalOrders,
                    IFNULL(SUM(total_amount - IFNULL(refunded_amount, 0)), 0) AS totalRevenue
                FROM orders
                WHERE status IN ('completed', 'partial_refund')
                  AND created_at BETWEEN ? AND ?`,
                [startSql, endSql]
            );

            const [[costRow]] = await db.execute(
                `SELECT IFNULL(SUM(
                    (od.quantity - IFNULL(od.refunded_quantity, 0)) * IFNULL(od.cost_price, 0)
                ), 0) AS totalCost
                FROM order_details od
                JOIN orders o ON o.id = od.order_id
                WHERE o.status IN ('completed', 'partial_refund', 'refunded')
                  AND o.created_at BETWEEN ? AND ?`,
                [startSql, endSql]
            );

            const [[members]] = await db.execute(
                `SELECT COUNT(*) AS newMembers
                FROM customers
                WHERE (created_at BETWEEN ? AND ?)
                   OR (member_since BETWEEN ? AND ?)`,
                [startSql, endSql, startSql, endSql]
            );

            const [[prevTotals]] = await db.execute(
                `SELECT
                    COUNT(*) AS totalOrders,
                    IFNULL(SUM(total_amount - IFNULL(refunded_amount, 0)), 0) AS totalRevenue
                FROM orders
                WHERE status IN ('completed', 'partial_refund')
                  AND created_at BETWEEN ? AND ?`,
                [prevStartSql, prevEndSql]
            );

            const [series] = await db.execute(
                `SELECT
                    DATE(created_at) AS day,
                    COUNT(*) AS order_count,
                    IFNULL(SUM(total_amount - IFNULL(refunded_amount, 0)), 0) AS revenue
                FROM orders
                WHERE status IN ('completed', 'partial_refund')
                  AND created_at BETWEEN ? AND ?
                GROUP BY DATE(created_at)
                ORDER BY day ASC`,
                [startSql, endSql]
            );

            const [topProducts] = await db.execute(
                `SELECT
                    p.id,
                    p.name,
                    p.sku,
                    SUM(od.quantity - IFNULL(od.refunded_quantity, 0)) AS qty_sold,
                    SUM((od.quantity - IFNULL(od.refunded_quantity, 0)) * od.price) AS revenue
                FROM order_details od
                JOIN orders o ON o.id = od.order_id
                LEFT JOIN products p ON p.id = od.product_id
                WHERE o.status IN ('completed', 'partial_refund', 'refunded')
                  AND o.created_at BETWEEN ? AND ?
                GROUP BY p.id, p.name, p.sku
                HAVING qty_sold > 0
                ORDER BY revenue DESC
                LIMIT 8`,
                [startSql, endSql]
            );

            const [topStaff] = await db.execute(
                `SELECT
                    u.id,
                    u.username,
                    COUNT(o.id) AS order_count,
                    IFNULL(SUM(o.total_amount - IFNULL(o.refunded_amount, 0)), 0) AS revenue
                FROM orders o
                JOIN users u ON u.id = o.user_id
                WHERE o.status IN ('completed', 'partial_refund')
                  AND o.created_at BETWEEN ? AND ?
                GROUP BY u.id, u.username
                ORDER BY revenue DESC
                LIMIT 8`,
                [startSql, endSql]
            );

            const revenue = Number(period.totalRevenue || 0);
            const cost = Number(costRow.totalCost || 0);
            const orderCount = Number(period.totalOrders || 0);
            const prevRevenue = Number(prevTotals.totalRevenue || 0);
            const prevOrders = Number(prevTotals.totalOrders || 0);
            const grossProfit = revenue - cost;

            return {
                totalProducts: Number(catalog.totalProducts || 0),
                totalCustomers: Number(catalog.totalCustomers || 0),
                totalOrders: orderCount,
                totalRevenue: revenue,
                range: label,
                from: startSql,
                to: endSql,
                revenue,
                order_count: orderCount,
                aov: orderCount ? Math.round(revenue / orderCount) : 0,
                cost,
                gross_profit: grossProfit,
                margin_percent: revenue > 0
                    ? Math.round((grossProfit / revenue) * 1000) / 10
                    : 0,
                new_members: Number(members.newMembers || 0),
                low_stock_count: Number(catalog.lowStockCount || 0),
                previous: {
                    revenue: prevRevenue,
                    order_count: prevOrders,
                    revenue_delta_percent: deltaPct(revenue, prevRevenue),
                    order_delta_percent: deltaPct(orderCount, prevOrders)
                },
                series: series.map((row) => ({
                    day: row.day,
                    order_count: Number(row.order_count || 0),
                    revenue: Number(row.revenue || 0)
                })),
                top_products: topProducts,
                top_staff: topStaff
            };
        }
    };
}

module.exports = {
    createDashboardRepository,
    rangeToDates
};
