const assert = require("node:assert/strict");
const test = require("node:test");
const {
    resolvePromotionLifecycle,
    remainingUses,
    usageProgressPercent
} = require("../../../src/modules/promotions/lifecycle");

const today = new Date("2026-07-10T12:00:00");

test("lifecycle disabled when is_active is 0", () => {
    assert.equal(
        resolvePromotionLifecycle({ is_active: 0, discount_percent: 10 }, today),
        "disabled"
    );
});

test("lifecycle scheduled before start_date", () => {
    assert.equal(
        resolvePromotionLifecycle({
            is_active: 1,
            start_date: "2026-08-01",
            end_date: "2026-08-31",
            discount_percent: 10
        }, today),
        "scheduled"
    );
});

test("lifecycle expired after end_date", () => {
    assert.equal(
        resolvePromotionLifecycle({
            is_active: 1,
            start_date: "2026-01-01",
            end_date: "2026-06-30",
            discount_percent: 10
        }, today),
        "expired"
    );
});

test("lifecycle exhausted when used_count reaches max_uses", () => {
    assert.equal(
        resolvePromotionLifecycle({
            is_active: 1,
            max_uses: 5,
            used_count: 5,
            discount_percent: 10
        }, today),
        "exhausted"
    );
});

test("lifecycle live when active and in window", () => {
    assert.equal(
        resolvePromotionLifecycle({
            is_active: 1,
            start_date: "2026-01-01",
            end_date: "2026-12-31",
            max_uses: 100,
            used_count: 3,
            discount_percent: 10
        }, today),
        "live"
    );
});

test("remainingUses and usage progress", () => {
    assert.equal(remainingUses({ max_uses: null, used_count: 5 }), null);
    assert.equal(remainingUses({ max_uses: 10, used_count: 3 }), 7);
    assert.equal(usageProgressPercent({ max_uses: 10, used_count: 5 }), 50);
    assert.equal(usageProgressPercent({ max_uses: null }), null);
});
