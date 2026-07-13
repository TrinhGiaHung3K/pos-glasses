const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const jwt = require("jsonwebtoken");
const { env } = require("../src/config/env");

async function request(app, path, options = {}) {
    const server = http.createServer(app);

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

    const { port } = server.address();

    try {
        const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
        const body = await response.json();

        return {
            status: response.status,
            body
        };
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

function authHeaders(role = "staff") {
    const token = jwt.sign(
        {
            id: role === "admin" ? 1 : 2,
            username: role,
            role
        },
        env.jwt.secret,
        { expiresIn: "1h" }
    );

    return {
        Authorization: `Bearer ${token}`
    };
}

test("GET / returns API health payload", async () => {
    const { createApp } = require("../src/app");

    const app = createApp();

    const response = await request(app, "/");

    assert.equal(response.status, 200);
    assert.equal(response.body.message, "POS Glasses API Running");
    assert.equal(typeof response.body.request_id, "string");
    assert.ok(response.body.request_id.length > 0);
});

test("GET /favicon.ico is public and does not fall through to auth", async () => {
    const { createApp } = require("../src/app");
    const app = createApp();
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/favicon.ico`);
        assert.equal(response.status, 204);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

test("GET /latest-orders returns recent orders through route wiring", async () => {
    const { createApp } = require("../src/app");

    const app = createApp({
        repositories: {
            orders: {
                findLatest: async (limit) => [
                    {
                        id: 3,
                        customer_name: "Tran Thi B",
                        username: "admin",
                        total_amount: "7600000.00",
                        created_at: "2026-06-25T00:34:59.000Z",
                        limit
                    }
                ]
            }
        }
    });

    const response = await request(app, "/latest-orders", {
        headers: authHeaders("staff")
    });

    assert.equal(response.status, 200);
    assert.equal(response.body[0].id, 3);
    assert.equal(response.body[0].limit, 5);
});

test("GET /api/public/tables/:token/menu does not require auth", async () => {
    const { createApp } = require("../src/app");

    const app = createApp({
        services: {
            tables: {
                getPublicMenu: async (token) => ({
                    table: {
                        id: 1,
                        code: "T01",
                        name: "Bàn tư vấn 01",
                        token
                    },
                    products: [{ id: 7, name: "RayBan Aviator Classic" }]
                })
            }
        }
    });

    const response = await request(app, "/api/public/tables/table-t01/menu");

    assert.equal(response.status, 200);
    assert.equal(response.body.table.code, "T01");
    assert.equal(response.body.products[0].id, 7);
});

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

test("GET /api/staff/customers/member/:memberCode allows staff barcode lookup", async () => {
    const { createApp } = require("../src/app");
    const calls = [];

    const app = createApp({
        services: {
            customers: {
                findAll: async () => [],
                findByMemberCode: async (memberCode) => {
                    calls.push(memberCode);
                    return {
                        id: 1,
                        member_code: memberCode,
                        name: "Nguyen Van A",
                        is_member: true
                    };
                }
            }
        }
    });

    const response = await request(app, "/api/staff/customers/member/2900000000018", {
        headers: authHeaders("staff")
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.member_code, "2900000000018");
    assert.deepEqual(calls, ["2900000000018"]);
});

test("GET /customers/member/:memberCode remains available for staff barcode lookup", async () => {
    const { createApp } = require("../src/app");
    const calls = [];

    const app = createApp({
        services: {
            customers: {
                findAll: async () => [],
                findByMemberCode: async (memberCode) => {
                    calls.push(memberCode);
                    return {
                        id: 1,
                        member_code: memberCode,
                        name: "Nguyen Van A",
                        is_member: true
                    };
                }
            }
        }
    });

    const response = await request(app, "/customers/member/2900000000018", {
        headers: authHeaders("staff")
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.member_code, "2900000000018");
    assert.deepEqual(calls, ["2900000000018"]);
});

test("GET /api/staff/performance/me returns current staff rank", async () => {
    const { createApp } = require("../src/app");
    const calls = [];

    const app = createApp({
        services: {
            staffPerformance: {
                findCurrentUserPerformance: async (userId) => {
                    calls.push(userId);
                    return {
                        id: userId,
                        username: "staff",
                        level: { code: "NULL", discount_percent: 0 },
                        progress: { percent: 0 }
                    };
                }
            }
        }
    });

    const response = await request(app, "/api/staff/performance/me", {
        headers: authHeaders("staff")
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.level.code, "NULL");
    assert.deepEqual(calls, [2]);
});

test("GET /api/admin/staff-performance returns admin leaderboard", async () => {
    const { createApp } = require("../src/app");

    const app = createApp({
        services: {
            staffPerformance: {
                listStaffPerformance: async () => [
                    {
                        id: 1,
                        username: "admin",
                        level: { code: "Gold", discount_percent: 5 },
                        progress: { percent: 80 }
                    }
                ]
            }
        }
    });

    const response = await request(app, "/api/admin/staff-performance", {
        headers: authHeaders("admin")
    });

    assert.equal(response.status, 200);
    assert.equal(response.body[0].level.code, "Gold");
});

test("public product QR resolver does not require auth", async () => {
    const { createApp } = require("../src/app");
    const code = "A".repeat(32);
    const app = createApp({ services: { productQr: { resolve: async (value) => ({ name: "RayBan", public_code: value }) } } });
    const response = await request(app, `/api/public/products/by-qr/${code}`);
    assert.equal(response.status, 200);
    assert.equal(response.body.public_code, code);
});

test("staff payment intent route delegates authenticated cart", async () => {
    const { createApp } = require("../src/app");
    const calls = [];
    const app = createApp({ services: { payments: {
        createOrderIntent: async (payload, user) => { calls.push({ payload, user }); return { public_id: "p1", payment_status: "pending" }; },
        findIntent: async () => ({})
    } } });
    const response = await request(app, "/api/staff/pos/payment-intents", {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders("staff") },
        body: JSON.stringify({ items: [{ product_id: 7, quantity: 1 }] })
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.payment_status, "pending");
    assert.equal(calls[0].user.id, 2);
});

test("admin AI endpoint rejects staff even inside authenticated router", async () => {
    const { createApp } = require("../src/app");
    const app = createApp({ services: { ai: { chat: async () => ({ answer: "secret" }) } } });
    const response = await request(app, "/api/admin/ai/chat", {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders("staff") },
        body: JSON.stringify({ message: "doanh thu" })
    });
    assert.equal(response.status, 403);
});
