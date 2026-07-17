const logger = require("../utils/logger");
const { env } = require("../config/env");

function requestLogger(req, res, next) {
    const startedAt = process.hrtime.bigint();

    res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        const url = req.path || "/";

        if (!env.isTest && (env.isDev || res.statusCode >= 400 || durationMs >= 1000)) {
            logger.request(req.method, url, res.statusCode, durationMs, req.ip, req.requestId);
        }
    });

    next();
}

module.exports = requestLogger;
