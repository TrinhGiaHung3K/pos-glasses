const assert = require("node:assert/strict");
const test = require("node:test");
const { createPaymentsService } = require("../../../src/modules/payments/service");
const { createFakePaymentProvider } = require("../../../src/modules/payments/providers/fake");

function harness(overrides = {}) {
    const intents = [];
    const transactions = [];
    const deliveries = new Set();
    const repository = {
        async recordDelivery(delivery) {
            if (deliveries.has(delivery.delivery_key)) return { inserted: false };
            deliveries.add(delivery.delivery_key);
            return { inserted: true, id: deliveries.size };
        },
        async createIntent(intent) {
            const row = { id: 1, ...intent, status: "pending", received_amount: 0 };
            intents.push(row);
            return row;
        },
        async findIntentByPublicId(id) {
            return intents.find((row) => row.public_id === id) || null;
        },
        async findPendingIntentByContent(content) {
            return intents.find((row) => row.status === "pending" && content.includes(row.transfer_content)) || null;
        },
        async recordTransaction(tx) {
            if (transactions.some((row) => row.provider_transaction_id === tx.provider_transaction_id)) {
                return { inserted: false };
            }
            transactions.push(tx);
            return { inserted: true, id: transactions.length };
        },
        async markTestIntentPaid(id, amount) {
            const row = intents.find((item) => item.id === id && item.is_test);
            if (!row || row.status !== "pending") return false;
            row.status = "paid";
            row.received_amount = amount;
            return true;
        },
        async markOrderIntentPaid(id, amount) {
            const row = intents.find((item) => item.id === id && !item.is_test);
            if (!row || row.status !== "processing") return false;
            row.status = "paid";
            row.received_amount = amount;
            return true;
        },
        async claimOrderIntent(id) {
            const row = intents.find((item) => item.id === id && !item.is_test && item.status === "pending");
            if (!row) return false;
            row.status = "processing";
            return true;
        },
        async markNeedsReview(id) {
            const row = intents.find((item) => item.id === id);
            if (row) row.status = "needs_review";
        },
        ...overrides.repository
    };
    const service = createPaymentsService(repository, {
        config: {
            testMode: true,
            testAmount: 2900,
            intentTtlMinutes: 10,
            bankCode: "VCB",
            accountNumber: "123456789",
            allowSimulation: true,
            ...overrides.config
        },
        provider: overrides.provider || createFakePaymentProvider(),
        ordersService: overrides.ordersService
    });
    return { service, intents, transactions };
}

test("admin creates an isolated 2,900 VND verification intent", async () => {
    const { service, intents } = harness();
    const result = await service.createTestIntent({ id: 1, role: "admin" });
    assert.equal(result.expected_amount, 2900);
    assert.equal(result.is_test, true);
    assert.equal(result.status, "pending");
    assert.match(result.transfer_content, /^PGT[A-F0-9]{10}$/);
    assert.equal(result.account_number_masked, "*****6789");
    assert.equal(intents[0].order_id, undefined);
});

test("test intent is unavailable when feature flag is off", async () => {
    const { service } = harness({ config: { testMode: false } });
    await assert.rejects(() => service.createTestIntent({ id: 1, role: "admin" }), { status: 404 });
});

test("non-admin cannot create verification intent", async () => {
    const { service } = harness();
    await assert.rejects(() => service.createTestIntent({ id: 2, role: "staff" }), { status: 403 });
});

test("matching webhook pays test intent and duplicate is idempotent", async () => {
    const { service, intents, transactions } = harness();
    const intent = await service.createTestIntent({ id: 1, role: "admin" });
    const payload = {
        id: 9001,
        accountNumber: "123456789",
        transferType: "in",
        transferAmount: 2900,
        content: `${intent.transfer_content} test`
    };
    const first = await service.handleWebhook({}, JSON.stringify(payload), payload);
    const second = await service.handleWebhook({}, JSON.stringify(payload), payload);
    assert.equal(first.matched, true);
    assert.equal(second.duplicate, true);
    assert.equal(intents[0].status, "paid");
    assert.equal(transactions.length, 1);
});

test("wrong amount is recorded but never pays test intent", async () => {
    const { service, intents, transactions } = harness();
    const intent = await service.createTestIntent({ id: 1, role: "admin" });
    const payload = {
        id: 9002,
        accountNumber: "123456789",
        transferType: "in",
        transferAmount: 3000,
        content: intent.transfer_content
    };
    const result = await service.handleWebhook({}, JSON.stringify(payload), payload);
    assert.equal(result.match_status, "amount_mismatch");
    assert.equal(intents[0].status, "pending");
    assert.equal(transactions[0].match_status, "amount_mismatch");
});

test("real order intent reserves through orders service and finalizes only after webhook", async () => {
    const calls = [];
    const ordersService = {
        async checkout(payload, user, meta) {
            calls.push(["checkout", payload, user, meta]);
            return { order_id: 55, total_amount: 3200000, payment_status: "pending" };
        },
        async finalizePendingPayment(orderId) {
            calls.push(["finalize", orderId]);
            return { order_id: orderId, payment_status: "paid" };
        },
        async cancelPendingPayment(orderId, reason) {
            calls.push(["cancel", orderId, reason]);
        }
    };
    const { service, intents } = harness({ ordersService });
    const intent = await service.createOrderIntent({
        items: [{ product_id: 7, quantity: 1 }]
    }, { id: 2, role: "staff" });
    assert.equal(intent.order_id, 55);
    assert.equal(intent.expected_amount, 3200000);
    assert.equal(calls[0][3].deferPayment, true);
    assert.equal(calls.some((call) => call[0] === "finalize"), false);

    const payload = {
        id: 9010,
        accountNumber: "123456789",
        transferType: "in",
        transferAmount: 3200000,
        content: intent.transfer_content
    };
    await service.handleWebhook({}, JSON.stringify(payload), payload);
    assert.deepEqual(calls.find((call) => call[0] === "finalize"), ["finalize", 55]);
    assert.equal(intents[0].status, "paid");
});

test("fake provider can simulate a pending payment outside production", async () => {
    const calls = [];
    const ordersService = {
        async checkout() { return { order_id: 56, total_amount: 2900, payment_status: "pending" }; },
        async finalizePendingPayment(id) { calls.push(id); return { order_id: id, payment_status: "paid" }; },
        async cancelPendingPayment() {}
    };
    const { service, intents } = harness({ ordersService });
    const intent = await service.createOrderIntent({ items: [{ product_id: 7, quantity: 1 }] }, { id: 2, role: "staff" });
    const result = await service.simulatePayment(intent.public_id, { id: 2, role: "staff" });
    assert.equal(result.status, "paid");
    assert.equal(result.order_id, 56);
    assert.deepEqual(calls, [56]);
    assert.equal(intents[0].status, "paid");
});

test("payment simulation is hidden when disabled", async () => {
    const { service } = harness({ config: { allowSimulation: false } });
    await assert.rejects(
        () => service.simulatePayment("missing", { id: 2, role: "staff" }),
        { status: 404 }
    );
});
