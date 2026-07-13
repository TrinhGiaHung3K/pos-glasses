function createAuditRepository(db) {
    return {
        async append(entry) {
            try {
                const [result] = await db.execute(
                    `INSERT INTO audit_logs
                    (actor_id, action, entity_type, entity_id, payload_json, ip)
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        entry.actor_id != null ? Number(entry.actor_id) : null,
                        String(entry.action || "").slice(0, 80),
                        String(entry.entity_type || "").slice(0, 60),
                        entry.entity_id != null ? Number(entry.entity_id) : null,
                        entry.payload != null ? JSON.stringify(entry.payload) : null,
                        entry.ip ? String(entry.ip).slice(0, 64) : null
                    ]
                );
                return result.insertId;
            } catch (error) {
                // Audit must not break primary business flow if table missing mid-deploy
                if (error && (error.code === "ER_NO_SUCH_TABLE" || error.errno === 1146)) {
                    return null;
                }
                throw error;
            }
        },

        async list({ page = 1, limit = 50, entity_type } = {}) {
            const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
            const safeLimit = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 50));
            const offset = (safePage - 1) * safeLimit;
            const params = [];
            let where = "";

            if (entity_type) {
                where = "WHERE entity_type = ?";
                params.push(String(entity_type));
            }

            const [countRows] = await db.execute(
                `SELECT COUNT(*) AS total FROM audit_logs ${where}`,
                params
            );
            const [rows] = await db.execute(
                `SELECT id, actor_id, action, entity_type, entity_id, payload_json, ip, created_at
                FROM audit_logs
                ${where}
                ORDER BY id DESC
                LIMIT ${safeLimit} OFFSET ${offset}`,
                params
            );

            return {
                items: rows,
                page: safePage,
                limit: safeLimit,
                total: Number(countRows[0]?.total || 0)
            };
        }
    };
}

module.exports = {
    createAuditRepository
};
