const assert = require("node:assert/strict");
const test = require("node:test");
const { createStockService } = require("../../../src/modules/stock/service");
const { STOCK_TYPES } = require("../../../src/modules/stock/types");

test("purchaseIn requires auth and lines", async () => {
    const service = createStockService({
        applyMovements: async () => []
    });

    await assert.rejects(() => service.purchaseIn({ lines: [] }, null), { status: 401 });
    await assert.rejects(
        () => service.purchaseIn({ lines: [] }, { id: 1 }),
        { status: 400 }
    );
});

test("purchaseIn applies purchase_in movements", async () => {
    const calls = [];
    const service = createStockService({
        applyMovements: async (movements) => {
            calls.push(movements);
            return movements.map((m, i) => ({ ...m, movement_id: i + 1 }));
        }
    });

    const result = await service.purchaseIn({
        note: "Nhập lô 1",
        lines: [{ product_id: 7, qty: 5, unit_cost: 1000000 }]
    }, { id: 2 });

    assert.equal(result.movements.length, 1);
    assert.equal(calls[0][0].type, STOCK_TYPES.PURCHASE_IN);
    assert.equal(calls[0][0].created_by, 2);
});

test("adjust requires note and supports out direction", async () => {
    const calls = [];
    const service = createStockService({
        applyMovements: async (movements) => {
            calls.push(movements);
            return movements;
        }
    });

    await assert.rejects(
        () => service.adjust({
            direction: "out",
            lines: [{ product_id: 1, qty: 1 }]
        }, { id: 1 }),
        { status: 400 }
    );

    await service.adjust({
        direction: "out",
        note: "Hư hỏng",
        lines: [{ product_id: 1, qty: 1 }]
    }, { id: 1 });

    assert.equal(calls[0][0].type, STOCK_TYPES.ADJUST_OUT);
});
