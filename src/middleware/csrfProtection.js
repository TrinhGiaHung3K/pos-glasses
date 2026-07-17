const { createHttpError } = require("./httpError");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function csrfProtection(req, res, next) {
    if (SAFE_METHODS.has(req.method) || req.authSource !== "cookie") {
        next();
        return;
    }

    const origin = String(req.headers.origin || "");
    const requestOrigin = `${req.protocol}://${String(req.headers.host || "").toLowerCase()}`;
    const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
    let normalizedOrigin = "";
    try {
        normalizedOrigin = origin ? new URL(origin).origin.toLowerCase() : "";
    } catch {
        throw createHttpError(403, "Nguồn yêu cầu không hợp lệ");
    }

    if ((normalizedOrigin && normalizedOrigin === requestOrigin) || (!origin && fetchSite === "same-origin")) {
        next();
        return;
    }

    throw createHttpError(403, "Yêu cầu thay đổi dữ liệu bị từ chối do không cùng nguồn");
}

module.exports = csrfProtection;
