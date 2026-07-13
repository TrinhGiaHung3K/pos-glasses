const assert = require("node:assert/strict");
const test = require("node:test");
const { createCategoriesService } = require("../../../src/modules/categories/service");

test("create rejects short names", async () => {
    const service = createCategoriesService({ create: async () => ({ insertId: 1 }) });
    await assert.rejects(() => service.create({ name: "A" }), { status: 400 });
});

test("create returns insert id", async () => {
    const service = createCategoriesService({
        create: async (name) => ({ insertId: 7, name })
    });
    const result = await service.create({ name: "Kính cận" });
    assert.equal(result.id, 7);
});
