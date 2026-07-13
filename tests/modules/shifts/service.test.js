const assert = require("node:assert/strict");
const test = require("node:test");
const { createShiftsService } = require("../../../src/modules/shifts/service");

function mockRepo(overrides = {}) {
    const openShift = {
        id: 3,
        user_id: 1,
        status: "open",
        opening_cash: 1000000,
        cash_sales: 500000,
        card_sales: 0,
        bank_sales: 0,
        order_count: 2,
        void_count: 0
    };
    return {
        findOpenByUser: async (userId) => (userId === 1 ? openShift : null),
        findById: async (id) => (Number(id) === 3 ? { ...openShift } : null),
        list: async () => ({ items: [openShift], page: 1, limit: 30, total: 1 }),
        open: async ({ userId, openingCash, note }) => ({
            id: 9,
            user_id: userId,
            status: "open",
            opening_cash: openingCash,
            note,
            cash_sales: 0,
            order_count: 0
        }),
        close: async (payload) => ({
            ...openShift,
            id: payload.id,
            status: "closed",
            closing_cash: payload.closingCash,
            expected_cash: payload.expectedCash,
            variance: payload.variance,
            closed_by: payload.closedBy
        }),
        recomputeFromOrders: async (id) => ({ ...openShift, id }),
        ...overrides
    };
}

test("open shift rejects when already open", async () => {
    const service = createShiftsService(mockRepo());
    await assert.rejects(
        () => service.open({ opening_cash: 0 }, { id: 1, role: "staff" }),
        { status: 400 }
    );
});

test("open shift creates when none open", async () => {
    const service = createShiftsService(mockRepo({
        findOpenByUser: async () => null
    }));
    const result = await service.open({ opening_cash: 2000000 }, { id: 2, role: "staff" });
    assert.equal(result.shift.status, "open");
    assert.equal(result.shift.opening_cash, 2000000);
});

test("close shift computes expected cash and variance", async () => {
    const service = createShiftsService(mockRepo());
    const result = await service.close(3, { closing_cash: 1600000 }, { id: 1, role: "staff" });
    // expected = 1_000_000 + 500_000 = 1_500_000; variance = 100_000
    assert.equal(result.report.expected_cash, 1500000);
    assert.equal(result.report.variance, 100000);
    assert.equal(result.shift.status, "closed");
});

test("close requires closing_cash", async () => {
    const service = createShiftsService(mockRepo());
    await assert.rejects(
        () => service.close(3, {}, { id: 1, role: "staff" }),
        { status: 400 }
    );
});

test("staff cannot close another user's shift", async () => {
    const service = createShiftsService(mockRepo());
    await assert.rejects(
        () => service.close(3, { closing_cash: 0 }, { id: 99, role: "staff" }),
        { status: 403 }
    );
});
