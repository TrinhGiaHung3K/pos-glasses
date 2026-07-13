const assert = require("node:assert/strict");
const test = require("node:test");
const { createOrdersRepository } = require("../../../src/modules/orders/repository");

function connectionFor(mode, events) {
    return {
        async beginTransaction() { events.push("begin"); },
        async commit() { events.push("commit"); },
        async rollback() { events.push("rollback"); },
        release() { events.push("release"); },
        async execute(sql) {
            const normalized = sql.replace(/\s+/g, " ").trim();
            events.push(normalized);
            if (/SELECT \* FROM orders/.test(normalized)) return [[{
                id: 55, status: "payment_pending", payment_status: "pending",
                customer_id: null, user_id: 2, shift_id: 3, payment_method: "bank_transfer",
                total_amount: 3200000, promotion_id: null
            }]];
            if (/FROM order_details/.test(normalized)) return [[{ product_id: 7, variant_id: null, quantity: 1, cost_price: 1000 }]];
            if (/FROM products/.test(normalized)) return [[{ id: 7, name: "RayBan", quantity: mode === "cancel" ? 4 : 5, cost_price: 1000 }]];
            if (/INSERT INTO stock_movements/.test(normalized)) return [{ insertId: 8 }];
            return [{ affectedRows: 1 }];
        }
    };
}

test("finalize pending payment atomically converts reservation to sale", async () => {
    const events = [];
    const repo = createOrdersRepository({ getConnection: async () => connectionFor("finalize", events) });
    const result = await repo.finalizePendingPayment(55);
    assert.equal(result.payment_status, "paid");
    assert.ok(events.some((sql) => typeof sql === "string" && /UPDATE stock_movements SET type/.test(sql)));
    assert.ok(events.some((sql) => typeof sql === "string" && /payment_status = 'paid'/.test(sql)));
    assert.deepEqual(events.slice(-2), ["commit", "release"]);
});

test("expired pending payment releases reserved stock", async () => {
    const events = [];
    const repo = createOrdersRepository({ getConnection: async () => connectionFor("cancel", events) });
    const result = await repo.cancelPendingPayment(55, "expired");
    assert.equal(result.cancelled, true);
    assert.ok(events.some((sql) => typeof sql === "string" && /INSERT INTO stock_movements/.test(sql)));
    assert.ok(events.some((sql) => typeof sql === "string" && /payment_status = 'expired'/.test(sql)));
    assert.deepEqual(events.slice(-2), ["commit", "release"]);
});
