const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const {
    parseImageDataUrl,
    sanitizeImageSlug,
    saveProcessedProductImage
} = require("../../../src/modules/products/service");

test("sanitizeImageSlug keeps safe filename tokens", () => {
    assert.equal(sanitizeImageSlug("RB014"), "rb014");
    assert.equal(sanitizeImageSlug(" Ray Ban / Aviator "), "ray-ban-aviator");
    assert.equal(sanitizeImageSlug("@@@"), "product");
});

test("parseImageDataUrl accepts png base64 payloads", () => {
    // 1x1 transparent PNG
    const png =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const parsed = parseImageDataUrl(png);
    assert.equal(parsed.mimeType, "image/png");
    assert.ok(parsed.buffer.length > 0);
});

test("parseImageDataUrl rejects invalid payloads", () => {
    assert.throws(() => parseImageDataUrl("not-an-image"), /data URL/i);
});

test("saveProcessedProductImage writes under frontend/images/products", async () => {
    const png =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const result = await saveProcessedProductImage({
        dataUrl: png,
        sku: "TESTSKU"
    });

    assert.match(result.path, /^images\/products\/testsku-\d+\.png$/);
    const absolute = path.join(
        __dirname,
        "..",
        "..",
        "..",
        "frontend",
        result.path
    );
    const stat = await fs.stat(absolute);
    assert.ok(stat.isFile());
    assert.ok(stat.size > 0);

    await fs.unlink(absolute);
});
