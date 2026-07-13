const CUSTOMER_SELECT = `
    c.id,
    c.member_code,
    c.name,
    c.phone,
    c.email,
    c.address,
    c.gender,
    c.date_of_birth,
    c.notes,
    c.membership_status,
    c.membership_tier,
    c.member_since,
    c.registered_by,
    COALESCE(c.points_balance, 0) AS points_balance,
    COALESCE(c.lifetime_spend, 0) AS lifetime_spend,
    c.care_of_user_id,
    c.created_at,
    c.updated_at,
    u.username AS registered_by_name
`;

function createCustomersRepository(db) {
    return {
        async findAll() {
            const [rows] = await db.execute(
                `SELECT ${CUSTOMER_SELECT}
                FROM customers c
                LEFT JOIN users u ON u.id = c.registered_by
                ORDER BY c.id DESC`
            );
            return rows;
        },

        async findFiltered(filters = {}) {
            const where = [];
            const params = [];

            if (filters.q) {
                where.push("(c.name LIKE ? OR c.phone LIKE ? OR c.member_code LIKE ? OR c.email LIKE ?)");
                const like = `%${filters.q}%`;
                params.push(like, like, like, like);
            }
            if (filters.tier) {
                where.push("c.membership_tier = ?");
                params.push(String(filters.tier));
            }
            if (filters.status) {
                where.push("c.membership_status = ?");
                params.push(String(filters.status));
            }

            const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

            if (!filters.paginate) {
                const [rows] = await db.execute(
                    `SELECT ${CUSTOMER_SELECT}
                    FROM customers c
                    LEFT JOIN users u ON u.id = c.registered_by
                    ${whereSql}
                    ORDER BY c.id DESC`,
                    params
                );
                return { items: rows, total: rows.length };
            }

            const [countRows] = await db.execute(
                `SELECT COUNT(*) AS total FROM customers c ${whereSql}`,
                params
            );
            const limit = Number(filters.limit) || 50;
            const offset = Number(filters.offset) || 0;
            const [rows] = await db.execute(
                `SELECT ${CUSTOMER_SELECT}
                FROM customers c
                LEFT JOIN users u ON u.id = c.registered_by
                ${whereSql}
                ORDER BY c.id DESC
                LIMIT ${limit} OFFSET ${offset}`,
                params
            );
            return {
                items: rows,
                total: Number(countRows[0]?.total || 0)
            };
        },

        async findById(id) {
            const [rows] = await db.execute(
                `SELECT ${CUSTOMER_SELECT}
                FROM customers c
                LEFT JOIN users u ON u.id = c.registered_by
                WHERE c.id = ?
                LIMIT 1`,
                [id]
            );
            return rows[0] || null;
        },

        async findByMemberCode(memberCode) {
            const [rows] = await db.execute(
                `SELECT ${CUSTOMER_SELECT}
                FROM customers c
                LEFT JOIN users u ON u.id = c.registered_by
                WHERE c.member_code = ?
                LIMIT 1`,
                [memberCode]
            );
            return rows[0] || null;
        },

        async findByPhone(phone) {
            const [rows] = await db.execute(
                `SELECT ${CUSTOMER_SELECT}
                FROM customers c
                LEFT JOIN users u ON u.id = c.registered_by
                WHERE c.phone = ?
                LIMIT 1`,
                [phone]
            );
            return rows[0] || null;
        },

        /**
         * Customer 360 aggregates for POS CRM drawer.
         */
        async findSummary(customerId) {
            const customer = await this.findById(customerId);
            if (!customer) {
                return null;
            }

            let recentOrders = [];
            let topProducts = [];
            let pointsLedger = [];

            try {
                const [orders] = await db.execute(
                    `SELECT id, total_amount, status, source, payment_method, created_at,
                        COALESCE(points_earned, 0) AS points_earned,
                        COALESCE(points_redeemed, 0) AS points_redeemed
                    FROM orders
                    WHERE customer_id = ?
                    ORDER BY id DESC
                    LIMIT 12`,
                    [customerId]
                );
                recentOrders = orders;

                const [products] = await db.execute(
                    `SELECT p.id, p.name, p.sku,
                        SUM(od.quantity - IFNULL(od.refunded_quantity, 0)) AS qty
                    FROM order_details od
                    JOIN orders o ON o.id = od.order_id
                    LEFT JOIN products p ON p.id = od.product_id
                    WHERE o.customer_id = ?
                      AND o.status IN ('completed', 'partial_refund', 'refunded')
                    GROUP BY p.id, p.name, p.sku
                    HAVING qty > 0
                    ORDER BY qty DESC
                    LIMIT 8`,
                    [customerId]
                );
                topProducts = products;
            } catch {
                // ignore if columns missing
            }

            try {
                const [ledger] = await db.execute(
                    `SELECT id, delta, balance_after, reason, order_id, note, created_at
                    FROM points_ledger
                    WHERE customer_id = ?
                    ORDER BY id DESC
                    LIMIT 20`,
                    [customerId]
                );
                pointsLedger = ledger;
            } catch {
                // points_ledger optional until Phase 2 schema
            }

            return {
                customer,
                recent_orders: recentOrders,
                top_products: topProducts,
                points_ledger: pointsLedger
            };
        },

        async create(customer) {
            const [result] = await db.execute(
                `INSERT INTO customers
                (
                    name, phone, email, address,
                    gender, date_of_birth, notes,
                    membership_status, membership_tier,
                    member_since, registered_by, member_code
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    customer.name,
                    customer.phone,
                    customer.email,
                    customer.address,
                    customer.gender,
                    customer.date_of_birth,
                    customer.notes,
                    customer.membership_status,
                    customer.membership_tier,
                    customer.member_since,
                    customer.registered_by,
                    customer.member_code
                ]
            );
            return result;
        },

        async assignMemberCode(id, memberCode) {
            const [result] = await db.execute(
                `UPDATE customers
                SET member_code = ?
                WHERE id = ?`,
                [memberCode, id]
            );
            return result;
        },

        async update(id, customer) {
            const [result] = await db.execute(
                `UPDATE customers
                SET name = ?,
                    phone = ?,
                    email = ?,
                    address = ?,
                    gender = ?,
                    date_of_birth = ?,
                    notes = ?,
                    membership_status = ?,
                    membership_tier = ?
                WHERE id = ?`,
                [
                    customer.name,
                    customer.phone,
                    customer.email,
                    customer.address,
                    customer.gender,
                    customer.date_of_birth,
                    customer.notes,
                    customer.membership_status,
                    customer.membership_tier,
                    id
                ]
            );
            return result;
        },

        async updateStatus(id, membershipStatus) {
            const [result] = await db.execute(
                `UPDATE customers
                SET membership_status = ?
                WHERE id = ?`,
                [membershipStatus, id]
            );
            return result;
        },

        async remove(id) {
            const [result] = await db.execute(
                "DELETE FROM customers WHERE id = ?",
                [id]
            );
            return result;
        }
    };
}

module.exports = {
    createCustomersRepository
};
