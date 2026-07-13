const assert = require("node:assert/strict");
const test = require("node:test");
const { ensureProductQrSchema } = require("../../src/db/productQrSchema");

test("product QR schema uses opaque unique codes and revoke status", async () => {
    let sql = "";
    await ensureProductQrSchema({ execute: async (value) => { sql += value; return [{ affectedRows: 0 }]; } });
    assert.match(sql, /product_qr_codes/);
    assert.match(sql, /UNIQUE KEY `uq_product_qr_public_code`/);
    assert.match(sql, /revoked_at/);
});
