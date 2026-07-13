const crypto = require("node:crypto");

/**
 * Attach X-Request-Id to every request/response for structured logs.
 */
function requestId(req, res, next) {
    const incoming = req.get("X-Request-Id") || req.get("x-request-id");
    const id = incoming && String(incoming).trim().slice(0, 64)
        ? String(incoming).trim().slice(0, 64)
        : crypto.randomBytes(8).toString("hex");

    req.requestId = id;
    res.setHeader("X-Request-Id", id);
    next();
}

module.exports = requestId;
