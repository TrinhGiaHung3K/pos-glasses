const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "..", "..");
const dumpPath = path.join(rootDir, "scripts", "Dump20260704.sql");

function readDump() {
    return fs.readFileSync(dumpPath, "utf8");
}

test("fresh dump bootstraps a portable MySQL database with all application tables", () => {
    const dump = readDump();
    const tables = [
        "users",
        "categories",
        "customers",
        "products",
        "promotions",
        "orders",
        "order_details"
    ];

    assert.match(
        dump,
        /CREATE DATABASE IF NOT EXISTS `pos_glasses`\s+DEFAULT CHARACTER SET utf8mb4\s+COLLATE utf8mb4_unicode_ci;/i
    );
    assert.match(dump, /USE `pos_glasses`;/i);
    assert.doesNotMatch(dump, /utf8mb4_0900_ai_ci/i);
    assert.doesNotMatch(dump, /^\s*LOCK TABLES\b/im);
    assert.doesNotMatch(dump, /^\s*UNLOCK TABLES\b/im);

    for (const table of tables) {
        assert.match(dump, new RegExp(`DROP TABLE IF EXISTS \`${table}\``, "i"));
        assert.match(dump, new RegExp(`CREATE TABLE \`${table}\``, "i"));
    }

    assert.doesNotMatch(dump, /CREATE TABLE `(?:store_tables|table_orders|table_order_items)`/i);
    assert.doesNotMatch(dump, /'123456'/);
    assert.match(dump, /BOOTSTRAP_ADMIN_USERNAME/);
});

test("fresh dump includes customer member barcode schema and backfilled data", () => {
    const dump = readDump();

    assert.match(
        dump,
        /`member_code`\s+varchar\(32\)\s+DEFAULT NULL/i
    );
    assert.match(
        dump,
        /UNIQUE KEY `idx_customers_member_code` \(`member_code`\)/i
    );
    assert.match(
        dump,
        /INSERT INTO `customers` \(`id`, `member_code`, `name`, `phone`, `email`, `address`\) VALUES/i
    );
    assert.match(dump, /\(1,\s+'2900000000018',\s+'Nguyen Van A'/);
    assert.match(dump, /\(2,\s+'2900000000025',\s+'Tran Thi B'/);
    assert.match(dump, /\(5,\s+'2900000000056',\s+'Huynh Van C'/);
});
