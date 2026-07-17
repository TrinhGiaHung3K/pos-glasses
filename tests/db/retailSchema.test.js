const assert = require("node:assert/strict");
const test = require("node:test");
const { ensureRetailOnlySchema, safeIdentifier } = require("../../src/db/retailSchema");

test("safeIdentifier rejects SQL identifier injection", () => {
    assert.equal(safeIdentifier("idx_orders_table_id"), "`idx_orders_table_id`");
    assert.throws(() => safeIdentifier("x; DROP TABLE users"), /Unsafe/);
});

test("retail schema cleanup removes obsolete table-ordering objects", async () => {
    const executed = [];
    const responses = [
        [[{ TABLE_NAME: "table_order_items" }]],
        [[]],
        [[{ CONSTRAINT_NAME: "fk_orders_store_table" }]],
        [[{ INDEX_NAME: "idx_orders_table_id" }]],
        [[{ COLUMN_NAME: "table_id" }, { COLUMN_NAME: "table_order_id" }]],
        [[{ TABLE_NAME: "store_tables" }]]
    ];
    const db = {
        async execute(sql, params) {
            executed.push({ sql, params });
            if (/^(?:DROP|ALTER)/.test(sql)) return [{ affectedRows: 0 }];
            return responses.shift();
        }
    };

    const result = await ensureRetailOnlySchema(db);

    assert.deepEqual(result.droppedTables, ["table_order_items", "store_tables"]);
    assert.deepEqual(result.droppedColumns.sort(), ["table_id", "table_order_id"]);
    assert.match(executed.map((entry) => entry.sql).join("\n"), /DROP FOREIGN KEY `fk_orders_store_table`/);
    assert.match(executed.map((entry) => entry.sql).join("\n"), /DROP INDEX `idx_orders_table_id`/);
});
