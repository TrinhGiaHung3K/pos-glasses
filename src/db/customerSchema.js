/**
 * Customer / membership schema bootstrap.
 * Idempotent: safe to run on every server start.
 *
 * Core identity: name, phone (unique), email, address
 * Profile: gender, date_of_birth, notes
 * Membership: member_code (EAN-13), membership_status, membership_tier,
 *             member_since, registered_by
 */

const CUSTOMER_MEMBER_COLUMNS = [
    {
        name: "member_code",
        ddl: "ALTER TABLE `customers` ADD COLUMN `member_code` varchar(32) DEFAULT NULL AFTER `id`"
    },
    {
        name: "gender",
        ddl: "ALTER TABLE `customers` ADD COLUMN `gender` varchar(16) NOT NULL DEFAULT 'unknown' AFTER `address`"
    },
    {
        name: "date_of_birth",
        ddl: "ALTER TABLE `customers` ADD COLUMN `date_of_birth` date DEFAULT NULL AFTER `gender`"
    },
    {
        name: "notes",
        ddl: "ALTER TABLE `customers` ADD COLUMN `notes` text DEFAULT NULL AFTER `date_of_birth`"
    },
    {
        name: "membership_status",
        ddl: "ALTER TABLE `customers` ADD COLUMN `membership_status` varchar(20) NOT NULL DEFAULT 'active' AFTER `notes`"
    },
    {
        name: "membership_tier",
        ddl: "ALTER TABLE `customers` ADD COLUMN `membership_tier` varchar(20) NOT NULL DEFAULT 'standard' AFTER `membership_status`"
    },
    {
        name: "member_since",
        ddl: "ALTER TABLE `customers` ADD COLUMN `member_since` datetime DEFAULT NULL AFTER `membership_tier`"
    },
    {
        name: "registered_by",
        ddl: "ALTER TABLE `customers` ADD COLUMN `registered_by` int DEFAULT NULL AFTER `member_since`"
    }
];

const CUSTOMER_MEMBER_INDEXES = [
    {
        name: "idx_customers_member_code",
        ddl: "ALTER TABLE `customers` ADD UNIQUE INDEX `idx_customers_member_code` (`member_code`)"
    },
    {
        name: "idx_customers_phone",
        ddl: "ALTER TABLE `customers` ADD UNIQUE INDEX `idx_customers_phone` (`phone`)"
    },
    {
        name: "idx_customers_membership_status",
        ddl: "ALTER TABLE `customers` ADD INDEX `idx_customers_membership_status` (`membership_status`)"
    },
    {
        name: "idx_customers_membership_tier",
        ddl: "ALTER TABLE `customers` ADD INDEX `idx_customers_membership_tier` (`membership_tier`)"
    }
];

function columnName(row) {
    return row.COLUMN_NAME || row.column_name || row.Field;
}

function indexName(row) {
    return row.INDEX_NAME || row.index_name || row.Key_name;
}

async function backfillCustomerMemberCodes(db) {
    await db.execute(
        `UPDATE \`customers\` c
        JOIN (
            SELECT source.\`id\`,
                   CONCAT(
                       source.body,
                       MOD(10 - MOD(
                           CAST(SUBSTRING(source.body, 1, 1) AS UNSIGNED) +
                           CAST(SUBSTRING(source.body, 2, 1) AS UNSIGNED) * 3 +
                           CAST(SUBSTRING(source.body, 3, 1) AS UNSIGNED) +
                           CAST(SUBSTRING(source.body, 4, 1) AS UNSIGNED) * 3 +
                           CAST(SUBSTRING(source.body, 5, 1) AS UNSIGNED) +
                           CAST(SUBSTRING(source.body, 6, 1) AS UNSIGNED) * 3 +
                           CAST(SUBSTRING(source.body, 7, 1) AS UNSIGNED) +
                           CAST(SUBSTRING(source.body, 8, 1) AS UNSIGNED) * 3 +
                           CAST(SUBSTRING(source.body, 9, 1) AS UNSIGNED) +
                           CAST(SUBSTRING(source.body, 10, 1) AS UNSIGNED) * 3 +
                           CAST(SUBSTRING(source.body, 11, 1) AS UNSIGNED) +
                           CAST(SUBSTRING(source.body, 12, 1) AS UNSIGNED) * 3,
                           10
                       ), 10)
                   ) AS member_code
            FROM (
                SELECT \`id\`, CONCAT('29', LPAD(\`id\`, 10, '0')) AS body
                FROM \`customers\`
            ) source
        ) member_codes ON member_codes.\`id\` = c.\`id\`
        SET c.\`member_code\` = member_codes.member_code
        WHERE c.\`member_code\` IS NULL
           OR c.\`member_code\` <> member_codes.member_code`
    );
}

async function backfillMembershipMetadata(db) {
    // Existing members: treat created_at as official join date when missing
    await db.execute(
        `UPDATE \`customers\`
        SET \`member_since\` = COALESCE(\`member_since\`, \`created_at\`, NOW())
        WHERE \`member_code\` IS NOT NULL
          AND \`member_since\` IS NULL`
    );

    await db.execute(
        `UPDATE \`customers\`
        SET \`membership_status\` = 'active'
        WHERE \`membership_status\` IS NULL
           OR \`membership_status\` = ''`
    );

    await db.execute(
        `UPDATE \`customers\`
        SET \`membership_tier\` = 'standard'
        WHERE \`membership_tier\` IS NULL
           OR \`membership_tier\` = ''`
    );

    await db.execute(
        `UPDATE \`customers\`
        SET \`gender\` = 'unknown'
        WHERE \`gender\` IS NULL
           OR \`gender\` = ''`
    );
}

async function ensureCustomerMemberColumns(db) {
    const columnNames = CUSTOMER_MEMBER_COLUMNS.map((column) => column.name);
    const [columnRows] = await db.execute(
        `SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'customers'
          AND COLUMN_NAME IN (${columnNames.map(() => "?").join(", ")})`,
        columnNames
    );
    const existingColumns = new Set(columnRows.map(columnName));
    const addedColumns = [];

    for (const column of CUSTOMER_MEMBER_COLUMNS) {
        if (!existingColumns.has(column.name)) {
            await db.execute(column.ddl);
            addedColumns.push(column.name);
        }
    }

    await backfillCustomerMemberCodes(db);
    await backfillMembershipMetadata(db);

    const indexNames = CUSTOMER_MEMBER_INDEXES.map((index) => index.name);
    const [indexRows] = await db.execute(
        `SELECT INDEX_NAME
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'customers'
          AND INDEX_NAME IN (${indexNames.map(() => "?").join(", ")})`,
        indexNames
    );
    const existingIndexes = new Set(indexRows.map(indexName));
    const addedIndexes = [];

    for (const index of CUSTOMER_MEMBER_INDEXES) {
        if (!existingIndexes.has(index.name)) {
            try {
                await db.execute(index.ddl);
                addedIndexes.push(index.name);
            } catch (error) {
                // Duplicate phone values would block unique phone index; log-friendly rethrow
                const code = error && (error.code || error.errno);
                if (index.name === "idx_customers_phone" && (code === "ER_DUP_ENTRY" || code === 1062)) {
                    const softError = new Error(
                        "Không thể tạo unique index phone: có số điện thoại trùng trong customers"
                    );
                    softError.cause = error;
                    throw softError;
                }
                throw error;
            }
        }
    }

    return { addedColumns, addedIndexes };
}

module.exports = {
    CUSTOMER_MEMBER_COLUMNS,
    CUSTOMER_MEMBER_INDEXES,
    ensureCustomerMemberColumns
};
