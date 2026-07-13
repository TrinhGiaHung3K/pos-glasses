/**
 * Phase 3 schema bootstrap (idempotent):
 * - shifts (ca làm việc) + orders.shift_id
 * - customer_prescriptions (đơn kính / Rx)
 * - warranties (bảo hành theo serial)
 * - suppliers + purchase_orders + purchase_order_items
 * - order_details.line_type (product | service)
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

const ORDER_COLUMNS = [
    {
        name: "shift_id",
        ddl: "ALTER TABLE `orders` ADD COLUMN `shift_id` int DEFAULT NULL AFTER `user_id`"
    }
];

const ORDER_DETAIL_COLUMNS = [
    {
        name: "line_type",
        ddl: "ALTER TABLE `order_details` ADD COLUMN `line_type` varchar(20) NOT NULL DEFAULT 'product' AFTER `product_id`"
    },
    {
        name: "prescription_id",
        ddl: "ALTER TABLE `order_details` ADD COLUMN `prescription_id` int DEFAULT NULL AFTER `variant_id`"
    }
];

async function ensureShifts(db) {
    if (await tableExists(db, "shifts")) {
        return { created: false };
    }
    await db.execute(
        `CREATE TABLE \`shifts\` (
            \`id\` int NOT NULL AUTO_INCREMENT,
            \`user_id\` int NOT NULL,
            \`status\` varchar(20) NOT NULL DEFAULT 'open',
            \`opened_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`closed_at\` datetime DEFAULT NULL,
            \`opening_cash\` decimal(14,2) NOT NULL DEFAULT 0,
            \`closing_cash\` decimal(14,2) DEFAULT NULL,
            \`expected_cash\` decimal(14,2) DEFAULT NULL,
            \`cash_sales\` decimal(14,2) NOT NULL DEFAULT 0,
            \`card_sales\` decimal(14,2) NOT NULL DEFAULT 0,
            \`bank_sales\` decimal(14,2) NOT NULL DEFAULT 0,
            \`order_count\` int NOT NULL DEFAULT 0,
            \`void_count\` int NOT NULL DEFAULT 0,
            \`variance\` decimal(14,2) DEFAULT NULL,
            \`note\` varchar(500) DEFAULT NULL,
            \`closed_by\` int DEFAULT NULL,
            PRIMARY KEY (\`id\`),
            KEY \`idx_shifts_user\` (\`user_id\`),
            KEY \`idx_shifts_status\` (\`status\`),
            KEY \`idx_shifts_opened\` (\`opened_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    return { created: true };
}

async function ensureCustomerPrescriptions(db) {
    if (await tableExists(db, "customer_prescriptions")) {
        return { created: false };
    }
    await db.execute(
        `CREATE TABLE \`customer_prescriptions\` (
            \`id\` int NOT NULL AUTO_INCREMENT,
            \`customer_id\` int NOT NULL,
            \`measured_at\` date DEFAULT NULL,
            \`doctor_name\` varchar(120) DEFAULT NULL,
            \`clinic_name\` varchar(160) DEFAULT NULL,
            \`od_sph\` decimal(5,2) DEFAULT NULL,
            \`od_cyl\` decimal(5,2) DEFAULT NULL,
            \`od_axis\` int DEFAULT NULL,
            \`os_sph\` decimal(5,2) DEFAULT NULL,
            \`os_cyl\` decimal(5,2) DEFAULT NULL,
            \`os_axis\` int DEFAULT NULL,
            \`pd\` decimal(5,2) DEFAULT NULL,
            \`add_power\` decimal(5,2) DEFAULT NULL,
            \`notes\` varchar(500) DEFAULT NULL,
            \`is_active\` tinyint(1) NOT NULL DEFAULT 1,
            \`created_by\` int DEFAULT NULL,
            \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (\`id\`),
            KEY \`idx_rx_customer\` (\`customer_id\`),
            KEY \`idx_rx_active\` (\`is_active\`),
            CONSTRAINT \`fk_rx_customer\`
                FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`)
                ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    return { created: true };
}

async function ensureWarranties(db) {
    if (await tableExists(db, "warranties")) {
        return { created: false };
    }
    await db.execute(
        `CREATE TABLE \`warranties\` (
            \`id\` int NOT NULL AUTO_INCREMENT,
            \`order_id\` int DEFAULT NULL,
            \`product_id\` int DEFAULT NULL,
            \`customer_id\` int DEFAULT NULL,
            \`serial_number\` varchar(80) NOT NULL,
            \`months\` int NOT NULL DEFAULT 12,
            \`start_date\` date NOT NULL,
            \`end_date\` date NOT NULL,
            \`note\` varchar(500) DEFAULT NULL,
            \`status\` varchar(20) NOT NULL DEFAULT 'active',
            \`created_by\` int DEFAULT NULL,
            \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (\`id\`),
            UNIQUE KEY \`uq_warranty_serial\` (\`serial_number\`),
            KEY \`idx_warranty_customer\` (\`customer_id\`),
            KEY \`idx_warranty_order\` (\`order_id\`),
            KEY \`idx_warranty_end\` (\`end_date\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    return { created: true };
}

async function ensureSuppliers(db) {
    if (await tableExists(db, "suppliers")) {
        return { created: false };
    }
    await db.execute(
        `CREATE TABLE \`suppliers\` (
            \`id\` int NOT NULL AUTO_INCREMENT,
            \`name\` varchar(160) NOT NULL,
            \`phone\` varchar(30) DEFAULT NULL,
            \`email\` varchar(120) DEFAULT NULL,
            \`address\` varchar(500) DEFAULT NULL,
            \`note\` varchar(500) DEFAULT NULL,
            \`is_active\` tinyint(1) NOT NULL DEFAULT 1,
            \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (\`id\`),
            KEY \`idx_suppliers_name\` (\`name\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    return { created: true };
}

async function ensurePurchaseOrders(db) {
    if (await tableExists(db, "purchase_orders")) {
        return { created: false };
    }
    await db.execute(
        `CREATE TABLE \`purchase_orders\` (
            \`id\` int NOT NULL AUTO_INCREMENT,
            \`supplier_id\` int NOT NULL,
            \`status\` varchar(20) NOT NULL DEFAULT 'draft',
            \`note\` varchar(500) DEFAULT NULL,
            \`ordered_at\` datetime DEFAULT NULL,
            \`received_at\` datetime DEFAULT NULL,
            \`created_by\` int DEFAULT NULL,
            \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (\`id\`),
            KEY \`idx_po_supplier\` (\`supplier_id\`),
            KEY \`idx_po_status\` (\`status\`),
            CONSTRAINT \`fk_po_supplier\`
                FOREIGN KEY (\`supplier_id\`) REFERENCES \`suppliers\` (\`id\`)
                ON DELETE RESTRICT ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    return { created: true };
}

async function ensurePurchaseOrderItems(db) {
    if (await tableExists(db, "purchase_order_items")) {
        return { created: false };
    }
    await db.execute(
        `CREATE TABLE \`purchase_order_items\` (
            \`id\` int NOT NULL AUTO_INCREMENT,
            \`purchase_order_id\` int NOT NULL,
            \`product_id\` int NOT NULL,
            \`qty_ordered\` int NOT NULL DEFAULT 0,
            \`qty_received\` int NOT NULL DEFAULT 0,
            \`unit_cost\` decimal(12,2) NOT NULL DEFAULT 0,
            PRIMARY KEY (\`id\`),
            KEY \`idx_poi_po\` (\`purchase_order_id\`),
            KEY \`idx_poi_product\` (\`product_id\`),
            CONSTRAINT \`fk_poi_po\`
                FOREIGN KEY (\`purchase_order_id\`) REFERENCES \`purchase_orders\` (\`id\`)
                ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    return { created: true };
}

async function ensurePhase3Schema(db) {
    const shifts = await ensureShifts(db);
    const prescriptions = await ensureCustomerPrescriptions(db);
    const warranties = await ensureWarranties(db);
    const suppliers = await ensureSuppliers(db);
    const purchaseOrders = await ensurePurchaseOrders(db);
    const purchaseOrderItems = await ensurePurchaseOrderItems(db);
    const orderColumns = await ensureColumns(db, "orders", ORDER_COLUMNS);
    const orderDetailColumns = await ensureColumns(db, "order_details", ORDER_DETAIL_COLUMNS);

    return {
        shiftsCreated: shifts.created,
        prescriptionsCreated: prescriptions.created,
        warrantiesCreated: warranties.created,
        suppliersCreated: suppliers.created,
        purchaseOrdersCreated: purchaseOrders.created,
        purchaseOrderItemsCreated: purchaseOrderItems.created,
        orderColumns,
        orderDetailColumns
    };
}

module.exports = {
    ensurePhase3Schema,
    ORDER_COLUMNS,
    ORDER_DETAIL_COLUMNS
};
