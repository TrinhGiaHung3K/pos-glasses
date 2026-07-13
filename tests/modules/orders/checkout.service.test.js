const assert = require("node:assert/strict");
const test = require("node:test");

function createRepository(overrides = {}) {
    const products = [
        { id: 7, name: "RayBan Aviator Classic", price: "3200000.00", quantity: 5, cost_price: 1000000 },
        { id: 8, name: "Oakley Holbrook", price: "2800000.00", quantity: 3, cost_price: 900000 }
    ];

    return {
        findPromotionByCode: async (code) =>
            code === "CODE10"
                ? {
                    id: 1,
                    code: "CODE10",
                    discount_type: "percent",
                    discount_percent: 10,
                    discount_value: 10,
                    is_active: 1,
                    min_order_amount: 0,
                    max_uses: null,
                    used_count: 0
                }
                : null,
        checkout: async (request) => ({ orderId: 88, ...request }),
        findProductsByIds: async () => products,
        findStaffPerformanceByUserId: async () => ({
            id: 2,
            username: "staff",
            role: "staff",
            member_order_count: 100,
            order_count: 120,
            total_revenue: 150000000
        }),
        ...overrides
    };
}

test("checkout rejects empty carts", async () => {
    const { createOrdersService } = require("../../../src/modules/orders/service");
    const service = createOrdersService(createRepository());

    await assert.rejects(
        () => service.checkout({ items: [] }, { id: 2, role: "staff" }),
        { status: 400, message: "Vui lòng chọn ít nhất một sản phẩm" }
    );
});

test("checkout rejects invalid payment methods", async () => {
    const { createOrdersService } = require("../../../src/modules/orders/service");
    const service = createOrdersService(createRepository());

    await assert.rejects(
        () =>
            service.checkout(
                {
                    items: [{ product_id: 7, quantity: 1 }],
                    payment: { method: "crypto", amount_paid: 3200000 }
                },
                { id: 2, role: "staff" }
            ),
        { status: 400, message: "Phương thức thanh toán không hợp lệ" }
    );
});

test("bank transfer cannot bypass payment intent flow", async () => {
    const { createOrdersService } = require("../../../src/modules/orders/service");
    const service = createOrdersService(createRepository());
    await assert.rejects(
        () => service.checkout({
            items: [{ product_id: 7, quantity: 1 }],
            payment: { method: "bank_transfer", amount_paid: 0 }
        }, { id: 2, role: "staff" }),
        { status: 409 }
    );
});

test("deferred bank transfer creates a payment-pending stock reservation", async () => {
    const { createOrdersService } = require("../../../src/modules/orders/service");
    const calls = [];
    const service = createOrdersService(createRepository({
        checkout: async (request) => {
            calls.push(request);
            return { orderId: 91 };
        }
    }));
    const result = await service.checkout({
        items: [{ product_id: 7, quantity: 1 }],
        payment: { method: "bank_transfer", amount_paid: 0 }
    }, { id: 2, role: "staff" }, { deferPayment: true });
    assert.equal(result.payment_status, "pending");
    assert.equal(result.amount_paid, 0);
    assert.equal(calls[0].status, "payment_pending");
    assert.equal(calls[0].defer_payment, true);
});

test("checkout combines duplicate product lines and calculates totals", async () => {
    const { createOrdersService } = require("../../../src/modules/orders/service");
    const calls = [];
    const service = createOrdersService(
        createRepository({
            checkout: async (request) => {
                calls.push(request);
                return { orderId: 88 };
            }
        })
    );

    const result = await service.checkout(
        {
            items: [
                { product_id: "7", quantity: "1" },
                { product_id: "7", quantity: "2" },
                { product_id: "8", quantity: "1" }
            ],
            coupon_code: "CODE10",
            manual_discount: { type: "amount", value: "50000" },
            payment: { method: "cash", amount_paid: "12000000" }
        },
        { id: 2, role: "staff" }
    );

    assert.equal(result.order_id, 88);
    assert.equal(result.subtotal_amount, 12400000);
    assert.equal(result.discount_amount, 1290000);
    assert.equal(result.total_amount, 11110000);
    assert.equal(result.amount_paid, 12000000);
    assert.equal(result.change_amount, 890000);
    assert.deepEqual(calls[0].items, [
        { product_id: 7, variant_id: null, quantity: 3, price: 3200000, cost_price: 1000000 },
        { product_id: 8, variant_id: null, quantity: 1, price: 2800000, cost_price: 900000 }
    ]);
    assert.equal(calls[0].points_earned, 0);
    assert.equal(calls[0].user_id, 2);
});

