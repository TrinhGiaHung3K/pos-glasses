const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(
    path.join(root, "scripts", "migrations", "2026-07-15-pos-demo-catalog-prices.sql"),
    "utf8"
);
const restore = fs.readFileSync(
    path.join(root, "scripts", "2026-07-15-restore-product-prices.sql"),
    "utf8"
);

test("POS demo pricing scales catalog and cost while preserving originals", () => {
    assert.match(migration, /ADD COLUMN `original_price`/);
    assert.match(migration, /`price`\s*=\s*GREATEST\(1000, ROUND\(`price` \/ 1000\)\)/);
    assert.match(migration, /`cost_price`\s*=\s*GREATEST\(0, ROUND\(COALESCE\(`cost_price`, 0\) \/ 1000\)\)/);
    assert.doesNotMatch(migration, /order_details|UPDATE\s+`orders`/i);
});

test("POS demo price migration has an explicit restore script", () => {
    assert.match(restore, /`price`\s*=\s*`original_price`/);
    assert.match(restore, /WHERE `original_price` IS NOT NULL/);
});
