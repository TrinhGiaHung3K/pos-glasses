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

function parseCorsOrigins(value, options = {}) {
    if (!value || !String(value).trim()) {
        // Reflect origins only in local development. Production falls back to
        // the configured public application URL instead of accepting every
        // requesting origin while credentials are enabled.
        return options.isProd ? [options.publicAppUrl] : true;
    }
    const list = String(value)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    if (list.includes("*")) {
        return options.isProd ? [options.publicAppUrl] : true;
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
    const publicAppUrl = String(source.PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

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
            corsOrigins: parseCorsOrigins(source.CORS_ORIGINS, { isProd, publicAppUrl }),
            sessionCookieName: source.SESSION_COOKIE_NAME || "pos_session",
            sessionCookieMaxAgeMs: Math.max(1, parseInteger(source.SESSION_TTL_HOURS, 24)) * 60 * 60 * 1000,
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
            webhookApiKey: source.PAYMENT_WEBHOOK_API_KEY || source.PAYMENT_WEBHOOK_SECRET || "",
            webhookAuthMode: String(source.PAYMENT_WEBHOOK_AUTH || "auto").trim().toLowerCase(),
            webhookMaxSkewSeconds: parseInteger(source.PAYMENT_WEBHOOK_MAX_SKEW_SECONDS, 300),
            accountNumber: source.PAYMENT_ACCOUNT_NUMBER || "",
            bankCode: source.PAYMENT_BANK_CODE || "",
            intentTtlMinutes: parseInteger(source.PAYMENT_INTENT_TTL_MINUTES, 30),
            lateMatchWindowMinutes: parseInteger(source.PAYMENT_LATE_MATCH_WINDOW_MINUTES, 60),
            testMode: parseBoolean(source.PAYMENT_TEST_MODE, false),
            testAmount: parseInteger(source.PAYMENT_TEST_AMOUNT, 2900)
        },
        cloudinary: {
            enabled: parseBoolean(
                source.CLOUDINARY_ENABLED,
                Boolean(source.CLOUDINARY_URL || (source.CLOUDINARY_CLOUD_NAME && source.CLOUDINARY_API_KEY && source.CLOUDINARY_API_SECRET))
            ),
            url: source.CLOUDINARY_URL || "",
            cloudName: source.CLOUDINARY_CLOUD_NAME || "",
            apiKey: source.CLOUDINARY_API_KEY || "",
            apiSecret: source.CLOUDINARY_API_SECRET || "",
            folder: source.CLOUDINARY_PRODUCT_FOLDER || "pos-glasses/products"
        },
        ai: {
            enabled: parseBoolean(source.AI_ENABLED, false),
            apiKey: source.GEMINI_API_KEY || "",
            defaultModel: source.GEMINI_DEFAULT_MODEL || "gemini-3.1-flash-lite",
            analysisModel: source.GEMINI_ANALYSIS_MODEL || "gemini-3.5-flash",
            dailyBudgetUsd: Math.max(0, Number(source.AI_DAILY_BUDGET_USD || 5))
        },
        publicAppUrl
    };
}

module.exports = {
    createEnv,
    env: createEnv(),
    DEFAULT_JWT_SECRET
};
