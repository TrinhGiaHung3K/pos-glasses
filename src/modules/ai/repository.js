function createAiRepository(db) {
    return {
        async logUsage(entry) {
            await db.execute(
                `INSERT INTO ai_usage_logs
                (user_id, role, use_case, prompt_version, model, input_tokens,
                 output_tokens, latency_ms, tool_names_json, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [entry.user_id || null, entry.role, entry.use_case, entry.prompt_version,
                    entry.model, entry.input_tokens || 0, entry.output_tokens || 0,
                    entry.latency_ms || 0, JSON.stringify(entry.tool_names || []), entry.status]
            );
        },
        async saveFeedback(entry) {
            await db.execute(
                `INSERT INTO ai_feedback (user_id, response_id, rating, reason)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE rating = VALUES(rating), reason = VALUES(reason)`,
                [entry.user_id, entry.response_id, entry.rating, entry.reason || null]
            );
        }
    };
}

module.exports = { createAiRepository };
