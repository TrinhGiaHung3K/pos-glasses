const assert = require("node:assert/strict");
const test = require("node:test");

test("addOrderDetail rejects missing products", async () => {
    const { createOrdersService } = require("../../../src/modules/orders/service");

    const service = createOrdersService({
        findProductStockById: async () => null,
        createOrderDetailWithStockUpdate: async () => {
            throw new Error("should not insert");
        }
    });

    await assert.rejects(
        () =>
            service.addOrderDetail({
                order_id: 1,
                product_id: 999,
                quantity: 1,
                price: 100
            }),
        {
            status: 404,
            message: "Product not found"
        }
    );
});

test("addOrderDetail rejects quantities greater than stock", async () => {
    const { createOrdersService } = require("../../../src/modules/orders/service");

    const service = createOrdersService({
        findProductStockById: async () => ({ quantity: 2 }),
        createOrderDetailWithStockUpdate: async () => {
            throw new Error("should not insert");
        }
    });

    await assert.rejects(
        () =>
            service.addOrderDetail({
                order_id: 1,
                product_id: 5,
                quantity: 3,
                price: 100
            }),
        {
            status: 400,
            message: "Not enough stock"
        }
    );
});

test("addOrderDetail inserts detail and decreases stock when enough stock exists", async () => {
    const { createOrdersService } = require("../../../src/modules/orders/service");

    const calls = [];

    const service = createOrdersService({
        findProductStockById: async (productId) => {
            calls.push(["stock", productId]);
            return { quantity: 4 };
        },
        createOrderDetailWithStockUpdate: async (detail) => {
            calls.push(["transaction", detail]);
            return { insertId: 9 };
        }
    });

    const result = await service.addOrderDetail({
        order_id: "7",
        product_id: "5",
        quantity: "2",
        price: "1500000"
    });

    assert.deepEqual(calls, [
        ["stock", 5],
        [
            "transaction",
            {
                order_id: 7,
                product_id: 5,
                quantity: 2,
                price: 1500000,
                cost_price: 0,
                user_id: null
            }
        ]
    ]);
    assert.deepEqual(result, {
        message: "Order detail added and stock updated",
        id: 9
    });
});
