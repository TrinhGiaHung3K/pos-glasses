const { env } = require("../config/env");
const logger = require("../utils/logger");

function errorHandler(error, req, res, next) {
    if (res.headersSent) {
        return next(error);
    }

    const status = error.status || 500;
    const payload = {
        message: status >= 500 ? "Internal server error" : error.message
    };

    if (error.details && status < 500) {
        payload.details = error.details;
    }

    if (status >= 500) {
        logger.error("Request failed", {
            method: req.method,
            path: req.originalUrl || req.url,
            status,
            message: error.message,
            stack: env.isDev ? error.stack : undefined
        });
    } else if (env.isDev) {
        logger.warn("Client error", {
            method: req.method,
            path: req.originalUrl || req.url,
            status,
            message: error.message
        });
    }

    return res.status(status).json(payload);
}

module.exports = errorHandler;
