function createFakePaymentProvider(options = {}) {
    return {
        name: "fake",
        createQr(intent) {
            return {
                qr_payload: `FAKE|${intent.bank_code || "TEST"}|${intent.expected_amount}|${intent.transfer_content}`,
                bank_code: intent.bank_code || "TEST",
                account_number_masked: intent.account_number_masked || "***0000"
            };
        },
        verifyWebhook() {
            return true;
        },
        normalizeTransaction(payload = {}) {
            return {
                provider_transaction_id: String(payload.id || payload.transaction_id || ""),
                account_number: String(payload.accountNumber || payload.account_number || ""),
                transfer_type: String(payload.transferType || payload.transfer_type || "in").toLowerCase(),
                amount: Math.round(Number(payload.transferAmount ?? payload.amount ?? 0)),
                transfer_content: String(payload.content || payload.transfer_content || ""),
                bank_reference: String(payload.referenceCode || payload.reference || ""),
                transaction_at: payload.transactionDate || payload.transaction_at || new Date().toISOString(),
                raw: payload
            };
        }
    };
}

module.exports = { createFakePaymentProvider };
