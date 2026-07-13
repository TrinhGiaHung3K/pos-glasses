/**
 * Revenue / ops insight engine for dashboard & reports.
 *
 * Design:
 * 1. Build a deterministic snapshot from dashboard SQL numbers (source of truth).
 * 2. Ask Gemini to narrate and recommend using ONLY that snapshot.
 * 3. Fall back to heuristic Vietnamese copy if AI is off / fails / returns bad JSON.
 */

const INSIGHT_PROMPT_VERSION = "pos-insights.v1";

function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function compactProduct(row) {
    return {
        id: row.id ?? null,
        name: row.name || "Sản phẩm",
        sku: row.sku || "",
        qty_sold: num(row.qty_sold),
        revenue: num(row.revenue)
    };
}

function compactStaff(row) {
    return {
        id: row.id ?? null,
        username: row.username || "NV",
        order_count: num(row.order_count),
        revenue: num(row.revenue)
    };
}

/**
 * Normalize dashboard.getSummary() into a compact, model-friendly snapshot.
 */
function buildInsightSnapshot(summary = {}) {
    const previous = summary.previous || {};
    const series = Array.isArray(summary.series) ? summary.series : [];
    return {
        range: summary.range || "today",
        from: summary.from || null,
        to: summary.to || null,
        revenue: num(summary.revenue ?? summary.totalRevenue),
        order_count: num(summary.order_count ?? summary.totalOrders),
        aov: num(summary.aov),
        cost: num(summary.cost),
        gross_profit: num(summary.gross_profit),
        margin_percent: num(summary.margin_percent),
        new_members: num(summary.new_members),
        low_stock_count: num(summary.low_stock_count),
        pending_qr_count: num(summary.pending_qr_count),
        total_products: num(summary.totalProducts),
        total_customers: num(summary.totalCustomers),
        previous: {
            revenue: num(previous.revenue),
            order_count: num(previous.order_count),
            revenue_delta_percent: num(previous.revenue_delta_percent),
            order_delta_percent: num(previous.order_delta_percent)
        },
        top_products: (summary.top_products || []).slice(0, 5).map(compactProduct),
        top_staff: (summary.top_staff || []).slice(0, 5).map(compactStaff),
        series_recent: series.slice(-10).map((row) => ({
            day: row.day,
            order_count: num(row.order_count),
            revenue: num(row.revenue)
        }))
    };
}

function sentimentFromDelta(deltaPct) {
    if (deltaPct > 3) return "up";
    if (deltaPct < -3) return "down";
    return "flat";
}

function formatVnd(value) {
    return `${Math.round(num(value)).toLocaleString("vi-VN")} đ`;
}

/**
 * Deterministic fallback when Gemini is unavailable.
 */
