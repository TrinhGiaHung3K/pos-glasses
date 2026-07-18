const { env } = require("./src/config/env");
const { startServer } = require("./src/server");
const { getPool } = require("./src/db/pool");
const logger = require("./src/utils/logger");

const SHUTDOWN_TIMEOUT_MS = 10_000;

let httpServer = null;
let isShuttingDown = false;

function logStartup(port) {
    const lines = [
        "",
        "Server is running!",
        "",
        `  Local:        http://localhost:${port}`,
        `  Environment:  ${env.nodeEnv}`,
        `  Node:         ${process.version}`,
        `  Database:     ${env.database.user}@${env.database.host}:${env.database.port}/${env.database.name}`
    ];

    if (env.isDev) {
        lines.push("  Auto-reload:  enabled (nodemon)");
        lines.push("  HTTP logging: enabled");
    }

    lines.push("", "Press Ctrl+C to stop.", "");

    lines.forEach((line) => console.log(line));
}

async function shutdown(signal, exitCode = 0) {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;
    logger.shutdown("signal received", { signal, pid: process.pid });

    const forceExitTimer = setTimeout(() => {
        logger.error("Forced shutdown after timeout", { timeoutMs: SHUTDOWN_TIMEOUT_MS });
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    forceExitTimer.unref();

    try {
        if (httpServer) {
            logger.shutdown("closing http server");
            await new Promise((resolve, reject) => {
                httpServer.close((error) => (error ? reject(error) : resolve()));
            });
        }

        logger.shutdown("closing database pool");
        await getPool().end();

        logger.shutdown("complete");
        clearTimeout(forceExitTimer);
        process.exit(exitCode);
    } catch (error) {
        logger.error("Error while stopping server", error);
        clearTimeout(forceExitTimer);
        process.exit(1);
    }
}

async function main() {
    if (process.env.NODEMON === "true") {
        logger.info("Nodemon restarted server");
    }

    logger.startup({
        mode: env.isDev ? "development" : "production",
        port: env.port,
        pid: process.pid
    });

    try {
        httpServer = await startServer({ quiet: true });
        const port = httpServer.address()?.port;

        logger.ready({
            port,
            address: httpServer.address()
        });

        logStartup(port);
    } catch (error) {
        logger.error("Failed to start server", error);
        process.exit(1);
    }
}

process.on("SIGINT", () => {
    shutdown("SIGINT");
});

process.on("SIGTERM", () => {
    shutdown("SIGTERM");
});

process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", error);
    shutdown("uncaughtException", 1);
});

//comment 1
process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", reason);
    shutdown("unhandledRejection", 1);
});

main();
