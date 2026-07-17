const assert = require("node:assert/strict");
const test = require("node:test");
const bcrypt = require("bcrypt");
const {
    ensureBootstrapAdmin,
    validateBootstrapCredentials
} = require("../../src/db/bootstrapAdmin");

test("bootstrap credentials require a strong paired username and password", () => {
    assert.equal(validateBootstrapCredentials({}), null);
    assert.throws(
        () => validateBootstrapCredentials({ username: "admin" }),
        /must be set together/
    );
    assert.throws(
        () => validateBootstrapCredentials({ username: "admin", password: "short1" }),
        /12-128/
    );
});

test("production requires bootstrap credentials when the users table is empty", async () => {
    const db = {
        execute: async () => [[{ total: 0 }]]
    };

    await assert.rejects(
        () => ensureBootstrapAdmin(db, {}, { isProd: true }),
        /No application users exist/
    );
});

test("bootstrap creates the first administrator with a bcrypt password", async () => {
    const calls = [];
    const db = {
        async execute(sql, params) {
            calls.push({ sql, params });
            if (sql.includes("COUNT(*)")) return [[{ total: 0 }]];
            return [{ insertId: 9 }];
        }
    };

    const result = await ensureBootstrapAdmin(db, {
        username: "admin.store",
        password: "StrongPassword2026"
    }, { isProd: true });

    assert.equal(result.created, true);
    assert.equal(result.id, 9);
    assert.equal(calls[1].params[0], "admin.store");
    assert.equal(await bcrypt.compare("StrongPassword2026", calls[1].params[1]), true);
});

test("production refuses to start while plaintext legacy passwords remain", async () => {
    let call = 0;
    const db = {
        async execute() {
            call += 1;
            if (call === 1) return [[{ total: 2 }]];
            return [[{ id: 2, username: "legacy.staff" }]];
        }
    };

    await assert.rejects(
        () => ensureBootstrapAdmin(db, {}, { isProd: true }),
        /legacy\.staff/
    );
});
