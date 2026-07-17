const bcrypt = require("bcrypt");

const SALT_ROUNDS = 12;

function validateBootstrapCredentials(config = {}) {
    const username = String(config.username || "").trim();
    const password = String(config.password || "");

    if (!username && !password) {
        return null;
    }
    if (!username || !password) {
        throw new Error("BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD must be set together");
    }
    if (!/^[a-zA-Z0-9._-]{3,50}$/.test(username)) {
        throw new Error("BOOTSTRAP_ADMIN_USERNAME must be 3-50 safe characters");
    }
    if (password.length < 12 || password.length > 128 || !/[A-Za-zÀ-ỹ]/u.test(password) || !/\d/.test(password)) {
        throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be 12-128 characters and include a letter and a number");
    }

    return { username, password };
}

async function ensureBootstrapAdmin(db, config = {}, options = {}) {
    const credentials = validateBootstrapCredentials(config);
    const [[countRow]] = await db.execute("SELECT COUNT(*) AS total FROM users");
    const total = Number(countRow?.total || 0);

    if (total === 0) {
        if (!credentials) {
            if (options.isProd) {
                throw new Error(
                    "No application users exist. Configure BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD for the first production start."
                );
            }
            return { created: false, reason: "credentials_missing" };
        }

        const hash = await bcrypt.hash(credentials.password, SALT_ROUNDS);
        const [result] = await db.execute(
            `INSERT INTO users (username, password, role, is_active)
            VALUES (?, ?, 'admin', 1)`,
            [credentials.username, hash]
        );
        return { created: true, id: result.insertId, username: credentials.username };
    }

    let prepared = null;
    if (credentials) {
        const [rows] = await db.execute(
            "SELECT id, password FROM users WHERE username = ? LIMIT 1",
            [credentials.username]
        );
        const existing = rows[0];

        if (!existing) {
            const hash = await bcrypt.hash(credentials.password, SALT_ROUNDS);
            const [result] = await db.execute(
                `INSERT INTO users (username, password, role, is_active)
                VALUES (?, ?, 'admin', 1)`,
                [credentials.username, hash]
            );
            prepared = { created: true, id: result.insertId, username: credentials.username };
        }

        if (existing && !String(existing.password || "").startsWith("$2")) {
            const hash = await bcrypt.hash(credentials.password, SALT_ROUNDS);
            await db.execute(
                "UPDATE users SET password = ?, role = 'admin', is_active = 1 WHERE id = ?",
                [hash, existing.id]
            );
            prepared = { created: false, migrated: true, id: existing.id, username: credentials.username };
        }
    }

    if (options.isProd) {
        const [legacyRows] = await db.execute(
            "SELECT id, username FROM users WHERE password NOT LIKE '$2%' LIMIT 10"
        );
        if (legacyRows.length) {
            const accounts = legacyRows.map((row) => row.username || row.id).join(", ");
            throw new Error(`Legacy plaintext passwords detected for: ${accounts}. Reset or disable these accounts before production start.`);
        }
    }

    return prepared || { created: false, reason: "users_exist" };
}

module.exports = {
    ensureBootstrapAdmin,
    validateBootstrapCredentials
};
