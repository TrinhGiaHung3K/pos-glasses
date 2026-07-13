const assert = require("node:assert/strict");
const test = require("node:test");
const { createAiService } = require("../../../src/modules/ai/service");
const { routeModel } = require("../../../src/modules/ai/modelRouter");
const { createLocalRag } = require("../../../src/modules/ai/rag");

function harness(overrides = {}) {
    const logs = [];
    const calls = [];
    const service = createAiService({
        logUsage: async (entry) => logs.push(entry),
        saveFeedback: async (entry) => calls.push(["feedback", entry])
    }, {
        config: { enabled: true, apiKey: "test", defaultModel: "lite", analysisModel: "flash" },
        rag: createLocalRag(),
        tools: { declarations: [], execute: async () => ({}) },
        gateway: { generate: async (input) => { calls.push(["generate", input]); return { text: "Câu trả lời", toolNames: ["search_products"], usage: { promptTokenCount: 10, candidatesTokenCount: 5 } }; } },
        ...overrides
    });
    return { service, logs, calls };
}

test("AI assistant grounds policy answers and logs metadata without raw prompt", async () => {
    const { service, logs, calls } = harness();
    const result = await service.chat({ message: "Chuyển khoản được xác nhận thế nào?" }, { id: 2, role: "staff" });
    assert.equal(result.answer, "Câu trả lời");
    assert.equal(result.model, "lite");
    assert.ok(result.sources.length > 0);
    assert.match(calls[0][1].systemInstruction, /webhook ngân hàng/);
    assert.equal(logs[0].input_tokens, 10);
    assert.equal("message" in logs[0], false);
});

test("admin revenue analysis routes to stronger model", () => {
    assert.equal(routeModel("Phân tích xu hướng doanh thu", { defaultModel: "lite", analysisModel: "flash" }, "admin"), "flash");
    assert.equal(routeModel("Tìm kính RayBan", { defaultModel: "lite", analysisModel: "flash" }, "staff"), "lite");
});

test("AI rejects disabled mode and oversized prompts", async () => {
    const { service } = harness({ config: { enabled: false } });
    await assert.rejects(() => service.chat({ message: "hello" }, { id: 2, role: "staff" }), { status: 503 });
    const active = harness().service;
    await assert.rejects(() => active.chat({ message: "x".repeat(2001) }, { id: 2, role: "staff" }), { status: 400 });
});
