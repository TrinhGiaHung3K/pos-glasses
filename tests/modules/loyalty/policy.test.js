const assert = require("node:assert/strict");
const test = require("node:test");
const {
    earnPointsFromTotal,
    redeemValueVnd,
    maxRedeemablePoints,
    resolveTierFromSpend,
    nextTierProgress
} = require("../../../src/modules/loyalty/policy");

test("earnPointsFromTotal: 1 point per 100k VND", () => {
    assert.equal(earnPointsFromTotal(0), 0);
    assert.equal(earnPointsFromTotal(99_999), 0);
    assert.equal(earnPointsFromTotal(100_000), 1);
    assert.equal(earnPointsFromTotal(3_250_000), 32);
});

test("redeemValueVnd: 1 point = 1000d", () => {
    assert.equal(redeemValueVnd(10), 10_000);
});

test("maxRedeemablePoints respects balance and 20% subtotal cap", () => {
    // subtotal 5M → max 20% = 1M → 1000 points; balance 50
    assert.equal(maxRedeemablePoints(5_000_000, 50), 50);
    // balance 5000 → capped by subtotal to 1000
    assert.equal(maxRedeemablePoints(5_000_000, 5000), 1000);
});

test("resolveTierFromSpend maps standard/silver/gold", () => {
    assert.equal(resolveTierFromSpend(0), "standard");
    assert.equal(resolveTierFromSpend(10_000_000), "silver");
    assert.equal(resolveTierFromSpend(30_000_000), "gold");
});

test("nextTierProgress toward silver", () => {
    const p = nextTierProgress(5_000_000);
    assert.equal(p.current_tier, "standard");
    assert.equal(p.next_tier, "silver");
    assert.equal(p.remaining_spend, 5_000_000);
});
