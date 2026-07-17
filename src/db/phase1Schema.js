/**
 * Phase 1 schema bootstrap (idempotent).
 * - stock_movements ledger
 * - products.cost_price, order_details.cost_price / refunded_quantity
 * - orders void metadata
 * - promotions admin fields
 * - audit_logs (minimal)
 * - checkout_idempotency
 */

function columnName(row) {
    return row.COLUMN_NAME || row.column_name || row.Field;
}

function tableName(row) {
    return row.TABLE_NAME || row.table_name;
}

async function tableExists(db, name) {
    const [rows] = await db.execute(
        `SELECT TABLE_NAME
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?`,
        [name]
    );
    return rows.some((row) => tableName(row) === name);
}

async function existingColumns(db, table, names) {
    if (!names.length) {
        return new Set();
    }

    const [rows] = await db.execute(
        `SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME IN (${names.map(() => "?").join(", ")})`,
        [table, ...names]
    );
    return new Set(rows.map(columnName));
}

async function ensureColumns(db, table, columns) {
    const names = columns.map((column) => column.name);
    const existing = await existingColumns(db, table, names);
    const added = [];

    for (const column of columns) {
        if (!existing.has(column.name)) {
            await db.execute(column.ddl);
            added.push(column.name);
        }
    }

    return added;
}

async function ensureStockMovementsTable(db) {
    if (await tableExists(db, "stock_movements")) {
        return { created: false };
    }

    await db.execute(
        `CREATE TABLE \`stock_movements\` (
            \`id\` int NOT NULL AUTO_INCREMENT,
            \`product_id\` int NOT NULL,
            \`type\` varchar(30) NOT NULL,
            \`qty\` int NOT NULL,
            \`unit_cost\` decimal(12,2) NOT NULL DEFAULT 0,
            \`ref_type\` varchar(40) DEFAULT NULL,
            \`ref_id\` int DEFAULT NULL,
            \`note\` varchar(500) DEFAULT NULL,
            \`created_by\` int DEFAULT NULL,
            \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (\`id\`),
            KEY \`idx_stock_movements_product_id\` (\`product_id\`),
            KEY \`idx_stock_movements_type\` (\`type\`),
            KEY \`idx_stock_movements_ref\` (\`ref_type\`, \`ref_id\`),
            KEY \`idx_stock_movements_created_at\` (\`created_at\`),
            CONSTRAINT \`fk_stock_movements_product\`
                FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`)
                ON DELETE RESTRICT ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    return { created: true };
}

async function indexExists(db, table, indexName) {
    const [rows] = await db.execute(
        `SELECT INDEX_NAME
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND INDEX_NAME = ?
        LIMIT 1`,
        [table, indexName]
    );
    return rows.length > 0;
}

/**
 * List path filters by entity_type and sorts by id DESC.
 * (entity_type, entity_id) does not cover that order well; add (entity_type, id).
 */
async function ensureAuditLogsIndexes(db) {
    if (!(await tableExists(db, "audit_logs"))) {
        return { added: [] };
    }

    const added = [];
    const name = "idx_audit_logs_entity_id";
    if (!(await indexExists(db, "audit_logs", name))) {
        await db.execute(
            `ALTER TABLE \`audit_logs\`
            ADD INDEX \`idx_audit_logs_entity_id\` (\`entity_type\`, \`id\`)`
        );
        added.push(name);
    }

    return { added };
}

