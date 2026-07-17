/**
 * Lightweight security headers (helmet-like, no extra dependency).
 */
const { env } = require("../config/env");

function securityHeaders(req, res, next) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-XSS-Protection", "0");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    );
    const csp = [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self' data:",
        "img-src 'self' data: blob: https://img.vietqr.io https://res.cloudinary.com",
        "connect-src 'self'"
    ];
    if (env.isProd) csp.push("upgrade-insecure-requests");
    res.setHeader("Content-Security-Policy", csp.join("; "));
    if (env.isProd) {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    // API JSON responses should not be cached by shared caches
    if (req.path.startsWith("/api") || req.path === "/login" || req.path === "/register") {
        res.setHeader("Cache-Control", "no-store");
    }
    next();
}

module.exports = securityHeaders;
