# POS Counter Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a counter-style POS checkout flow that creates complete paid invoices and reduces stock in one atomic backend transaction.

**Architecture:** Add checkout calculations and transaction handling to the existing `orders` module so legacy order reads keep working. Expose a protected `POST /api/staff/pos/checkout` route through the current JWT and role middleware. Replace `frontend/orders.html` with a single POS workspace that calls the checkout API and stops using the legacy two-step `/orders` plus `/order-details` workflow.

**Tech Stack:** Node.js CommonJS, Express 5, MySQL via `mysql2/promise`, static HTML/CSS/JS, Node `node:test`.

---

## File Structure

- Modify `src/modules/orders/service.js`: add payload validation, discount calculation helpers, and `checkout(payload, user)` service method.
- Modify `src/modules/orders/repository.js`: add transactional `checkout(request)` and keep legacy order queries compatible with new POS fields.
- Modify `src/modules/orders/controller.js`: add `checkout(req, res)`.
- Modify `src/modules/orders/routes.js`: add `POST /api/staff/pos/checkout`.
- Modify `src/app.js`: keep route registration as-is if the new route lives in `createOrdersRouter`.
- Add `tests/modules/orders/checkout.service.test.js`: unit coverage for validation and totals.
- Add `tests/modules/orders/checkout.repository.test.js`: transaction sequencing coverage using fake DB connection.
- Modify `tests/app.test.js`: route wiring and auth coverage for checkout.
- Add `scripts/2026-07-05-pos-counter-checkout-migration.sql`: idempotent `orders` column migration.
- Modify `scripts/Dump20260704.sql`: add POS fields to the `orders` table and seed inserts.
- Rewrite `frontend/orders.html`: POS screen and checkout API call.
- Modify `frontend/assets/js/auth.js`: staff landing should be `/orders.html`.
- Modify sidebar links in `frontend/dashboard.html`, `frontend/products.html`, `frontend/orders.html`, `frontend/invoices.html`, and `frontend/invoice_detail.html`: hide `/staff/qr-orders.html` and `/admin/tables.html` from primary selling navigation.
- Modify `frontend/invoice_detail.html`: show payment method, amount paid, and change amount on receipts.

## Task 1: Checkout Service Calculations

**Files:**
- Modify: `src/modules/orders/service.js`
- Create: `tests/modules/orders/checkout.service.test.js`

- [ ] **Step 1: Write failing service tests**

Add `tests/modules/orders/checkout.service.test.js`:

```js
const assert = require("node:assert/strict");
const test = require("node:test");

function createRepository(overrides = {}) {
    const products = [
        { id: 7, name: "RayBan Aviator Classic", price: "3200000.00", quantity: 5 },
        { id: 8, name: "Oakley Holbrook", price: "2800000.00", quantity: 3 }
    ];

    return {
        findPromotionByCode: async (code) =>
            code === "CODE10"
                ? { code: "CODE10", discount_percent: 10 }
                : null,
        checkout: async (request) => ({ orderId: 88, ...request }),
        findProductsByIds: async () => products,
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
        { product_id: 7, quantity: 3, price: 3200000 },
        { product_id: 8, quantity: 1, price: 2800000 }
    ]);
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
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```powershell
npm test -- tests/modules/orders/checkout.service.test.js
```

Expected: fail because `service.checkout` and checkout repository methods are not implemented.

- [ ] **Step 3: Implement checkout service helpers and method**

Update `src/modules/orders/service.js` to include:

```js
const { createHttpError } = require("../../middleware/httpError");

const PAYMENT_METHODS = new Set(["cash", "bank_transfer", "card"]);
const MANUAL_DISCOUNT_TYPES = new Set(["percent", "amount"]);

function toNumber(value) {
    return Number(value || 0);
}

function toPositiveInteger(value, fieldName) {
    const numberValue = Number(value);

    if (!Number.isInteger(numberValue) || numberValue < 1) {
        throw createHttpError(400, `${fieldName} không hợp lệ`);
    }

    return numberValue;
}

function normalizeCheckoutItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw createHttpError(400, "Vui lòng chọn ít nhất một sản phẩm");
    }

    const byProductId = new Map();

    for (const item of items) {
        const productId = toPositiveInteger(item.product_id, "Sản phẩm");
        const quantity = toPositiveInteger(item.quantity, "Số lượng");
        byProductId.set(productId, (byProductId.get(productId) || 0) + quantity);
    }

    return [...byProductId.entries()].map(([product_id, quantity]) => ({
        product_id,
        quantity
    }));
}

