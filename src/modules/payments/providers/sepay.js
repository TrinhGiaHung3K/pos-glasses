const crypto = require("node:crypto");

function safeEqual(left, right) {
    const a = Buffer.from(String(left || ""));
    const b = Buffer.from(String(right || ""));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createSePayProvider(options = {}) {
    const secret = String(options.webhookSecret || "");
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
            if (!secret) return false;
            const authorization = String(headers.authorization || "");
            if (safeEqual(authorization, `Apikey ${secret}`)) return true;
            const supplied = String(headers["x-sepay-signature"] || headers["x-signature"] || "").replace(/^sha256=/i, "");
            const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
            return safeEqual(supplied, expected);
        },
        normalizeTransaction(payload = {}) {
            return {
                provider_transaction_id: String(payload.id || payload.referenceCode || ""),
                account_number: String(payload.accountNumber || ""),
                transfer_type: String(payload.transferType || "").toLowerCase(),
                amount: Math.round(Number(payload.transferAmount || 0)),
                transfer_content: String(payload.content || payload.code || ""),
                bank_reference: String(payload.referenceCode || ""),
                transaction_at: payload.transactionDate || new Date().toISOString(),
                raw: payload
            };
        }
    };
}

module.exports = { createSePayProvider, safeEqual };
