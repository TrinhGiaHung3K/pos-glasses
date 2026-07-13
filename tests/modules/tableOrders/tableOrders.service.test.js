const assert = require("node:assert/strict");
const test = require("node:test");

test("createPublicOrder stores a pending request without reducing stock", async () => {
    const { createTableOrdersService } = require("../../../src/modules/tableOrders/service");
    const calls = [];
    const service = createTableOrdersService({
        findActiveTableByToken: async (token) => {
            calls.push(["table", token]);
            return { id: 1, code: "T01", name: "Bàn tư vấn 01" };
        },
        findProductsByIds: async (ids) => {
            calls.push(["products", ids]);
            return [
                {
                    id: 7,
                    name: "RayBan Aviator Classic",
                    price: "3200000.00",
                    quantity: 20
                }
            ];
        },
        createPendingTableOrder: async (request) => {
            calls.push(["create", request]);
            return { insertId: 12 };
        }
    });

    const result = await service.createPublicOrder({
        token: "table-t01",
        items: [{ product_id: "7", quantity: "2" }]
    });

    assert.deepEqual(result, {
        message: "Đã gửi yêu cầu đặt hàng",
        id: 12,
        table: {
            id: 1,
            code: "T01",
            name: "Bàn tư vấn 01"
        }
    });
    assert.deepEqual(calls, [
        ["table", "table-t01"],
        ["products", [7]],
        [
            "create",
            {
                table_id: 1,
                items: [
                    {
                        product_id: 7,
                        quantity: 2,
                        unit_price_snapshot: 3200000,
                        product_name_snapshot: "RayBan Aviator Classic"
                    }
                ]
            }
        ]
    ]);
});

test("createPublicOrder rejects empty carts", async () => {
    const { createTableOrdersService } = require("../../../src/modules/tableOrders/service");
    const service = createTableOrdersService({});

    await assert.rejects(
        () => service.createPublicOrder({ token: "table-t01", items: [] }),
        {
            status: 400,
            message: "Vui lòng chọn ít nhất một sản phẩm"
        }
    );
});

test("confirm rejects insufficient stock before creating official order", async () => {
    const { createTableOrdersService } = require("../../../src/modules/tableOrders/service");
    const service = createTableOrdersService({
        findPendingOrderWithItems: async () => ({
            id: 9,
            table_id: 1,
            items: [
                {
                    product_id: 7,
                    product_name_snapshot: "RayBan Aviator Classic",
                    quantity: 3,
                    unit_price_snapshot: 3200000
                }
            ]
        }),
        findProductsByIds: async () => [
            {
                id: 7,
                name: "RayBan Aviator Classic",
                price: "3200000.00",
                quantity: 2
            }
        ],
        confirmPendingOrder: async () => {
            throw new Error("should not confirm");
        }
    });

    await assert.rejects(
        () => service.confirm(9, { id: 2, role: "staff" }),
        {
            status: 400,
            message: "Sản phẩm RayBan Aviator Classic không đủ tồn kho"
        }
    );
});

test("confirm creates an official QR order when stock is available", async () => {
    const { createTableOrdersService } = require("../../../src/modules/tableOrders/service");
    const calls = [];
    const service = createTableOrdersService({
        findPendingOrderWithItems: async (id) => {
            calls.push(["find", id]);
            return {
                id,
                table_id: 1,
                items: [
                    {
                        product_id: 7,
                        product_name_snapshot: "RayBan Aviator Classic",
                        quantity: 2,
                        unit_price_snapshot: 3200000
                    }
                ]
            };
        },
        findProductsByIds: async (ids) => {
            calls.push(["stocks", ids]);
            return [
                {
                    id: 7,
                    name: "RayBan Aviator Classic",
                    price: "3200000.00",
                    quantity: 20
                }
            ];
        },
        confirmPendingOrder: async (request) => {
            calls.push(["confirm", request]);
            return { orderId: 55 };
        }
    });

    const result = await service.confirm(9, { id: 2, role: "staff" });

    assert.deepEqual(result, {
        message: "Đã xác nhận yêu cầu và tạo hóa đơn",
        order_id: 55
    });
    assert.deepEqual(calls, [
        ["find", 9],
        ["stocks", [7]],
        [
            "confirm",
            {
                table_order_id: 9,
                table_id: 1,
                user_id: 2,
                total_amount: 6400000,
                items: [
                    {
                        product_id: 7,
                        quantity: 2,
                        price: 3200000
                    }
                ]
            }
        ]
    ]);
});
