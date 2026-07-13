const assert = require("node:assert/strict");
const test = require("node:test");
const { ensureAiSchema } = require("../../src/db/aiSchema");

test("AI schema stores usage metadata and feedback, not prompt text", async () => {
    const statements = [];
    await ensureAiSchema({ execute: async (sql) => { statements.push(sql); return [{ affectedRows: 0 }]; } });
    const sql = statements.join("\n");
    assert.match(sql, /ai_usage_logs/);
    assert.match(sql, /ai_feedback/);
    assert.doesNotMatch(sql, /prompt_text/);
});