function buildHeuristicInsight(snapshot, surface = "dashboard") {
    const delta = num(snapshot.previous?.revenue_delta_percent);
    const orderDelta = num(snapshot.previous?.order_delta_percent);
    const sentiment = sentimentFromDelta(delta);
    const topProduct = snapshot.top_products?.[0];
    const topStaff = snapshot.top_staff?.[0];

    const headline = sentiment === "up"
        ? `Doanh thu tăng ${Math.abs(delta)}% so với kỳ trước`
        : sentiment === "down"
            ? `Doanh thu giảm ${Math.abs(delta)}% so với kỳ trước`
            : "Doanh thu đi ngang so với kỳ trước";

    const highlights = [
        {
            type: "revenue",
            title: "Doanh thu kỳ này",
            detail: `${formatVnd(snapshot.revenue)} (${delta >= 0 ? "+" : ""}${delta}% so với ${formatVnd(snapshot.previous.revenue)})`,
            direction: sentiment
        },
        {
            type: "orders",
            title: "Số đơn",
            detail: `${snapshot.order_count} đơn · AOV ${formatVnd(snapshot.aov)} · Δ đơn ${orderDelta >= 0 ? "+" : ""}${orderDelta}%`,
            direction: sentimentFromDelta(orderDelta)
        }
    ];

    if (topProduct) {
        highlights.push({
            type: "product",
            title: "Sản phẩm dẫn dắt",
            detail: `${topProduct.name} (\`${topProduct.sku || "—"}\`) · ${formatVnd(topProduct.revenue)} · ${topProduct.qty_sold} sp`,
            direction: "up"
        });
    }

    if (topStaff) {
        highlights.push({
            type: "staff",
            title: "Nhân viên mạnh",
            detail: `${topStaff.username} · ${formatVnd(topStaff.revenue)} · ${topStaff.order_count} đơn`,
            direction: "up"
        });
    }

    const actions = [];
    if (sentiment === "down") {
        actions.push({
            priority: "high",
            title: "Kích hoạt đơn còn thiếu",
            detail: "Rà đơn QR pending, follow-up khách bỏ giỏ và ưu tiên gợi ý top SP đang bán chạy."
        });
        actions.push({
            priority: "medium",
            title: "Rà promotion theo AOV",
            detail: `AOV hiện ${formatVnd(snapshot.aov)}. Cân nhắc combo/upsell gọng + tròng thay vì giảm sâu toàn menu.`
        });
    } else if (sentiment === "up") {
        actions.push({
            priority: "medium",
            title: "Giữ đà tăng",
            detail: "Nhân rộng kịch bản bán của top nhân viên và đảm bảo tồn top SP không đứt hàng."
        });
    } else {
        actions.push({
            priority: "medium",
            title: "Tìm đòn bẩy tăng nhẹ",
            detail: "Thử push 1–2 SKU biên lợi nhuận tốt vào gợi ý quầy trong ca cao điểm."
        });
    }

    if (num(snapshot.low_stock_count) > 0) {
        actions.push({
            priority: "high",
            title: "Xử lý tồn thấp",
            detail: `Có ${snapshot.low_stock_count} SP tồn ≤ 5. Ưu tiên nhập top seller trước khi chạy campaign.`
        });
    }

    if (num(snapshot.pending_qr_count) > 0) {
        actions.push({
            priority: "medium",
            title: "Đóng đơn QR treo",
            detail: `${snapshot.pending_qr_count} đơn QR pending có thể chuyển thành doanh thu nếu staff chốt nhanh.`
        });
    }

    const risks = [];
    if (sentiment === "down") {
        risks.push("Nếu giảm kéo dài > 2 kỳ, cần tách kênh staff vs QR để tìm điểm rơi.");
    }
    if (num(snapshot.margin_percent) < 20 && num(snapshot.revenue) > 0) {
        risks.push(`Biên lợi nhuận ${snapshot.margin_percent}% thấp — kiểm tra giá vốn / hoàn tiền.`);
    }
    if (num(snapshot.low_stock_count) >= 5) {
        risks.push("Tồn thấp diện rộng có thể làm mất doanh thu những ngày tới.");
    }

    const surfaceHint = surface === "reports"
        ? "Góc nhìn báo cáo bán hàng"
        : "Góc nhìn vận hành dashboard";

    return {
        headline,
        sentiment,
        summary: `${surfaceHint}: kỳ **${snapshot.range}** ghi nhận **${formatVnd(snapshot.revenue)}** / **${snapshot.order_count}** đơn. So với kỳ trước: doanh thu **${delta >= 0 ? "+" : ""}${delta}%**, đơn **${orderDelta >= 0 ? "+" : ""}${orderDelta}%**.`,
        highlights: highlights.slice(0, 5),
        actions: actions.slice(0, 4),
        risks: risks.slice(0, 3),
        source: "heuristic"
    };
}

function clampList(value, max) {
    return Array.isArray(value) ? value.slice(0, max) : [];
}

function normalizeInsight(raw, snapshot, surface) {
    if (!raw || typeof raw !== "object") {
        return buildHeuristicInsight(snapshot, surface);
    }

    const sentiment = ["up", "down", "flat", "mixed"].includes(raw.sentiment)
        ? raw.sentiment
        : sentimentFromDelta(num(snapshot.previous?.revenue_delta_percent));

    const highlights = clampList(raw.highlights, 5).map((item) => ({
        type: String(item?.type || "note").slice(0, 40),
        title: String(item?.title || "Ghi chú").slice(0, 120),
        detail: String(item?.detail || "").slice(0, 400),
        direction: ["up", "down", "flat"].includes(item?.direction) ? item.direction : "flat"
    })).filter((item) => item.detail);

    const actions = clampList(raw.actions, 4).map((item) => ({
        priority: ["high", "medium", "low"].includes(item?.priority) ? item.priority : "medium",
        title: String(item?.title || "Gợi ý").slice(0, 120),
        detail: String(item?.detail || "").slice(0, 400)
    })).filter((item) => item.detail);

    const risks = clampList(raw.risks, 3)
        .map((item) => String(item || "").slice(0, 280))
        .filter(Boolean);

    const headline = String(raw.headline || "").trim().slice(0, 160)
        || buildHeuristicInsight(snapshot, surface).headline;
    const summary = String(raw.summary || "").trim().slice(0, 1200)
        || buildHeuristicInsight(snapshot, surface).summary;

    if (!highlights.length && !actions.length) {
        return buildHeuristicInsight(snapshot, surface);
    }

    return {
        headline,
        sentiment,
        summary,
        highlights: highlights.length ? highlights : buildHeuristicInsight(snapshot, surface).highlights,
        actions: actions.length ? actions : buildHeuristicInsight(snapshot, surface).actions,
        risks,
        source: "gemini"
    };
}

