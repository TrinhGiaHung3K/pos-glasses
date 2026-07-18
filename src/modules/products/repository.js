function buildInClause(values) {
    return values.map(() => "?").join(", ");
}

/** Whitelist only — never interpolate raw client sort into SQL. */
function commercialPriceExpr() {
    // Canonical sell price is products.price (nghìn đồng) for all payments & UI.
    return "price";
}

function resolveProductOrder(sort) {
    const priceExpr = commercialPriceExpr();
    switch (String(sort || "").toLowerCase()) {
        case "price_asc":
        case "price":
            return `${priceExpr} ASC, id ASC`;
        case "price_desc":
            return `${priceExpr} DESC, id DESC`;
        case "name_asc":
        case "name":
            return "name ASC, id ASC";
        case "qty_asc":
            return "quantity ASC, id ASC";
        case "qty_desc":
            return "quantity DESC, id DESC";
        case "id_asc":
            return "id ASC";
        case "id_desc":
        default:
            return "id DESC";
    }
}

function createProductsRepository(db) {
    return {
        async findAll() {
            const [rows] = await db.execute("SELECT * FROM products ORDER BY id DESC");
            return rows;
        },

        /**
         * @param {{
         *   q?: string,
         *   category_id?: number,
         *   brand?: string,
         *   in_stock?: string,
         *   min_price?: number,
         *   max_price?: number,
         *   sort?: string,
         *   page?: number,
         *   limit?: number,
         *   offset?: number,
         *   paginate?: boolean
         * }} filters
         */
        async findFiltered(filters = {}) {
            const where = [];
            const params = [];

            if (filters.q) {
                where.push("(name LIKE ? OR sku LIKE ? OR IFNULL(brand, '') LIKE ?)");
                const like = `%${filters.q}%`;
                params.push(like, like, like);
            }
            if (filters.category_id) {
                where.push("category_id = ?");
                params.push(Number(filters.category_id));
            }
            if (filters.brand) {
                where.push("brand = ?");
                params.push(String(filters.brand));
            }
            if (filters.in_stock === "1" || filters.in_stock === "available") {
                where.push("quantity > 0");
            } else if (filters.in_stock === "0" || filters.in_stock === "empty") {
                where.push("quantity = 0");
            } else if (filters.in_stock === "low") {
                where.push("quantity > 0 AND quantity <= 5");
            }
            if (filters.min_price != null && Number.isFinite(Number(filters.min_price))) {
                where.push(`${commercialPriceExpr()} >= ?`);
                params.push(Number(filters.min_price));
            }
            if (filters.max_price != null && Number.isFinite(Number(filters.max_price))) {
                where.push(`${commercialPriceExpr()} <= ?`);
                params.push(Number(filters.max_price));
            }

            const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
            const orderSql = resolveProductOrder(filters.sort);

            if (!filters.paginate) {
                const [rows] = await db.execute(
                    `SELECT * FROM products ${whereSql} ORDER BY ${orderSql}`,
                    params
                );
                return { items: rows, total: rows.length };
            }

            const [countRows] = await db.execute(
                `SELECT COUNT(*) AS total FROM products ${whereSql}`,
                params
            );
            const limit = Number(filters.limit) || 50;
            const offset = Number(filters.offset) || 0;
            const [rows] = await db.execute(
                `SELECT * FROM products ${whereSql}
                ORDER BY ${orderSql}
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
                "SELECT * FROM products WHERE id = ?",
                [id]
            );
            return rows[0] || null;
        },

        async create(product) {
            try {
                const [result] = await db.execute(
                    `INSERT INTO products
                    (category_id, name, brand, sku, price, original_price, cost_price, original_cost_price, quantity, image)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        product.category_id,
                        product.name,
                        product.brand || null,
                        product.sku,
                        product.price,
                        product.original_price != null ? product.original_price : product.price,
                        product.cost_price != null ? product.cost_price : 0,
                        product.original_cost_price != null
                            ? product.original_cost_price
                            : (product.cost_price != null ? product.cost_price : 0),
                        product.quantity,
                        product.image || null
                    ]
                );
                return result;
            } catch (error) {
                if (error && (error.code === "ER_BAD_FIELD_ERROR" || error.errno === 1054)) {
                    const [result] = await db.execute(
                        `INSERT INTO products
                        (category_id, name, sku, price, cost_price, quantity, image)
                        VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            product.category_id,
                            product.name,
                            product.sku,
                            product.price,
                            product.cost_price != null ? product.cost_price : 0,
                            product.quantity,
                            product.image || null
                        ]
                    );
                    return result;
                }
                throw error;
            }
        },

        async update(id, product) {
            try {
                const [result] = await db.execute(
                    `UPDATE products
                    SET category_id = ?,
                        name = ?,
                        brand = ?,
                        sku = ?,
                        price = ?,
                        original_price = ?,
                        cost_price = ?,
                        original_cost_price = ?,
                        quantity = ?,
                        image = COALESCE(?, image)
                    WHERE id = ?`,
                    [
                        product.category_id,
                        product.name,
                        product.brand || null,
                        product.sku,
                        product.price,
                        product.original_price != null ? product.original_price : product.price,
                        product.cost_price != null ? product.cost_price : 0,
                        product.original_cost_price != null
                            ? product.original_cost_price
                            : (product.cost_price != null ? product.cost_price : 0),
                        product.quantity,
                        product.image || null,
                        id
                    ]
                );
                return result;
            } catch (error) {
                if (error && (error.code === "ER_BAD_FIELD_ERROR" || error.errno === 1054)) {
                    const [result] = await db.execute(
                        `UPDATE products
                        SET category_id = ?,
                            name = ?,
                            sku = ?,
                            price = ?,
                            cost_price = ?,
                            quantity = ?,
                            image = COALESCE(?, image)
                        WHERE id = ?`,
                        [
                            product.category_id,
                            product.name,
                            product.sku,
                            product.price,
                            product.cost_price != null ? product.cost_price : 0,
                            product.quantity,
                            product.image || null,
                            id
                        ]
                    );
                    return result;
                }
                throw error;
            }
        },

        async remove(id) {
            const [result] = await db.execute(
                "DELETE FROM products WHERE id = ?",
                [id]
            );
            return result;
        },

        /** Lightweight image-path update used by background-strip batch jobs. */
        async updateImage(id, imagePath) {
            const [result] = await db.execute(
                "UPDATE products SET image = ? WHERE id = ?",
                [String(imagePath || "").trim() || null, Number(id)]
            );
            return result;
        }
    };
}

module.exports = {
    createProductsRepository,
    buildInClause
};
