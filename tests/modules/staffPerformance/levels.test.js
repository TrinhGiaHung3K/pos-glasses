const assert = require("node:assert/strict");
const test = require("node:test");

test("buildStaffPerformanceView returns NULL as the lowest staff level", () => {
    const {
        buildStaffPerformanceView
    } = require("../../../src/modules/staffPerformance/levels");

    const view = buildStaffPerformanceView({
        id: 2,
        username: "staff01",
        role: "staff",
        member_order_count: 0,
        order_count: 0,
        total_revenue: 0
    });

    assert.equal(view.level.code, "NULL");
    assert.equal(view.level.discount_percent, 0);
    assert.equal(view.next_level.code, "Bronze");
    assert.equal(view.progress.percent, 0);
    assert.equal(view.progress.remaining_member_orders, 5);
    assert.equal(view.progress.remaining_revenue, 5000000);
});

test("buildStaffPerformanceView levels up by member-attached barcode orders", () => {
    const {
        buildStaffPerformanceView
    } = require("../../../src/modules/staffPerformance/levels");

    const view = buildStaffPerformanceView({
        id: 2,
        username: "staff01",
        role: "staff",
        member_order_count: 20,
        order_count: 22,
        total_revenue: 4000000
    });

    assert.equal(view.level.code, "Silver");
    assert.equal(view.level.discount_percent, 3);
    assert.equal(view.next_level.code, "Gold");
    assert.equal(view.progress.percent, 40);
    assert.equal(view.progress.remaining_member_orders, 30);
    assert.equal(view.progress.remaining_revenue, 56000000);
});

test("buildStaffPerformanceView marks Platinum as complete", () => {
    const {
        buildStaffPerformanceView
    } = require("../../../src/modules/staffPerformance/levels");

    const view = buildStaffPerformanceView({
        id: 2,
        username: "staff01",
        role: "staff",
        member_order_count: 101,
        order_count: 120,
        total_revenue: 151000000
    });

    assert.equal(view.level.code, "Platinum");
    assert.equal(view.level.discount_percent, 8);
    assert.equal(view.next_level, null);
    assert.equal(view.progress.percent, 100);
    assert.equal(view.progress.remaining_member_orders, 0);
    assert.equal(view.progress.remaining_revenue, 0);
});
