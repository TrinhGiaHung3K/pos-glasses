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

        /**
         * List audit events newest-first.
         *
         * Performance notes:
         * - No COUNT(*) (full-table count is the main cost on large audit_logs).
         * - Fetches limit+1 rows to derive has_more for next-page UI.
         * - Orders by primary key id DESC (index-friendly).
         * - entity_type filter uses idx_audit_logs_entity_id (entity_type, id).
         * - Optional include_total=true for rare callers that need exact totals.
         */
        async list({ page = 1, limit = 50, entity_type, include_total = false } = {}) {
            const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
            const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));
            const offset = (safePage - 1) * safeLimit;
            const params = [];
            let where = "";

            if (entity_type) {
                where = "WHERE entity_type = ?";
                params.push(String(entity_type));
            }

            // limit+1 avoids COUNT(*) while still knowing if another page exists
            const fetchLimit = safeLimit + 1;
            const listSql = `
                SELECT id, actor_id, action, entity_type, entity_id, payload_json, ip, created_at
                FROM audit_logs
                ${where}
                ORDER BY id DESC
                LIMIT ${fetchLimit} OFFSET ${offset}
            `;

            const runList = () =>
                typeof db.query === "function"
                    ? db.query(listSql, params)
                    : db.execute(listSql, params);

            let rows;
            let total = null;

            if (include_total === true || include_total === "1" || include_total === 1) {
                const countSql = `SELECT COUNT(*) AS total FROM audit_logs ${where}`;
                const runCount = () =>
                    typeof db.query === "function"
                        ? db.query(countSql, params)
                        : db.execute(countSql, params);

                const [countResult, listResult] = await Promise.all([runCount(), runList()]);
                const countRows = countResult[0] || [];
                rows = listResult[0] || [];
                total = Number(countRows[0]?.total || 0);
            } else {
                const listResult = await runList();
                rows = listResult[0] || [];
            }

            const hasMore = Array.isArray(rows) && rows.length > safeLimit;
            const items = hasMore ? rows.slice(0, safeLimit) : (rows || []);

            // Soft total for UI when we hit the last page without counting
            if (total == null && !hasMore) {
                total = offset + items.length;
            }

            return {
                items,
                page: safePage,
                limit: safeLimit,
                has_more: hasMore,
                total
            };
        }
    };
}

module.exports = {
    createAuditRepository
};
