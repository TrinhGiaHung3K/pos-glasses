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
    assert.equal(env.payment.testMode, false);
    assert.equal(env.payment.testAmount, 2900);
    assert.equal(env.payment.intentTtlMinutes, 30);
    assert.equal(env.cloudinary.enabled, false);
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
        JWT_SECRET: "super-secret-production-key",
        PAYMENT_PROVIDER: "sepay",
        PAYMENT_WEBHOOK_AUTH: "hmac",
        PAYMENT_WEBHOOK_SECRET: "payment-webhook-secret",
        PAYMENT_ACCOUNT_NUMBER: "0123456789",
        PAYMENT_BANK_CODE: "VCB"
    });
    assert.equal(env.jwt.secret, "super-secret-production-key");
    assert.equal(env.jwt.isDefault, false);
    assert.equal(env.security.sessionCookieName, "__Host-pos_session");
});

test("createEnv parses payment and AI feature flags", () => {
    const { createEnv } = require("../../src/config/env");
    const env = createEnv({
        NODE_ENV: "test",
        PAYMENT_PROVIDER: "sepay",
        PAYMENT_TEST_MODE: "true",
        PAYMENT_TEST_AMOUNT: "2900",
        PAYMENT_INTENT_TTL_MINUTES: "15",
        PAYMENT_ACCOUNT_NUMBER: "0123456789",
        PAYMENT_BANK_CODE: "VCB",
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

test("production CORS defaults to the public app instead of reflecting every origin", () => {
    const { createEnv } = require("../../src/config/env");
    const env = createEnv({
        NODE_ENV: "production",
        JWT_SECRET: "super-secret-production-key",
        PUBLIC_APP_URL: "https://pos.example.com",
        PAYMENT_PROVIDER: "sepay",
        PAYMENT_WEBHOOK_AUTH: "api_key",
        PAYMENT_WEBHOOK_API_KEY: "payment-api-key",
        PAYMENT_ACCOUNT_NUMBER: "0123456789",
        PAYMENT_BANK_CODE: "VCB"
    });
    assert.deepEqual(env.security.corsOrigins, ["https://pos.example.com"]);
});

test("createEnv rejects unsafe production payment settings", () => {
    const { createEnv } = require("../../src/config/env");
    const base = {
        NODE_ENV: "production",
        JWT_SECRET: "super-secret-production-key"
    };

    assert.throws(() => createEnv(base), /PAYMENT_PROVIDER=fake/);
    assert.throws(() => createEnv({
        ...base,
        PAYMENT_PROVIDER: "sepay",
        PAYMENT_ACCOUNT_NUMBER: "0123456789",
        PAYMENT_BANK_CODE: "VCB",
        PAYMENT_WEBHOOK_SECRET: "secret",
        PAYMENT_TEST_MODE: "true"
    }), /PAYMENT_TEST_MODE/);
    assert.throws(() => createEnv({
        ...base,
        PAYMENT_PROVIDER: "sepay",
        PAYMENT_ACCOUNT_NUMBER: "0123456789",
        PAYMENT_BANK_CODE: "VCB"
    }), /secret hoặc API key/);
});

test("createEnv rejects incomplete or unknown payment providers", () => {
    const { createEnv } = require("../../src/config/env");

    assert.throws(() => createEnv({ NODE_ENV: "test", PAYMENT_PROVIDER: "unknown" }), /không được hỗ trợ/);
    assert.throws(() => createEnv({ NODE_ENV: "test", PAYMENT_PROVIDER: "sepay" }), /PAYMENT_ACCOUNT_NUMBER/);
    assert.throws(() => createEnv({
        NODE_ENV: "test",
        PAYMENT_WEBHOOK_AUTH: "none"
    }), /PAYMENT_WEBHOOK_AUTH/);
});
