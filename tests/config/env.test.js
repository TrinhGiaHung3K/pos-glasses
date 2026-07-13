const assert = require("node:assert/strict");
const test = require("node:test");

test("createEnv uses safe defaults and supplied database credentials", () => {
    const { createEnv } = require("../../src/config/env");

    const env = createEnv({
        NODE_ENV: "test",
        DB_PASSWORD: "secret"
    });

    assert.equal(env.port, 3000);
    assert.equal(env.database.host, "localhost");
    assert.equal(env.database.port, 3306);
    assert.equal(env.database.user, "root");
    assert.equal(env.database.password, "secret");
    assert.equal(env.database.name, "pos_glasses");
    assert.equal(env.security.allowPublicRegister, false);
    assert.equal(env.payment.testMode, false);
    assert.equal(env.payment.testAmount, 2900);
    assert.equal(env.ai.defaultModel, "gemini-3.1-flash-lite");
});

test("createEnv parses custom ports and names", () => {
    const { createEnv } = require("../../src/config/env");

    const env = createEnv({
        NODE_ENV: "development",
        PORT: "4000",
        DB_HOST: "127.0.0.1",
        DB_PORT: "3307",
        DB_USER: "pos_user",
        DB_PASSWORD: "secret",
        DB_NAME: "custom_pos"
    });

    assert.equal(env.port, 4000);
    assert.deepEqual(env.database, {
        host: "127.0.0.1",
        port: 3307,
        user: "pos_user",
        password: "secret",
        name: "custom_pos",
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
});

test("createEnv fails fast in production without JWT_SECRET", () => {
    const { createEnv } = require("../../src/config/env");

    assert.throws(
        () => createEnv({ NODE_ENV: "production" }),
        /JWT_SECRET/
    );

    const env = createEnv({
        NODE_ENV: "production",
        JWT_SECRET: "super-secret-production-key"
    });
    assert.equal(env.jwt.secret, "super-secret-production-key");
    assert.equal(env.jwt.isDefault, false);
});

test("createEnv respects ALLOW_PUBLIC_REGISTER", () => {
    const { createEnv } = require("../../src/config/env");
    const env = createEnv({
        NODE_ENV: "test",
        ALLOW_PUBLIC_REGISTER: "true"
    });
    assert.equal(env.security.allowPublicRegister, true);
});

test("createEnv parses payment and AI feature flags", () => {
    const { createEnv } = require("../../src/config/env");
    const env = createEnv({
        NODE_ENV: "test",
        PAYMENT_PROVIDER: "sepay",
        PAYMENT_TEST_MODE: "true",
        PAYMENT_TEST_AMOUNT: "2900",
        PAYMENT_INTENT_TTL_MINUTES: "15",
        AI_ENABLED: "true",
        AI_DAILY_BUDGET_USD: "12.5",
        PUBLIC_APP_URL: "https://pos.example.com/"
    });
    assert.equal(env.payment.provider, "sepay");
    assert.equal(env.payment.testMode, true);
    assert.equal(env.payment.testAmount, 2900);
    assert.equal(env.payment.intentTtlMinutes, 15);
    assert.equal(env.ai.enabled, true);
    assert.equal(env.ai.dailyBudgetUsd, 12.5);
    assert.equal(env.publicAppUrl, "https://pos.example.com");
});
