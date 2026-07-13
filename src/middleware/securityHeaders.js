/**
 * Lightweight security headers (helmet-like, no extra dependency).
 */
function securityHeaders(req, res, next) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-XSS-Protection", "0");
    res.setHeader(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=()"
    );
    // API JSON responses should not be cached by shared caches
    if (req.path.startsWith("/api") || req.path === "/login" || req.path === "/register") {
        res.setHeader("Cache-Control", "no-store");
    }
    next();
}

module.exports = securityHeaders;
