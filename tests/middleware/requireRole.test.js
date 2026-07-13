const assert = require("node:assert/strict");
const test = require("node:test");

test("requireRole rejects unauthenticated requests", () => {
    const { requireRole } = require("../../src/middleware/requireRole");
    const middleware = requireRole("admin");

    assert.throws(
        () => middleware({}, {}, () => {}),
        {
            status: 401,
            message: "Vui lòng đăng nhập để tiếp tục"
        }
    );
});

test("requireRole rejects users without an allowed role", () => {
    const { requireRole } = require("../../src/middleware/requireRole");
    const middleware = requireRole("admin");

    assert.throws(
        () => middleware({ user: { role: "staff" } }, {}, () => {}),
        {
            status: 403,
            message: "Bạn không có quyền truy cập chức năng này"
        }
    );
});

test("requireRole allows users with an allowed role", () => {
    const { requireRole } = require("../../src/middleware/requireRole");
    const middleware = requireRole("admin", "staff");
    let called = false;

    middleware({ user: { role: "staff" } }, {}, () => {
        called = true;
    });

    assert.equal(called, true);
});
