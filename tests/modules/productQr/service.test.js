const assert = require("node:assert/strict");
const test = require("node:test");
const { createProductQrService, validCode } = require("../../../src/modules/productQr/service");

function repository() {
    const rows = [];
    return {
        rows,
        findProduct: async (id) => id === 7 ? { id: 7, name: "RayBan", sku: "RB001", price: 3200000, quantity: 2 } : null,
        findActiveByProduct: async (id) => rows.find((row) => row.product_id === id && row.status === "active") || null,
        createCode: async (row) => ({ id: rows.push({ id: rows.length + 1, ...row, status: "active" }), ...row, status: "active" }),
        rotate: async (id, code) => ({ id: 2, product_id: id, public_code: code, status: "active", version: 2 }),
        findPublicByCode: async (code) => code === "A".repeat(32) ? {
            id: 7, name: "RayBan", brand: "Ray-Ban", sku: "RB001", image: "images/x.jpg",
            price: "3200000.00", quantity: 2, public_code: code
        } : null
    };
}

test("product QR creates an opaque HTTPS URL and reuses active code", async () => {
    const repo = repository();
    const service = createProductQrService(repo, { publicAppUrl: "https://pos.example.com" });
    const first = await service.getOrCreate(7, { id: 1 });
    const second = await service.getOrCreate(7, { id: 1 });
    assert.match(first.public_code, /^[A-Za-z0-9_-]{32}$/);
    assert.equal(first.url, `https://pos.example.com/qr/product.html?code=${first.public_code}`);
    assert.match(first.qr_data_url, /^data:image\/png;base64,/);
    assert.equal(second.public_code, first.public_code);
});

test("public resolver exposes safe fields without cost or quantity", async () => {
    const service = createProductQrService(repository());
    const result = await service.resolve("A".repeat(32));
    assert.equal(result.name, "RayBan");
    assert.equal(result.availability, "in_stock");
    assert.equal("cost_price" in result, false);
    assert.equal("quantity" in result, false);
    assert.equal("id" in result, false);
});

test("invalid and unknown QR codes return generic 404", async () => {
    const service = createProductQrService(repository());
    assert.equal(validCode("short"), null);
    await assert.rejects(() => service.resolve("short"), { status: 404 });
    await assert.rejects(() => service.resolve("B".repeat(32)), { status: 404 });
});
