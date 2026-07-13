const assert = require("node:assert/strict");
const test = require("node:test");

function createRepository(overrides = {}) {
    const calls = [];
    const store = new Map();

    return {
        calls,
        findAll: async () => [],
        findById: async (id) => store.get(Number(id)) || null,
        findByMemberCode: async (memberCode) => {
            calls.push(["findByMemberCode", memberCode]);
            return memberCode === "2900000000421"
                ? {
                    id: 42,
                    name: "Nguyen An",
                    member_code: "2900000000421",
                    membership_status: "active",
                    membership_tier: "standard",
                    gender: "unknown"
                }
                : null;
        },
        findByPhone: async (phone) => {
            calls.push(["findByPhone", phone]);
            for (const row of store.values()) {
                if (row.phone === phone) return row;
            }
            return null;
        },
        create: async (customer) => {
            calls.push(["create", customer]);
            const id = 42;
            store.set(id, {
                id,
                ...customer,
                member_code: customer.member_code || null,
                registered_by_name: null,
                created_at: new Date(),
                updated_at: new Date()
            });
            return { insertId: id };
        },
        assignMemberCode: async (id, memberCode) => {
            calls.push(["assignMemberCode", id, memberCode]);
            const row = store.get(Number(id));
            if (row) row.member_code = memberCode;
            return { affectedRows: 1 };
        },
        update: async (id, customer) => {
            calls.push(["update", id, customer]);
            const row = store.get(Number(id));
            if (row) Object.assign(row, customer);
            return { affectedRows: 1 };
        },
        updateStatus: async (id, status) => {
            calls.push(["updateStatus", id, status]);
            const row = store.get(Number(id));
            if (row) row.membership_status = status;
            return { affectedRows: 1 };
        },
        remove: async (id) => {
            calls.push(["remove", id]);
            store.delete(Number(id));
            return { affectedRows: 1 };
        },
        ...overrides
    };
}

test("generateMemberCode returns an internal EAN-13 barcode with a valid check digit", () => {
    const { generateMemberCode } = require("../../../src/modules/customers/service");

    assert.equal(generateMemberCode(42), "2900000000421");
    assert.equal(generateMemberCode(1), "2900000000018");
});

test("normalizePhone converts +84 to 0-prefix local format", () => {
    const { normalizePhone } = require("../../../src/modules/customers/service");
    assert.equal(normalizePhone("+84 901 234 567"), "0901234567");
    assert.equal(normalizePhone("090-123-4567"), "0901234567");
});

test("create registers membership with EAN-13, defaults, and staff id", async () => {
    const { createCustomersService } = require("../../../src/modules/customers/service");
    const repository = createRepository();
    const service = createCustomersService(repository);

    const result = await service.create({
        name: "  Nguyen  An ",
        phone: "+84901234567",
        address: "Quan 1",
        email: "An@Example.com",
        gender: "male",
        membership_tier: "silver",
        registered_by: 3
    });

    assert.equal(result.id, 42);
    assert.equal(result.member_code, "2900000000421");
    assert.equal(result.customer.phone, "0901234567");
    assert.equal(result.customer.email, "an@example.com");
    assert.equal(result.customer.membership_tier, "silver");
    assert.equal(result.customer.is_member, true);

    const createCall = repository.calls.find((c) => c[0] === "create");
    assert.equal(createCall[1].name, "Nguyen An");
    assert.equal(createCall[1].phone, "0901234567");
    assert.equal(createCall[1].gender, "male");
    assert.equal(createCall[1].registered_by, 3);
    assert.equal(createCall[1].member_code, null);
    assert.ok(createCall[1].member_since instanceof Date);
    assert.deepEqual(repository.calls.find((c) => c[0] === "assignMemberCode"), [
        "assignMemberCode",
        42,
        "2900000000421"
    ]);
});

test("create rejects duplicate phone numbers", async () => {
    const { createCustomersService } = require("../../../src/modules/customers/service");
    const repository = createRepository({
        findByPhone: async () => ({ id: 7, name: "Co san", phone: "0901234567" })
    });
    const service = createCustomersService(repository);

    await assert.rejects(
        () => service.create({ name: "Moi", phone: "0901234567" }),
        { status: 409 }
    );
});

test("create rejects invalid membership tier", async () => {
    const { createCustomersService } = require("../../../src/modules/customers/service");
    const service = createCustomersService(createRepository());

    await assert.rejects(
        () => service.create({ name: "Test", phone: "0901111222", membership_tier: "platinum" }),
        { status: 400 }
    );
});

test("findByMemberCode normalizes scanned Barcode to PC input", async () => {
    const { createCustomersService } = require("../../../src/modules/customers/service");
    const repository = createRepository();
    const service = createCustomersService(repository);

    const customer = await service.findByMemberCode(" ２９００ ００００００４２１\n");

    assert.equal(customer.id, 42);
    assert.equal(customer.member_code, "2900000000421");
    assert.equal(customer.is_member, true);
    assert.deepEqual(repository.calls, [["findByMemberCode", "2900000000421"]]);
});

test("findByMemberCode rejects malformed EAN-13 member barcodes before lookup", async () => {
    const { createCustomersService } = require("../../../src/modules/customers/service");
    const repository = createRepository();
    const service = createCustomersService(repository);

    await assert.rejects(
        () => service.findByMemberCode("2900000000428"),
        { status: 400, message: "Mã khách hàng không hợp lệ" }
    );

    assert.deepEqual(repository.calls, []);
});

test("findByMemberCode rejects unknown member barcodes", async () => {
    const { createCustomersService } = require("../../../src/modules/customers/service");
    const service = createCustomersService(createRepository());

    await assert.rejects(
        () => service.findByMemberCode("2900000000438"),
        { status: 404, message: "Không tìm thấy hội viên trong hệ thống" }
    );
});

test("findByMemberCode blocks suspended members", async () => {
    const { createCustomersService } = require("../../../src/modules/customers/service");
    const service = createCustomersService(createRepository({
        findByMemberCode: async () => ({
            id: 9,
            member_code: "2900000000094",
            name: "Khoa",
            membership_status: "suspended",
            membership_tier: "standard"
        })
    }));

    await assert.rejects(
        () => service.findByMemberCode("2900000000094"),
        { status: 403 }
    );
});

test("remove soft-deactivates by default", async () => {
    const { createCustomersService } = require("../../../src/modules/customers/service");
    const repository = createRepository();
    repository.findById = async () => ({
        id: 5,
        name: "A",
        phone: "0900000000",
        membership_status: "active"
    });
    const service = createCustomersService(repository);

    const result = await service.remove(5);
    assert.equal(result.hard, false);
    assert.equal(result.membership_status, "inactive");
    assert.deepEqual(repository.calls.find((c) => c[0] === "updateStatus"), [
        "updateStatus",
        5,
        "inactive"
    ]);
});

test("remove hard deletes when requested", async () => {
    const { createCustomersService } = require("../../../src/modules/customers/service");
    const repository = createRepository();
    repository.findById = async () => ({ id: 5, name: "A", phone: "0900000000" });
    const service = createCustomersService(repository);

    const result = await service.remove(5, { hard: true });
    assert.equal(result.hard, true);
    assert.deepEqual(repository.calls.find((c) => c[0] === "remove"), ["remove", 5]);
});
