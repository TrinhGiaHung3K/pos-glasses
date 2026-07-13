const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const test = require("node:test");

function read(path) {
    return readFileSync(path, "utf8");
}

test("staff menu keeps POS selling first and excludes the customer QR page", () => {
    const source = read("frontend/assets/js/components.js");

    assert.match(source, /key:\s*"orders"[\s\S]*label:\s*"Bán hàng"/);
    assert.match(source, /key:\s*"products"[\s\S]*label:\s*"Sản phẩm"/);
    assert.match(source, /key:\s*"qr-orders"[\s\S]*label:\s*"Yêu cầu QR"/);
    assert.match(source, /APP_MENU_GROUPS/);
    assert.match(source, /type:\s*"mega"/);
    assert.match(source, /id:\s*"pos"/);
    assert.doesNotMatch(source, /href:\s*"\/qr\/table\.html"/);
});

test("Optic Bridge logo is used across all brand surfaces", () => {
    const menu = read("frontend/assets/js/components.js");
    const layout = read("frontend/assets/css/layout.css");
    const login = read("frontend/login.html");
    const register = read("frontend/register.html");
    const qr = read("frontend/qr/table.html");
    const qrCss = read("frontend/assets/css/qr.css");
    const invoice = read("frontend/invoice_detail.html");

    assert.match(menu, /class="pos-logo-image"[\s\S]*src="\/assets\/images\/pos-glasses-optic-bridge-logo\.png"/);
    assert.doesNotMatch(menu, /ph-sunglasses/);
    assert.match(layout, /\.pos-logo-image/);
    assert.match(login, /class="auth-logo-image"[\s\S]*src="\/assets\/images\/pos-glasses-optic-bridge-logo\.png"/);
    assert.match(register, /class="auth-logo-image"[\s\S]*src="\/assets\/images\/pos-glasses-optic-bridge-logo\.png"/);
    assert.match(login, /class="auth-brand-logo"[\s\S]*src="\/assets\/images\/pos-glasses-optic-bridge-logo\.png"/);
    assert.match(register, /class="auth-brand-logo"[\s\S]*src="\/assets\/images\/pos-glasses-optic-bridge-logo\.png"/);
    assert.doesNotMatch(login, /ph-sunglasses/);
    assert.match(qr, /class="qr-brand-logo"[\s\S]*src="\.\.\/assets\/images\/pos-glasses-optic-bridge-logo\.png"/);
    assert.match(qrCss, /\.qr-brand-logo/);
    assert.match(invoice, /class="receipt-store-logo"[\s\S]*src="\/assets\/images\/pos-glasses-optic-bridge-logo\.png"/);
});

test("orders page exposes the POS terminal layout contract", () => {
    const source = read("frontend/orders.html");

    assert.match(source, /pos-terminal-grid/);
    assert.match(source, /pos-sell-zone/);
    assert.match(source, /pos-checkout-rail/);
    assert.match(source, /Quét SKU, barcode hoặc tìm tên kính/);
    assert.match(source, /handleProductSearchKey/);
});

