const assert = require("node:assert/strict");
const test = require("node:test");

test("findLatest sanitizes limit before building SQL", async () => {
    const { createOrdersRepository } = require("../../../src/modules/orders/repository");

    let executedSql = "";
    let executedParams;

    const repository = createOrdersRepository({
        execute: async (sql, params) => {
            executedSql = sql;
            executedParams = params;
            return [[{ id: 1 }]];
        }
    });

    const rows = await repository.findLatest("5abc");

    assert.deepEqual(rows, [{ id: 1 }]);
    assert.match(executedSql, /LIMIT 5\b/);
    assert.equal(executedParams, undefined);
});

test("findDetailsById selects POS payment summary fields", async () => {
    const { createOrdersRepository } = require("../../../src/modules/orders/repository");

    let executedSql = "";

    const repository = createOrdersRepository({
        execute: async (sql) => {
            executedSql = sql;
            return [[{ order_id: 1 }]];
        }
    });

    await repository.findDetailsById(1);

    assert.match(executedSql, /o\.subtotal_amount/);
    assert.match(executedSql, /o\.discount_amount/);
    assert.match(executedSql, /o\.payment_method/);
    assert.match(executedSql, /o\.amount_paid/);
    assert.match(executedSql, /o\.change_amount/);
});
