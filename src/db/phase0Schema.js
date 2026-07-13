/**
 * Phase 0 schema: users.is_active for disable accounts.
 * Idempotent.
 */

function columnName(row) {
    return row.COLUMN_NAME || row.column_name || row.Field;
}

async function ensurePhase0Schema(db) {
    const [rows] = await db.execute(
        `SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'is_active'`
    );
    const has = rows.some((row) => columnName(row) === "is_active");
    const addedColumns = [];

    if (!has) {
        await db.execute(
            "ALTER TABLE `users` ADD COLUMN `is_active` tinyint(1) NOT NULL DEFAULT 1 AFTER `role`"
        );
        addedColumns.push("is_active");
    }

    return { addedColumns };
}

module.exports = {
    ensurePhase0Schema
};
