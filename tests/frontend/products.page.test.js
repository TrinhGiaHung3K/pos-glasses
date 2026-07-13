const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const productsPath = path.resolve(__dirname, "../../frontend/products.html");

test("product cards keep primary and secondary actions in separate stable rows", () => {
    const html = fs.readFileSync(productsPath, "utf8");

    assert.match(html, /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\) 42px;/);
    assert.match(html, /class="btn btn-primary product-buy-button"/);
    assert.match(html, /class="product-secondary-actions"/);
    assert.match(html, /<span class="action-label">Mã QR<\/span>/);
    assert.match(html, /<span class="action-label">Chỉnh sửa<\/span>/);
    assert.match(html, /@media \(max-width: 390px\)[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) 42px 42px;/);
});

test("product catalog uses POS-specific action language and responsive media", () => {
    const html = fs.readFileSync(productsPath, "utf8");

    assert.match(html, /"Bán nhanh"/);
    assert.doesNotMatch(html, /"Mua ngay"/);
    assert.match(html, /aspect-ratio:\s*16 \/ 10;/);
    assert.match(html, /grid-template-columns:\s*repeat\(auto-fill, minmax\(min\(100%, 286px\), 1fr\)\);/);
});
