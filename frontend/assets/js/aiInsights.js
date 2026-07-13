/**
 * Shared AI revenue/ops insights panel for dashboard + reports.
 * Visual layer: Chart.js (trend, period compare, top products) + AI narrative.
 */
(function initPosAiInsights(window, document) {
    if (window.PosAiInsights) return;

    const STYLE_ID = "pos-ai-insights-style";
    const PALETTE = {
        accent: "#0f766e",
        accentSoft: "rgba(15, 118, 110, 0.16)",
        accentFill: "rgba(15, 118, 110, 0.12)",
        success: "#16a34a",
        successSoft: "rgba(22, 163, 74, 0.14)",
        danger: "#dc2626",
        dangerSoft: "rgba(220, 38, 38, 0.12)",
        warning: "#d97706",
        muted: "#758582",
        text: "#14201f",
        grid: "rgba(20, 32, 31, 0.08)",
        series: ["#0f766e", "#0284c7", "#7c3aed", "#d97706", "#db2777", "#0d9488"]
    };

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
.pos-ai-insights {
    background: var(--bg-surface, #fff);
    border: 1px solid var(--border-color, rgba(20, 32, 31, 0.1));
    border-radius: var(--radius-default, 12px);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
}
.pos-ai-insights__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 18px;
    border-bottom: 1px solid var(--border-color, rgba(20, 32, 31, 0.1));
    background:
        linear-gradient(135deg, rgba(229, 245, 242, 0.65), rgba(255, 255, 255, 0) 55%),
        var(--bg-surface, #fff);
}
.pos-ai-insights__title-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
}
.pos-ai-insights__icon {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    color: var(--accent-color, #0f766e);
    background: var(--accent-light, #e5f5f2);
    border: 1px solid rgba(15, 118, 110, 0.14);
    font-size: 18px;
}
.pos-ai-insights__title {
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--text-primary, #14201f);
}
.pos-ai-insights__sub {
    margin: 2px 0 0;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-muted, #758582);
}
.pos-ai-insights__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    flex-wrap: wrap;
    justify-content: flex-end;
}
.pos-ai-insights__badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 28px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 800;
    white-space: nowrap;
}
.pos-ai-insights__badge.is-up {
    background: var(--success-light, #ecfdf5);
    color: var(--success-color, #16a34a);
}
.pos-ai-insights__badge.is-down {
    background: var(--danger-light, #fff1f2);
    color: var(--danger-color, #dc2626);
}
.pos-ai-insights__badge.is-flat,
.pos-ai-insights__badge.is-mixed {
    background: var(--bg-muted, #eaf0f2);
    color: var(--text-secondary, #465957);
}
.pos-ai-insights__body {
    padding: 16px 18px 18px;
    display: grid;
    gap: 16px;
}
.pos-ai-insights__headline {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 850;
    letter-spacing: -0.03em;
    line-height: 1.25;
    color: var(--text-primary, #14201f);
}
.pos-ai-insights__summary {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.55;
    color: var(--text-secondary, #465957);
}
.pos-ai-insights__summary p { margin: 0 0 0.4em; }
.pos-ai-insights__summary p:last-child { margin: 0; }
.pos-ai-insights__summary strong { color: var(--text-primary, #14201f); font-weight: 750; }
.pos-ai-insights__summary code {
    font-family: "Roboto Mono", Consolas, monospace;
    font-size: 0.9em;
    padding: 0.05em 0.3em;
    border-radius: 4px;
    background: var(--bg-muted, #eaf0f2);
}

/* Visual KPI strip */
.pos-ai-insights__kpis {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(4, minmax(0, 1fr));
}
.pos-ai-insights__kpi {
    border: 1px solid var(--border-color, rgba(20, 32, 31, 0.1));
    border-radius: 12px;
    padding: 12px 13px;
    background: var(--bg-primary, #f3f6f8);
    min-width: 0;
}
.pos-ai-insights__kpi-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: var(--text-muted, #758582);
}
.pos-ai-insights__kpi-value {
    margin: 4px 0 2px;
    font-size: 1.05rem;
    font-weight: 850;
    letter-spacing: -0.02em;
    color: var(--text-primary, #14201f);
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
}
.pos-ai-insights__kpi-delta {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11.5px;
    font-weight: 800;
}
.pos-ai-insights__kpi-delta.is-up { color: var(--success-color, #16a34a); }
.pos-ai-insights__kpi-delta.is-down { color: var(--danger-color, #dc2626); }
.pos-ai-insights__kpi-delta.is-flat { color: var(--text-muted, #758582); }
.pos-ai-insights__kpi-note {
    margin-top: 2px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted, #758582);
}

/* Charts */
.pos-ai-insights__charts {
    display: grid;
    gap: 12px;
    grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.85fr);
}
.pos-ai-insights__chart-card {
    border: 1px solid var(--border-color, rgba(20, 32, 31, 0.1));
    border-radius: 12px;
    background: #fff;
    padding: 12px 14px 10px;
    min-width: 0;
    display: grid;
    gap: 6px;
}
.pos-ai-insights__chart-card.is-wide {
    grid-column: 1 / -1;
}
.pos-ai-insights__chart-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
}
.pos-ai-insights__chart-title {
    margin: 0;
    font-size: 12.5px;
    font-weight: 800;
    color: var(--text-primary, #14201f);
}
.pos-ai-insights__chart-hint {
    font-size: 11px;
    font-weight: 650;
    color: var(--text-muted, #758582);
}
.pos-ai-insights__chart-wrap {
    position: relative;
    height: 200px;
    width: 100%;
}
.pos-ai-insights__chart-wrap.is-sm { height: 180px; }
.pos-ai-insights__chart-wrap.is-lg { height: 220px; }
.pos-ai-insights__chart-empty {
    display: grid;
    place-items: center;
    height: 100%;
    color: var(--text-muted, #758582);
    font-size: 12.5px;
    font-weight: 650;
    text-align: center;
    padding: 12px;
}

/* Narrative + actions */
.pos-ai-insights__grid {
    display: grid;
    gap: 12px;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
}
.pos-ai-insights__section-title {
    margin: 0 0 8px;
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted, #758582);
}
.pos-ai-insights__list {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
}
.pos-ai-insights__item {
    border: 1px solid var(--border-color, rgba(20, 32, 31, 0.1));
    border-radius: 10px;
    padding: 10px 12px;
    background: var(--bg-primary, #f3f6f8);
}
.pos-ai-insights__item-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 13px;
    font-weight: 750;
    color: var(--text-primary, #14201f);
}
.pos-ai-insights__item-detail {
    margin: 4px 0 0;
    font-size: 12.5px;
    line-height: 1.45;
    color: var(--text-secondary, #465957);
}
.pos-ai-insights__dir {
    font-size: 11px;
    font-weight: 800;
}
.pos-ai-insights__dir.is-up { color: var(--success-color, #16a34a); }
.pos-ai-insights__dir.is-down { color: var(--danger-color, #dc2626); }
.pos-ai-insights__dir.is-flat { color: var(--text-muted, #758582); }
.pos-ai-insights__priority {
    font-size: 10.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--accent-color, #0f766e);
}
.pos-ai-insights__priority.is-high { color: var(--danger-color, #dc2626); }
.pos-ai-insights__priority.is-low { color: var(--text-muted, #758582); }
.pos-ai-insights__risks {
    margin: 0;
    padding-left: 1.1em;
    color: var(--text-secondary, #465957);
    font-size: 12.5px;
    line-height: 1.45;
}
.pos-ai-insights__risks li { margin: 0.25em 0; }
.pos-ai-insights__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    font-size: 11.5px;
    font-weight: 650;
    color: var(--text-muted, #758582);
}
.pos-ai-insights__empty,
.pos-ai-insights__error {
    padding: 22px 18px;
    text-align: center;
    color: var(--text-muted, #758582);
    font-size: 13.5px;
}
.pos-ai-insights__error { color: var(--danger-color, #dc2626); }
.pos-ai-insights__skel {
    display: grid;
    gap: 10px;
}
.pos-ai-insights__skel span {
    display: block;
    height: 12px;
    border-radius: 6px;
    background: linear-gradient(90deg, var(--bg-muted, #eaf0f2) 0%, #f5f8f8 45%, var(--bg-muted, #eaf0f2) 100%);
    background-size: 200% 100%;
    animation: pos-ai-insights-shimmer 1.2s ease infinite;
}
.pos-ai-insights__skel span:nth-child(1) { width: 55%; height: 18px; }
.pos-ai-insights__skel span:nth-child(2) { width: 92%; }
.pos-ai-insights__skel span:nth-child(3) { width: 78%; height: 120px; }
@keyframes pos-ai-insights-shimmer {
    0% { background-position: 100% 0; }
    100% { background-position: -100% 0; }
}
@media (prefers-reduced-motion: reduce) {
    .pos-ai-insights__skel span { animation: none; }
}
@media (max-width: 1100px) {
    .pos-ai-insights__kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 900px) {
    .pos-ai-insights__charts,
    .pos-ai-insights__grid { grid-template-columns: 1fr; }
    .pos-ai-insights__head { flex-direction: column; }
    .pos-ai-insights__chart-card.is-wide { grid-column: auto; }
}
@media (max-width: 560px) {
    .pos-ai-insights__kpis { grid-template-columns: 1fr; }
    .pos-ai-insights__chart-wrap,
    .pos-ai-insights__chart-wrap.is-sm,
    .pos-ai-insights__chart-wrap.is-lg { height: 200px; }
}
@media print {
    .pos-ai-insights__actions button { display: none; }
}
`;
        document.head.appendChild(style);
    }

    function escapeHtml(value) {
        if (typeof window.escapeHtml === "function") return window.escapeHtml(value);
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function formatCurrency(value) {
        if (typeof window.formatCurrency === "function") return window.formatCurrency(value);
        return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
    }

    function formatCompactCurrency(value) {
        const n = Number(value || 0);
        if (Math.abs(n) >= 1e9) return `${(n / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ`;
        if (Math.abs(n) >= 1e6) return `${(n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
        if (Math.abs(n) >= 1e3) return `${(n / 1e3).toLocaleString("vi-VN", { maximumFractionDigits: 0 })}k`;
        return n.toLocaleString("vi-VN");
    }

    function renderMd(text) {
        if (typeof window.__posAiMarkdown === "function") {
            return window.__posAiMarkdown(text);
        }
        const escaped = escapeHtml(text);
        return escaped
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/`([^`]+)`/g, "<code>$1</code>")
            .replace(/\n/g, "<br>");
    }

    function directionLabel(dir) {
        if (dir === "up") return "Tăng";
        if (dir === "down") return "Giảm";
        return "Ổn định";
    }

    function sentimentLabel(s) {
        if (s === "up") return "Xu hướng tăng";
        if (s === "down") return "Xu hướng giảm";
        if (s === "mixed") return "Tín hiệu hỗn hợp";
        return "Đi ngang";
    }

    function rangeLabel(range) {
        const map = {
            today: "Hôm nay",
            "7d": "7 ngày",
            "30d": "30 ngày",
            custom: "Tùy chọn",
            last7: "7 ngày",
            last30: "30 ngày"
        };
        return map[String(range || "")] || String(range || "—");
    }

    function deltaClass(delta) {
        if (delta > 3) return "up";
        if (delta < -3) return "down";
        return "flat";
    }

    function formatDayLabel(value) {
        if (!value) return "";
        const d = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(d.getTime())) {
            const s = String(value);
            return s.length >= 10 ? s.slice(5, 10) : s;
        }
        return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
    }

    function destroyCharts(store) {
        if (!store) return;
        Object.keys(store).forEach((key) => {
            try {
                store[key]?.destroy?.();
            } catch {
                /* ignore */
            }
            delete store[key];
        });
    }

    function tooltipDefaults() {
        return {
            backgroundColor: "#10201d",
            titleColor: "#f8fafc",
            bodyColor: "#e2e8f0",
            borderColor: "rgba(255, 255, 255, 0.08)",
            borderWidth: 1,
            cornerRadius: 8,
            padding: 10,
            displayColors: true,
            callbacks: {
                label(ctx) {
                    const label = ctx.dataset.label ? `${ctx.dataset.label}: ` : "";
                    const raw = ctx.parsed.y != null ? ctx.parsed.y : ctx.parsed;
                    if (ctx.dataset.unit === "currency" || /doanh thu|revenue|dt/i.test(ctx.dataset.label || "")) {
                        return `${label}${formatCurrency(raw)}`;
                    }
                    return `${label}${Number(raw || 0).toLocaleString("vi-VN")}`;
                }
            }
        };
    }

    function createChart(store, key, canvas, config) {
        if (!window.Chart || !canvas) return null;
        if (store[key]) {
            try { store[key].destroy(); } catch { /* ignore */ }
        }
        store[key] = new window.Chart(canvas.getContext("2d"), config);
        return store[key];
    }

    function renderTrendChart(store, canvas, snapshot) {
        const series = Array.isArray(snapshot.series_recent) ? snapshot.series_recent : [];
        if (!series.length || !window.Chart) {
            canvas.parentElement.innerHTML = `<div class="pos-ai-insights__chart-empty">Chưa đủ chuỗi ngày để vẽ xu hướng.</div>`;
            return;
        }

        const labels = series.map((row) => formatDayLabel(row.day));
        const revenues = series.map((row) => Number(row.revenue || 0));
        const orders = series.map((row) => Number(row.order_count || 0));
        const sentiment = deltaClass(Number(snapshot.previous?.revenue_delta_percent || 0));
        const lineColor = sentiment === "down" ? PALETTE.danger : PALETTE.accent;

        createChart(store, "trend", canvas, {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "Doanh thu",
                        data: revenues,
                        unit: "currency",
                        borderColor: lineColor,
                        backgroundColor: (ctx) => {
                            const chart = ctx.chart;
                            const { ctx: c, chartArea } = chart;
                            if (!chartArea) return PALETTE.accentFill;
                            const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                            g.addColorStop(0, sentiment === "down" ? "rgba(220,38,38,0.22)" : "rgba(15,118,110,0.22)");
                            g.addColorStop(1, "rgba(15,118,110,0)");
                            return g;
                        },
                        fill: true,
                        tension: 0.35,
                        borderWidth: 2.5,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        pointBackgroundColor: "#fff",
                        pointBorderColor: lineColor,
                        pointBorderWidth: 2,
                        yAxisID: "y"
                    },
                    {
                        label: "Số đơn",
                        data: orders,
                        borderColor: "#0284c7",
                        backgroundColor: "rgba(2,132,199,0.08)",
                        fill: false,
                        tension: 0.35,
                        borderWidth: 2,
                        borderDash: [5, 4],
                        pointRadius: 2.5,
                        pointHoverRadius: 4,
                        pointBackgroundColor: "#fff",
                        pointBorderColor: "#0284c7",
                        yAxisID: "y1"
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                    legend: {
                        position: "top",
                        align: "end",
                        labels: {
                            boxWidth: 10,
                            boxHeight: 10,
                            usePointStyle: true,
                            pointStyle: "circle",
                            font: { size: 11, weight: "600" }
                        }
                    },
                    tooltip: tooltipDefaults()
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 10.5, weight: "600" }, maxRotation: 0 }
                    },
                    y: {
                        position: "left",
                        grid: { color: PALETTE.grid },
                        ticks: {
                            font: { size: 10.5 },
                            callback: (v) => formatCompactCurrency(v)
                        }
                    },
                    y1: {
                        position: "right",
                        grid: { drawOnChartArea: false },
                        ticks: {
                            font: { size: 10.5 },
                            precision: 0
                        }
                    }
                }
            }
        });
    }

    function renderCompareChart(store, canvas, snapshot) {
        if (!window.Chart) {
            canvas.parentElement.innerHTML = `<div class="pos-ai-insights__chart-empty">Chart.js chưa tải.</div>`;
            return;
        }
        const currentRevenue = Number(snapshot.revenue || 0);
        const prevRevenue = Number(snapshot.previous?.revenue || 0);
        const currentOrders = Number(snapshot.order_count || 0);
        const prevOrders = Number(snapshot.previous?.order_count || 0);

        createChart(store, "compare", canvas, {
            type: "bar",
            data: {
                labels: ["Doanh thu", "Số đơn"],
                datasets: [
                    {
                        label: "Kỳ trước",
                        data: [prevRevenue, prevOrders],
                        backgroundColor: "rgba(117, 133, 130, 0.35)",
                        borderRadius: 8,
                        borderSkipped: false,
                        maxBarThickness: 36
                    },
                    {
                        label: "Kỳ này",
                        data: [currentRevenue, currentOrders],
                        backgroundColor: [PALETTE.accent, "#0284c7"],
                        borderRadius: 8,
                        borderSkipped: false,
                        maxBarThickness: 36
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "top",
                        align: "end",
                        labels: {
                            boxWidth: 10,
                            usePointStyle: true,
                            pointStyle: "rectRounded",
                            font: { size: 11, weight: "600" }
                        }
                    },
                    tooltip: {
                        ...tooltipDefaults(),
                        callbacks: {
                            label(ctx) {
                                const idx = ctx.dataIndex;
                                const val = ctx.parsed.y;
                                if (idx === 0) return `${ctx.dataset.label}: ${formatCurrency(val)}`;
                                return `${ctx.dataset.label}: ${Number(val).toLocaleString("vi-VN")} đơn`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 11, weight: "700" } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: PALETTE.grid },
                        ticks: {
                            font: { size: 10.5 },
                            callback: (v) => formatCompactCurrency(v)
                        }
                    }
                }
            }
        });
    }

    function renderTopProductsChart(store, canvas, snapshot) {
        const products = Array.isArray(snapshot.top_products) ? snapshot.top_products.slice(0, 5) : [];
        if (!products.length || !window.Chart) {
            canvas.parentElement.innerHTML = `<div class="pos-ai-insights__chart-empty">Chưa có top sản phẩm trong kỳ.</div>`;
            return;
        }

        const labels = products.map((p) => {
            const name = String(p.name || p.sku || "SP");
            return name.length > 22 ? `${name.slice(0, 20)}…` : name;
        });
        const data = products.map((p) => Number(p.revenue || 0));
        const colors = products.map((_, i) => PALETTE.series[i % PALETTE.series.length]);

        createChart(store, "products", canvas, {
            type: "bar",
            data: {
                labels,
                datasets: [{
                    label: "Doanh thu",
                    data,
                    unit: "currency",
                    backgroundColor: colors.map((c) => `${c}cc`),
                    borderColor: colors,
                    borderWidth: 1,
                    borderRadius: 8,
                    borderSkipped: false,
                    maxBarThickness: 28
                }]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        ...tooltipDefaults(),
                        callbacks: {
                            title(items) {
                                const i = items[0]?.dataIndex ?? 0;
                                const p = products[i];
                                return p ? `${p.name}${p.sku ? ` (${p.sku})` : ""}` : "";
                            },
                            label(ctx) {
                                const p = products[ctx.dataIndex];
                                const qty = p ? ` · ${Number(p.qty_sold || 0)} sp` : "";
                                return `${formatCurrency(ctx.parsed.x)}${qty}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: PALETTE.grid },
                        ticks: {
                            font: { size: 10.5 },
                            callback: (v) => formatCompactCurrency(v)
                        }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { font: { size: 11, weight: "650" } }
                    }
                }
            }
        });
    }

    function renderTopStaffChart(store, canvas, snapshot) {
        const staff = Array.isArray(snapshot.top_staff) ? snapshot.top_staff.slice(0, 5) : [];
        if (!staff.length || !window.Chart) {
            canvas.parentElement.innerHTML = `<div class="pos-ai-insights__chart-empty">Chưa có dữ liệu nhân viên trong kỳ.</div>`;
            return;
        }

        createChart(store, "staff", canvas, {
            type: "doughnut",
            data: {
                labels: staff.map((s) => s.username || "NV"),
                datasets: [{
                    data: staff.map((s) => Number(s.revenue || 0)),
                    backgroundColor: staff.map((_, i) => PALETTE.series[i % PALETTE.series.length]),
                    borderWidth: 2,
                    borderColor: "#fff",
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "58%",
                plugins: {
                    legend: {
                        position: "right",
                        labels: {
                            boxWidth: 10,
                            boxHeight: 10,
                            usePointStyle: true,
                            pointStyle: "circle",
                            font: { size: 11, weight: "600" },
                            padding: 10
                        }
                    },
                    tooltip: {
                        ...tooltipDefaults(),
                        callbacks: {
                            label(ctx) {
                                const s = staff[ctx.dataIndex];
                                const orders = s ? ` · ${Number(s.order_count || 0)} đơn` : "";
                                return `${ctx.label}: ${formatCurrency(ctx.parsed)}${orders}`;
                            }
                        }
                    }
                }
            }
        });
    }

    function buildKpiHtml(snapshot) {
        const revDelta = Number(snapshot.previous?.revenue_delta_percent || 0);
        const orderDelta = Number(snapshot.previous?.order_delta_percent || 0);
        const revDir = deltaClass(revDelta);
        const orderDir = deltaClass(orderDelta);

        const kpis = [
            {
                label: "Doanh thu kỳ",
                value: formatCurrency(snapshot.revenue),
                delta: revDelta,
                dir: revDir,
                note: `Kỳ trước ${formatCurrency(snapshot.previous?.revenue)}`
            },
            {
                label: "Số đơn",
                value: Number(snapshot.order_count || 0).toLocaleString("vi-VN"),
                delta: orderDelta,
                dir: orderDir,
                note: `Kỳ trước ${Number(snapshot.previous?.order_count || 0).toLocaleString("vi-VN")} đơn`
            },
            {
                label: "AOV",
                value: formatCurrency(snapshot.aov),
                delta: null,
                dir: "flat",
                note: "Giá trị trung bình / đơn"
            },
            {
                label: "LN gộp",
                value: formatCurrency(snapshot.gross_profit),
                delta: null,
                dir: "flat",
                note: `Biên ${Number(snapshot.margin_percent || 0)}%`
            }
        ];

        return `
            <div class="pos-ai-insights__kpis" aria-label="Chỉ số kỳ AI">
                ${kpis.map((k) => `
                    <article class="pos-ai-insights__kpi">
                        <div class="pos-ai-insights__kpi-label">${escapeHtml(k.label)}</div>
                        <div class="pos-ai-insights__kpi-value">${escapeHtml(k.value)}</div>
                        ${k.delta != null ? `
                            <div class="pos-ai-insights__kpi-delta is-${k.dir}">
                                <i class="ph ${k.dir === "up" ? "ph-trend-up" : k.dir === "down" ? "ph-trend-down" : "ph-minus"}"></i>
                                ${k.delta >= 0 ? "+" : ""}${Number(k.delta).toLocaleString("vi-VN")}%
                            </div>` : ""}
                        <div class="pos-ai-insights__kpi-note">${escapeHtml(k.note)}</div>
                    </article>
                `).join("")}
            </div>
        `;
    }

    function createPanelShell(options) {
        ensureStyles();
        const root = document.createElement("section");
        root.className = "pos-ai-insights";
        root.setAttribute("aria-label", options.title || "Gợi ý AI doanh thu");
        root.innerHTML = `
            <div class="pos-ai-insights__head">
                <div class="pos-ai-insights__title-row">
                    <div class="pos-ai-insights__icon" aria-hidden="true"><i class="ph ph-sparkle"></i></div>
                    <div>
                        <h3 class="pos-ai-insights__title">${escapeHtml(options.title || "Gợi ý AI doanh thu")}</h3>
                        <p class="pos-ai-insights__sub" data-ai-sub>Biểu đồ + phân tích tăng/giảm và hành động gợi ý</p>
                    </div>
                </div>
                <div class="pos-ai-insights__actions">
                    <span class="pos-ai-insights__badge is-flat" data-ai-sentiment hidden></span>
                    <button type="button" class="btn btn-secondary btn-sm" data-ai-refresh>
                        <i class="ph ph-arrow-clockwise"></i> Phân tích lại
                    </button>
                </div>
            </div>
            <div class="pos-ai-insights__body" data-ai-body>
                <div class="pos-ai-insights__skel" aria-busy="true">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        return root;
    }

    function renderLoading(body) {
        body.innerHTML = `
            <div class="pos-ai-insights__skel" aria-busy="true">
                <span></span><span></span><span></span>
            </div>`;
    }

    function renderError(body, message) {
        body.innerHTML = `<div class="pos-ai-insights__error"><i class="ph ph-warning-circle"></i> ${escapeHtml(message)}</div>`;
    }

    function renderInsight(root, payload, chartStore) {
        destroyCharts(chartStore);

        const body = root.querySelector("[data-ai-body]");
        const sub = root.querySelector("[data-ai-sub]");
        const badge = root.querySelector("[data-ai-sentiment]");
        const insight = payload.insight || {};
        const snapshot = payload.snapshot || {};
        const sentiment = insight.sentiment || deltaClass(Number(snapshot.previous?.revenue_delta_percent || 0));

        if (badge) {
            badge.hidden = false;
            badge.className = `pos-ai-insights__badge is-${sentiment}`;
            badge.innerHTML = `<i class="ph ${sentiment === "up" ? "ph-trend-up" : sentiment === "down" ? "ph-trend-down" : "ph-minus"}"></i> ${escapeHtml(sentimentLabel(sentiment))}`;
        }
        if (sub) {
            const delta = Number(snapshot.previous?.revenue_delta_percent || 0);
            sub.textContent = `Kỳ ${rangeLabel(payload.range)} · Δ doanh thu ${delta >= 0 ? "+" : ""}${delta}% · ${payload.model || "AI"}`;
        }

        const highlights = Array.isArray(insight.highlights) ? insight.highlights : [];
        const actions = Array.isArray(insight.actions) ? insight.actions : [];
        const risks = Array.isArray(insight.risks) ? insight.risks : [];

        const highlightsHtml = highlights.length
            ? `<ul class="pos-ai-insights__list">${highlights.map((h) => `
                <li class="pos-ai-insights__item">
                    <div class="pos-ai-insights__item-title">
                        <span>${escapeHtml(h.title || "")}</span>
                        <span class="pos-ai-insights__dir is-${escapeHtml(h.direction || "flat")}">${escapeHtml(directionLabel(h.direction))}</span>
                    </div>
                    <p class="pos-ai-insights__item-detail">${escapeHtml(h.detail || "")}</p>
                </li>`).join("")}</ul>`
            : `<p class="pos-ai-insights__item-detail">Chưa có điểm nhấn.</p>`;

        const actionsHtml = actions.length
            ? `<ul class="pos-ai-insights__list">${actions.map((a) => `
                <li class="pos-ai-insights__item">
                    <div class="pos-ai-insights__item-title">
                        <span>${escapeHtml(a.title || "")}</span>
                        <span class="pos-ai-insights__priority is-${escapeHtml(a.priority || "medium")}">${escapeHtml(a.priority || "medium")}</span>
                    </div>
                    <p class="pos-ai-insights__item-detail">${escapeHtml(a.detail || "")}</p>
                </li>`).join("")}</ul>`
            : `<p class="pos-ai-insights__item-detail">Chưa có gợi ý hành động.</p>`;

        const risksHtml = risks.length
            ? `<div><p class="pos-ai-insights__section-title">Rủi ro cần lưu ý</p><ul class="pos-ai-insights__risks">${risks.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul></div>`
            : "";

        const chartUnavailable = !window.Chart
            ? `<div class="pos-ai-insights__chart-empty">Cần Chart.js để hiển thị biểu đồ. Trang dashboard/reports đã có sẵn thư viện này.</div>`
            : "";

        body.innerHTML = `
            <h4 class="pos-ai-insights__headline">${escapeHtml(insight.headline || "Phân tích doanh thu")}</h4>
            <div class="pos-ai-insights__summary">${renderMd(insight.summary || "")}</div>

            ${buildKpiHtml(snapshot)}

            <div class="pos-ai-insights__charts" data-ai-charts>
                <article class="pos-ai-insights__chart-card is-wide">
                    <div class="pos-ai-insights__chart-head">
                        <h5 class="pos-ai-insights__chart-title">Xu hướng doanh thu & đơn theo ngày</h5>
                        <span class="pos-ai-insights__chart-hint">Chuỗi gần nhất trong kỳ</span>
                    </div>
                    <div class="pos-ai-insights__chart-wrap is-lg">
                        ${chartUnavailable || '<canvas data-chart="trend" aria-label="Biểu đồ xu hướng doanh thu"></canvas>'}
                    </div>
                </article>
                <article class="pos-ai-insights__chart-card">
                    <div class="pos-ai-insights__chart-head">
                        <h5 class="pos-ai-insights__chart-title">So sánh kỳ này / kỳ trước</h5>
                        <span class="pos-ai-insights__chart-hint">Doanh thu & đơn</span>
                    </div>
                    <div class="pos-ai-insights__chart-wrap">
                        ${chartUnavailable || '<canvas data-chart="compare" aria-label="Biểu đồ so sánh kỳ"></canvas>'}
                    </div>
                </article>
                <article class="pos-ai-insights__chart-card">
                    <div class="pos-ai-insights__chart-head">
                        <h5 class="pos-ai-insights__chart-title">Top sản phẩm theo doanh thu</h5>
                        <span class="pos-ai-insights__chart-hint">Top 5</span>
                    </div>
                    <div class="pos-ai-insights__chart-wrap">
                        ${chartUnavailable || '<canvas data-chart="products" aria-label="Biểu đồ top sản phẩm"></canvas>'}
                    </div>
                </article>
                <article class="pos-ai-insights__chart-card is-wide">
                    <div class="pos-ai-insights__chart-head">
                        <h5 class="pos-ai-insights__chart-title">Cơ cấu doanh thu theo nhân viên</h5>
                        <span class="pos-ai-insights__chart-hint">Top 5</span>
                    </div>
                    <div class="pos-ai-insights__chart-wrap is-sm">
                        ${chartUnavailable || '<canvas data-chart="staff" aria-label="Biểu đồ nhân viên"></canvas>'}
                    </div>
                </article>
            </div>

            <div class="pos-ai-insights__grid">
                <div>
                    <p class="pos-ai-insights__section-title">Điểm nhấn AI</p>
                    ${highlightsHtml}
                </div>
                <div>
                    <p class="pos-ai-insights__section-title">Gợi ý hành động</p>
                    ${actionsHtml}
                </div>
            </div>
            ${risksHtml}
            <div class="pos-ai-insights__meta">
                <span>DT ${escapeHtml(formatCurrency(snapshot.revenue))} · ${Number(snapshot.order_count || 0)} đơn · AOV ${escapeHtml(formatCurrency(snapshot.aov))}</span>
                <span>Nguồn: ${escapeHtml(insight.source || payload.model || "AI")}</span>
            </div>
        `;

        if (!window.Chart) return;

        // Defer chart paint so layout/canvas has size
        requestAnimationFrame(() => {
            const trend = body.querySelector('canvas[data-chart="trend"]');
            const compare = body.querySelector('canvas[data-chart="compare"]');
            const products = body.querySelector('canvas[data-chart="products"]');
            const staff = body.querySelector('canvas[data-chart="staff"]');
            if (trend) renderTrendChart(chartStore, trend, snapshot);
            if (compare) renderCompareChart(chartStore, compare, snapshot);
            if (products) renderTopProductsChart(chartStore, products, snapshot);
            if (staff) renderTopStaffChart(chartStore, staff, snapshot);
        });
    }

    /**
     * @param {HTMLElement|string} target
     * @param {object} options
     */
    function mount(target, options = {}) {
        const el = typeof target === "string" ? document.querySelector(target) : target;
        if (!el) return null;

        const user = typeof window.getCurrentUser === "function" ? window.getCurrentUser() : null;
        const adminOnly = options.adminOnly !== false;
        if (adminOnly && user?.role !== "admin") {
            el.hidden = true;
            return null;
        }

        ensureStyles();
        el.innerHTML = "";
        const root = createPanelShell(options);
        el.appendChild(root);
        el.hidden = false;

        const body = root.querySelector("[data-ai-body]");
        const refreshBtn = root.querySelector("[data-ai-refresh]");
        let loading = false;
        let lastPayload = null;
        const chartStore = {};

        async function load() {
            if (loading) return lastPayload;
            if (typeof window.apiRequest !== "function") {
                renderError(body, "API chưa sẵn sàng.");
                return null;
            }

            loading = true;
            refreshBtn.disabled = true;
            destroyCharts(chartStore);
            renderLoading(body);

            try {
                const rangeInfo = typeof options.getRange === "function"
                    ? (options.getRange() || {})
                    : { range: "7d" };

                const surface = options.surface || "dashboard";
                const params = new URLSearchParams();
                params.set("range", rangeInfo.range || "7d");
                params.set("surface", surface);
                if (rangeInfo.from) params.set("from", rangeInfo.from);
                if (rangeInfo.to) params.set("to", rangeInfo.to);
                if (rangeInfo.focus) params.set("focus", rangeInfo.focus);

                const endpoint = options.endpoint
                    || (surface === "dashboard"
                        ? `/dashboard/ai-insights?${params.toString()}`
                        : `/api/admin/ai/insights?${params.toString()}`);

                const data = await window.apiRequest(endpoint);
                lastPayload = data;
                renderInsight(root, data, chartStore);
                return data;
            } catch (error) {
                const msg = error?.message || "Không tạo được gợi ý AI.";
                if (/403|admin/i.test(msg)) {
                    el.hidden = true;
                    return null;
                }
                renderError(body, msg);
                return null;
            } finally {
                loading = false;
                refreshBtn.disabled = false;
            }
        }

        refreshBtn.addEventListener("click", () => {
            load();
        });

        const api = {
            root,
            load,
            getLast: () => lastPayload,
            destroy() {
                destroyCharts(chartStore);
                el.innerHTML = "";
            }
        };

        if (options.autoLoad !== false) {
            load();
        }

        return api;
    }

    window.PosAiInsights = {
        mount,
        rangeLabel,
        formatCurrency
    };
})(window, document);
