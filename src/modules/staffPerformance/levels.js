const STAFF_LEVELS = [
    {
        code: "NULL",
        label: "NULL",
        min_member_orders: 0,
        min_revenue: 0,
        discount_percent: 0
    },
    {
        code: "Bronze",
        label: "Bronze",
        min_member_orders: 5,
        min_revenue: 5000000,
        discount_percent: 1
    },
    {
        code: "Silver",
        label: "Silver",
        min_member_orders: 20,
        min_revenue: 20000000,
        discount_percent: 3
    },
    {
        code: "Gold",
        label: "Gold",
        min_member_orders: 50,
        min_revenue: 60000000,
        discount_percent: 5
    },
    {
        code: "Platinum",
        label: "Platinum",
        min_member_orders: 100,
        min_revenue: 150000000,
        discount_percent: 8
    }
];

function toMetricNumber(value) {
    return Math.max(0, Number(value || 0));
}

function normalizeMetrics(metrics = {}) {
    return {
        id: Number(metrics.id || 0),
        username: metrics.username || "",
        role: metrics.role || "staff",
        member_order_count: Math.round(toMetricNumber(metrics.member_order_count)),
        order_count: Math.round(toMetricNumber(metrics.order_count)),
        total_revenue: Math.round(toMetricNumber(metrics.total_revenue))
    };
}

function resolveStaffLevel(metrics = {}) {
    const normalized = normalizeMetrics(metrics);
    let currentLevel = STAFF_LEVELS[0];

    for (const level of STAFF_LEVELS) {
        if (
            normalized.member_order_count >= level.min_member_orders ||
            normalized.total_revenue >= level.min_revenue
        ) {
            currentLevel = level;
        }
    }

    return currentLevel;
}

function getNextLevel(level) {
    const index = STAFF_LEVELS.findIndex((item) => item.code === level.code);
    return index >= 0 ? STAFF_LEVELS[index + 1] || null : STAFF_LEVELS[1];
}

function buildProgress(metrics, nextLevel) {
    const normalized = normalizeMetrics(metrics);

    if (!nextLevel) {
        return {
            percent: 100,
            member_order_target: normalized.member_order_count,
            revenue_target: normalized.total_revenue,
            remaining_member_orders: 0,
            remaining_revenue: 0
        };
    }

    const orderProgress = nextLevel.min_member_orders > 0
        ? normalized.member_order_count / nextLevel.min_member_orders
        : 1;
    const revenueProgress = nextLevel.min_revenue > 0
        ? normalized.total_revenue / nextLevel.min_revenue
        : 1;

    return {
        percent: Math.max(0, Math.min(100, Math.round(Math.max(orderProgress, revenueProgress) * 100))),
        member_order_target: nextLevel.min_member_orders,
        revenue_target: nextLevel.min_revenue,
        remaining_member_orders: Math.max(0, nextLevel.min_member_orders - normalized.member_order_count),
        remaining_revenue: Math.max(0, nextLevel.min_revenue - normalized.total_revenue)
    };
}

function buildStaffPerformanceView(metrics = {}) {
    const normalized = normalizeMetrics(metrics);
    const level = resolveStaffLevel(normalized);
    const nextLevel = getNextLevel(level);

    return {
        ...normalized,
        level,
        next_level: nextLevel,
        progress: buildProgress(normalized, nextLevel)
    };
}

module.exports = {
    STAFF_LEVELS,
    buildStaffPerformanceView,
    resolveStaffLevel
};
