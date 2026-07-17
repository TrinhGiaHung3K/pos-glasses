const { env } = require("../config/env");

function timestamp() {
    return new Date().toISOString();
}

function formatDetails(details) {
    if (!details) {
        return "";
    }

    if (typeof details === "string") {
        return ` ${details}`;
    }

    return ` ${JSON.stringify(details)}`;
}

function write(level, message, details) {
    const line = `[${timestamp()}] [${level}] ${message}${formatDetails(details)}`;

    if (level === "ERROR") {
        console.error(line);
        return;
    }

    if (level === "WARN") {
        console.warn(line);
        return;
    }

    console.log(line);
}

function logError(error, context) {
    write("ERROR", context || "Unexpected error");

    if (error instanceof Error) {
        console.error(error.stack || error.message);
        return;
    }

    console.error(error);
}

const logger = {
    info(message, details) {
        write("INFO", message, details);
    },

    warn(message, details) {
        write("WARN", message, details);
    },

    error(message, errorOrDetails) {
        if (errorOrDetails instanceof Error) {
            logError(errorOrDetails, message);
            return;
        }

        write("ERROR", message, errorOrDetails);
    },

    debug(message, details) {
        if (!env.isDev) {
            return;
        }

        write("DEBUG", message, details);
    },

    request(method, url, statusCode, durationMs, ip, requestId) {
        const status = String(statusCode);
        const duration = `${durationMs.toFixed(1)}ms`;
        const rid = requestId ? ` req=${requestId}` : "";
        write("HTTP", `${method} ${url} ${status} ${duration} ip=${ip || "-"}${rid}`);
    },

    startup(details) {
        logger.info("POS Glasses server starting", details);
    },

    ready(details) {
        logger.info("Server ready", details);
    },

    shutdown(step, details) {
        logger.info(`Shutdown: ${step}`, details);
    }
};

module.exports = logger;
