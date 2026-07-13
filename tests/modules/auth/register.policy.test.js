const assert = require("node:assert/strict");
const test = require("node:test");

test("register is blocked when public register disabled", async () => {
    // Reload env module path is sticky; test service with mocked env via direct service behavior
    const { createAuthService } = require("../../../src/modules/auth/service");
    const { env } = require("../../../src/config/env");

    // In test NODE_ENV, allowPublicRegister defaults false
    assert.equal(env.security.allowPublicRegister, false);

    const service = createAuthService({
        findByUsername: async () => null,
        createUser: async () => ({ id: 1, username: "x", role: "staff" })
    });

    await assert.rejects(
        () => service.register({ username: "newbie", password: "123456" }),
        { status: 403 }
    );
});

test("admin createUser creates staff account", async () => {
    const { createAuthService } = require("../../../src/modules/auth/service");
    const calls = [];
    const service = createAuthService({
        findByUsername: async () => null,
        createUser: async (username, hash, role, active) => {
            calls.push({ username, role, active });
            return { id: 9, username, role, is_active: active };
        }
    });

    const result = await service.createUser({
        username: "staff9",
        password: "secret1",
        role: "staff"
    });

    assert.equal(result.user.username, "staff9");
    assert.equal(calls[0].role, "staff");
    assert.ok(!result.token);
});
