function toSqlDatetime(value) {
    if (value instanceof Date) return value.toISOString().slice(0, 19).replace("T", " ");
    const text = String(value || "").trim();
    const isoMatch = text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
    return isoMatch ? `${isoMatch[1]} ${isoMatch[2]}` : text || null;
}

function createPaymentsRepository(db) {
    return {
        async recordDelivery(delivery) {
            try {
                const [result] = await db.execute(
                    `INSERT INTO payment_webhook_deliveries
                    (provider, delivery_key, signature_valid, processing_status, error_code, processed_at)
                    VALUES (?, ?, ?, ?, ?, NOW())`,
                    [delivery.provider, delivery.delivery_key, delivery.signature_valid ? 1 : 0,
                        delivery.processing_status, delivery.error_code || null]
                );
                return { inserted: true, id: result.insertId };
            } catch (error) {
                if (error?.code === "ER_DUP_ENTRY" || error?.errno === 1062) return { inserted: false };
                throw error;
            }
        },
        async createIntent(intent) {
            const [result] = await db.execute(
                `INSERT INTO payment_intents
                (public_id, order_id, provider, purpose, is_test, currency,
                 expected_amount, transfer_content, bank_code, account_number_masked,
                 status, expires_at, created_by)
                VALUES (?, ?, ?, ?, ?, 'VND', ?, ?, ?, ?, 'pending', ?, ?)`,
                [intent.public_id, intent.order_id || null, intent.provider, intent.purpose,
                    intent.is_test ? 1 : 0, intent.expected_amount, intent.transfer_content,
                    intent.bank_code || null, intent.account_number_masked || null,
                    intent.expires_at, intent.created_by || null]
            );
            return { id: result.insertId, ...intent, status: "pending", received_amount: 0 };
        },
        async findIntentByPublicId(publicId) {
            const [rows] = await db.execute("SELECT * FROM payment_intents WHERE public_id = ?", [publicId]);
            return rows[0] || null;
        },
        async findPendingIntentByContent(content) {
            const [rows] = await db.execute(
                `SELECT * FROM payment_intents
                 WHERE status = 'pending' AND expires_at > NOW() AND ? LIKE CONCAT('%', transfer_content, '%')
                 ORDER BY created_at DESC LIMIT 2`,
                [content]
            );
            return rows.length === 1 ? rows[0] : null;
        },
        async findIntentCandidateByContent(content, createdAfter) {
            const [rows] = await db.execute(
                `SELECT * FROM payment_intents
                 WHERE status IN ('pending', 'expired')
                   AND created_at >= ?
                   AND ? LIKE CONCAT('%', transfer_content, '%')
                 ORDER BY created_at DESC LIMIT 2`,
                [toSqlDatetime(createdAfter), content]
            );
            return rows.length === 1 ? rows[0] : null;
        },
        async recordTransaction(transaction) {
            try {
                const [result] = await db.execute(
                    `INSERT INTO payment_transactions
                    (provider, provider_transaction_id, payment_intent_id, account_number_masked,
                     transfer_type, amount, transfer_content, bank_reference, transaction_at,
                     signature_valid, match_status, raw_payload_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [transaction.provider, transaction.provider_transaction_id,
                        transaction.payment_intent_id || null, transaction.account_number_masked || null,
                        transaction.transfer_type, transaction.amount, transaction.transfer_content,
                        transaction.bank_reference || null, toSqlDatetime(transaction.transaction_at),
                        transaction.signature_valid ? 1 : 0, transaction.match_status,
                        JSON.stringify(transaction.raw || {})]
                );
                return { inserted: true, id: result.insertId };
            } catch (error) {
                if (error?.code === "ER_DUP_ENTRY" || error?.errno === 1062) return { inserted: false };
                throw error;
            }
        },
        async markTestIntentPaid(intentId, amount) {
            const [result] = await db.execute(
                `UPDATE payment_intents SET status = 'paid', received_amount = ?, paid_at = NOW()
                 WHERE id = ? AND is_test = 1 AND status = 'pending' AND expires_at > NOW()`,
                [amount, intentId]
            );
            return result.affectedRows === 1;
        },
        async claimOrderIntent(intentId) {
            const [result] = await db.execute(
                `UPDATE payment_intents SET status = 'processing'
                 WHERE id = ? AND is_test = 0 AND status = 'pending' AND expires_at > NOW()`,
                [intentId]
            );
            return result.affectedRows === 1;
        },
        async markOrderIntentPaid(intentId, amount) {
            const [result] = await db.execute(
                `UPDATE payment_intents SET status = 'paid', received_amount = ?, paid_at = NOW()
                 WHERE id = ? AND is_test = 0 AND status = 'processing'`,
                [amount, intentId]
            );
            return result.affectedRows === 1;
        },
        async markNeedsReview(intentId) {
            await db.execute(
                `UPDATE payment_intents SET status = 'needs_review' WHERE id = ? AND status = 'processing'`,
                [intentId]
            );
        },
        async findExpiredPending(limit = 50) {
            const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
            const [rows] = await db.execute(
                `SELECT * FROM payment_intents WHERE status = 'pending' AND expires_at <= NOW()
                 ORDER BY expires_at ASC LIMIT ${safeLimit}`
            );
            return rows;
        },
        async markExpired(intentId) {
            const [result] = await db.execute(
                `UPDATE payment_intents SET status = 'expired', cancelled_at = NOW()
                 WHERE id = ? AND status = 'pending' AND expires_at <= NOW()`,
                [intentId]
            );
            return result.affectedRows === 1;
        },
        async listIntents(filters = {}) {
            const where = [];
            const params = [];
            if (filters.status) { where.push("status = ?"); params.push(String(filters.status)); }
            if (filters.is_test === "0" || filters.is_test === "1") { where.push("is_test = ?"); params.push(Number(filters.is_test)); }
            const limit = Math.min(200, Math.max(1, Number(filters.limit) || 50));
            const [rows] = await db.execute(
                `SELECT id, public_id, order_id, provider, purpose, is_test, expected_amount,
                        received_amount, transfer_content, status, expires_at, paid_at, created_at
                 FROM payment_intents ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
                 ORDER BY id DESC LIMIT ${limit}`, params
            );
            return rows;
        },
        async listTransactions(filters = {}) {
            const params = [];
            const where = filters.match_status ? "WHERE match_status = ?" : "";
            if (filters.match_status) params.push(String(filters.match_status));
            const limit = Math.min(200, Math.max(1, Number(filters.limit) || 50));
            const [rows] = await db.execute(
                `SELECT id, provider, provider_transaction_id, payment_intent_id,
                        account_number_masked, transfer_type, amount, transfer_content,
                        bank_reference, transaction_at, match_status, received_at
                 FROM payment_transactions ${where} ORDER BY id DESC LIMIT ${limit}`, params
            );
            return rows;
        }
    };
}

module.exports = { createPaymentsRepository };
