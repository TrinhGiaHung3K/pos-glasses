const assert = require("node:assert/strict");
const test = require("node:test");
const {
    isPromotionCurrentlyValid,
    resolvePromotionDiscount
} = require("../../../src/modules/orders/service");

test("promotion rejected when inactive", () => {
    const result = isPromotionCurrentlyValid({
        is_active: 0,
        discount_percent: 10
    }, 1000000);
    assert.equal(result.ok, false);
});

test("promotion rejected when expired", () => {
    const result = isPromotionCurrentlyValid({
        is_active: 1,
        end_date: "2020-01-01",
        discount_percent: 10
    }, 1000000);
    assert.equal(result.ok, false);
    assert.match(result.message, /hết hạn/i);
});

test("promotion rejected below min order", () => {
    const result = isPromotionCurrentlyValid({
        is_active: 1,
        min_order_amount: 5000000,
        discount_percent: 10
    }, 1000000);
    assert.equal(result.ok, false);
});

test("promotion rejected when max uses reached", () => {
    const result = isPromotionCurrentlyValid({
        is_active: 1,
        max_uses: 5,
        used_count: 5,
        discount_percent: 10
    }, 1000000);
    assert.equal(result.ok, false);
});

test("resolve percent and amount discounts", () => {
    const percent = resolvePromotionDiscount({
        discount_type: "percent",
        discount_percent: 10,
        discount_value: 10
    }, 1000000);
    assert.equal(percent.amount, 100000);

    const amount = resolvePromotionDiscount({
        discount_type: "amount",
        discount_value: 150000
    }, 1000000);
    assert.equal(amount.amount, 150000);
});
