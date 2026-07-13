const assert = require("node:assert/strict");
const test = require("node:test");
const {
    buildInsightSnapshot,
    buildHeuristicInsight,
    normalizeInsight,
    extractJsonObject,
    normalizeInsightRange,
    sentimentFromDelta
} = require("../../../src/modules/ai/insights");
const { createAiService } = require("../../../src/modules/ai/service");

const sampleSummary = {
    range: "7d",
    from: "2026-07-07 00:00:00",
    to: "2026-07-13 23:59:59",
    revenue: 150000000,
    totalRevenue: 150000000,
    order_count: 12,
    totalOrders: 12,
    aov: 12500000,
    cost: 0,
    gross_profit: 150000000,
    margin_percent: 100,
    new_members: 3,
    low_stock_count: 2,
    pending_qr_count: 1,
    totalProducts: 56,
    totalCustomers: 40,
    previous: {
        revenue: 12000000,
        order_count: 3,
        revenue_delta_percent: 1150,
        order_delta_percent: 300
    },
    top_products: [
        { id: 1, name: "LV Heritage", sku: "LV001", qty_sold: 2, revenue: 31800000 }
    ],
    top_staff: [
        { id: 9, username: "BanhCanh", order_count: 5, revenue: 100000000 }
    ],
    series: [
        { day: "2026-07-12", order_count: 2, revenue: 20000000 },
        { day: "2026-07-13", order_count: 3, revenue: 40000000 }
    ]
};

test("buildInsightSnapshot keeps commercial metrics only", () => {
    const snap = buildInsightSnapshot(sampleSummary);
    assert.equal(snap.revenue, 150000000);
    assert.equal(snap.previous.revenue_delta_percent, 1150);
    assert.equal(snap.top_products[0].sku, "LV001");
    assert.equal(snap.series_recent.length, 2);
});

test("heuristic insight marks strong growth as up", () => {
    const snap = buildInsightSnapshot(sampleSummary);
    const insight = buildHeuristicInsight(snap, "dashboard");
    assert.equal(insight.sentiment, "up");
    assert.match(insight.headline, /tăng/i);
    assert.ok(insight.actions.length >= 1);
    assert.equal(insight.source, "heuristic");
});

test("normalizeInsight rejects empty model payload", () => {
    const snap = buildInsightSnapshot(sampleSummary);
    const insight = normalizeInsight({ headline: "x", sentiment: "up" }, snap, "reports");
    assert.ok(insight.highlights.length >= 1);
});

test("extractJsonObject handles fenced JSON", () => {
    const obj = extractJsonObject("```json\n{\"headline\":\"Hi\",\"sentiment\":\"flat\",\"highlights\":[{\"type\":\"revenue\",\"title\":\"A\",\"detail\":\"B\",\"direction\":\"flat\"}],\"actions\":[{\"priority\":\"medium\",\"title\":\"T\",\"detail\":\"D\"}]}\n```");
    assert.equal(obj.headline, "Hi");
});

test("normalizeInsightRange maps report filters", () => {
    assert.equal(normalizeInsightRange({ range: "last7" }).range, "7d");
    assert.equal(normalizeInsightRange({ range: "last30" }).range, "30d");
    assert.equal(normalizeInsightRange({ range: "thisMonth" }).range, "custom");
    assert.ok(normalizeInsightRange({ range: "thisMonth" }).from);
});

test("sentimentFromDelta thresholds", () => {
    assert.equal(sentimentFromDelta(10), "up");
    assert.equal(sentimentFromDelta(-10), "down");
    assert.equal(sentimentFromDelta(1), "flat");
});

test("AI insights is admin-only and returns snapshot + insight", async () => {
    const service = createAiService({
        logUsage: async () => {}
    }, {
        config: { enabled: true, apiKey: "k", defaultModel: "lite", analysisModel: "flash" },
        getDashboardSummary: async () => sampleSummary,
        gateway: {
            generateText: async () => ({
                text: JSON.stringify({
                    headline: "Doanh thu tăng mạnh",
                    sentiment: "up",
                    summary: "Kỳ này **tăng** rõ rệt.",
                    highlights: [
                        { type: "revenue", title: "DT", detail: "Tăng so kỳ trước", direction: "up" }
                    ],
                    actions: [
                        { priority: "medium", title: "Giữ đà", detail: "Push top SP" }
                    ],
                    risks: []
                }),
                usage: { promptTokenCount: 11, candidatesTokenCount: 22 }
            })
        }
    });

    await assert.rejects(
        () => service.insights({ range: "7d" }, { id: 2, role: "staff" }),
        { status: 403 }
    );

    const result = await service.insights({ range: "7d", surface: "dashboard" }, { id: 1, role: "admin" });
    assert.equal(result.snapshot.revenue, 150000000);
    assert.equal(result.insight.sentiment, "up");
    assert.match(result.insight.headline, /tăng/i);
    assert.equal(result.model, "flash");
    assert.ok(result.response_id);
});

test("AI insights falls back to heuristic when Gemini fails", async () => {
    const service = createAiService({
        logUsage: async () => {}
    }, {
        config: { enabled: true, apiKey: "k", defaultModel: "lite", analysisModel: "flash" },
        getDashboardSummary: async () => sampleSummary,
        gateway: {
            generateText: async () => {
                throw Object.assign(new Error("quota"), { status: 429 });
            }
        }
    });

    const result = await service.insights({ range: "7d" }, { id: 1, role: "admin" });
    assert.equal(result.insight.source, "heuristic_fallback");
    assert.ok(result.insight.highlights.length);
});
