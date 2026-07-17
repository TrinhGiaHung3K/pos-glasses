const { createApp } = require("./app");
const { env } = require("./config/env");
const { ensureOrderPaymentColumns } = require("./db/checkoutSchema");
const { ensureCustomerMemberColumns } = require("./db/customerSchema");
const { ensurePhase0Schema } = require("./db/phase0Schema");
const { ensurePhase1Schema } = require("./db/phase1Schema");
const { ensurePhase2Schema } = require("./db/phase2Schema");
const { ensurePhase3Schema } = require("./db/phase3Schema");
const { ensurePaymentSchema } = require("./db/paymentSchema");
const { ensureProductQrSchema } = require("./db/productQrSchema");
const { ensureAiSchema } = require("./db/aiSchema");
const { ensureBootstrapAdmin } = require("./db/bootstrapAdmin");
const { ensureRetailOnlySchema } = require("./db/retailSchema");
const { runMigrations } = require("./db/migrationRunner");
const { getPool } = require("./db/pool");
const logger = require("./utils/logger");

async function startServer(options = {}) {
    const app = options.app || createApp();
    const port = options.port || env.port;
    const db = options.db || getPool();

    try {
        logger.info("Connecting to MySQL", {
            host: env.database.host,
            port: env.database.port,
            database: env.database.name,
            user: env.database.user
        });

        await db.query("SELECT 1");
        const orderSchemaResult = await ensureOrderPaymentColumns(db);
        const customerSchemaResult = await ensureCustomerMemberColumns(db);
        const phase0SchemaResult = await ensurePhase0Schema(db);
        const phase1SchemaResult = await ensurePhase1Schema(db);
        const phase2SchemaResult = await ensurePhase2Schema(db);
        const phase3SchemaResult = await ensurePhase3Schema(db);
        const retailSchemaResult = await ensureRetailOnlySchema(db);
        const paymentSchemaResult = await ensurePaymentSchema(db);
        await ensureProductQrSchema(db);
        await ensureAiSchema(db);
        const bootstrapAdminResult = await ensureBootstrapAdmin(db, env.bootstrapAdmin, {
            isProd: env.isProd
        });

        try {
            const migrationResult = await runMigrations(db);
            if (migrationResult.applied.length) {
                logger.info("SQL migrations applied", {
                    files: migrationResult.applied
                });
            }
        } catch (migrationError) {
            logger.error("SQL migrations failed", migrationError);
            if (env.isProd) throw migrationError;
        }

        logger.info("MySQL connected");

        if (bootstrapAdminResult.created || bootstrapAdminResult.migrated) {
            logger.info("Bootstrap administrator prepared", {
                created: Boolean(bootstrapAdminResult.created),
                migrated: Boolean(bootstrapAdminResult.migrated),
                username: bootstrapAdminResult.username
            });
        }

        if (orderSchemaResult.addedColumns.length) {
            logger.info("Checkout schema updated", {
                columns: orderSchemaResult.addedColumns
            });
        }

        if (customerSchemaResult.addedColumns.length || customerSchemaResult.addedIndexes.length) {
            logger.info("Customer member schema updated", {
                columns: customerSchemaResult.addedColumns,
                indexes: customerSchemaResult.addedIndexes
            });
        }

        if (phase0SchemaResult.addedColumns.length) {
            logger.info("Phase 0 schema updated", phase0SchemaResult);
        }

        if (
            phase1SchemaResult.stockMovementsCreated
            || phase1SchemaResult.auditLogsCreated
            || phase1SchemaResult.idempotencyCreated
            || phase1SchemaResult.productColumns.length
            || phase1SchemaResult.orderDetailColumns.length
            || phase1SchemaResult.orderColumns.length
            || phase1SchemaResult.promotionColumns.length
        ) {
            logger.info("Phase 1 schema updated", phase1SchemaResult);
        }

        if (
            phase2SchemaResult.pointsLedgerCreated
            || phase2SchemaResult.productVariantsCreated
            || phase2SchemaResult.customerColumns.length
            || phase2SchemaResult.productColumns.length
            || phase2SchemaResult.orderColumns.length
            || phase2SchemaResult.orderDetailColumns.length
        ) {
            logger.info("Phase 2 schema updated", phase2SchemaResult);
        }

        if (
            phase3SchemaResult.shiftsCreated
            || phase3SchemaResult.prescriptionsCreated
            || phase3SchemaResult.warrantiesCreated
            || phase3SchemaResult.suppliersCreated
            || phase3SchemaResult.purchaseOrdersCreated
            || phase3SchemaResult.purchaseOrderItemsCreated
            || phase3SchemaResult.orderColumns.length
            || phase3SchemaResult.orderDetailColumns.length
        ) {
            logger.info("Phase 3 schema updated", phase3SchemaResult);
        }

        if (
            retailSchemaResult.droppedTables.length
            || retailSchemaResult.droppedColumns.length
            || retailSchemaResult.droppedIndexes.length
            || retailSchemaResult.droppedForeignKeys.length
        ) {
            logger.info("Retired table-ordering schema removed", retailSchemaResult);
        }

        if (paymentSchemaResult.orderColumns.length) {
            logger.info("Payment schema updated", paymentSchemaResult);
        }

        if (env.jwt.isDefault && !env.isTest) {
            logger.warn("JWT_SECRET is using the built-in default — set JWT_SECRET in production");
        }
    } catch (error) {
        logger.error("Database startup preparation failed", error);
        if (env.isProd) {
            throw error;
        }
    }

    return new Promise((resolve, reject) => {
        const server = app.listen(port, () => {
            if (!options.quiet) {
                logger.info("Server running", { port });
            }

            const paymentService = app.locals?.services?.payments;
            if (paymentService?.expirePendingIntents) {
                const timer = setInterval(() => {
                    paymentService.expirePendingIntents().catch((error) => {
                        logger.error("Payment reconciliation failed", error);
                    });
                }, 60_000);
                timer.unref();
                server.on("close", () => clearInterval(timer));
            }
            resolve(server);
        });

        server.on("error", reject);
    });
}

if (require.main === module) {
    startServer().catch((error) => {
        logger.error("Failed to start server", error);
        process.exit(1);
    });
}

module.exports = {
    startServer
};
