const assert = require("node:assert/strict");
const test = require("node:test");
const { parseListQuery, listResponse } = require("../../src/utils/pagination");

test("parseListQuery defaults to non-paginate legacy mode", () => {
    const info = parseListQuery({});
    assert.equal(info.paginate, false);
    assert.equal(info.page, 1);
});

test("parseListQuery enables paginate when page or limit set", () => {
    const info = parseListQuery({ page: "2", limit: "10" });
    assert.equal(info.paginate, true);
    assert.equal(info.page, 2);
    assert.equal(info.limit, 10);
    assert.equal(info.offset, 10);
});

test("listResponse returns bare array when not paginating", () => {
    const items = [{ id: 1 }];
    assert.deepEqual(listResponse(items, { paginate: false, page: 1, limit: 50, total: 1 }), items);
});

test("listResponse returns envelope when paginating", () => {
    const out = listResponse([{ id: 1 }], { paginate: true, page: 1, limit: 10, total: 25 });
    assert.equal(out.total, 25);
    assert.equal(out.total_pages, 3);
    assert.equal(out.items.length, 1);
});
