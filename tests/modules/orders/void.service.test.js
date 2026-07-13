const assert = require("node:assert/strict");
const test = require("node:test");
const { createOrdersService } = require("../../../src/modules/orders/service");

function baseOrder(overrides = {}) {
    return {
        id: 10,
        status: "completed",
        total_amount: 5000000,
        created_at: new Date(),
        customer_name: "A",
        ...overrides
    };
}

function createRepo(overrides = {}) {
    return {
        findOrderHeaderById: async () => baseOrder(),
        findOrderLinesById: async () => [
            {
                id: 1,
                order_id: 10,
                product_id: 7,
                quantity: 2,
                refunded_quantity: 0,
                price: 2500000,
                cost_price: 1000000
            }
        ],
        voidOrder: async (payload) => ({ orderId: payload.orderId, status: "voided" }),
        refundOrder: async (payload) => ({
            orderId: payload.orderId,
            status: payload.nextStatus,
            refund_amount: payload.refundAmount
        }),
        ...overrides
    };
}

test("void rejects missing reason", async () => {
    const service = createOrdersService(createRepo());
    await assert.rejects(
        () => service.voidOrder(10, { id: 1, role: "admin" }, { reason: "" }),
        { status: 400 }
    );
});

test("void rejects non-completed orders", async () => {
    const service = createOrdersService(createRepo({
        findOrderHeaderById: async () => baseOrder({ status: "voided" })
    }));
    await assert.rejects(
        () => service.voidOrder(10, { id: 1, role: "admin" }, { reason: "Sai đơn" }),
        { status: 400, message: "Chỉ hủy được hóa đơn đã hoàn tất" }
    );
});

test("void blocks staff for previous-day orders", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const service = createOrdersService(createRepo({
        findOrderHeaderById: async () => baseOrder({ created_at: yesterday })
    }));
    await assert.rejects(
        () => service.voidOrder(10, { id: 2, role: "staff" }, { reason: "Sai đơn" }),
        { status: 403 }
    );
});

test("void succeeds for admin", async () => {
    const calls = [];
    const service = createOrdersService(createRepo({
        voidOrder: async (payload) => {
            calls.push(payload);
            return { orderId: payload.orderId, status: "voided" };
        }
    }));

    const result = await service.voidOrder(10, { id: 1, role: "admin" }, { reason: "Nhầm khách" });
    assert.equal(result.status, "voided");
    assert.equal(calls[0].reason, "Nhầm khách");
    assert.equal(calls[0].lines.length, 1);
});

test("full refund without items restores remaining lines", async () => {
    const calls = [];
    const service = createOrdersService(createRepo({
        refundOrder: async (payload) => {
            calls.push(payload);
            return {
                orderId: payload.orderId,
                status: payload.nextStatus,
                refund_amount: payload.refundAmount
            };
        }
    }));

    const result = await service.refundOrder(10, { id: 1, role: "admin" }, { reason: "Khách trả hàng" });
    assert.equal(result.status, "refunded");
    assert.equal(result.refund_amount, 5000000);
    assert.equal(calls[0].refundLines[0].refund_qty, 2);
    assert.equal(calls[0].nextStatus, "refunded");
});

test("partial refund sets partial_refund status", async () => {
    const service = createOrdersService(createRepo());
    const result = await service.refundOrder(
        10,
        { id: 1, role: "admin" },
        {
            reason: "Hoàn 1 chiếc",
            items: [{ order_detail_id: 1, quantity: 1 }]
        }
    );
    assert.equal(result.status, "partial_refund");
    assert.equal(result.refund_amount, 2500000);
});

test("double refund beyond remaining is rejected", async () => {
    const service = createOrdersService(createRepo({
        findOrderLinesById: async () => [
            {
                id: 1,
                order_id: 10,
                product_id: 7,
                quantity: 2,
                refunded_quantity: 2,
                price: 2500000,
                cost_price: 1000000
            }
        ]
    }));

    await assert.rejects(
        () => service.refundOrder(10, { id: 1, role: "admin" }, {
            reason: "Hoàn thêm",
            items: [{ order_detail_id: 1, quantity: 1 }]
        }),
        { status: 400 }
    );
});
