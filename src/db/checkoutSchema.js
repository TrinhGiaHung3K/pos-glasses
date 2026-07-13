const ORDER_PAYMENT_COLUMNS = [
    {
        name: "subtotal_amount",
        ddl: "ALTER TABLE `orders` ADD COLUMN `subtotal_amount` decimal(12,2) NOT NULL DEFAULT 0 AFTER `status`"
    },
    {
        name: "discount_amount",
        ddl: "ALTER TABLE `orders` ADD COLUMN `discount_amount` decimal(12,2) NOT NULL DEFAULT 0 AFTER `subtotal_amount`"
    },
    {
        name: "manual_discount_type",
        ddl: "ALTER TABLE `orders` ADD COLUMN `manual_discount_type` varchar(20) DEFAULT NULL AFTER `discount_percent`"
    },
    {
        name: "manual_discount_value",
        ddl: "ALTER TABLE `orders` ADD COLUMN `manual_discount_value` decimal(12,2) NOT NULL DEFAULT 0 AFTER `manual_discount_type`"
    },
    {
        name: "payment_method",
        ddl: "ALTER TABLE `orders` ADD COLUMN `payment_method` varchar(30) NOT NULL DEFAULT 'cash' AFTER `manual_discount_value`"
    },
    {
        name: "amount_paid",
        ddl: "ALTER TABLE `orders` ADD COLUMN `amount_paid` decimal(12,2) NOT NULL DEFAULT 0 AFTER `payment_method`"
    },
    {
        name: "change_amount",
        ddl: "ALTER TABLE `orders` ADD COLUMN `change_amount` decimal(12,2) NOT NULL DEFAULT 0 AFTER `amount_paid`"
    }
];

function columnName(row) {
    return row.COLUMN_NAME || row.column_name || row.Field;
}

async function ensureOrderPaymentColumns(db) {
    const columnNames = ORDER_PAYMENT_COLUMNS.map((column) => column.name);
    const [rows] = await db.execute(
        `SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'orders'
          AND COLUMN_NAME IN (${columnNames.map(() => "?").join(", ")})`,
        columnNames
    );
    const existingColumns = new Set(rows.map(columnName));
    const addedColumns = [];

    for (const column of ORDER_PAYMENT_COLUMNS) {
        if (!existingColumns.has(column.name)) {
            await db.execute(column.ddl);
            addedColumns.push(column.name);
        }
    }

    if (addedColumns.length) {
        await db.execute(
            `UPDATE \`orders\`
            SET \`subtotal_amount\` = CASE
                    WHEN \`subtotal_amount\` = 0 THEN IFNULL(\`total_amount\`, 0)
                    ELSE \`subtotal_amount\`
                END,
                \`amount_paid\` = CASE
                    WHEN \`amount_paid\` = 0 THEN IFNULL(\`total_amount\`, 0)
                    ELSE \`amount_paid\`
                END
            WHERE \`source\` IS NOT NULL`
        );
    }

    return { addedColumns };
}

module.exports = {
    ORDER_PAYMENT_COLUMNS,
    ensureOrderPaymentColumns
};