function validatePayment(payment = {}) {
    const method = String(payment.method || "cash").trim();

    if (!PAYMENT_METHODS.has(method)) {
        throw createHttpError(400, "Phương thức thanh toán không hợp lệ");
    }

    return {
        method,
        amount_paid: Math.max(0, Math.round(toNumber(payment.amount_paid)))
    };
}

function normalizeManualDiscount(manualDiscount = {}) {
    const type = manualDiscount.type ? String(manualDiscount.type).trim() : null;
    const value = Math.max(0, toNumber(manualDiscount.value));

    if (!type && value === 0) {
        return {
            type: null,
            value: 0
        };
    }

    if (!MANUAL_DISCOUNT_TYPES.has(type) || value <= 0) {
        throw createHttpError(400, "Giảm giá không hợp lệ");
    }

    if (type === "percent" && value > 100) {
        throw createHttpError(400, "Giảm giá không hợp lệ");
    }

    return {
        type,
        value
    };
}

function mapProductsById(products) {
    return new Map(products.map((product) => [Number(product.id), product]));
}

function calculateManualDiscount(subtotal, discount) {
    if (!discount.type) {
        return 0;
    }

    if (discount.type === "percent") {
        return Math.round(subtotal * discount.value / 100);
    }

    return Math.round(discount.value);
}

function createOrdersService(repository) {
    return {
        async createOrder(payload) {
            const result = await repository.createOrder({
                customer_id: toNumber(payload.customer_id),
                user_id: toNumber(payload.user_id),
                table_id: payload.table_id ? toNumber(payload.table_id) : null,
                table_order_id: payload.table_order_id ? toNumber(payload.table_order_id) : null,
                source: payload.source || "staff",
                status: payload.status || "completed",
                total_amount: toNumber(payload.total_amount),
                coupon_code: payload.coupon_code || null,
                discount_percent: toNumber(payload.discount_percent)
            });

            return {
                message: "Order created successfully",
                id: result.insertId
            };
        },

        async addOrderDetail(payload) {
            const detail = {
                order_id: toNumber(payload.order_id),
                product_id: toNumber(payload.product_id),
                quantity: toNumber(payload.quantity),
                price: toNumber(payload.price)
            };

            const stock = await repository.findProductStockById(detail.product_id);

            if (!stock) {
                throw createHttpError(404, "Product not found");
            }

            if (Number(stock.quantity) < detail.quantity) {
                throw createHttpError(400, "Not enough stock");
            }

            const result = await repository.createOrderDetailWithStockUpdate(detail);

            return {
                message: "Order detail added and stock updated",
                id: result.insertId
            };
        },

        async checkout(payload, user) {
            if (!user || !user.id) {
                throw createHttpError(401, "Vui lòng đăng nhập để tiếp tục");
            }

            const items = normalizeCheckoutItems(payload.items);
            const payment = validatePayment(payload.payment);
            const manualDiscount = normalizeManualDiscount(payload.manual_discount);
            const couponCode = String(payload.coupon_code || "").trim() || null;
            const products = await repository.findProductsByIds(
                items.map((item) => item.product_id)
            );
            const productsById = mapProductsById(products);
            const checkoutItems = [];

            for (const item of items) {
                const product = productsById.get(item.product_id);

                if (!product) {
                    throw createHttpError(404, "Sản phẩm không tồn tại");
                }

                if (Number(product.quantity) < item.quantity) {
                    throw createHttpError(400, `Sản phẩm ${product.name} không đủ tồn kho`);
                }

                checkoutItems.push({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    price: Number(product.price)
                });
            }

            const subtotal = checkoutItems.reduce(
                (sum, item) => sum + item.quantity * item.price,
                0
            );
            let couponDiscountPercent = 0;

            if (couponCode) {
                const promotion = await repository.findPromotionByCode(couponCode);

                if (!promotion) {
                    throw createHttpError(400, "Mã giảm giá không tồn tại hoặc đã hết hạn");
                }

                couponDiscountPercent = Number(promotion.discount_percent || 0);
            }

            const couponDiscount = Math.round(subtotal * couponDiscountPercent / 100);
            const manualDiscountAmount = calculateManualDiscount(subtotal, manualDiscount);
            const discountAmount = couponDiscount + manualDiscountAmount;

            if (discountAmount > subtotal) {
                throw createHttpError(400, "Giảm giá không hợp lệ");
            }

            const total = subtotal - discountAmount;
            const amountPaid = payment.method === "cash"
                ? payment.amount_paid
                : Math.max(payment.amount_paid, total);

            if (payment.method === "cash" && amountPaid < total) {
                throw createHttpError(400, "Tiền khách đưa chưa đủ");
            }

            const changeAmount = payment.method === "cash" ? amountPaid - total : 0;
            const request = {
                customer_id: payload.customer_id ? Number(payload.customer_id) : null,
                user_id: Number(user.id),
                source: "pos",
                status: "completed",
                items: checkoutItems,
                subtotal_amount: subtotal,
                discount_amount: discountAmount,
                total_amount: total,
                coupon_code: couponCode,
                discount_percent: couponDiscountPercent,
                manual_discount_type: manualDiscount.type,
                manual_discount_value: manualDiscount.value,
                payment_method: payment.method,
                amount_paid: amountPaid,
                change_amount: changeAmount
            };
            const result = await repository.checkout(request);

            return {
                message: "Thanh toán thành công",
                order_id: result.orderId,
                subtotal_amount: subtotal,
                discount_amount: discountAmount,
                total_amount: total,
                payment_method: payment.method,
                amount_paid: amountPaid,
                change_amount: changeAmount
            };
        },

        findDetailsById(orderId) {
            return repository.findDetailsById(Number(orderId));
        },

        findAll() {
            return repository.findAll();
        },

        findLatest(limit = 5) {
            return repository.findLatest(Number(limit) || 5);
        }
    };
}

