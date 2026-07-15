const crypto = require("node:crypto");

function safeEqual(left, right) {
    const a = Buffer.from(String(left || ""));
    const b = Buffer.from(String(right || ""));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createSePayProvider(options = {}) {
    const secret = String(options.webhookSecret || "");
    const apiKey = String(options.webhookApiKey || options.webhookSecret || "");
    const authMode = String(options.webhookAuthMode || "auto").toLowerCase();
    const maxSkewSeconds = Math.max(30, Number(options.webhookMaxSkewSeconds) || 300);

    function verifyApiKey(headers) {
        if (!apiKey) return false;
        const authorization = String(headers.authorization || "");
        return safeEqual(authorization, `Apikey ${apiKey}`);
    }

    function verifyHmac(headers, rawBody) {
        if (!secret) return false;
        const timestampText = String(headers["x-sepay-timestamp"] || "").trim();
        const timestamp = Number(timestampText);
        if (!Number.isInteger(timestamp)) return false;
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (Math.abs(nowSeconds - timestamp) > maxSkewSeconds) return false;

        const supplied = String(headers["x-sepay-signature"] || "").trim();
        const digest = crypto
            .createHmac("sha256", secret)
            .update(`${timestampText}.${rawBody}`)
            .digest("hex");
        return safeEqual(supplied, `sha256=${digest}`);
    }

    return {
        name: "sepay",
        createQr(intent) {
            return {
                qr_payload: `https://img.vietqr.io/image/${encodeURIComponent(intent.bank_code)}-${encodeURIComponent(options.accountNumber || "")}-compact2.png?amount=${intent.expected_amount}&addInfo=${encodeURIComponent(intent.transfer_content)}`,
                bank_code: intent.bank_code,
                account_number_masked: intent.account_number_masked
            };
        },
        verifyWebhook(headers = {}, rawBody = "") {
            if (authMode === "api_key") return verifyApiKey(headers);
            if (authMode === "hmac") return verifyHmac(headers, rawBody);
            return verifyApiKey(headers) || verifyHmac(headers, rawBody);
        },
        normalizeTransaction(payload = {}) {
            return {
                provider_transaction_id: String(payload.id || payload.referenceCode || ""),
                account_number: String(payload.accountNumber || ""),
                sub_account: String(payload.subAccount || ""),
                transfer_type: String(payload.transferType || "").toLowerCase(),
                amount: Math.round(Number(payload.transferAmount || 0)),
                transfer_content: String(payload.content || payload.code || ""),
                payment_code: String(payload.code || ""),
                bank_reference: String(payload.referenceCode || ""),
                transaction_at: payload.transactionDate || new Date().toISOString(),
                raw: payload
            };
        }
    };
}

module.exports = { createSePayProvider, safeEqual };
