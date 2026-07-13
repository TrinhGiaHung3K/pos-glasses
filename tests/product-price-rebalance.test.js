const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "..");
const dumpPath = path.join(rootDir, "scripts", "Dump20260704.sql");
const migrationPath = path.join(rootDir, "scripts", "2026-07-06-product-price-rebalance.sql");

const expectedPriceAnchors = [
    ["RB3025", "2990000.00"],
    ["RB001", "2890000.00"],
    ["OK007", "4890000.00"],
    ["GG006", "7990000.00"],
    ["PR006", "5990000.00"],
    ["DR004", "9490000.00"],
    ["PL004", "1690000.00"],
    ["GM002", "5990000.00"]
];

function read(filePath) {
    return fs.readFileSync(filePath, "utf8");
}

test("product price rebalance migration updates catalog prices by SKU", () => {
    assert.ok(fs.existsSync(migrationPath), "migration script should exist");

    const sql = read(migrationPath);

    assert.match(sql, /UPDATE\s+`products`\s+SET\s+`price`\s*=\s*CASE\s+`sku`/i);
    for (const [sku, price] of expectedPriceAnchors) {
        assert.match(sql, new RegExp(`WHEN '${sku}' THEN ${price.replace(".", "\\.")}`));
    }
    assert.doesNotMatch(sql, /UPDATE\s+`order_details`/i);
    assert.doesNotMatch(sql, /UPDATE\s+`orders`/i);
});

test("fresh database dump uses the rebalanced catalog prices", () => {
    const dump = read(dumpPath);

    for (const [sku, price] of expectedPriceAnchors) {
        assert.match(dump, new RegExp(`'${sku}',\\s*${price.replace(".", "\\.")}`));
    }
});

test("historical invoice price snapshots remain unchanged", () => {
    const dump = read(dumpPath);

    assert.match(dump, /\(1,\s+1,\s+1,\s+2,\s+3500000\.00\)/);
    assert.match(dump, /\(4,\s+3,\s+22,\s+2,\s+3800000\.00\)/);
    assert.match(dump, /\(7,\s+5,\s+45,\s+1,\s+8500000\.00\)/);
});
