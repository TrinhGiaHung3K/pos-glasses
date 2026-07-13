/**
 * Simple SQL migration runner.
 * Files: scripts/migrations/*.sql ordered by filename.
 * Tracks applied names in schema_migrations.
 */

const fs = require("node:fs/promises");
const path = require("node:path");
const logger = require("../utils/logger");

const DEFAULT_DIR = path.join(__dirname, "..", "..", "scripts", "migrations");

async function ensureMigrationsTable(db) {
    await db.execute(
        `CREATE TABLE IF NOT EXISTS \`schema_migrations\` (
            \`id\` int NOT NULL AUTO_INCREMENT,
            \`name\` varchar(255) NOT NULL,
            \`applied_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (\`id\`),
            UNIQUE KEY \`uq_schema_migrations_name\` (\`name\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
}

async function listApplied(db) {
    const [rows] = await db.execute(
        "SELECT name FROM schema_migrations ORDER BY name ASC"
    );
    return new Set(rows.map((row) => row.name));
}

async function listMigrationFiles(dir) {
    try {
        const entries = await fs.readdir(dir);
        return entries
            .filter((name) => name.endsWith(".sql"))
            .sort((a, b) => a.localeCompare(b));
    } catch (error) {
        if (error && error.code === "ENOENT") {
            return [];
        }
        throw error;
    }
}

/**
 * Split SQL file into statements (naive; good enough for simple migrations).
 */
function splitStatements(sql) {
    return String(sql)
        .split(/;\s*[\r\n]+/)
        .map((part) => part.trim())
        .filter((part) => part && !part.startsWith("--") && part !== ";");
}

async function runMigrations(db, options = {}) {
    const dir = options.dir || DEFAULT_DIR;
    await ensureMigrationsTable(db);
    const applied = await listApplied(db);
    const files = await listMigrationFiles(dir);
    const ran = [];

    for (const file of files) {
        if (applied.has(file)) {
            continue;
        }

        const fullPath = path.join(dir, file);
        const sql = await fs.readFile(fullPath, "utf8");
        const statements = splitStatements(sql);

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            for (const statement of statements) {
                await connection.execute(statement);
            }
            await connection.execute(
                "INSERT INTO schema_migrations (name) VALUES (?)",
                [file]
            );
            await connection.commit();
            ran.push(file);
            logger.info("Migration applied", { name: file });
        } catch (error) {
            await connection.rollback();
            logger.error("Migration failed", error);
            throw error;
        } finally {
            connection.release();
        }
    }

    return { applied: ran, pending: files.filter((f) => !applied.has(f) && !ran.includes(f)) };
}

module.exports = {
    runMigrations,
    ensureMigrationsTable,
    DEFAULT_DIR
};
