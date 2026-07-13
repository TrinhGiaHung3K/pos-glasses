function createAuthRepository(db) {
    return {
        async findByUsername(username) {
            const [rows] = await db.execute(
                `SELECT * FROM users WHERE username = ?`,
                [username]
            );
            return rows[0] || null;
        },

        async findById(id) {
            const [rows] = await db.execute(
                `SELECT id, username, role, is_active, created_at
                FROM users WHERE id = ? LIMIT 1`,
                [id]
            );
            return rows[0] || null;
        },

        async createUser(username, hashedPassword, role, isActive = 1) {
            const [result] = await db.execute(
                `INSERT INTO users (username, password, role, is_active)
                VALUES (?, ?, ?, ?)`,
                [username, hashedPassword, role, isActive ? 1 : 0]
            );
            return {
                id: result.insertId,
                username,
                role,
                is_active: isActive ? 1 : 0
            };
        },

        async updatePassword(id, hashedPassword) {
            await db.execute(
                `UPDATE users SET password = ? WHERE id = ?`,
                [hashedPassword, id]
            );
        },

        async setActive(id, isActive) {
            const [result] = await db.execute(
                `UPDATE users SET is_active = ? WHERE id = ?`,
                [isActive ? 1 : 0, id]
            );
            return result;
        },

        async findAllUsers() {
            const [rows] = await db.execute(
                `SELECT id, username, role,
                    COALESCE(is_active, 1) AS is_active,
                    created_at
                FROM users
                ORDER BY id ASC`
            );
            return rows;
        }
    };
}

module.exports = {
    createAuthRepository
};
