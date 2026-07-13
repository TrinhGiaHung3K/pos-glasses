function createProductQrRepository(db) {
    return {
        async findProduct(productId) {
            const [rows] = await db.execute(
                "SELECT id, name, brand, sku, image, price, quantity FROM products WHERE id = ?", [productId]
            );
            return rows[0] || null;
        },
        async findActiveByProduct(productId) {
            const [rows] = await db.execute(
                `SELECT * FROM product_qr_codes WHERE product_id = ? AND status = 'active'
                 ORDER BY version DESC LIMIT 1`, [productId]
            );
            return rows[0] || null;
        },
        async createCode({ product_id, public_code, version, created_by }) {
            const [result] = await db.execute(
                `INSERT INTO product_qr_codes (product_id, public_code, status, version, created_by)
                 VALUES (?, ?, 'active', ?, ?)`,
                [product_id, public_code, version, created_by || null]
            );
            return { id: result.insertId, product_id, public_code, status: "active", version };
        },
        async rotate(productId, code, createdBy) {
            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();
                const [rows] = await connection.execute(
                    "SELECT COALESCE(MAX(version), 0) AS version FROM product_qr_codes WHERE product_id = ? FOR UPDATE",
                    [productId]
                );
                await connection.execute(
                    `UPDATE product_qr_codes SET status = 'revoked', revoked_at = NOW()
                     WHERE product_id = ? AND status = 'active'`, [productId]
                );
                const version = Number(rows[0]?.version || 0) + 1;
                const [result] = await connection.execute(
                    `INSERT INTO product_qr_codes (product_id, public_code, status, version, created_by)
                     VALUES (?, ?, 'active', ?, ?)`, [productId, code, version, createdBy || null]
                );
                await connection.commit();
                return { id: result.insertId, product_id: productId, public_code: code, status: "active", version };
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        },
        async findPublicByCode(code) {
            const [rows] = await db.execute(
                `SELECT p.id, p.name, p.brand, p.sku, p.image, p.price, p.quantity,
                        q.public_code, q.version
                 FROM product_qr_codes q
                 JOIN products p ON p.id = q.product_id
                 WHERE q.public_code = ? AND q.status = 'active' LIMIT 1`, [code]
            );
            return rows[0] || null;
        }
    };
}

module.exports = { createProductQrRepository };
