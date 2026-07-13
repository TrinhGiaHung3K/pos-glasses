const assert = require("node:assert/strict");
const test = require("node:test");

test("ensureOrderPaymentColumns adds only missing checkout columns", async () => {
    const { ensureOrderPaymentColumns } = require("../../src/db/checkoutSchema");
    const calls = [];
    const existingColumns = [
        "subtotal_amount",
        "discount_amount",
        "manual_discount_type"
    ];
    const db = {
        async execute(sql, params) {
            calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });

            if (sql.includes("information_schema.COLUMNS")) {
                return [
                    existingColumns.map((name) => ({
                        COLUMN_NAME: name
                    }))
                ];
            }

            return [{ affectedRows: 1 }];
        }
    };

    const result = await ensureOrderPaymentColumns(db);

    assert.deepEqual(result.addedColumns, [
        "manual_discount_value",
        "payment_method",
        "amount_paid",
        "change_amount"
    ]);
    assert.equal(
        calls.filter((call) => call.sql.startsWith("ALTER TABLE `orders` ADD COLUMN")).length,
        4
    );
    assert.match(calls.at(-1).sql, /^UPDATE `orders` SET `subtotal_amount`/);
});

test("ensureOrderPaymentColumns does not alter orders when checkout columns exist", async () => {
    const { ensureOrderPaymentColumns } = require("../../src/db/checkoutSchema");
    const calls = [];
    const db = {
        async execute(sql, params) {
            calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });

            if (sql.includes("information_schema.COLUMNS")) {
                return [
                    [
                        "subtotal_amount",
                        "discount_amount",
                        "manual_discount_type",
                        "manual_discount_value",
                        "payment_method",
                        "amount_paid",
                        "change_amount"
                    ].map((name) => ({
                        COLUMN_NAME: name
                    }))
                ];
            }

            return [{ affectedRows: 1 }];
        }
    };

    const result = await ensureOrderPaymentColumns(db);

    assert.deepEqual(result.addedColumns, []);
    assert.equal(
        calls.filter((call) => call.sql.startsWith("ALTER TABLE `orders` ADD COLUMN")).length,
        0
    );
});
