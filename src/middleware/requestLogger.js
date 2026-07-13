const logger = require("../utils/logger");

function requestLogger(req, res, next) {
    const startedAt = process.hrtime.bigint();

    res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        const url = req.originalUrl || req.url;

        logger.request(req.method, url, res.statusCode, durationMs, req.ip, req.requestId);
    });

    next();
}

module.exports = requestLogger;