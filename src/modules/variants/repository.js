function createVariantsRepository(db) {
    return {
        async findByProductId(productId) {
            const [rows] = await db.execute(
                `SELECT id, product_id, sku, color, size, barcode,
                    price_override, quantity, image, is_default
                FROM product_variants
                WHERE product_id = ?
                ORDER BY is_default DESC, id ASC`,
                [productId]
            );
            return rows;
        },

        async findById(id) {
            const [rows] = await db.execute(
                `SELECT * FROM product_variants WHERE id = ? LIMIT 1`,
                [id]
            );
            return rows[0] || null;
        },

        async create(variant) {
            const [result] = await db.execute(
                `INSERT INTO product_variants
                (product_id, sku, color, size, barcode, price_override, quantity, image, is_default)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    variant.product_id,
                    variant.sku || null,
                    variant.color || null,
                    variant.size || null,
                    variant.barcode || null,
                    variant.price_override,
                    variant.quantity || 0,
                    variant.image || null,
                    variant.is_default ? 1 : 0
                ]
            );
            return result;
        },

        async update(id, variant) {
            const [result] = await db.execute(
                `UPDATE product_variants
                SET sku = ?, color = ?, size = ?, barcode = ?,
                    price_override = ?, quantity = ?, image = COALESCE(?, image),
                    is_default = ?
                WHERE id = ?`,
                [
                    variant.sku || null,
                    variant.color || null,
                    variant.size || null,
                    variant.barcode || null,
                    variant.price_override,
                    variant.quantity || 0,
                    variant.image || null,
                    variant.is_default ? 1 : 0,
                    id
                ]
            );
            return result;
        },

        async remove(id) {
            const [result] = await db.execute(
                "DELETE FROM product_variants WHERE id = ?",
                [id]
            );
            return result;
        },

        async listBrands() {
            const [rows] = await db.execute(
                `SELECT DISTINCT brand AS name
                FROM products
                WHERE brand IS NOT NULL AND brand <> ''
                ORDER BY brand ASC`
            );
            return rows;
        }
    };
}

module.exports = {
    createVariantsRepository
};