function extractJsonObject(text) {
    const raw = String(text || "").trim();
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        /* try fenced or embedded object */
    }

    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) {
        try {
            return JSON.parse(fence[1].trim());
        } catch {
            /* continue */
        }
    }

    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
        try {
            return JSON.parse(raw.slice(start, end + 1));
        } catch {
            return null;
        }
    }
    return null;
}

function buildInsightSystemInstruction(surface) {
    return [
        "Bạn là chuyên gia phân tích vận hành POS kính mắt (POS Glasses).",
        `Bối cảnh màn hình: ${surface === "reports" ? "Báo cáo bán hàng" : "Dashboard vận hành"}.`,
        "Chỉ được dùng số liệu trong SNAPSHOT JSON do hệ thống cung cấp. Không bịa số, không thêm sản phẩm/nhân viên ngoài snapshot.",
        "Trả lời DUY NHẤT một JSON object hợp lệ (không markdown ngoài field text, không giải thích ngoài JSON).",
        "Schema:",
        JSON.stringify({
            headline: "string ngắn ≤ 12 từ, nêu tăng/giảm/đi ngang",
            sentiment: "up|down|flat|mixed",
            summary: "string markdown ngắn 2-4 câu, có **in đậm** số chính",
            highlights: [{ type: "revenue|orders|product|staff|inventory|other", title: "string", detail: "string", direction: "up|down|flat" }],
            actions: [{ priority: "high|medium|low", title: "string", detail: "string hành động cụ thể cho chủ shop/quầy" }],
            risks: ["string"]
        }, null, 2),
        "Ưu tiên gợi ý hành động thực dụng: tồn thấp, đơn QR pending, AOV, top SP, top NV, promotion có kiểm soát.",
        "Không chẩn đoán y khoa. Không bảo staff tự xác nhận chuyển khoản."
    ].join("\n");
}

function buildInsightUserMessage(snapshot, focus) {
    const focusLine = focus
        ? `\nTrọng tâm người dùng muốn nhấn: ${String(focus).slice(0, 200)}`
        : "";
    return [
        "SNAPSHOT số liệu kỳ hiện tại (nguồn sự thật):",
        JSON.stringify(snapshot, null, 2),
        focusLine,
        "Hãy phân tích tăng/giảm doanh thu, đơn, AOV, top sản phẩm/nhân viên và đưa gợi ý hành động."
    ].filter(Boolean).join("\n");
}

/**
 * Map UI range keys from reports.html into dashboard repository ranges.
 */
function normalizeInsightRange(payload = {}) {
    const raw = String(payload.range || "7d").toLowerCase();
    const map = {
        today: "today",
        "7d": "7d",
        last7: "7d",
        "30d": "30d",
        last30: "30d",
        custom: "custom",
        thismonth: "custom",
        all: "30d"
    };

    let range = map[raw] || "7d";
    let from = payload.from || null;
    let to = payload.to || null;

    if (raw === "thismonth" || raw === "this_month") {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now);
        const pad = (n) => String(n).padStart(2, "0");
        from = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`;
        to = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
        range = "custom";
    }

    if (range === "custom" && (!from || !to)) {
        range = "7d";
        from = null;
        to = null;
    }

    return { range, from, to };
}

module.exports = {
    INSIGHT_PROMPT_VERSION,
    buildInsightSnapshot,
    buildHeuristicInsight,
    normalizeInsight,
    extractJsonObject,
    buildInsightSystemInstruction,
    buildInsightUserMessage,
    normalizeInsightRange,
    sentimentFromDelta
};
