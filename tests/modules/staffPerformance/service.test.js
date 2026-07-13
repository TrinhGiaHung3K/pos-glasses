const assert = require("node:assert/strict");
const test = require("node:test");

test("staff performance service maps current user metrics to a ranked view", async () => {
    const {
        createStaffPerformanceService
    } = require("../../../src/modules/staffPerformance/service");
    const service = createStaffPerformanceService({
        findByUserId: async (userId) => ({
            id: userId,
            username: "staff01",
            role: "staff",
            member_order_count: 5,
            order_count: 6,
            total_revenue: 1000000
        })
    });

    const view = await service.findCurrentUserPerformance(2);

    assert.equal(view.id, 2);
    assert.equal(view.level.code, "Bronze");
    assert.equal(view.level.discount_percent, 1);
});

test("staff performance service maps all users for admin leaderboard", async () => {
    const {
        createStaffPerformanceService
    } = require("../../../src/modules/staffPerformance/service");
    const service = createStaffPerformanceService({
        findAll: async () => [
            {
                id: 1,
                username: "admin",
                role: "admin",
                member_order_count: 50,
                order_count: 60,
                total_revenue: 61000000
            },
            {
                id: 2,
                username: "staff01",
                role: "staff",
                member_order_count: 0,
                order_count: 1,
                total_revenue: 1000000
            }
        ]
    });

    const rows = await service.listStaffPerformance();

    assert.equal(rows[0].level.code, "Gold");
    assert.equal(rows[1].level.code, "NULL");
    assert.equal(rows[1].progress.remaining_member_orders, 5);
});