async function ensureAuditLogsTable(db) {
    if (await tableExists(db, "audit_logs")) {
        const indexes = await ensureAuditLogsIndexes(db);
        return { created: false, indexesAdded: indexes.added };
    }

    await db.execute(
        `CREATE TABLE \`audit_logs\` (
            \`id\` int NOT NULL AUTO_INCREMENT,
            \`actor_id\` int DEFAULT NULL,
            \`action\` varchar(80) NOT NULL,
            \`entity_type\` varchar(60) NOT NULL,
            \`entity_id\` int DEFAULT NULL,
            \`payload_json\` json DEFAULT NULL,
            \`ip\` varchar(64) DEFAULT NULL,
            \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (\`id\`),
            KEY \`idx_audit_logs_entity\` (\`entity_type\`, \`entity_id\`),
            KEY \`idx_audit_logs_entity_id\` (\`entity_type\`, \`id\`),
            KEY \`idx_audit_logs_actor\` (\`actor_id\`),
            KEY \`idx_audit_logs_created_at\` (\`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    return { created: true, indexesAdded: [] };
}

async function ensureIdempotencyTable(db) {
    if (await tableExists(db, "checkout_idempotency")) {
        return { created: false };
    }

    await db.execute(
        `CREATE TABLE \`checkout_idempotency\` (
            \`id\` int NOT NULL AUTO_INCREMENT,
            \`idempotency_key\` varchar(80) NOT NULL,
            \`user_id\` int NOT NULL,
            \`order_id\` int DEFAULT NULL,
            \`response_json\` json NOT NULL,
            \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (\`id\`),
            UNIQUE KEY \`uq_checkout_idempotency_key_user\` (\`idempotency_key\`, \`user_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    return { created: true };
}

const PRODUCT_COLUMNS = [
    {
        name: "cost_price",
        ddl: "ALTER TABLE `products` ADD COLUMN `cost_price` decimal(12,2) NOT NULL DEFAULT 0 AFTER `price`"
    }
];

const ORDER_DETAIL_COLUMNS = [
    {
        name: "cost_price",
        ddl: "ALTER TABLE `order_details` ADD COLUMN `cost_price` decimal(12,2) NOT NULL DEFAULT 0 AFTER `price`"
    },
    {
        name: "refunded_quantity",
        ddl: "ALTER TABLE `order_details` ADD COLUMN `refunded_quantity` int NOT NULL DEFAULT 0 AFTER `cost_price`"
    }
];

const ORDER_COLUMNS = [
    {
        name: "void_reason",
        ddl: "ALTER TABLE `orders` ADD COLUMN `void_reason` varchar(500) DEFAULT NULL AFTER `change_amount`"
    },
    {
        name: "voided_at",
        ddl: "ALTER TABLE `orders` ADD COLUMN `voided_at` datetime DEFAULT NULL AFTER `void_reason`"
    },
    {
        name: "voided_by",
        ddl: "ALTER TABLE `orders` ADD COLUMN `voided_by` int DEFAULT NULL AFTER `voided_at`"
    },
    {
        name: "refunded_amount",
        ddl: "ALTER TABLE `orders` ADD COLUMN `refunded_amount` decimal(12,2) NOT NULL DEFAULT 0 AFTER `voided_by`"
    }
];

const PROMOTION_COLUMNS = [
    {
        name: "discount_type",
        ddl: "ALTER TABLE `promotions` ADD COLUMN `discount_type` varchar(20) NOT NULL DEFAULT 'percent' AFTER `code`"
    },
    {
        name: "discount_value",
        ddl: "ALTER TABLE `promotions` ADD COLUMN `discount_value` decimal(12,2) NOT NULL DEFAULT 0 AFTER `discount_percent`"
    },
    {
        name: "min_order_amount",
        ddl: "ALTER TABLE `promotions` ADD COLUMN `min_order_amount` decimal(12,2) NOT NULL DEFAULT 0 AFTER `discount_value`"
    },
    {
        name: "max_uses",
        ddl: "ALTER TABLE `promotions` ADD COLUMN `max_uses` int DEFAULT NULL AFTER `min_order_amount`"
    },
    {
        name: "used_count",
        ddl: "ALTER TABLE `promotions` ADD COLUMN `used_count` int NOT NULL DEFAULT 0 AFTER `max_uses`"
    },
    {
        name: "is_active",
        ddl: "ALTER TABLE `promotions` ADD COLUMN `is_active` tinyint(1) NOT NULL DEFAULT 1 AFTER `used_count`"
    }
];

async function backfillPromotionValues(db) {
    await db.execute(
        `UPDATE \`promotions\`
        SET \`discount_value\` = IFNULL(\`discount_percent\`, 0)
        WHERE \`discount_type\` = 'percent'
          AND (\`discount_value\` IS NULL OR \`discount_value\` = 0)
          AND IFNULL(\`discount_percent\`, 0) > 0`
    );
}

async function ensurePhase1Schema(db) {
    const stock = await ensureStockMovementsTable(db);
    const audit = await ensureAuditLogsTable(db);
    const idempotency = await ensureIdempotencyTable(db);
    const productColumns = await ensureColumns(db, "products", PRODUCT_COLUMNS);
    const orderDetailColumns = await ensureColumns(db, "order_details", ORDER_DETAIL_COLUMNS);
    const orderColumns = await ensureColumns(db, "orders", ORDER_COLUMNS);
    const promotionColumns = await ensureColumns(db, "promotions", PROMOTION_COLUMNS);

    if (promotionColumns.length) {
        await backfillPromotionValues(db);
    }

    return {
        stockMovementsCreated: stock.created,
        auditLogsCreated: audit.created,
        auditIndexesAdded: audit.indexesAdded || [],
        idempotencyCreated: idempotency.created,
        productColumns,
        orderDetailColumns,
        orderColumns,
        promotionColumns
    };
}

module.exports = {
    ensurePhase1Schema,
    PRODUCT_COLUMNS,
    ORDER_DETAIL_COLUMNS,
    ORDER_COLUMNS,
    PROMOTION_COLUMNS
};