test("shared CSS defines the bright retail POS system primitives", () => {
    const base = read("frontend/assets/css/base.css");
    const components = read("frontend/assets/css/components.css");

    assert.match(base, /--accent-color:\s*#0f766e/);
    assert.match(base, /--bg-sidebar:\s*#10201d/);
    assert.match(components, /\.pos-money/);
    assert.match(components, /\.pos-terminal-grid/);
    assert.match(components, /\.pos-checkout-rail/);
});

test("shared navigation uses a flat minimal mega rail treatment", () => {
    const layout = read("frontend/assets/css/layout.css");

    assert.match(layout, /\.pos-sidebar\s*\{[\s\S]*background:\s*var\(--bg-sidebar\)/);
    assert.match(layout, /\.pos-mega-panel\s*\{[\s\S]*background:\s*var\(--bg-surface\)/);
    assert.match(layout, /\.pos-mega-tile\s*\{[\s\S]*color:\s*var\(--text-primary\)/);
    assert.doesNotMatch(layout, /\.pos-mega-panel-inner/);
    assert.doesNotMatch(layout, /\.pos-mega-inline/);
});

test("customer admin exposes generated EAN-13 member barcodes", () => {
    const packageJson = JSON.parse(read("package.json"));
    const app = read("src/app.js");
    const source = read("frontend/customers.html");

    assert.ok(packageJson.dependencies.jsbarcode, "jsbarcode dependency should be installed");
    assert.match(app, /\/vendor\/jsbarcode/);
    assert.match(app, /node_modules[\s\S]*jsbarcode[\s\S]*dist/);
    assert.match(source, /\/vendor\/jsbarcode\/JsBarcode\.all\.min\.js/);
    assert.match(source, /member-barcode-svg/);
    assert.match(source, /renderCustomerBarcodes/);
    assert.match(source, /renderBarcodeSvg/);
    assert.match(source, /openMemberCard/);
    assert.match(source, /printMemberCard/);
    assert.match(source, /JsBarcode\(/);
    assert.match(source, /format:\s*"EAN13"/);
    const logoRefs = source.match(/\/assets\/images\/pos-glasses-optic-bridge-logo\.png/g) || [];
    assert.equal(logoRefs.length, 2);
    assert.match(source, /class="pg-brand-logo-plate"/);
    assert.match(source, /class="pg-brand-logo"/);
    assert.match(source, /\.pg-brand-logo-plate/);
    assert.match(source, /\.pg-brand-logo/);
    assert.doesNotMatch(source, /\$\{STORE_BRAND\.mark\}/);
    assert.doesNotMatch(source, /CUS\$\{/);
});

test("phone barcode scanner mode removes camera dependency and keeps staff ranking hooks", () => {
    const packageJson = JSON.parse(read("package.json"));
    const app = read("src/app.js");
    const orders = read("frontend/orders.html");
    const dashboard = read("frontend/dashboard.html");

    assert.equal(packageJson.dependencies["@zxing/browser"], undefined);
    assert.doesNotMatch(app, /\/vendor\/zxing-browser/);
    assert.match(orders, /id="memberPhoneScanButton"/);
    assert.match(orders, /Barcode to PC/);
    assert.match(app, /staffPerformance/);
    assert.match(dashboard, /staffPerformanceLeaderboard/);
    assert.match(dashboard, /loadStaffPerformanceLeaderboard/);
    assert.match(dashboard, /api\/admin\/staff-performance/);
    assert.match(dashboard, /staff-performance-progress/);
});

test("dashboard page exposes expanded POS analytics with Chart.js panels", () => {
    const source = read("frontend/dashboard.html");

    assert.match(source, /https:\/\/cdn\.jsdelivr\.net\/npm\/chart\.js/);
    assert.match(source, /id="dashboardStatus"/);
    assert.match(source, /id="todayRevenue"/);
    assert.match(source, /id="averageOrderValue"/);
    assert.match(source, /id="lowStockCount"/);
    assert.match(source, /id="dailyRevenueChart"/);
    assert.match(source, /id="orderSourceChart"/);
    assert.match(source, /id="inventoryHealthChart"/);
    assert.match(source, /id="staffRevenueChart"/);
    assert.match(source, /buildDashboardAnalytics/);
    assert.match(source, /renderDashboardCharts/);
});

test("dashboard charts use a richer Chart.js presentation system", () => {
    const source = read("frontend/dashboard.html");

    assert.match(source, /id="dailyRevenueLegend"/);
    assert.match(source, /id="orderSourceLegend"/);
    assert.match(source, /id="inventoryHealthLegend"/);
    assert.match(source, /id="staffRevenueLegend"/);
    assert.match(source, /chart-html-tooltip/);
    assert.match(source, /externalTooltipHandler/);
    assert.match(source, /createChartGradients/);
    assert.match(source, /renderChartLegend/);
    assert.match(source, /centerTextPlugin/);
    assert.match(source, /valueLabelPlugin/);
    assert.match(source, /averageLinePlugin/);
    assert.match(source, /type:\s*"bar"[\s\S]*type:\s*"line"/);
});

test("reports page includes full report controls, export actions, and detailed analytics", () => {
    const source = read("frontend/reports.html");

    assert.match(source, /id="reportRangeFilter"/);
    assert.match(source, /id="viewReportButton"/);
    assert.match(source, /id="exportCsvButton"/);
    assert.match(source, /id="printReportButton"/);
    assert.match(source, /id="reportPreviewPanel"/);
    assert.match(source, /id="reportDetailTable"/);
    assert.match(source, /id="reportTrendChart"/);
    assert.match(source, /id="reportSourceChart"/);
    assert.match(source, /id="reportStaffChart"/);
    assert.match(source, /exportReportCsv/);
    assert.match(source, /renderReportPreview/);
    assert.match(source, /buildReportAnalytics/);
});

test("reports charts use a richer Chart.js presentation system", () => {
    const source = read("frontend/reports.html");

    assert.match(source, /id="reportTrendLegend"/);
    assert.match(source, /id="reportSourceLegend"/);
    assert.match(source, /id="reportStaffLegend"/);
    assert.match(source, /chart-html-tooltip/);
    assert.match(source, /externalTooltipHandler/);
    assert.match(source, /createChartGradients/);
    assert.match(source, /renderChartLegend/);
    assert.match(source, /valueLabelPlugin/);
    assert.match(source, /averageLinePlugin/);
    assert.match(source, /type:\s*"bar"[\s\S]*type:\s*"line"/);
});

test("dashboard and reports group sales by local calendar dates", () => {
    const dashboard = read("frontend/dashboard.html");
    const reports = read("frontend/reports.html");

    assert.match(dashboard, /function dateKey[\s\S]*getFullYear\(\)[\s\S]*getMonth\(\)[\s\S]*getDate\(\)/);
    assert.match(reports, /function dateKey[\s\S]*getFullYear\(\)[\s\S]*getMonth\(\)[\s\S]*getDate\(\)/);
});
