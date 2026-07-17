function safeIdentifier(value) {
    const identifier = String(value || "");
    if (!/^[A-Za-z0-9_$]+$/.test(identifier)) {
        throw new Error(`Unsafe database identifier: ${identifier}`);
    }
    return `\`${identifier}\``;
}

async function ensureRetailOnlySchema(db) {
    const result = {
        droppedTables: [],
        droppedColumns: [],
        droppedIndexes: [],
        droppedForeignKeys: []
    };

    for (const table of ["table_order_items", "table_orders"]) {
        const [rows] = await db.execute(
            `SELECT TABLE_NAME
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
            [table]
        );
        if (rows.length) {
            await db.execute(`DROP TABLE ${safeIdentifier(table)}`);
            result.droppedTables.push(table);
        }
    }

    const [foreignKeys] = await db.execute(
        `SELECT DISTINCT CONSTRAINT_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'orders'
          AND REFERENCED_TABLE_NAME = 'store_tables'`
    );
    for (const row of foreignKeys) {
        const name = row.CONSTRAINT_NAME || row.constraint_name;
        await db.execute(`ALTER TABLE \`orders\` DROP FOREIGN KEY ${safeIdentifier(name)}`);
        result.droppedForeignKeys.push(name);
    }

    const [indexes] = await db.execute(
        `SELECT DISTINCT INDEX_NAME
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'orders'
          AND INDEX_NAME IN ('idx_orders_table_id', 'idx_orders_table_order_id')`
    );
    for (const row of indexes) {
        const name = row.INDEX_NAME || row.index_name;
        await db.execute(`ALTER TABLE \`orders\` DROP INDEX ${safeIdentifier(name)}`);
        result.droppedIndexes.push(name);
    }

    const [columns] = await db.execute(
        `SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'orders'
          AND COLUMN_NAME IN ('table_id', 'table_order_id')`
    );
    for (const row of columns) {
        const name = row.COLUMN_NAME || row.column_name;
        await db.execute(`ALTER TABLE \`orders\` DROP COLUMN ${safeIdentifier(name)}`);
        result.droppedColumns.push(name);
    }

    const [storeTables] = await db.execute(
        `SELECT TABLE_NAME
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_tables'`
    );
    if (storeTables.length) {
        await db.execute("DROP TABLE `store_tables`");
        result.droppedTables.push("store_tables");
    }

    return result;
}

module.exports = {
    ensureRetailOnlySchema,
    safeIdentifier
};
