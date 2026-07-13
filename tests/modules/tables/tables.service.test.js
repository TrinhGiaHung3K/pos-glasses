const assert = require("node:assert/strict");
const test = require("node:test");

test("getPublicMenu rejects inactive or missing table tokens", async () => {
    const { createTablesService } = require("../../../src/modules/tables/service");
    const service = createTablesService({
        findActiveByToken: async () => null,
        findAvailableProducts: async () => {
            throw new Error("should not load products");
        }
    });

    await assert.rejects(
        () => service.getPublicMenu("missing-token"),
        {
            status: 404,
            message: "Bàn không tồn tại hoặc đã tạm ngưng"
        }
    );
});

test("getPublicMenu returns active table and available products", async () => {
    const { createTablesService } = require("../../../src/modules/tables/service");
    const service = createTablesService({
        findActiveByToken: async (token) => ({
            id: 2,
            code: "T02",
            name: "Bàn tư vấn 02",
            qr_token: token
        }),
        findAvailableProducts: async () => [
            {
                id: 7,
                name: "RayBan Aviator Classic",
                price: "3200000.00",
                quantity: 20
            }
        ]
    });

    const result = await service.getPublicMenu("table-t02");

    assert.deepEqual(result.table, {
        id: 2,
        code: "T02",
        name: "Bàn tư vấn 02"
    });
    assert.equal(result.products.length, 1);
    assert.equal(result.products[0].id, 7);
});

test("create validates table code and name", async () => {
    const { createTablesService } = require("../../../src/modules/tables/service");
    const service = createTablesService({
        create: async () => {
            throw new Error("should not create");
        }
    });

    await assert.rejects(
        () => service.create({ code: "", name: "" }),
        {
            status: 400,
            message: "Vui lòng nhập mã bàn và tên bàn"
        }
    );
});
