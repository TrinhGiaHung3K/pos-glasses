const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const { createHttpError } = require("./httpError");

function readCookie(req, name) {
    const cookieHeader = String(req.headers.cookie || "");
    for (const pair of cookieHeader.split(";")) {
        const separator = pair.indexOf("=");
        if (separator < 0) continue;
        const key = pair.slice(0, separator).trim();
        if (key === name) return decodeURIComponent(pair.slice(separator + 1).trim());
    }
    return "";
}

async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    // EventSource cannot set Authorization — allow ?token= for SSE streams only
    const queryToken = req.query?.token ? String(req.query.token).trim() : "";
    const cookieToken = readCookie(req, env.security.sessionCookieName);
    let token = null;

    if (cookieToken) {
        token = cookieToken;
        req.authSource = "cookie";
    } else if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
        req.authSource = "bearer";
    } else if (queryToken && String(req.path || "").includes("/stream")) {
        token = queryToken;
        req.authSource = "query";
    } else if (queryToken && String(req.originalUrl || "").includes("/stream")) {
        token = queryToken;
        req.authSource = "query";
    }

    if (!token) {
        throw createHttpError(401, "Vui lòng đăng nhập để tiếp tục");
    }

    let decoded;
    try {
        decoded = jwt.verify(token, env.jwt.secret);
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            throw createHttpError(401, "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
        }
        throw createHttpError(401, "Token không hợp lệ");
    }

    const authService = req.app?.locals?.services?.auth;
    req.user = req.authSource === "cookie" && authService?.validateSession
        ? await authService.validateSession(decoded)
        : decoded;
    next();
}

module.exports = authMiddleware;
module.exports.readCookie = readCookie;
