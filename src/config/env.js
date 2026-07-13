require("dotenv").config({ quiet: true });

const DEFAULT_JWT_SECRET = "pos-glasses-secret-key-2026";

function parseInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

function parseBoolean(value, fallback = false) {
    if (value == null || value === "") {
        return fallback;
    }
    const normalized = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
        return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
        return false;
    }
    return fallback;
}

function parseCorsOrigins(value) {
    if (!value || !String(value).trim()) {
        return true; // reflect request origin (dev-friendly)
    }
    const list = String(value)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    if (list.includes("*")) {
        return true;
    }
    return list;
}

function createEnv(source = process.env) {
    // Default development so unit tests / local createEnv() stay usable.
    // `npm start` sets NODE_ENV=production and enforces JWT_SECRET.
    const nodeEnv = source.NODE_ENV || "development";
    const isProd = nodeEnv === "production";
    const isTest = nodeEnv === "test";
    const jwtSecret = source.JWT_SECRET || DEFAULT_JWT_SECRET;
    const jwtIsDefault = !source.JWT_SECRET || jwtSecret === DEFAULT_JWT_SECRET;

    // Fail-fast in production if JWT secret is missing/default
    if (isProd && jwtIsDefault) {
        throw new Error(
            "JWT_SECRET is required in production. Set a strong secret in .env (do not use the default)."
        );
    }

    return {
        nodeEnv,
        isDev: nodeEnv === "development",
        isProd,
        isTest,
        port: parseInteger(source.PORT, 3000),
        jwt: {
            secret: jwtSecret,
            expiresIn: source.JWT_EXPIRES_IN || "24h",
            isDefault: jwtIsDefault
        },
        security: {
            // Public self-register: off by default (admin creates users)
            allowPublicRegister: parseBoolean(source.ALLOW_PUBLIC_REGISTER, false),
            corsOrigins: parseCorsOrigins(source.CORS_ORIGINS),
            loginRateLimit: {
                windowMs: parseInteger(source.LOGIN_RATE_WINDOW_MS, 15 * 60 * 1000),
                maxAttempts: parseInteger(source.LOGIN_RATE_MAX, 10)
            }
        },
        database: {
            host: source.DB_HOST || "localhost",
            port: parseInteger(source.DB_PORT, 3306),
            user: source.DB_USER || "root",
            password: source.DB_PASSWORD || "",
            name: source.DB_NAME || "pos_glasses",
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        },
        payment: {
            provider: source.PAYMENT_PROVIDER || "fake",
            webhookSecret: source.PAYMENT_WEBHOOK_SECRET || "",
            accountNumber: source.PAYMENT_ACCOUNT_NUMBER || "",
            bankCode: source.PAYMENT_BANK_CODE || "",
            intentTtlMinutes: parseInteger(source.PAYMENT_INTENT_TTL_MINUTES, 10),
            testMode: parseBoolean(source.PAYMENT_TEST_MODE, false),
            testAmount: parseInteger(source.PAYMENT_TEST_AMOUNT, 2900)
        },
        ai: {
            enabled: parseBoolean(source.AI_ENABLED, false),
            apiKey: source.GEMINI_API_KEY || "",
            defaultModel: source.GEMINI_DEFAULT_MODEL || "gemini-3.1-flash-lite",
            analysisModel: source.GEMINI_ANALYSIS_MODEL || "gemini-3.5-flash",
            dailyBudgetUsd: Math.max(0, Number(source.AI_DAILY_BUDGET_USD || 5))
        },
        publicAppUrl: String(source.PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")
    };
}

module.exports = {
    createEnv,
    env: createEnv(),
    DEFAULT_JWT_SECRET
};
