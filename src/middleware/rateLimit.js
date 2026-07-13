/**
 * In-memory fixed-window rate limiter (single process).
 * Suitable for POS LAN / small deploy; not multi-node shared state.
 */

function createRateLimiter(options = {}) {
    const windowMs = Math.max(1000, Number(options.windowMs) || 60_000);
    const max = Math.max(1, Number(options.max) || 60);
    const keyFn = typeof options.keyFn === "function"
        ? options.keyFn
        : (req) => req.ip || "unknown";
    const message = options.message || "Quá nhiều yêu cầu, vui lòng thử lại sau";

    /** @type {Map<string, { count: number, resetAt: number }>} */
    const buckets = new Map();

    function prune(now) {
        if (buckets.size < 500) {
            return;
        }
        for (const [key, bucket] of buckets) {
            if (bucket.resetAt <= now) {
                buckets.delete(key);
            }
        }
    }

    function middleware(req, res, next) {
        const now = Date.now();
        prune(now);
        const key = keyFn(req);
        let bucket = buckets.get(key);

        if (!bucket || bucket.resetAt <= now) {
            bucket = { count: 0, resetAt: now + windowMs };
            buckets.set(key, bucket);
        }

        bucket.count += 1;
        const remaining = Math.max(0, max - bucket.count);
        res.setHeader("X-RateLimit-Limit", String(max));
        res.setHeader("X-RateLimit-Remaining", String(remaining));
        res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

        if (bucket.count > max) {
            res.status(429).json({ message });
            return;
        }

        next();
    }

    middleware._buckets = buckets;
    middleware.reset = () => buckets.clear();
    return middleware;
}

function createLoginRateLimiter(envSecurity) {
    const cfg = envSecurity?.loginRateLimit || {};
    return createRateLimiter({
        windowMs: cfg.windowMs || 15 * 60 * 1000,
        max: cfg.maxAttempts || 10,
        message: "Đăng nhập thất bại quá nhiều lần. Vui lòng thử lại sau 15 phút.",
        keyFn(req) {
            const ip = req.ip || req.socket?.remoteAddress || "unknown";
            const username = String(req.body?.username || "")
                .trim()
                .toLowerCase()
                .slice(0, 80);
            return `login:${ip}:${username || "-"}`;
        }
    });
}

module.exports = {
    createRateLimiter,
    createLoginRateLimiter
};
