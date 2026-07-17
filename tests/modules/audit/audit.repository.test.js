const assert = require("node:assert/strict");
const test = require("node:test");
const { createAuditRepository } = require("../../../src/modules/audit/repository");

test("list skips COUNT by default and uses limit+1 for has_more", async () => {
    const calls = [];
    const rows = Array.from({ length: 51 }, (_, i) => ({
        id: 100 - i,
        actor_id: 1,
        action: "order.checkout",
        entity_type: "order",
        entity_id: i + 1,
        payload_json: null,
        ip: "127.0.0.1",
        created_at: "2026-07-17 10:00:00"
    }));

    const repository = createAuditRepository({
        query: async (sql, params) => {
            calls.push({ sql, params });
            return [rows];
        },
        execute: async (sql, params) => {
            calls.push({ sql, params });
            return [rows];
        }
    });

    const result = await repository.list({ page: 1, limit: 50 });

    assert.equal(calls.length, 1);
    assert.doesNotMatch(calls[0].sql, /COUNT\s*\(/i);
    assert.match(calls[0].sql, /LIMIT 51\b/);
    assert.match(calls[0].sql, /ORDER BY id DESC/);
    assert.equal(result.items.length, 50);
    assert.equal(result.has_more, true);
    assert.equal(result.total, null);
    assert.equal(result.page, 1);
    assert.equal(result.limit, 50);
});

test("list sets total when last page has no more rows", async () => {
    const rows = [
        { id: 2, action: "auth.login_success", entity_type: "user" },
        { id: 1, action: "auth.login_failed", entity_type: "user" }
    ];

    const repository = createAuditRepository({
        query: async () => [rows]
    });

    const result = await repository.list({ page: 1, limit: 50 });

    assert.equal(result.has_more, false);
    assert.equal(result.total, 2);
    assert.equal(result.items.length, 2);
});

test("list filters by entity_type and optionally counts in parallel", async () => {
    const calls = [];
    const repository = createAuditRepository({
        query: async (sql, params) => {
            calls.push({ sql: String(sql), params });
            if (/COUNT/i.test(sql)) {
                return [[{ total: 3 }]];
            }
            return [[
                { id: 3, entity_type: "order" },
                { id: 2, entity_type: "order" },
                { id: 1, entity_type: "order" }
            ]];
        }
    });

    const result = await repository.list({
        page: 1,
        limit: 50,
        entity_type: "order",
        include_total: true
    });

    assert.equal(calls.length, 2);
    assert.ok(calls.some((c) => /COUNT/i.test(c.sql)));
    assert.ok(calls.some((c) => /entity_type\s*=\s*\?/.test(c.sql)));
    assert.deepEqual(
        calls.find((c) => /entity_type/.test(c.sql) && !/COUNT/i.test(c.sql)).params,
        ["order"]
    );
    assert.equal(result.total, 3);
    assert.equal(result.has_more, false);
    assert.equal(result.items.length, 3);
});

test("list sanitizes page and clamps limit", async () => {
    let seenSql = "";
    const repository = createAuditRepository({
        query: async (sql) => {
            seenSql = String(sql);
            return [[]];
        }
    });

    const result = await repository.list({ page: "abc", limit: 999 });

    assert.equal(result.page, 1);
    assert.equal(result.limit, 100);
    assert.match(seenSql, /LIMIT 101\b/);
    assert.match(seenSql, /OFFSET 0\b/);
});
