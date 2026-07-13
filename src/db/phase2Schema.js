/**
 * Phase 2 schema bootstrap (idempotent):
 * - loyalty: points_balance, lifetime_spend, care_of_user_id, points_ledger
 * - catalog: products.brand, product_variants
 * - order_details.variant_id, points_earned / points_redeemed on orders
 */

function columnName(row) {
    return row.COLUMN_NAME || row.column_name || row.Field;
}

function tableName(row) {
    return row.TABLE_NAME || row.table_name;
}

async function tableExists(db, name) {
    const [rows] = await db.execute(
        `SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [name]
    );
    return rows.some((r) => tableName(r) === name);
}

async function existingColumns(db, table, names) {
    if (!names.length) return new Set();
    const [rows] = await db.execute(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
          AND COLUMN_NAME IN (${names.map(() => "?").join(", ")})`,
        [table, ...names]
    );
    return new Set(rows.map(columnName));
}

async function ensureColumns(db, table, columns) {
    const existing = await existingColumns(db, table, columns.map((c) => c.name));
    const added = [];
    for (const col of columns) {
        if (!existing.has(col.name)) {
            await db.execute(col.ddl);
            added.push(col.name);
        }
    }
    return added;
}

const CUSTOMER_COLUMNS = [
    {
        name: "points_balance",
        ddl: "ALTER TABLE `customers` ADD COLUMN `points_balance` int NOT NULL DEFAULT 0 AFTER `registered_by`"
    },
    {
        name: "lifetime_spend",
        ddl: "ALTER TABLE `customers` ADD COLUMN `lifetime_spend` decimal(14,2) NOT NULL DEFAULT 0 AFTER `points_balance`"
    },
    {
        name: "care_of_user_id",
        ddl: "ALTER TABLE `customers` ADD COLUMN `care_of_user_id` int DEFAULT NULL AFTER `lifetime_spend`"
    }
];

const PRODUCT_COLUMNS = [
    {
        name: "brand",
        ddl: "ALTER TABLE `products` ADD COLUMN `brand` varchar(80) DEFAULT NULL AFTER `name`"
    }
];

const ORDER_COLUMNS = [
    {
        name: "points_earned",
        ddl: "ALTER TABLE `orders` ADD COLUMN `points_earned` int NOT NULL DEFAULT 0 AFTER `refunded_amount`"
    },
    {
        name: "points_redeemed",
        ddl: "ALTER TABLE `orders` ADD COLUMN `points_redeemed` int NOT NULL DEFAULT 0 AFTER `points_earned`"
    },
    {
        name: "points_discount_amount",
        ddl: "ALTER TABLE `orders` ADD COLUMN `points_discount_amount` decimal(12,2) NOT NULL DEFAULT 0 AFTER `points_redeemed`"
    }
];

const ORDER_DETAIL_COLUMNS = [
    {
        name: "variant_id",
        ddl: "ALTER TABLE `order_details` ADD COLUMN `variant_id` int DEFAULT NULL AFTER `product_id`"
    }
];

async function ensurePointsLedger(db) {
    if (await tableExists(db, "points_ledger")) {
        return { created: false };
    }
    await db.execute(
        `CREATE TABLE \`points_ledger\` (
            \`id\` int NOT NULL AUTO_INCREMENT,
            \`customer_id\` int NOT NULL,
            \`delta\` int NOT NULL,
            \`balance_after\` int NOT NULL DEFAULT 0,
            \`reason\` varchar(40) NOT NULL,
            \`order_id\` int DEFAULT NULL,
            \`note\` varchar(255) DEFAULT NULL,
            \`created_by\` int DEFAULT NULL,
            \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (\`id\`),
            KEY \`idx_points_ledger_customer\` (\`customer_id\`),
            KEY \`idx_points_ledger_order\` (\`order_id\`),
            CONSTRAINT \`fk_points_ledger_customer\`
                FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`)
                ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    return { created: true };
}

async function ensureProductVariants(db) {
    if (await tableExists(db, "product_variants")) {
        return { created: false };
    }
    await db.execute(
        `CREATE TABLE \`product_variants\` (
            \`id\` int NOT NULL AUTO_INCREMENT,
            \`product_id\` int NOT NULL,
            \`sku\` varchar(60) DEFAULT NULL,
            \`color\` varchar(60) DEFAULT NULL,
            \`size\` varchar(40) DEFAULT NULL,
            \`barcode\` varchar(64) DEFAULT NULL,
            \`price_override\` decimal(12,2) DEFAULT NULL,
            \`quantity\` int NOT NULL DEFAULT 0,
            \`image\` varchar(255) DEFAULT NULL,
            \`is_default\` tinyint(1) NOT NULL DEFAULT 0,
            \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (\`id\`),
            UNIQUE KEY \`uq_product_variants_sku\` (\`sku\`),
            KEY \`idx_product_variants_product\` (\`product_id\`),
            KEY \`idx_product_variants_barcode\` (\`barcode\`),
            CONSTRAINT \`fk_product_variants_product\`
                FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`)
                ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    return { created: true };
}

/**
 * Backfill brand from product name prefix when empty (best-effort).
 */
async function backfillBrands(db) {
    await db.execute(
        `UPDATE products
        SET brand = TRIM(SUBSTRING_INDEX(name, ' ', 1))
        WHERE (brand IS NULL OR brand = '')
          AND name IS NOT NULL
          AND name <> ''`
    );
}

async function ensurePhase2Schema(db) {
    const customerColumns = await ensureColumns(db, "customers", CUSTOMER_COLUMNS);
    const productColumns = await ensureColumns(db, "products", PRODUCT_COLUMNS);
    const orderColumns = await ensureColumns(db, "orders", ORDER_COLUMNS);
    const orderDetailColumns = await ensureColumns(db, "order_details", ORDER_DETAIL_COLUMNS);
    const ledger = await ensurePointsLedger(db);
    const variants = await ensureProductVariants(db);

    if (productColumns.includes("brand")) {
        await backfillBrands(db);
    }

    return {
        customerColumns,
        productColumns,
        orderColumns,
        orderDetailColumns,
        pointsLedgerCreated: ledger.created,
        productVariantsCreated: variants.created
    };
}

module.exports = {
    ensurePhase2Schema,
    CUSTOMER_COLUMNS,
    PRODUCT_COLUMNS,
    ORDER_COLUMNS
};
