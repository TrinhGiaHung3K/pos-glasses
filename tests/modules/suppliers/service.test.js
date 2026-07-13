const assert = require("node:assert/strict");
const test = require("node:test");
const { createSuppliersService } = require("../../../src/modules/suppliers/service");

test("create supplier requires name", async () => {
    const service = createSuppliersService({
        create: async () => ({})
    });
    await assert.rejects(
        () => service.create({}, { id: 1 }),
        { status: 400 }
    );
});

test("create purchase order validates items", async () => {
    const service = createSuppliersService({
        findById: async () => ({ id: 1, is_active: 1 }),
        createPurchaseOrder: async (payload) => payload
    });

    await assert.rejects(
        () => service.createPurchaseOrder({ supplier_id: 1, items: [] }, { id: 1 }),
        { status: 400 }
    );

    const po = await service.createPurchaseOrder({
        supplier_id: 1,
        items: [{ product_id: 7, qty: 3, unit_cost: 1000 }]
    }, { id: 2 });

    assert.equal(po.supplierId, 1);
    assert.equal(po.items[0].qty_ordered, 3);
    assert.equal(po.createdBy, 2);
});

test("receive purchase order maps stock errors", async () => {
    const service = createSuppliersService({
        receivePurchaseOrder: async () => {
            const err = new Error("Đơn nhập đã nhận hàng");
            err.status = 400;
            throw err;
        }
    });
    await assert.rejects(
        () => service.receivePurchaseOrder(1, { id: 1 }),
        { status: 400 }
    );
});
