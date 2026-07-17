const assert = require("node:assert/strict");
const test = require("node:test");

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
        password: "secret1234",
        role: "staff"
    });

    assert.equal(result.user.username, "staff9");
    assert.equal(calls[0].role, "staff");
    assert.ok(!result.token);
});
