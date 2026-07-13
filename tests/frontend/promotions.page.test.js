const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "../..");
const promotionsPath = path.join(rootDir, "frontend/promotions.html");
const componentsPath = path.join(rootDir, "frontend/assets/js/components.js");

test("promotions page is mounted in shared sidebar menu", () => {
    const components = fs.readFileSync(componentsPath, "utf8");
    assert.match(components, /key:\s*"promotions"/);
    assert.match(components, /href:\s*"\/promotions\.html"/);
    assert.match(components, /label:\s*"Khuyến mãi"/);
    assert.match(components, /"\/promotions\.html":\s*"promotions"/);
});

test("promotions page exposes admin ops cockpit contract", () => {
    const html = fs.readFileSync(promotionsPath, "utf8");

    assert.match(html, /data-menu-component/);
    assert.match(html, /data-active-menu="promotions"/);
    assert.match(html, /id="createPromoBtn"/);
    assert.match(html, /Tạo mã giảm giá/);
    assert.match(html, /id="createCustomPromoBtn"/);
    assert.match(html, /id="promoTemplates"/);
    assert.match(html, /promo-templates-grid/);
    assert.match(html, /promo-template-card/);
    assert.match(html, /id="promoSearch"/);
    assert.match(html, /id="calcRun"/);
    assert.match(html, /\/api\/admin\/promotions/);
    assert.match(html, /\/api\/admin\/promotions\/policy/);
    assert.match(html, /\/api\/staff\/promotions/);
    assert.match(html, /lifecycle/);
    assert.match(html, /discount_type/);
    assert.match(html, /max_uses/);
    assert.match(html, /min_order_amount/);
    assert.match(html, /promo-kpi-grid/);
    assert.match(html, /Thử mã nhanh/);
    assert.match(html, /validatePromoClient/);
    assert.match(html, /Policy POS Glasses/);
});

test("promotions page supports staff read-only and admin write paths", () => {
    const html = fs.readFileSync(promotionsPath, "utf8");
    assert.match(html, /requireRole\(\["admin",\s*"staff"\]\)/);
    assert.match(html, /isAdmin/);
    assert.match(html, /promo-admin-only/);
});
