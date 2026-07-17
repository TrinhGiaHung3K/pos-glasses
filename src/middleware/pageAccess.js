const authMiddleware = require("./authMiddleware");

const PUBLIC_PAGES = new Set([
    "/login.html",
    "/qr/product.html"
]);

const ADMIN_PAGES = new Set([
    "/audit.html",
    "/dashboard.html",
    "/reports.html",
    "/users.html"
]);

const RETIRED_PAGE_REDIRECTS = new Map([
    ["/admin/tables.html", "/inventory.html"],
    ["/staff/qr-orders.html", "/orders.html"],
    ["/qr/table.html", "/login.html"],
    ["/register.html", "/login.html"],
    ["/payment-test.html", "/dashboard.html"]
]);

function isHtmlNavigation(req) {
    return (req.method === "GET" || req.method === "HEAD")
        && String(req.path || "").toLowerCase().endsWith(".html");
}

function loginRedirect(req) {
    const requested = String(req.originalUrl || req.url || "");
    if (!requested || requested === "/login.html") {
        return "/login.html";
    }
    return `/login.html?next=${encodeURIComponent(requested)}`;
}

function createPageAccessMiddleware() {
    return async function pageAccess(req, res, next) {
        if (!isHtmlNavigation(req)) {
            next();
            return;
        }

        const pagePath = String(req.path || "").toLowerCase();
        const retiredRedirect = RETIRED_PAGE_REDIRECTS.get(pagePath);
        if (retiredRedirect) {
            res.setHeader("Cache-Control", "no-store");
            res.redirect(302, retiredRedirect);
            return;
        }

        if (PUBLIC_PAGES.has(pagePath)) {
            res.setHeader("Cache-Control", "no-cache");
            next();
            return;
        }

        let authenticated = false;
        try {
            await authMiddleware(req, res, () => {
                authenticated = true;
            });
        } catch {
            res.setHeader("Cache-Control", "no-store");
            res.redirect(302, loginRedirect(req));
            return;
        }

        if (!authenticated) {
            return;
        }

        if (ADMIN_PAGES.has(pagePath) && req.user?.role !== "admin") {
            res.setHeader("Cache-Control", "no-store");
            res.redirect(302, "/orders.html");
            return;
        }

        res.setHeader("Cache-Control", "no-store");
        next();
    };
}

module.exports = {
    ADMIN_PAGES,
    PUBLIC_PAGES,
    RETIRED_PAGE_REDIRECTS,
    createPageAccessMiddleware
};
