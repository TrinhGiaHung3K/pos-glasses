const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const rootDir = path.resolve(__dirname, "../..");
const skuPath = path.join(rootDir, "frontend/assets/js/sku.js");

function loadSkuHelpers() {
    const code = fs.readFileSync(skuPath, "utf8");
    const window = {};
    vm.runInNewContext(code, { window });
    return window;
}

test("suggestProductSku prefers model code embedded in product name", () => {
    const window = loadSkuHelpers();
    const result = window.suggestProductSku({
        name: "RayBan Erika RB4171",
        existing: ["RB001", "RB3025"]
    });

    assert.equal(result.sku, "RB4171");
    assert.equal(result.source, "model");
    assert.equal(result.brandCode, "RB");
});

test("suggestProductSku falls back to brand sequential when model is taken", () => {
    const window = loadSkuHelpers();
    const result = window.suggestProductSku({
        name: "RayBan Erika RB4171",
        existing: ["RB4171", "RB001", "RB014"]
    });

    assert.equal(result.source, "sequential");
    assert.equal(result.brandCode, "RB");
    assert.match(result.sku, /^RB\d{3,}$/);
    assert.notEqual(result.sku, "RB4171");
});

test("suggestProductSku builds sequential SKUs per brand prefix", () => {
    const window = loadSkuHelpers();
    const result = window.suggestProductSku({
        name: "Gentle Monster Her",
        existing: ["GM001", "GM002"]
    });

    assert.equal(result.sku, "GM003");
    assert.equal(result.source, "sequential");
    assert.equal(result.brandCode, "GM");
});

test("suggestProductSku uses PG prefix for unknown brands", () => {
    const window = loadSkuHelpers();
    const result = window.suggestProductSku({
        name: "NoName Urban Frame",
        existing: ["PG001"]
    });

    assert.equal(result.sku, "PG002");
    assert.equal(result.brandCode, "PG");
});

test("normalizeSku strips non-alphanumeric and uppercases", () => {
    const window = loadSkuHelpers();
    assert.equal(window.normalizeSku(" rb-014 "), "RB014");
    assert.equal(window.normalizeSku("gg.003"), "GG003");
});

test("validateSkuFormat accepts standard and model-like codes", () => {
    const window = loadSkuHelpers();
    assert.equal(window.validateSkuFormat("RB014").ok, true);
    assert.equal(window.validateSkuFormat("RB4171").ok, true);
    assert.equal(window.validateSkuFormat("").ok, false);
});
