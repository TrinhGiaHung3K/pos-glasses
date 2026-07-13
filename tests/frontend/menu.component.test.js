const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const rootDir = path.resolve(__dirname, "../..");
const componentsPath = path.join(rootDir, "frontend/assets/js/components.js");

function loadComponents() {
    const code = fs.readFileSync(componentsPath, "utf8");
    const listeners = {};
    const document = {
        readyState: "loading",
        body: {
            contains: () => false,
            appendChild: () => {}
        },
        createElement: () => ({
            addEventListener: () => {},
            classList: { add: () => {}, remove: () => {} },
            focus: () => {},
            querySelector: () => null,
            querySelectorAll: () => [],
            remove: () => {}
        }),
        addEventListener: (event, handler) => {
            listeners[event] = handler;
        },
        querySelectorAll: () => []
    };
    const window = {
        location: { pathname: "/orders.html" },
        getCurrentUser: () => ({ username: "Linh", role: "admin" }),
        sessionStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {}
        },
        matchMedia: () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} })
    };

    vm.runInNewContext(code, {
        window,
        document,
        requestAnimationFrame: (callback) => callback(),
        setTimeout,
        clearTimeout
    });

    return window;
}

test("buildAppMenuHtml renders a lean mega rail with the active destination and user", () => {
    const window = loadComponents();

    assert.equal(typeof window.buildAppMenuHtml, "function");

    const html = window.buildAppMenuHtml({
        active: "orders",
        user: { username: "Linh", role: "admin" }
    });

    assert.match(html, /href="\/orders\.html" class="pos-mega-tile is-active/);
    assert.match(html, /pos-nav--mega/);
    assert.match(html, /data-mega-group="pos"/);
    assert.match(html, /class="pos-mega-group is-active-group"/);
    assert.match(html, /pos-mega-panel/);
    assert.match(html, /class="pos-mega-grid"/);
    assert.match(html, /class="pos-mega-tile is-active"/);
    // Panel stays closed on load so it never covers the POS workspace.
    assert.doesNotMatch(html, /pos-mega-group is-open/);
    assert.doesNotMatch(html, /pos-mega-trigger-meta/);
    assert.doesNotMatch(html, /pos-mega-panel-head/);
    assert.doesNotMatch(html, /pos-mega-tile-hint/);
    assert.doesNotMatch(html, /pos-mega-tile-arrow/);
    assert.match(html, />Bán hàng</);
    assert.match(html, />Hàng hóa</);
    assert.match(html, />Hóa đơn</);
    assert.match(html, /id="welcomeUser">Linh</);
    assert.match(html, /id="roleLabel">Quản trị</);
});

test("mega menu groups related destinations for staff and admin", () => {
    const window = loadComponents();
    const staffHtml = window.buildAppMenuHtml({
        active: "products",
        user: { username: "An", role: "staff" }
    });
    const adminHtml = window.buildAppMenuHtml({
        active: "users",
        user: { username: "Linh", role: "admin" }
    });

    assert.match(staffHtml, /data-mega-group="catalog"/);
    assert.match(staffHtml, />Hàng hóa</);
    assert.match(staffHtml, /data-mega-group="crm"/);
    assert.match(staffHtml, /data-mega-group="stock"/);
    assert.match(staffHtml, />Kho hàng</);
    assert.doesNotMatch(staffHtml, /data-mega-group="system"/);
    assert.match(adminHtml, /data-mega-group="system"/);
    assert.match(adminHtml, /href="\/users\.html"/);
    assert.match(adminHtml, /href="\/audit\.html"/);
});

test("renderAppMenu uses the page data-active-menu value", () => {
    const window = loadComponents();
    const mount = {
        className: "",
        dataset: { activeMenu: "invoices" },
        innerHTML: "",
        querySelectorAll: () => [],
        querySelector: () => null
    };

    assert.equal(typeof window.renderAppMenu, "function");

    window.renderAppMenu(mount, {
        user: { username: "An", role: "staff" }
    });

    assert.equal(mount.className, "pos-sidebar");
    assert.match(mount.innerHTML, /href="\/invoices\.html" class="pos-mega-tile is-active/);
    assert.match(mount.innerHTML, /id="roleLabel">Nhân viên/);
    assert.match(mount.innerHTML, /is-active-group/);
    assert.doesNotMatch(mount.innerHTML, /pos-mega-group is-open/);
});

test("component library exposes the reusable custom dropdown enhancer", () => {
    const window = loadComponents();

    assert.equal(typeof window.enhanceCustomSelects, "function");
});

test("authenticated pages mount the shared menu instead of copying sidebar markup", () => {
    const pages = [
        ["frontend/dashboard.html", "dashboard"],
        ["frontend/products.html", "products"],
        ["frontend/customers.html", "customers"],
        ["frontend/orders.html", "orders"],
        ["frontend/invoices.html", "invoices"],
        ["frontend/inventory.html", "inventory"],
        ["frontend/reports.html", "reports"],
        ["frontend/invoice_detail.html", "invoice-detail"],
        ["frontend/admin/tables.html", "tables"],
        ["frontend/staff/qr-orders.html", "qr-orders"]
    ];

    for (const [file, active] of pages) {
        const html = fs.readFileSync(path.join(rootDir, file), "utf8");
        assert.match(
            html,
            new RegExp(`<aside[^>]+data-menu-component[^>]+data-active-menu="${active}"`),
            `${file} should mount the shared menu`
        );
        assert.doesNotMatch(
            html,
            /<nav class="pos-nav">/,
            `${file} should not copy sidebar nav markup`
        );
    }
});
