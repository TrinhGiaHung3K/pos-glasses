const { createHttpError } = require("./httpError");
const { env } = require("../config/env");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function normalizeOrigin(value) {
    try {
        return value ? new URL(String(value)).origin.toLowerCase() : "";
    } catch {
        return "";
    }
}

function createCsrfProtection(options = {}) {
    const trustedOrigins = new Set(
        (options.trustedOrigins || [])
            .map(normalizeOrigin)
            .filter(Boolean)
    );

    return function csrfProtection(req, res, next) {
        if (SAFE_METHODS.has(req.method) || req.authSource !== "cookie") {
            next();
            return;
        }

        const origin = String(req.headers.origin || "");
        const requestOrigin = `${req.protocol}://${String(req.headers.host || "").toLowerCase()}`;
        const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
        const normalizedOrigin = normalizeOrigin(origin);

        if (origin && !normalizedOrigin) {
            throw createHttpError(403, "Nguồn yêu cầu không hợp lệ");
        }

        // On managed hosts such as Render, TLS terminates at a reverse proxy.
        // If trust proxy is accidentally omitted, req.protocol can be "http"
        // even though the browser origin is the configured HTTPS public URL.
        const isConfiguredPublicOrigin = normalizedOrigin && trustedOrigins.has(normalizedOrigin);
        const isRequestOrigin = normalizedOrigin && normalizedOrigin === requestOrigin;
        if (isConfiguredPublicOrigin || isRequestOrigin || (!origin && fetchSite === "same-origin")) {
            next();
            return;
        }

        throw createHttpError(403, "Yêu cầu thay đổi dữ liệu bị từ chối do không cùng nguồn");
    };
}

const csrfProtection = createCsrfProtection({ trustedOrigins: [env.publicAppUrl] });

module.exports = csrfProtection;
module.exports.createCsrfProtection = createCsrfProtection;
module.exports.normalizeOrigin = normalizeOrigin;
