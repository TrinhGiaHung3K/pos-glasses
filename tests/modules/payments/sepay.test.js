const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const { createSePayProvider } = require("../../../src/modules/payments/providers/sepay");

test("SePay provider accepts API key and HMAC signatures", () => {
    const provider = createSePayProvider({ webhookSecret: "secret" });
    const body = JSON.stringify({ id: 1 });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = crypto.createHmac("sha256", "secret").update(`${timestamp}.${body}`).digest("hex");
    assert.equal(provider.verifyWebhook({ authorization: "Apikey secret" }, body), true);
    assert.equal(provider.verifyWebhook({
        "x-sepay-signature": `sha256=${signature}`,
        "x-sepay-timestamp": timestamp
    }, body), true);
    assert.equal(provider.verifyWebhook({
        "x-sepay-signature": "sha256=bad",
        "x-sepay-timestamp": timestamp
    }, body), false);
    assert.equal(provider.verifyWebhook({
        "x-sepay-signature": `sha256=${signature}`,
        "x-sepay-timestamp": String(Number(timestamp) - 3600)
    }, body), false);
});

test("SePay provider normalizes incoming transaction", () => {
    const provider = createSePayProvider({ webhookSecret: "secret" });
    const tx = provider.normalizeTransaction({
        id: 92704,
        accountNumber: "1017588888",
        subAccount: "002470",
        transferType: "in",
        transferAmount: 2900,
        content: "PGTABC",
        referenceCode: "FT1",
        transactionDate: "2026-07-13 10:00:00"
    });
    assert.equal(tx.provider_transaction_id, "92704");
    assert.equal(tx.amount, 2900);
    assert.equal(tx.transfer_content, "PGTABC");
    assert.equal(tx.sub_account, "002470");
});
