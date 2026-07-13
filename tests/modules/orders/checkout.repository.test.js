const assert = require("node:assert/strict");
const test = require("node:test");

function createFakeConnection(events, failOnSql = "") {
    return {
        async beginTransaction() {
            events.push(["begin"]);
        },
        async execute(sql, params) {
            events.push(["execute", sql.replace(/\s+/g, " ").trim(), params]);

            if (failOnSql && sql.includes(failOnSql)) {
                throw new Error("forced failure");
            }

            if (sql.includes("SELECT") && sql.includes("FROM products")) {
                return [[{ id: 7, name: "RayBan", quantity: 5, cost_price: 1000000 }]];
            }

            if (sql.includes("INSERT INTO orders")) {
                return [{ insertId: 44 }];
            }

            if (sql.includes("INSERT INTO stock_movements")) {
                return [{ insertId: 9 }];
            }

            return [{ affectedRows: 1 }];
        },
        async commit() {
            events.push(["commit"]);
        },
        async rollback() {
            events.push(["rollback"]);
        },
        release() {
            events.push(["release"]);
        }
    };
}

test("checkout locks stock, inserts order, details, stock ledger, and commits", async () => {
    const { createOrdersRepository } = require("../../../src/modules/orders/repository");
    const events = [];
    const repository = createOrdersRepository({
        getConnection: async () => createFakeConnection(events),
        execute: async () => [[], undefined]
    });

    const result = await repository.checkout({
        customer_id: null,
        user_id: 2,
        source: "pos",
        status: "completed",
        items: [{ product_id: 7, quantity: 2, price: 3200000, cost_price: 1000000 }],
        subtotal_amount: 6400000,
        discount_amount: 50000,
        total_amount: 6350000,
        coupon_code: null,
        discount_percent: 0,
        manual_discount_type: "amount",
        manual_discount_value: 50000,
        payment_method: "cash",
        amount_paid: 7000000,
        change_amount: 650000
    });

    assert.equal(result.orderId, 44);
    const kinds = events.map((event) => event[0]);
    assert.equal(kinds[0], "begin");
    assert.equal(kinds[kinds.length - 2], "commit");
    assert.equal(kinds[kinds.length - 1], "release");

    const sqls = events.filter((e) => e[0] === "execute").map((e) => e[1]);
    assert.ok(sqls.some((sql) => /FROM products/.test(sql) && /FOR UPDATE/.test(sql)));
    assert.ok(sqls.some((sql) => /INSERT INTO orders/.test(sql)));
    assert.ok(sqls.some((sql) => /INSERT INTO order_details/.test(sql)));
    assert.ok(sqls.some((sql) => /UPDATE products/.test(sql)));
    assert.ok(sqls.some((sql) => /INSERT INTO stock_movements/.test(sql)));
});

test("checkout rolls back and releases on failure", async () => {
    const { createOrdersRepository } = require("../../../src/modules/orders/repository");
    const events = [];
    const repository = createOrdersRepository({
        getConnection: async () => createFakeConnection(events, "order_details"),
        execute: async () => [[], undefined]
    });

    await assert.rejects(
        () =>
            repository.checkout({
                customer_id: null,
                user_id: 2,
                source: "pos",
                status: "completed",
                items: [{ product_id: 7, quantity: 2, price: 3200000 }],
                subtotal_amount: 6400000,
                discount_amount: 0,
                total_amount: 6400000,
                coupon_code: null,
                discount_percent: 0,
                manual_discount_type: null,
                manual_discount_value: 0,
                payment_method: "cash",
                amount_paid: 6400000,
                change_amount: 0
            }),
        /forced failure/
    );

    assert.deepEqual(events.map((event) => event[0]), [
        "begin",
        "execute",
        "execute",
        "execute",
        "rollback",
        "release"
    ]);
});
