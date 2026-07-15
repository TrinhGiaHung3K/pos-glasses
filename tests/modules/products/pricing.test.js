const assert = require("node:assert/strict");
const test = require("node:test");
const {
    commercialUnitPrice,
    commercialUnitCost,
    chargeUnitPrice,
    presentProductPricing,
    scaleAbsoluteDiscount
} = require("../../../src/modules/products/pricing");

test("commercialUnitPrice prefers original_price", () => {
    assert.equal(commercialUnitPrice({ price: 3200, original_price: 3200000 }), 3200000);
    assert.equal(commercialUnitPrice({ price: 3200 }), 3200);
    assert.equal(commercialUnitPrice({ price: "2890.00", original_price: "2890000.00" }), 2890000);
});

test("commercialUnitCost prefers original_cost_price including zero", () => {
    assert.equal(commercialUnitCost({ cost_price: 1, original_cost_price: 1000000 }), 1000000);
    assert.equal(commercialUnitCost({ cost_price: 500, original_cost_price: 0 }), 0);
    assert.equal(commercialUnitCost({ cost_price: 500 }), 500);
});

test("chargeUnitPrice uses demo price only in test mode", () => {
    const product = { price: 3200, original_price: 3200000 };
    assert.equal(chargeUnitPrice(product, { testMode: true }), 3200);
    assert.equal(chargeUnitPrice(product, { testMode: false }), 3200000);
});

test("presentProductPricing exposes commercial price on price field", () => {
    const presented = presentProductPricing({
        id: 1,
        price: 3200,
        original_price: 3200000,
        cost_price: 1000,
        original_cost_price: 1000000
    });
    assert.equal(presented.price, 3200000);
    assert.equal(presented.cost_price, 1000000);
    assert.equal(presented.charge_price, 3200);
    assert.equal(presented.demo_price, 3200);
    assert.equal(presented.original_price, 3200000);
});

test("scaleAbsoluteDiscount keeps proportional QR discounts", () => {
    assert.equal(scaleAbsoluteDiscount(50000, 3200000, 3200), 50);
    assert.equal(scaleAbsoluteDiscount(0, 3200000, 3200), 0);
    assert.equal(scaleAbsoluteDiscount(100, 0, 3200), 100);
});
