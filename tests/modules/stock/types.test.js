const assert = require("node:assert/strict");
const test = require("node:test");
const { stockDelta, STOCK_TYPES, ALL_STOCK_TYPES } = require("../../../src/modules/stock/types");

test("stockDelta decreases for sale and adjust_out", () => {
    assert.equal(stockDelta(STOCK_TYPES.SALE, 3), -3);
    assert.equal(stockDelta(STOCK_TYPES.ADJUST_OUT, 2), -2);
    assert.equal(stockDelta(STOCK_TYPES.RESERVE_OUT, 1), -1);
});

test("stockDelta increases for inbound types", () => {
    assert.equal(stockDelta(STOCK_TYPES.SALE_VOID, 3), 3);
    assert.equal(stockDelta(STOCK_TYPES.PURCHASE_IN, 10), 10);
    assert.equal(stockDelta(STOCK_TYPES.ADJUST_IN, 1), 1);
    assert.equal(stockDelta(STOCK_TYPES.RETURN_IN, 4), 4);
    assert.equal(stockDelta(STOCK_TYPES.RESERVE_RELEASE, 2), 2);
});

test("all stock types are registered", () => {
    assert.equal(ALL_STOCK_TYPES.size, 8);
});
