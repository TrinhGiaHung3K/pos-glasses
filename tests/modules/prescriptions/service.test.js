const assert = require("node:assert/strict");
const test = require("node:test");
const { createPrescriptionsService } = require("../../../src/modules/prescriptions/service");

test("create prescription normalizes OD/OS values and deactivates others when active", async () => {
    const calls = { deactivate: null };
    const service = createPrescriptionsService({
        create: async (row) => ({ id: 11, ...row, is_active: 1 }),
        deactivateOthers: async (customerId, exceptId) => {
            calls.deactivate = { customerId, exceptId };
        }
    });

    const created = await service.create(5, {
        od_sph: -1.25,
        os_sph: -1.5,
        od_axis: 90,
        pd: 62,
        is_active: true
    }, { id: 1 });

    assert.equal(created.customer_id, 5);
    assert.equal(created.od_sph, -1.25);
    assert.equal(created.pd, 62);
    assert.deepEqual(calls.deactivate, { customerId: 5, exceptId: 11 });
});

test("rejects invalid axis", async () => {
    const service = createPrescriptionsService({
        create: async () => ({})
    });
    await assert.rejects(
        () => service.create(1, { od_axis: 200 }, { id: 1 }),
        { status: 400 }
    );
});

test("update requires existing row", async () => {
    const service = createPrescriptionsService({
        findById: async () => null
    });
    await assert.rejects(
        () => service.update(99, {}, { id: 1 }),
        { status: 404 }
    );
});
