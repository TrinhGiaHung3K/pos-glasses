const assert = require("node:assert/strict");
const test = require("node:test");
const { createWarrantiesService } = require("../../../src/modules/warranties/service");

test("create warranty uppercases serial and sets end date", async () => {
    let saved = null;
    const service = createWarrantiesService({
        findBySerial: async () => null,
        create: async (row) => {
            saved = row;
            return { id: 1, ...row };
        }
    });

    const w = await service.create({
        serial_number: "ab-123",
        months: 12,
        start_date: "2026-01-15"
    }, { id: 2 });

    assert.equal(saved.serial_number, "AB-123");
    assert.equal(saved.end_date, "2027-01-15");
    assert.equal(saved.created_by, 2);
    assert.equal(w.id, 1);
});

test("create rejects duplicate serial", async () => {
    const service = createWarrantiesService({
        findBySerial: async () => ({ id: 1, serial_number: "X1" })
    });
    await assert.rejects(
        () => service.create({ serial_number: "X1" }, { id: 1 }),
        { status: 400 }
    );
});

test("lookup 404 when missing", async () => {
    const service = createWarrantiesService({
        findBySerial: async () => null
    });
    await assert.rejects(() => service.lookup("NOPE"), { status: 404 });
});