test("checkout rejects manual discounts greater than subtotal", async () => {
    const { createOrdersService } = require("../../../src/modules/orders/service");
    const service = createOrdersService(createRepository());

    await assert.rejects(
        () =>
            service.checkout(
                {
                    items: [{ product_id: 7, quantity: 1 }],
                    manual_discount: { type: "amount", value: 99999999 },
                    payment: { method: "cash", amount_paid: 99999999 }
                },
                { id: 2, role: "staff" }
            ),
        { status: 400, message: "Giảm giá không hợp lệ" }
    );
});

test("checkout rejects insufficient stock", async () => {
    const { createOrdersService } = require("../../../src/modules/orders/service");
    const service = createOrdersService(createRepository());

    await assert.rejects(
        () =>
            service.checkout(
                {
                    items: [{ product_id: 7, quantity: 10 }],
                    payment: { method: "cash", amount_paid: 50000000 }
                },
                { id: 2, role: "staff" }
            ),
        { status: 400, message: "Sản phẩm RayBan Aviator Classic không đủ tồn kho" }
    );
});

test("checkout rejects insufficient cash payment", async () => {
    const { createOrdersService } = require("../../../src/modules/orders/service");
    const service = createOrdersService(createRepository());

    await assert.rejects(
        () =>
            service.checkout(
                {
                    items: [{ product_id: 7, quantity: 1 }],
                    payment: { method: "cash", amount_paid: 1000000 }
                },
                { id: 2, role: "staff" }
            ),
        { status: 400, message: "Tiền khách đưa chưa đủ" }
    );
});

test("checkout rejects invalid coupons", async () => {
    const { createOrdersService } = require("../../../src/modules/orders/service");
    const service = createOrdersService(createRepository());

    await assert.rejects(
        () =>
            service.checkout(
                {
                    items: [{ product_id: 7, quantity: 1 }],
                    coupon_code: "MISSING",
                    payment: { method: "cash", amount_paid: 3200000 }
                },
                { id: 2, role: "staff" }
            ),
        { status: 400, message: "Mã giảm giá không tồn tại hoặc đã hết hạn" }
    );
});

test("checkout rejects manual discounts above the staff rank cap", async () => {
    const { createOrdersService } = require("../../../src/modules/orders/service");
    const service = createOrdersService(
        createRepository({
            findStaffPerformanceByUserId: async () => ({
                id: 2,
                username: "staff",
                role: "staff",
                member_order_count: 0,
                order_count: 0,
                total_revenue: 0
            })
        })
    );

    await assert.rejects(
        () =>
            service.checkout(
                {
                    items: [{ product_id: 7, quantity: 1 }],
                    manual_discount: { type: "percent", value: 1 },
                    payment: { method: "cash", amount_paid: 3200000 }
                },
                { id: 2, role: "staff" }
            ),
        { status: 400, message: "Hạng nhân viên NULL chỉ được giảm tối đa 0%" }
    );
});

test("checkout allows amount discounts within the staff rank cap", async () => {
    const { createOrdersService } = require("../../../src/modules/orders/service");
    const service = createOrdersService(
        createRepository({
            findStaffPerformanceByUserId: async () => ({
                id: 2,
                username: "staff",
                role: "staff",
                member_order_count: 20,
                order_count: 22,
                total_revenue: 20000000
            })
        })
    );

    const result = await service.checkout(
        {
            items: [{ product_id: 7, quantity: 1 }],
            manual_discount: { type: "amount", value: 90000 },
            payment: { method: "cash", amount_paid: 3200000 }
        },
        { id: 2, role: "staff" }
    );

    assert.equal(result.discount_amount, 90000);
    assert.equal(result.total_amount, 3110000);
});