module.exports = {
    createOrdersService,
    normalizeCheckoutItems,
    validatePayment,
    normalizeManualDiscount
};
```

- [ ] **Step 4: Run service tests and verify they pass**

Run:

```powershell
npm test -- tests/modules/orders/checkout.service.test.js
```

Expected: all checkout service tests pass.

## Task 2: Checkout Repository Transaction

**Files:**
- Modify: `src/modules/orders/repository.js`
- Create: `tests/modules/orders/checkout.repository.test.js`

- [ ] **Step 1: Write failing repository transaction tests**

Add `tests/modules/orders/checkout.repository.test.js`:

```js
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

            if (sql.includes("SELECT quantity FROM products")) {
                return [[{ quantity: 5 }]];
            }

            if (sql.includes("INSERT INTO orders")) {
                return [{ insertId: 44 }];
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

test("checkout locks stock, inserts order, details, stock updates, and commits", async () => {
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
        items: [{ product_id: 7, quantity: 2, price: 3200000 }],
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
    assert.deepEqual(events.map((event) => event[0]), [
        "begin",
        "execute",
        "execute",
        "execute",
        "execute",
        "commit",
        "release"
    ]);
    assert.match(events[1][1], /SELECT quantity FROM products/);
    assert.match(events[2][1], /INSERT INTO orders/);
    assert.match(events[3][1], /INSERT INTO order_details/);
    assert.match(events[4][1], /UPDATE products/);
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
```

- [ ] **Step 2: Run repository tests and verify they fail**

Run:

```powershell
npm test -- tests/modules/orders/checkout.repository.test.js
```

Expected: fail because `repository.checkout` is not implemented.

- [ ] **Step 3: Implement repository checkout SQL**

Update `src/modules/orders/repository.js`:

```js
function buildInClause(values) {
    return values.map(() => "?").join(", ");
}
```

Add methods inside `createOrdersRepository(db)`:

```js
async findProductsByIds(ids) {
    if (!ids.length) {
        return [];
    }

    const [rows] = await db.execute(
        `SELECT id, name, price, quantity
        FROM products
        WHERE id IN (${buildInClause(ids)})`,
        ids
    );
    return rows;
},

async findPromotionByCode(code) {
    const [rows] = await db.execute(
        `SELECT code, discount_percent
        FROM promotions
        WHERE code = ?`,
        [code]
    );
    return rows[0] || null;
},

async checkout(request) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        for (const item of request.items) {
            const [stockRows] = await connection.execute(
                "SELECT quantity FROM products WHERE id = ? FOR UPDATE",
                [item.product_id]
            );
            const stock = stockRows[0];

            if (!stock || Number(stock.quantity) < item.quantity) {
                const error = new Error("Sản phẩm không đủ tồn kho");
                error.status = 400;
                throw error;
            }
        }

        const [orderResult] = await connection.execute(
            `INSERT INTO orders
            (customer_id, user_id, table_id, table_order_id, source, status,
                subtotal_amount, discount_amount, total_amount,
                coupon_code, discount_percent,
                manual_discount_type, manual_discount_value,
                payment_method, amount_paid, change_amount)
            VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                request.customer_id,
                request.user_id,
                request.source,
                request.status,
                request.subtotal_amount,
                request.discount_amount,
                request.total_amount,
                request.coupon_code,
                request.discount_percent,
                request.manual_discount_type,
                request.manual_discount_value,
                request.payment_method,
                request.amount_paid,
                request.change_amount
            ]
        );

        for (const item of request.items) {
            await connection.execute(
                `INSERT INTO order_details (order_id, product_id, quantity, price)
                VALUES (?, ?, ?, ?)`,
                [
                    orderResult.insertId,
                    item.product_id,
                    item.quantity,
                    item.price
                ]
            );
            await connection.execute(
                `UPDATE products
                SET quantity = quantity - ?
                WHERE id = ?`,
                [item.quantity, item.product_id]
            );
        }

        await connection.commit();

        return {
            orderId: orderResult.insertId
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}
```

- [ ] **Step 4: Run repository tests and verify they pass**

Run:

```powershell
npm test -- tests/modules/orders/checkout.repository.test.js
```

Expected: all repository checkout tests pass.

## Task 3: Checkout Route And Auth Wiring

**Files:**
- Modify: `src/modules/orders/controller.js`
- Modify: `src/modules/orders/routes.js`
- Modify: `tests/app.test.js`

- [ ] **Step 1: Write failing route tests**

Append to `tests/app.test.js`:

```js
test("POST /api/staff/pos/checkout requires auth", async () => {
    const { createApp } = require("../src/app");
    const app = createApp({
        services: {
            orders: {
                checkout: async () => {
                    throw new Error("should not checkout");
                }
            }
        }
    });

    const response = await request(app, "/api/staff/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [] })
    });

    assert.equal(response.status, 401);
    assert.equal(response.body.message, "Vui lòng đăng nhập để tiếp tục");
});

test("POST /api/staff/pos/checkout passes request body and auth user to service", async () => {
    const { createApp } = require("../src/app");
    const calls = [];
    const app = createApp({
        services: {
            orders: {
                checkout: async (payload, user) => {
                    calls.push({ payload, user });
                    return {
                        message: "Thanh toán thành công",
                        order_id: 99
                    };
                }
            }
        }
    });

    const response = await request(app, "/api/staff/pos/checkout", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...authHeaders("staff")
        },
        body: JSON.stringify({
            user_id: 999,
            items: [{ product_id: 7, quantity: 1 }]
        })
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.order_id, 99);
    assert.equal(calls[0].user.id, 2);
    assert.equal(calls[0].payload.user_id, 999);
});
```

- [ ] **Step 2: Run app tests and verify they fail**

Run:

```powershell
npm test -- tests/app.test.js
```

Expected: checkout route test fails with 404 or missing controller method.

- [ ] **Step 3: Add controller and route**

Update `src/modules/orders/controller.js`:

```js
async checkout(req, res) {
    res.status(201).json(await service.checkout(req.body, req.user));
}
```

Update `src/modules/orders/routes.js`:

```js
router.post("/api/staff/pos/checkout", asyncHandler(controller.checkout));
```

Place the new route before `router.get("/orders/:id", ...)`.

- [ ] **Step 4: Run route tests and verify they pass**

Run:

```powershell
npm test -- tests/app.test.js
```

Expected: route wiring tests pass.

## Task 4: Schema Migration And Dump Update

**Files:**
- Create: `scripts/2026-07-05-pos-counter-checkout-migration.sql`
- Modify: `scripts/Dump20260704.sql`

- [ ] **Step 1: Add idempotent migration script**

Create `scripts/2026-07-05-pos-counter-checkout-migration.sql`:

```sql
-- POS Glasses Counter Checkout Migration
-- Purpose: Add payment and discount fields for atomic POS checkout.
USE `pos_glasses`;

DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_missing $$
CREATE PROCEDURE add_column_if_missing(
    IN table_name_value VARCHAR(64),
    IN column_name_value VARCHAR(64),
    IN ddl_value TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = table_name_value
          AND COLUMN_NAME = column_name_value
    ) THEN
        SET @ddl = ddl_value;
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END $$

DELIMITER ;

CALL add_column_if_missing('orders', 'subtotal_amount', 'ALTER TABLE `orders` ADD COLUMN `subtotal_amount` decimal(12,2) NOT NULL DEFAULT 0 AFTER `status`');
CALL add_column_if_missing('orders', 'discount_amount', 'ALTER TABLE `orders` ADD COLUMN `discount_amount` decimal(12,2) NOT NULL DEFAULT 0 AFTER `subtotal_amount`');
CALL add_column_if_missing('orders', 'manual_discount_type', 'ALTER TABLE `orders` ADD COLUMN `manual_discount_type` varchar(20) DEFAULT NULL AFTER `discount_percent`');
CALL add_column_if_missing('orders', 'manual_discount_value', 'ALTER TABLE `orders` ADD COLUMN `manual_discount_value` decimal(12,2) NOT NULL DEFAULT 0 AFTER `manual_discount_type`');
CALL add_column_if_missing('orders', 'payment_method', 'ALTER TABLE `orders` ADD COLUMN `payment_method` varchar(30) NOT NULL DEFAULT ''cash'' AFTER `manual_discount_value`');
CALL add_column_if_missing('orders', 'amount_paid', 'ALTER TABLE `orders` ADD COLUMN `amount_paid` decimal(12,2) NOT NULL DEFAULT 0 AFTER `payment_method`');
CALL add_column_if_missing('orders', 'change_amount', 'ALTER TABLE `orders` ADD COLUMN `change_amount` decimal(12,2) NOT NULL DEFAULT 0 AFTER `amount_paid`');

UPDATE `orders`
SET `subtotal_amount` = CASE WHEN `subtotal_amount` = 0 THEN IFNULL(`total_amount`, 0) ELSE `subtotal_amount` END,
    `amount_paid` = CASE WHEN `amount_paid` = 0 THEN IFNULL(`total_amount`, 0) ELSE `amount_paid` END
WHERE `source` IS NOT NULL;

DROP PROCEDURE IF EXISTS add_column_if_missing;
```

- [ ] **Step 2: Update dump orders table**

Modify `scripts/Dump20260704.sql` `CREATE TABLE orders` so it includes:

```sql
  `subtotal_amount` decimal(12,2) NOT NULL DEFAULT 0,
  `discount_amount` decimal(12,2) NOT NULL DEFAULT 0,
  `manual_discount_type` varchar(20) DEFAULT NULL,
  `manual_discount_value` decimal(12,2) NOT NULL DEFAULT 0,
  `payment_method` varchar(30) NOT NULL DEFAULT 'cash',
  `amount_paid` decimal(12,2) NOT NULL DEFAULT 0,
  `change_amount` decimal(12,2) NOT NULL DEFAULT 0,
```

Modify the `INSERT INTO orders` column list to include the new fields. Existing seed rows should set `subtotal_amount` and `amount_paid` to the current `total_amount`, `discount_amount` to `0`, `manual_discount_type` to `NULL`, `manual_discount_value` to `0`, `payment_method` to `'cash'`, and `change_amount` to `0`.

- [ ] **Step 3: Sanity-check SQL text**

Run:

```powershell
rg -n "subtotal_amount|payment_method|manual_discount" scripts\2026-07-05-pos-counter-checkout-migration.sql scripts\Dump20260704.sql
```

Expected: both files contain the new POS checkout fields.

## Task 5: Frontend POS Checkout Screen

**Files:**
- Rewrite: `frontend/orders.html`
- Use existing helpers: `frontend/assets/js/api.js`, `frontend/assets/js/auth.js`, `frontend/assets/js/format.js`, `frontend/assets/js/ui.js`, `frontend/assets/js/components.js`

- [ ] **Step 1: Replace two-step invoice UI with POS workspace**

Rewrite `frontend/orders.html` with these main DOM ids:

```html
<input id="productSearch" type="search">
<div id="productGrid"></div>
<select id="customerSelect"></select>
<div id="cartLines"></div>
<input id="couponCode">
<select id="manualDiscountType">
    <option value="">Không giảm thủ công</option>
    <option value="percent">%</option>
    <option value="amount">VNĐ</option>
</select>
<input id="manualDiscountValue" type="number" min="0">
<select id="paymentMethod">
    <option value="cash">Tiền mặt</option>
    <option value="bank_transfer">Chuyển khoản</option>
    <option value="card">Thẻ</option>
</select>
<input id="amountPaid" type="number" min="0">
<button id="checkoutButton" onclick="checkout()">Thanh toán</button>
```

Keep the existing sidebar style and use existing shared CSS variables. Product cards should use stable dimensions and disable add actions when `quantity <= 0`.

- [ ] **Step 2: Add POS page state and loading**

Inside the page script, use this state shape:

```js
const currentUser = requireRole(["admin", "staff"]);
const state = {
    products: [],
    customers: [],
    cart: new Map(),
    couponCode: "",
    manualDiscountType: "",
    manualDiscountValue: 0,
    paymentMethod: "cash",
    amountPaid: 0,
    submitting: false
};
```

Load data:

```js
async function initPos() {
    if (!currentUser) return;
    document.getElementById("welcomeUser").textContent = currentUser.username;
    const [products, customers] = await Promise.all([
        apiRequest("/products"),
        apiRequest("/customers")
    ]);
    state.products = products;
    state.customers = customers;
    renderCustomers();
    renderProducts();
    renderCart();
}
```

- [ ] **Step 3: Render products and cart**

Implement:

```js
function addToCart(productId) {
    const product = state.products.find((item) => Number(item.id) === Number(productId));
    if (!product || Number(product.quantity) <= 0) return;
    const current = state.cart.get(Number(productId)) || 0;
    if (current >= Number(product.quantity)) {
        showToast("Số lượng vượt quá tồn kho hiện tại", "warning");
        return;
    }
    state.cart.set(Number(productId), current + 1);
    renderCart();
}

function setCartQuantity(productId, quantity) {
    const product = state.products.find((item) => Number(item.id) === Number(productId));
    const nextQuantity = Math.max(0, Number(quantity) || 0);
    if (nextQuantity === 0) {
        state.cart.delete(Number(productId));
    } else if (product && nextQuantity <= Number(product.quantity)) {
        state.cart.set(Number(productId), nextQuantity);
    }
    renderCart();
}

function provisionalTotals() {
    const subtotal = [...state.cart.entries()].reduce((sum, [productId, quantity]) => {
        const product = state.products.find((item) => Number(item.id) === Number(productId));
        return sum + (product ? Number(product.price) * quantity : 0);
    }, 0);
    const manualValue = Number(document.getElementById("manualDiscountValue").value || 0);
    const manualType = document.getElementById("manualDiscountType").value;
    const manualDiscount = manualType === "percent"
        ? Math.round(subtotal * manualValue / 100)
        : Math.round(manualValue);
    const total = Math.max(0, subtotal - manualDiscount);
    const amountPaid = Number(document.getElementById("amountPaid").value || 0);
    return {
        subtotal,
        manualDiscount,
        total,
        amountPaid,
        change: Math.max(0, amountPaid - total)
    };
}
```

Display coupon as a submitted value but let backend validate final coupon discount.

- [ ] **Step 4: Submit checkout**

Implement:

```js
async function checkout() {
    if (state.submitting) return;
    const items = [...state.cart.entries()].map(([product_id, quantity]) => ({
        product_id,
        quantity
    }));

    if (!items.length) {
        showToast("Vui lòng chọn ít nhất một sản phẩm", "warning");
        return;
    }

    state.submitting = true;
    document.getElementById("checkoutButton").disabled = true;

    try {
        const customerValue = document.getElementById("customerSelect").value;
        const result = await apiRequest("/api/staff/pos/checkout", {
            method: "POST",
            body: {
                customer_id: customerValue ? Number(customerValue) : null,
                items,
                coupon_code: document.getElementById("couponCode").value.trim() || null,
                manual_discount: {
                    type: document.getElementById("manualDiscountType").value || null,
                    value: Number(document.getElementById("manualDiscountValue").value || 0)
                },
                payment: {
                    method: document.getElementById("paymentMethod").value,
                    amount_paid: Number(document.getElementById("amountPaid").value || 0)
                }
            }
        });

        showToast(`Đã thanh toán hóa đơn #${result.order_id}`, "success");
        state.cart.clear();
        await initPos();
        window.location.href = `/invoice_detail.html?id=${result.order_id}`;
    } catch (error) {
        showToast(error.message, "error");
    } finally {
        state.submitting = false;
        document.getElementById("checkoutButton").disabled = false;
    }
}
```

- [ ] **Step 5: Manual browser smoke test**

Start server:

```powershell
npm start
```

Open:

```text
http://localhost:3000/orders.html
```

Expected: page loads for authenticated users, product list renders, cart totals update, and unauthenticated users redirect to login.

## Task 6: Navigation And Landing Cleanup

**Files:**
- Modify: `frontend/assets/js/auth.js`
- Modify: `frontend/dashboard.html`
- Modify: `frontend/products.html`
- Modify: `frontend/orders.html`
- Modify: `frontend/invoices.html`
- Modify: `frontend/invoice_detail.html`

- [ ] **Step 1: Update staff landing**

In `frontend/assets/js/auth.js`, change:

```js
return "/staff/qr-orders.html";
```

to:

```js
return "/orders.html";
```

- [ ] **Step 2: Remove primary QR/table nav links**

In primary sidebars, ensure the selling nav points to:

```html
<a href="/orders.html" class="pos-nav-item">
    <span class="nav-icon"><i class="ph ph-cash-register"></i></span> <span>Bán hàng</span>
</a>
<a href="/invoices.html" class="pos-nav-item">
    <span class="nav-icon"><i class="ph ph-receipt"></i></span> <span>Hóa đơn</span>
</a>
```

Do not include `/staff/qr-orders.html` or `/admin/tables.html` in the main POS selling nav.

- [ ] **Step 3: Search for leftover primary QR/table navigation**

Run:

```powershell
rg -n --glob "!node_modules/**" "staff/qr-orders|admin/tables|Yêu cầu QR|Bàn QR" frontend
```

Expected: matches may remain only inside the legacy QR/table pages themselves, not in the primary POS pages.

## Task 7: Receipt And Order Query Compatibility

**Files:**
- Modify: `src/modules/orders/repository.js`
- Modify: `frontend/invoice_detail.html`

- [ ] **Step 1: Include POS payment fields in order detail queries**

In `findDetailsById`, add selected fields:

```sql
o.subtotal_amount,
o.discount_amount,
o.manual_discount_type,
o.manual_discount_value,
o.payment_method,
o.amount_paid,
o.change_amount,
```

Keep existing fields so old receipt code still works.

- [ ] **Step 2: Display payment summary on receipt**

In `frontend/invoice_detail.html`, render fields after total:

```html
<div class="receipt-info-row">
    <span class="receipt-info-label">THANH TOÁN:</span>
    <span>${paymentLabel(first.payment_method)}</span>
</div>
<div class="receipt-info-row">
    <span class="receipt-info-label">KHÁCH ĐƯA:</span>
    <span>${formatCurrency(first.amount_paid || first.total_amount)}</span>
</div>
<div class="receipt-info-row">
    <span class="receipt-info-label">TIỀN THỐI:</span>
    <span>${formatCurrency(first.change_amount || 0)}</span>
</div>
```

Add helper:

```js
function paymentLabel(method) {
    return {
        cash: "Tiền mặt",
        bank_transfer: "Chuyển khoản",
        card: "Thẻ"
    }[method] || "Tiền mặt";
}
```

- [ ] **Step 3: Run existing order/detail tests**

Run:

```powershell
npm test -- tests/modules/orders/orderDetails.service.test.js tests/modules/orders/orders.repository.test.js
```

Expected: existing order tests still pass.

## Task 8: Full Verification

**Files:**
- All touched files

- [ ] **Step 1: Run full test suite**

Run:

```powershell
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Search for legacy two-step checkout calls in POS page**

Run:

```powershell
rg -n "apiRequest\\(\"/orders\"|apiRequest\\(\"/order-details\"|createOrder\\(|addOrderDetail\\(" frontend\orders.html
```

Expected: no matches.

- [ ] **Step 3: Search for POS checkout route**

Run:

```powershell
rg -n "/api/staff/pos/checkout|checkout\\(" src tests frontend\orders.html
```

Expected: route, service tests, app tests, and frontend checkout usage are present.

- [ ] **Step 4: Summarize manual DB verification**

If a local MySQL database is configured, apply migration and complete one checkout through the UI. Verify:

```sql
SELECT id, source, subtotal_amount, discount_amount, total_amount, payment_method, amount_paid, change_amount
FROM orders
ORDER BY id DESC
LIMIT 1;
```

Expected: latest row has `source = 'pos'` and payment fields populated.
