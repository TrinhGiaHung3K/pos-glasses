/**
 * Clone live schema (defaultdb) into a complete SQL script for a new database
 * suitable for MySQL Workbench EER reverse engineer / ERD.
 *
 * Usage:
 *   node scripts/export-erd-database-clone.js
 *   node scripts/export-erd-database-clone.js --db=pos_glasses
 *
 * Output:
 *   scripts/pos_glasses_erd_schema.sql   (default)
 */
require("dotenv").config();

const fs = require("node:fs/promises");
const path = require("node:path");
const mysql = require("mysql2/promise");

function parseArgs(argv) {
    const options = {
        db: "pos_glasses",
        out: null
    };
    for (const arg of argv) {
        if (arg.startsWith("--db=")) options.db = arg.slice(5).trim() || options.db;
        if (arg.startsWith("--out=")) options.out = arg.slice(6).trim() || null;
    }
    return options;
}

function sanitizeDbName(name) {
    const cleaned = String(name || "").trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(cleaned)) {
        throw new Error(`Invalid database name: ${name}`);
    }
    return cleaned;
}

function cleanCreateTableSql(createSql) {
    let sql = String(createSql || "");

    // Aiven/ANSI_QUOTES often emits double-quoted identifiers.
    sql = sql.replace(/"([A-Za-z0-9_]+)"/g, "`$1`");

    // Drop schema qualification if present.
    sql = sql
        .replace(/^CREATE TABLE `[A-Za-z0-9_]+`\./i, "CREATE TABLE ")
        .replace(/REFERENCES `[A-Za-z0-9_]+`\./gi, "REFERENCES ");

    return sql.trim().replace(/;?\s*$/, ";");
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const targetDb = sanitizeDbName(options.db);
    const outPath = path.resolve(
        options.out || path.join(__dirname, `${targetDb}_erd_schema.sql`)
    );

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === "false" ? undefined : { rejectUnauthorized: false }
    });

    try {
        const [[meta]] = await connection.query(
            "SELECT @@version AS version, @@sql_mode AS sql_mode, DATABASE() AS db"
        );

        const [tableRows] = await connection.query(
            `SELECT TABLE_NAME AS name
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_TYPE = 'BASE TABLE'
             ORDER BY TABLE_NAME`
        );

        const lines = [
            "-- =============================================================================",
            "-- POS Glasses — complete schema clone for ERD (MySQL Workbench)",
            `-- Source database : ${meta.db}`,
            `-- Source MySQL    : ${meta.version}`,
            `-- Source sql_mode : ${meta.sql_mode}`,
            `-- Target database : ${targetDb}`,
            `-- Generated at    : ${new Date().toISOString()}`,
            "-- Generator       : scripts/export-erd-database-clone.js",
            "--",
            "-- How to use in MySQL Workbench:",
            "--   1) File > New Model",
            "--   2) File > Import > Reverse Engineer MySQL Create Script...",
            "--   3) Select this file",
            "--   4) Select schema/tables > Finish > Arrange Diagram",
            "--",
            "-- Or execute this script on a local MySQL 8.x instance, then:",
            "--   Database > Reverse Engineer... (live connection)",
            "-- =============================================================================",
            "",
            "SET NAMES utf8mb4;",
            "SET time_zone = '+00:00';",
            "SET FOREIGN_KEY_CHECKS = 0;",
            "SET UNIQUE_CHECKS = 0;",
            "SET SQL_MODE = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';",
            "",
            `DROP DATABASE IF EXISTS \`${targetDb}\`;`,
            `CREATE DATABASE \`${targetDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
            `USE \`${targetDb}\`;`,
            ""
        ];

        for (const row of tableRows) {
            const tableName = row.name;
            const [createRows] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
            const rawCreate = createRows[0]["Create Table"];
            if (!rawCreate) {
                console.warn("Skip (no CREATE TABLE):", tableName);
                continue;
            }

            const createSql = cleanCreateTableSql(rawCreate);
            lines.push("-- ------------------------------------------------------------");
            lines.push(`-- Table structure for \`${tableName}\``);
            lines.push("-- ------------------------------------------------------------");
            lines.push(`DROP TABLE IF EXISTS \`${tableName}\`;`);
            lines.push(createSql);
            lines.push("");
        }

        // Optional: export FK relationships that may only exist as indexes
        // (SHOW CREATE TABLE already includes inline FK constraints when present).

        lines.push("SET FOREIGN_KEY_CHECKS = 1;");
        lines.push("SET UNIQUE_CHECKS = 1;");
        lines.push("");
        lines.push(`-- End of schema for \`${targetDb}\` (${tableRows.length} tables)`);
        lines.push("");

        await fs.mkdir(path.dirname(outPath), { recursive: true });
        await fs.writeFile(outPath, lines.join("\n"), "utf8");

        console.log(JSON.stringify({
            sourceDb: meta.db,
            targetDb,
            tables: tableRows.length,
            outPath
        }, null, 2));
    } finally {
        await connection.end();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
