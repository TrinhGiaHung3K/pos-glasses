function createSuppliersRepository(db) {
    return {
        async list({ q = "", activeOnly = true } = {}) {
            const where = [];
            const params = [];
            if (activeOnly) {
                where.push("is_active = 1");
            }
            if (q) {
                where.push("(name LIKE ? OR phone LIKE ? OR email LIKE ?)");
                const like = `%${q}%`;
                params.push(like, like, like);
            }
            const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
            const [rows] = await db.execute(
                `SELECT * FROM suppliers ${whereSql} ORDER BY name ASC`,
                params
            );
            return rows;
        },

        async findById(id) {
            const [rows] = await db.execute(
                `SELECT * FROM suppliers WHERE id = ? LIMIT 1`,
                [id]
            );
            return rows[0] || null;
        },

        async create(row) {
            const [result] = await db.execute(
                `INSERT INTO suppliers (name, phone, email, address, note, is_active)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [row.name, row.phone, row.email, row.address, row.note, row.is_active ? 1 : 0]
            );
            return this.findById(result.insertId);
        },

        async update(id, row) {
            await db.execute(
                `UPDATE suppliers
                SET name = ?, phone = ?, email = ?, address = ?, note = ?, is_active = ?
                WHERE id = ?`,
                [row.name, row.phone, row.email, row.address, row.note, row.is_active ? 1 : 0, id]
            );
            return this.findById(id);
        },

        async listPurchaseOrders({ page = 1, limit = 30, status = null, supplierId = null } = {}) {
            const where = [];
            const params = [];
            if (status) {
                where.push("po.status = ?");
                params.push(status);
            }
            if (supplierId) {
                where.push("po.supplier_id = ?");
                params.push(Number(supplierId));
            }
            const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
            const safeLimit = Math.min(100, Math.max(1, Number(limit) || 30));
            const safePage = Math.max(1, Number(page) || 1);
            const offset = (safePage - 1) * safeLimit;

            const [countRows] = await db.execute(
                `SELECT COUNT(*) AS total FROM purchase_orders po ${whereSql}`,
                params
            );
            const [items] = await db.execute(
                `SELECT po.*, s.name AS supplier_name
                FROM purchase_orders po
                LEFT JOIN suppliers s ON s.id = po.supplier_id
                ${whereSql}
                ORDER BY po.id DESC
                LIMIT ${safeLimit} OFFSET ${offset}`,
                params
            );

            return {
                items,
                page: safePage,
                limit: safeLimit,
                total: Number(countRows[0]?.total || 0)
            };
        },

        async findPurchaseOrder(id) {
            const [rows] = await db.execute(
                `SELECT po.*, s.name AS supplier_name, s.phone AS supplier_phone
                FROM purchase_orders po
                LEFT JOIN suppliers s ON s.id = po.supplier_id
                WHERE po.id = ?
                LIMIT 1`,
                [id]
            );
            return rows[0] || null;
        },

        async listPoItems(poId) {
            const [rows] = await db.execute(
                `SELECT poi.*, p.name AS product_name, p.sku
                FROM purchase_order_items poi
                LEFT JOIN products p ON p.id = poi.product_id
                WHERE poi.purchase_order_id = ?
                ORDER BY poi.id ASC`,
                [poId]
            );
            return rows;
        },

        async createPurchaseOrder({ supplierId, note, createdBy, items }) {
            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();
                const [result] = await connection.execute(
                    `INSERT INTO purchase_orders
                    (supplier_id, status, note, ordered_at, created_by)
                    VALUES (?, 'ordered', ?, NOW(), ?)`,
                    [supplierId, note, createdBy]
                );
                const poId = result.insertId;

                for (const item of items) {
                    await connection.execute(
                        `INSERT INTO purchase_order_items
                        (purchase_order_id, product_id, qty_ordered, qty_received, unit_cost)
                        VALUES (?, ?, ?, 0, ?)`,
                        [poId, item.product_id, item.qty_ordered, item.unit_cost]
                    );
                }

                await connection.commit();
                return this.getPurchaseOrderDetail(poId);
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        },

        async getPurchaseOrderDetail(id) {
            const po = await this.findPurchaseOrder(id);
            if (!po) return null;
            const items = await this.listPoItems(id);
            return { ...po, items };
        },

        /**
         * Mark PO received and return lines for stock movements.
         * applyStockFn(connection, lines) optional — called inside TX if provided.
         */
        async receivePurchaseOrder(id, { receivedBy, stockApply }) {
            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();

                const [poRows] = await connection.execute(
                    `SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE`,
                    [id]
                );
                const po = poRows[0];
                if (!po) {
                    const err = new Error("Không tìm thấy đơn nhập");
                    err.status = 404;
                    throw err;
                }
                if (po.status === "received") {
                    const err = new Error("Đơn nhập đã nhận hàng");
                    err.status = 400;
                    throw err;
                }
                if (po.status === "cancelled") {
                    const err = new Error("Đơn nhập đã hủy");
                    err.status = 400;
                    throw err;
                }

                const [items] = await connection.execute(
                    `SELECT * FROM purchase_order_items WHERE purchase_order_id = ? FOR UPDATE`,
                    [id]
                );

                for (const item of items) {
                    await connection.execute(
                        `UPDATE purchase_order_items
                        SET qty_received = qty_ordered
                        WHERE id = ?`,
                        [item.id]
                    );
                }

                await connection.execute(
                    `UPDATE purchase_orders
                    SET status = 'received', received_at = NOW()
                    WHERE id = ?`,
                    [id]
                );

                const movementLines = items.map((item) => ({
                    product_id: Number(item.product_id),
                    qty: Number(item.qty_ordered),
                    unit_cost: Number(item.unit_cost) || 0,
                    type: "purchase_in",
                    ref_type: "purchase_order",
                    ref_id: Number(id),
                    note: `Nhập từ PO #${id}`,
                    created_by: receivedBy
                }));

                if (typeof stockApply === "function") {
                    await stockApply(connection, movementLines);
                }

                await connection.commit();
                return {
                    po: await this.getPurchaseOrderDetail(id),
                    movements: movementLines
                };
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        }
    };
}

module.exports = {
    createSuppliersRepository
};
