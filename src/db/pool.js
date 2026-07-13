const mysql = require("mysql2/promise");
const { env } = require("../config/env");

let sharedPool;

function createPool(databaseConfig = env.database) {
    return mysql.createPool({
        host: databaseConfig.host,
        port: databaseConfig.port,
        user: databaseConfig.user,
        password: databaseConfig.password,
        database: databaseConfig.name,
        waitForConnections: databaseConfig.waitForConnections,
        connectionLimit: databaseConfig.connectionLimit,
        queueLimit: databaseConfig.queueLimit
    });
}

function getPool() {
    if (!sharedPool) {
        sharedPool = createPool();
    }

    return sharedPool;
}

module.exports = {
    createPool,
    getPool
};
