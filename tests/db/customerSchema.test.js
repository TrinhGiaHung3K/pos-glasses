const assert = require("node:assert/strict");
const test = require("node:test");

test("ensureCustomerMemberColumns adds membership columns, backfills, and indexes", async () => {
    const { ensureCustomerMemberColumns, CUSTOMER_MEMBER_COLUMNS, CUSTOMER_MEMBER_INDEXES } = require("../../src/db/customerSchema");
    const calls = [];
    const db = {
        async execute(sql, params) {
            const normalizedSql = sql.replace(/\s+/g, " ").trim();
            calls.push({ sql: normalizedSql, params });

            if (sql.includes("information_schema.COLUMNS")) {
                return [[]];
            }

            if (sql.includes("information_schema.STATISTICS")) {
                return [[]];
            }

            return [{ affectedRows: 1 }];
        }
    };

    const result = await ensureCustomerMemberColumns(db);

    assert.deepEqual(result.addedColumns, CUSTOMER_MEMBER_COLUMNS.map((c) => c.name));
    assert.deepEqual(result.addedIndexes, CUSTOMER_MEMBER_INDEXES.map((i) => i.name));
    assert.match(calls[1].sql, /ALTER TABLE `customers` ADD COLUMN `member_code`/);
    assert.equal(
        calls.filter((call) => call.sql.startsWith("UPDATE `customers` c JOIN")).length,
        1
    );
    assert.match(
        calls.find((c) => c.sql.startsWith("UPDATE `customers` c JOIN")).sql,
        /CONCAT\('29', LPAD\(`id`, 10, '0'\)\)/
    );
    assert.ok(calls.some((c) => c.sql.includes("member_since")));
    assert.ok(calls.some((c) => c.sql.includes("idx_customers_phone")));
});

test("ensureCustomerMemberColumns backfills existing schema without re-adding columns", async () => {
    const { ensureCustomerMemberColumns, CUSTOMER_MEMBER_COLUMNS, CUSTOMER_MEMBER_INDEXES } = require("../../src/db/customerSchema");
    const calls = [];
    const db = {
        async execute(sql, params) {
            const normalizedSql = sql.replace(/\s+/g, " ").trim();
            calls.push({ sql: normalizedSql, params });

            if (sql.includes("information_schema.COLUMNS")) {
                return [CUSTOMER_MEMBER_COLUMNS.map((c) => ({ COLUMN_NAME: c.name }))];
            }

            if (sql.includes("information_schema.STATISTICS")) {
                return [CUSTOMER_MEMBER_INDEXES.map((i) => ({ INDEX_NAME: i.name }))];
            }

            return [{ affectedRows: 1 }];
        }
    };

    const result = await ensureCustomerMemberColumns(db);

    assert.deepEqual(result.addedColumns, []);
    assert.deepEqual(result.addedIndexes, []);
    assert.equal(
        calls.filter((call) => call.sql.startsWith("UPDATE `customers` c JOIN")).length,
        1
    );
    assert.equal(
        calls.filter((call) => call.sql.startsWith("ALTER TABLE `customers`")).length,
        0
    );
});
