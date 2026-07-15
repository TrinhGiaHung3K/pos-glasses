const crypto = require("node:crypto");
const { createHttpError } = require("../../middleware/httpError");
const { publishPaymentEvent } = require("./events");

function maskAccount(value) {
    const text = String(value || "").replace(/\D/g, "");
    return text ? `${"*".repeat(Math.max(0, text.length - 4))}${text.slice(-4)}` : "";
}

function normalizeAccountIdentifier(value) {
    return String(value || "").replace(/\D/g, "");
}

function publicIntent(intent, qr) {
    return {
        public_id: intent.public_id,
        order_id: intent.order_id ? Number(intent.order_id) : null,
        provider: intent.provider,
        purpose: intent.purpose,
        is_test: Boolean(intent.is_test),
        currency: "VND",
        expected_amount: Number(intent.expected_amount),
        received_amount: Number(intent.received_amount || 0),
        transfer_content: intent.transfer_content,
        bank_code: intent.bank_code,
        account_number_masked: intent.account_number_masked,
        status: intent.status,
        payment_status: intent.status,
        expires_at: intent.expires_at,
        qr_payload: qr?.qr_payload || null
    };
}

function createPaymentsService(repository, options = {}) {
    const config = options.config || {};
    const provider = options.provider;
    const ordersService = options.ordersService;
    return {
        async createTestIntent(user) {
            if (!config.testMode) throw createHttpError(404, "Payment test mode đang tắt");
            if (!user || user.role !== "admin") throw createHttpError(403, "Chỉ admin được tạo giao dịch kiểm thử");
            const now = Date.now();
            const intent = {
                public_id: crypto.randomUUID().replace(/-/g, ""),
                provider: provider.name,
                purpose: "verification",
                is_test: true,
                expected_amount: Math.max(1, Number(config.testAmount) || 2900),
                transfer_content: `PGT${crypto.randomBytes(5).toString("hex").toUpperCase()}`,
                bank_code: config.bankCode || "TEST",
                account_number_masked: maskAccount(config.accountNumber),
                expires_at: new Date(now + Math.max(1, config.intentTtlMinutes || 10) * 60000),
                created_by: Number(user.id)
            };
            const created = await repository.createIntent(intent);
            return publicIntent(created, provider.createQr(created));
        },
        async findIntent(publicId) {
            const intent = await repository.findIntentByPublicId(String(publicId || ""));
            if (!intent) throw createHttpError(404, "Không tìm thấy giao dịch");
            return publicIntent(intent);
        },
        async createOrderIntent(payload, user, meta = {}) {
            if (!ordersService) throw createHttpError(503, "Payment service chưa sẵn sàng");
            if (provider.name !== "fake" && (!config.bankCode || !config.accountNumber)) {
                throw createHttpError(503, "Chưa cấu hình tài khoản nhận chuyển khoản");
            }
            const checkoutPayload = {
                ...payload,
                payment: { ...(payload.payment || {}), method: "bank_transfer", amount_paid: 0 }
            };
            const pendingOrder = await ordersService.checkout(checkoutPayload, user, {
                ...meta,
                deferPayment: true
            });
            const intent = {
                public_id: crypto.randomUUID().replace(/-/g, ""),
                order_id: pendingOrder.order_id,
                provider: provider.name,
                purpose: "order",
                is_test: false,
                expected_amount: Number(pendingOrder.total_amount),
                transfer_content: `PG${Number(pendingOrder.order_id).toString(36).toUpperCase()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
                bank_code: config.bankCode,
                account_number_masked: maskAccount(config.accountNumber),
                expires_at: new Date(Date.now() + Math.max(1, config.intentTtlMinutes || 10) * 60000),
                created_by: Number(user.id)
            };
            try {
                const created = await repository.createIntent(intent);
                return { ...publicIntent(created, provider.createQr(created)), order_id: pendingOrder.order_id };
            } catch (error) {
                await ordersService.cancelPendingPayment(pendingOrder.order_id, "Không tạo được payment intent");
                throw error;
            }
        },
        async simulatePayment(publicId, user) {
            if (!config.allowSimulation || provider.name !== "fake") {
                throw createHttpError(404, "Mô phỏng thanh toán không khả dụng");
            }
            if (!user?.id) throw createHttpError(401, "Vui lòng đăng nhập để tiếp tục");
            const intent = await repository.findIntentByPublicId(String(publicId || ""));
            if (!intent || intent.status !== "pending") {
                throw createHttpError(409, "Giao dịch không còn chờ thanh toán");
            }
            const payload = {
                id: `SIM-${crypto.randomUUID()}`,
                accountNumber: config.accountNumber || "",
                transferType: "in",
                transferAmount: Number(intent.expected_amount),
                content: intent.transfer_content,
                referenceCode: `SIM-${Date.now()}`,
                transactionDate: new Date().toISOString()
            };
            const result = await this.handleWebhook({}, JSON.stringify(payload), payload);
            return {
                ...result,
                public_id: intent.public_id,
                order_id: intent.order_id ? Number(intent.order_id) : null,
                status: result.matched ? "paid" : intent.status
            };
        },
        async handleWebhook(headers, rawBody, payload) {
            if (!provider.verifyWebhook(headers, rawBody)) throw createHttpError(401, "Webhook signature không hợp lệ");
            const tx = provider.normalizeTransaction(payload);
            if (!tx.provider_transaction_id || tx.amount <= 0 || tx.transfer_type !== "in") {
                throw createHttpError(400, "Dữ liệu giao dịch không hợp lệ");
            }
            const delivery = await repository.recordDelivery({
                provider: provider.name,
                delivery_key: tx.provider_transaction_id,
                signature_valid: true,
                processing_status: "received"
            });
            // A duplicated delivery can be a provider retry after an earlier
            // attempt failed before the transaction row was inserted. Continue
            // through the idempotent transaction insert instead of returning.
            const expectedAccount = normalizeAccountIdentifier(config.accountNumber);
            const receivedAccounts = [tx.account_number, tx.sub_account]
                .map(normalizeAccountIdentifier)
                .filter(Boolean);
            const accountMatches = !expectedAccount || receivedAccounts.includes(expectedAccount);
            const matchContent = `${tx.payment_code || ""} ${tx.transfer_content || ""}`.trim();
            const candidateCutoff = new Date(
                Date.now() - Math.max(1, Number(config.lateMatchWindowMinutes) || 60) * 60_000
            );
            const intent = accountMatches
                ? (repository.findIntentCandidateByContent
                    ? await repository.findIntentCandidateByContent(matchContent, candidateCutoff)
                    : await repository.findPendingIntentByContent(matchContent))
                : null;
            const activeIntent = intent
                && intent.status === "pending"
                && new Date(intent.expires_at).getTime() > Date.now();
            const amountMatches = intent && Number(intent.expected_amount) === tx.amount;
            const matchStatus = !accountMatches ? "account_mismatch"
                : !intent ? "unmatched"
                    : !activeIntent ? "late_payment"
                        : !amountMatches ? "amount_mismatch" : "matched";
            const recorded = await repository.recordTransaction({
                ...tx,
                provider: provider.name,
                payment_intent_id: intent?.id,
                account_number_masked: maskAccount(tx.account_number),
                signature_valid: true,
                match_status: matchStatus
            });
            if (!recorded.inserted) return { success: true, duplicate: true };
            if (matchStatus === "matched" && Number(intent.is_test) === 1) {
                const paid = await repository.markTestIntentPaid(intent.id, tx.amount);
                if (paid) publishPaymentEvent({ type: "payment.paid", public_id: intent.public_id, status: "paid" });
            } else if (matchStatus === "matched" && intent.order_id && ordersService) {
                const claimed = await repository.claimOrderIntent(intent.id);
                if (!claimed) return { success: true, matched: false, match_status: "state_changed" };
                let paid = false;
                try {
                    await ordersService.finalizePendingPayment(intent.order_id);
                    paid = await repository.markOrderIntentPaid(intent.id, tx.amount);
                } catch (error) {
                    await repository.markNeedsReview(intent.id);
                    throw error;
                }
                if (paid) publishPaymentEvent({
                    type: "payment.paid",
                    public_id: intent.public_id,
                    order_id: Number(intent.order_id),
                    status: "paid"
                });
            }
            return { success: true, matched: matchStatus === "matched", match_status: matchStatus };
        },
        async expirePendingIntents(limit = 50) {
            const expired = await repository.findExpiredPending(limit);
            const results = [];
            for (const intent of expired) {
                if (intent.order_id && ordersService) {
                    const cancelled = await ordersService.cancelPendingPayment(intent.order_id, "Payment intent expired");
                    if (!cancelled?.cancelled) continue;
                }
                const marked = await repository.markExpired(intent.id);
                if (!marked) continue;
                publishPaymentEvent({
                    type: "payment.expired",
                    public_id: intent.public_id,
                    order_id: intent.order_id ? Number(intent.order_id) : null,
                    status: "expired"
                });
                results.push(intent.public_id);
            }
            return results;
        },
        async adminList(query, user) {
            if (user?.role !== "admin") throw createHttpError(403, "Chỉ admin được xem đối soát");
            const [intents, transactions] = await Promise.all([
                repository.listIntents(query),
                repository.listTransactions(query)
            ]);
            return { intents, transactions };
        }
    };
}

module.exports = { createPaymentsService, maskAccount, normalizeAccountIdentifier, publicIntent };
