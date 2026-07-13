function createLoyaltyRepository(db) {
    return {
        async getCustomerLoyalty(customerId) {
            const [rows] = await db.execute(
                `SELECT id, name, membership_status, membership_tier,
                    COALESCE(points_balance, 0) AS points_balance,
                    COALESCE(lifetime_spend, 0) AS lifetime_spend,
                    care_of_user_id
                FROM customers WHERE id = ? LIMIT 1`,
                [customerId]
            );
            return rows[0] || null;
        },

        async applyCheckoutLoyalty(connection, {
            customerId,
            orderId,
            pointsEarned,
            pointsRedeemed,
            netSpend,
            newTier,
            createdBy
        }) {
            const [rows] = await connection.execute(
                `SELECT points_balance, lifetime_spend, membership_tier
                FROM customers WHERE id = ? FOR UPDATE`,
                [customerId]
            );
            const customer = rows[0];
            if (!customer) {
                const err = new Error("Hội viên không tồn tại");
                err.status = 404;
                throw err;
            }

            let balance = Number(customer.points_balance) || 0;
            if (pointsRedeemed > balance) {
                const err = new Error("Điểm hội viên không đủ");
                err.status = 400;
                throw err;
            }

            if (pointsRedeemed > 0) {
                balance -= pointsRedeemed;
                await connection.execute(
                    `INSERT INTO points_ledger
                    (customer_id, delta, balance_after, reason, order_id, note, created_by)
                    VALUES (?, ?, ?, 'redeem', ?, ?, ?)`,
                    [
                        customerId,
                        -pointsRedeemed,
                        balance,
                        orderId,
                        "Đổi điểm thanh toán",
                        createdBy
                    ]
                );
            }

            if (pointsEarned > 0) {
                balance += pointsEarned;
                await connection.execute(
                    `INSERT INTO points_ledger
                    (customer_id, delta, balance_after, reason, order_id, note, created_by)
                    VALUES (?, ?, ?, 'earn', ?, ?, ?)`,
                    [
                        customerId,
                        pointsEarned,
                        balance,
                        orderId,
                        "Tích điểm đơn hàng",
                        createdBy
                    ]
                );
            }

            const lifetime = Number(customer.lifetime_spend) + Number(netSpend || 0);

            await connection.execute(
                `UPDATE customers
                SET points_balance = ?,
                    lifetime_spend = ?,
                    membership_tier = COALESCE(?, membership_tier)
                WHERE id = ?`,
                [balance, lifetime, newTier || null, customerId]
            );

            return { points_balance: balance, lifetime_spend: lifetime };
        },

        async reverseOrderLoyalty(connection, {
            customerId,
            orderId,
            pointsEarned,
            pointsRedeemed,
            netSpend,
            createdBy
        }) {
            const [rows] = await connection.execute(
                `SELECT points_balance, lifetime_spend
                FROM customers WHERE id = ? FOR UPDATE`,
                [customerId]
            );
            const customer = rows[0];
            if (!customer) {
                return null;
            }

            let balance = Number(customer.points_balance) || 0;

            // Reverse earn first (subtract), then restore redeem (add back)
            if (pointsEarned > 0) {
                balance = Math.max(0, balance - pointsEarned);
                await connection.execute(
                    `INSERT INTO points_ledger
                    (customer_id, delta, balance_after, reason, order_id, note, created_by)
                    VALUES (?, ?, ?, 'void_earn', ?, ?, ?)`,
                    [customerId, -pointsEarned, balance, orderId, "Hoàn điểm khi hủy/hoàn đơn", createdBy]
                );
            }
            if (pointsRedeemed > 0) {
                balance += pointsRedeemed;
                await connection.execute(
                    `INSERT INTO points_ledger
                    (customer_id, delta, balance_after, reason, order_id, note, created_by)
                    VALUES (?, ?, ?, 'void_redeem', ?, ?, ?)`,
                    [customerId, pointsRedeemed, balance, orderId, "Hoàn điểm đã đổi", createdBy]
                );
            }

            const lifetime = Math.max(0, Number(customer.lifetime_spend) - Number(netSpend || 0));
            await connection.execute(
                `UPDATE customers
                SET points_balance = ?, lifetime_spend = ?
                WHERE id = ?`,
                [balance, lifetime, customerId]
            );
            return { points_balance: balance, lifetime_spend: lifetime };
        },

        async listLedger(customerId, { limit = 50 } = {}) {
            const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
            const [rows] = await db.execute(
                `SELECT id, delta, balance_after, reason, order_id, note, created_at
                FROM points_ledger
                WHERE customer_id = ?
                ORDER BY id DESC
                LIMIT ${safeLimit}`,
                [customerId]
            );
            return rows;
        }
    };
}

module.exports = {
    createLoyaltyRepository
};
