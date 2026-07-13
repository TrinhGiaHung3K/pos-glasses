const assert = require("node:assert/strict");
const test = require("node:test");
const { createRateLimiter } = require("../../src/middleware/rateLimit");

function mockReq(key = "a") {
    return { ip: key, body: {} };
}

function mockRes() {
    const headers = {};
    return {
        headers,
        statusCode: 200,
        setHeader(k, v) { headers[k] = v; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

test("rate limiter allows under max then blocks", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2, keyFn: (req) => req.ip });
    const nextCalls = [];
    const next = () => nextCalls.push(1);

    limiter(mockReq("ip1"), mockRes(), next);
    limiter(mockReq("ip1"), mockRes(), next);
    assert.equal(nextCalls.length, 2);

    const res = mockRes();
    limiter(mockReq("ip1"), res, next);
    assert.equal(res.statusCode, 429);
    assert.equal(nextCalls.length, 2);
});
