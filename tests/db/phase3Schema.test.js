const assert = require("node:assert/strict");
const test = require("node:test");
const { ensurePhase3Schema, ORDER_COLUMNS } = require("../../src/db/phase3Schema");

test("phase3 ORDER_COLUMNS includes shift_id", () => {
    assert.ok(ORDER_COLUMNS.some((c) => c.name === "shift_id"));
});

test("ensurePhase3Schema is idempotent with mock empty schema", async () => {
    const created = new Set();
    const columns = new Map();

    const db = {
        async execute(sql, params = []) {
            const text = String(sql);
            if (text.includes("information_schema.TABLES")) {
                const name = params[0];
                return [created.has(name) ? [{ TABLE_NAME: name }] : []];
            }
            if (text.includes("information_schema.COLUMNS")) {
                const table = params[0];
                const existing = columns.get(table) || new Set();
                const names = params.slice(1).filter((n) => existing.has(n));
                return [names.map((COLUMN_NAME) => ({ COLUMN_NAME }))];
            }
            if (text.startsWith("CREATE TABLE")) {
                const m = text.match(/CREATE TABLE `([^`]+)`/);
                if (m) created.add(m[1]);
                return [{ affectedRows: 0 }];
            }
            if (text.startsWith("ALTER TABLE")) {
                const m = text.match(/ALTER TABLE `([^`]+)` ADD COLUMN `([^`]+)`/);
                if (m) {
                    if (!columns.has(m[1])) columns.set(m[1], new Set());
                    columns.get(m[1]).add(m[2]);
                }
                return [{ affectedRows: 0 }];
            }
            return [[]];
        }
    };

    const first = await ensurePhase3Schema(db);
    assert.equal(first.shiftsCreated, true);
    assert.equal(first.prescriptionsCreated, true);
    assert.equal(first.warrantiesCreated, true);
    assert.equal(first.suppliersCreated, true);
    assert.equal(first.purchaseOrdersCreated, true);
    assert.ok(first.orderColumns.includes("shift_id"));

    const second = await ensurePhase3Schema(db);
    assert.equal(second.shiftsCreated, false);
    assert.equal(second.prescriptionsCreated, false);
    assert.deepEqual(second.orderColumns, []);
});
