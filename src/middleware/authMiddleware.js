const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const { createHttpError } = require("./httpError");

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    // EventSource cannot set Authorization — allow ?token= for SSE streams only
    const queryToken = req.query?.token ? String(req.query.token).trim() : "";
    let token = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
    } else if (queryToken && String(req.path || "").includes("/stream")) {
        token = queryToken;
    } else if (queryToken && String(req.originalUrl || "").includes("/stream")) {
        token = queryToken;
    }

    if (!token) {
        throw createHttpError(401, "Vui lòng đăng nhập để tiếp tục");
    }

    try {
        const decoded = jwt.verify(token, env.jwt.secret);
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            throw createHttpError(401, "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
        }
        throw createHttpError(401, "Token không hợp lệ");
    }
}

module.exports = authMiddleware;
