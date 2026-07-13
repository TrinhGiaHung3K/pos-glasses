const assert = require("node:assert/strict");
const test = require("node:test");
const { ensurePaymentSchema } = require("../../src/db/paymentSchema");

test("payment schema creates intent/transaction/delivery tables and order payment status", async () => {
    const sql = [];
    const db = {
        async execute(statement) {
            sql.push(statement);
            if (/information_schema\.COLUMNS/.test(statement)) return [[]];
            return [{ affectedRows: 0 }];
        }
    };
    const result = await ensurePaymentSchema(db);
    const combined = sql.join("\n");
    assert.match(combined, /CREATE TABLE IF NOT EXISTS `payment_intents`/);
    assert.match(combined, /CREATE TABLE IF NOT EXISTS `payment_transactions`/);
    assert.match(combined, /CREATE TABLE IF NOT EXISTS `payment_webhook_deliveries`/);
    assert.match(combined, /ADD COLUMN `payment_status`/);
    assert.deepEqual(result.orderColumns, ["payment_status"]);
});
