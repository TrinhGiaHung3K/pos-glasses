const cors = require("cors");
const express = require("express");
const path = require("node:path");
const { env } = require("./config/env");
const { getPool } = require("./db/pool");
const requestLogger = require("./middleware/requestLogger");
const requestId = require("./middleware/requestId");
const securityHeaders = require("./middleware/securityHeaders");
const authMiddleware = require("./middleware/authMiddleware");
const errorHandler = require("./middleware/errorHandler");
const notFoundHandler = require("./middleware/notFoundHandler");
const { requireRole } = require("./middleware/requireRole");
const { createAuditRepository } = require("./modules/audit/repository");
const { createAdminAuditRouter } = require("./modules/audit/routes");
const { createAuditService } = require("./modules/audit/service");
const { createAuthRepository } = require("./modules/auth/repository");
const { createAdminAuthRouter, createAuthRouter } = require("./modules/auth/routes");
const { createAuthService } = require("./modules/auth/service");
const { createCategoriesRepository } = require("./modules/categories/repository");
const {
    createAdminCategoriesRouter,
    createCategoriesRouter
} = require("./modules/categories/routes");
const { createCategoriesService } = require("./modules/categories/service");
const { createCustomersRepository } = require("./modules/customers/repository");
const { createCustomersRouter } = require("./modules/customers/routes");
const { createCustomersService } = require("./modules/customers/service");
const { createDashboardRepository } = require("./modules/dashboard/repository");
const { createDashboardRouter } = require("./modules/dashboard/routes");
const { createDashboardService } = require("./modules/dashboard/service");
const { createOrdersRepository } = require("./modules/orders/repository");
const { createOrdersRouter } = require("./modules/orders/routes");
const { createOrdersService } = require("./modules/orders/service");
const { createProductsRepository } = require("./modules/products/repository");
const { createProductsRouter } = require("./modules/products/routes");
const { createProductsService } = require("./modules/products/service");
const { createPromotionsRepository } = require("./modules/promotions/repository");
const {
    createAdminPromotionsRouter,
    createPromotionsRouter
} = require("./modules/promotions/routes");
const { createPromotionsService } = require("./modules/promotions/service");
const { createStaffPerformanceRepository } = require("./modules/staffPerformance/repository");
const {
    createAdminStaffPerformanceRouter,
    createStaffPerformanceRouter
} = require("./modules/staffPerformance/routes");
const { createStaffPerformanceService } = require("./modules/staffPerformance/service");
const { createStockRepository } = require("./modules/stock/repository");
const { createStockRouter } = require("./modules/stock/routes");
const { createStockService } = require("./modules/stock/service");
const { createTableOrdersRepository } = require("./modules/tableOrders/repository");
const {
    createPublicTableOrdersRouter,
    createStaffTableOrdersRouter
} = require("./modules/tableOrders/routes");
const { createTableOrdersService } = require("./modules/tableOrders/service");
const { createTablesRepository } = require("./modules/tables/repository");
const { createAdminTablesRouter, createPublicTablesRouter } = require("./modules/tables/routes");
const { createTablesService } = require("./modules/tables/service");
const { createVariantsRepository } = require("./modules/variants/repository");
const { createVariantsRouter } = require("./modules/variants/routes");
const { createVariantsService } = require("./modules/variants/service");
const { createShiftsRepository } = require("./modules/shifts/repository");
const { createShiftsRouter } = require("./modules/shifts/routes");
const { createShiftsService } = require("./modules/shifts/service");
const { createPrescriptionsRepository } = require("./modules/prescriptions/repository");
const { createPrescriptionsRouter } = require("./modules/prescriptions/routes");
const { createPrescriptionsService } = require("./modules/prescriptions/service");
const { createWarrantiesRepository } = require("./modules/warranties/repository");
const { createWarrantiesRouter } = require("./modules/warranties/routes");
const { createWarrantiesService } = require("./modules/warranties/service");
const { createSuppliersRepository } = require("./modules/suppliers/repository");
const { createSuppliersRouter } = require("./modules/suppliers/routes");
const { createSuppliersService } = require("./modules/suppliers/service");
const { createPaymentsRepository } = require("./modules/payments/repository");
const { createPaymentsService } = require("./modules/payments/service");
const { createPaymentProvider } = require("./modules/payments/providers");
const { createPublicPaymentsRouter, createAdminPaymentsRouter, createStaffPaymentsRouter } = require("./modules/payments/routes");
const { createProductQrRepository } = require("./modules/productQr/repository");
const { createProductQrService } = require("./modules/productQr/service");
const { createPublicProductQrRouter, createStaffProductQrRouter } = require("./modules/productQr/routes");
const { createAiRepository } = require("./modules/ai/repository");
const { createAiService } = require("./modules/ai/service");
const { createGeminiGateway } = require("./modules/ai/gateway");
const { createLocalRag } = require("./modules/ai/rag");
const { createAiTools } = require("./modules/ai/tools");
const { createAiRouter } = require("./modules/ai/routes");

function createDefaultRepositories(db) {
    return {
        auth: createAuthRepository(db),
        products: createProductsRepository(db),
        customers: createCustomersRepository(db),
        orders: createOrdersRepository(db),
        promotions: createPromotionsRepository(db),
        dashboard: createDashboardRepository(db),
        staffPerformance: createStaffPerformanceRepository(db),
        tables: createTablesRepository(db),
        tableOrders: createTableOrdersRepository(db),
        stock: createStockRepository(db),
        audit: createAuditRepository(db),
        categories: createCategoriesRepository(db),
        variants: createVariantsRepository(db),
        shifts: createShiftsRepository(db),
        prescriptions: createPrescriptionsRepository(db),
        warranties: createWarrantiesRepository(db),
        suppliers: createSuppliersRepository(db),
        payments: createPaymentsRepository(db),
        productQr: createProductQrRepository(db),
        ai: createAiRepository(db)
    };
}

function createDefaultServices(repositories) {
    const audit = createAuditService(repositories.audit);
    const orders = createOrdersService(repositories.orders, {
        auditService: audit,
        shiftsRepository: repositories.shifts
    });

    const services = {
        auth: createAuthService(repositories.auth, { auditService: audit }),
        products: createProductsService(repositories.products, { auditService: audit }),
        customers: createCustomersService(repositories.customers),
        orders,
        promotions: createPromotionsService(repositories.promotions),
        // Lazy AI injection avoids circular init (dashboard insights → AI → summary)
        dashboard: createDashboardService(repositories.dashboard, {
            getAiService: () => services.ai
        }),
        staffPerformance: createStaffPerformanceService(repositories.staffPerformance),
        tables: createTablesService(repositories.tables),
        tableOrders: createTableOrdersService(repositories.tableOrders),
        stock: createStockService(repositories.stock),
        audit,
        categories: createCategoriesService(repositories.categories),
        variants: createVariantsService(repositories.variants),
        shifts: createShiftsService(repositories.shifts, { auditService: audit }),
        prescriptions: createPrescriptionsService(repositories.prescriptions),
        warranties: createWarrantiesService(repositories.warranties),
        suppliers: createSuppliersService(repositories.suppliers, {
            stockRepository: repositories.stock
        }),
        payments: createPaymentsService(repositories.payments, {
            config: {
                ...env.payment,
                allowSimulation: !env.isProd
            },
            provider: createPaymentProvider(env.payment),
            ordersService: orders
        }),
        productQr: createProductQrService(repositories.productQr, { publicAppUrl: env.publicAppUrl })
    };
    services.ai = createAiService(repositories.ai, {
        config: env.ai,
        gateway: createGeminiGateway(env.ai),
        rag: createLocalRag(),
        tools: createAiTools(services),
        getDashboardSummary: (query) => services.dashboard.getSummary(query)
    });
    return services;
}

function createApp(options = {}) {
    const app = express();
    const db = options.db || getPool();
    const repositories = {
        ...createDefaultRepositories(db),
        ...(options.repositories || {})
    };
    const services = {
        ...createDefaultServices(repositories),
        ...(options.services || {})
    };
    app.locals.services = services;

    app.set("trust proxy", 1);
    app.use(requestId);
    app.use(securityHeaders);
    app.use(cors({
        origin: env.security.corsOrigins,
        credentials: true,
        exposedHeaders: ["X-Request-Id", "X-RateLimit-Limit", "X-RateLimit-Remaining", "Deprecation"]
    }));
    app.use(express.json({
        limit: "12mb",
        verify(req, res, buffer) {
            req.rawBody = buffer.toString("utf8");
        }
    }));

    if (env.isDev) {
        app.use(requestLogger);
    }
    app.use("/vendor/bootstrap", express.static(path.join(__dirname, "..", "node_modules", "bootstrap", "dist")));
    app.use("/vendor/phosphor", express.static(path.join(__dirname, "..", "node_modules", "@phosphor-icons", "web", "src")));
    app.use("/vendor/jsbarcode", express.static(path.join(__dirname, "..", "node_modules", "jsbarcode", "dist")));
    app.use(express.static(path.join(__dirname, "..", "frontend")));

    app.get("/", (req, res) => {
        res.json({
            message: "POS Glasses API Running",
            request_id: req.requestId || null
        });
    });

    // Browsers request this automatically. Keep it public so a missing icon
    // never falls through to JWT auth and pollutes logs with a false 401.
    app.get("/favicon.ico", (req, res) => res.status(204).end());

    app.get("/health", async (req, res) => {
        try {
            await db.query("SELECT 1");
            res.json({ ok: true, db: true, request_id: req.requestId });
        } catch {
            res.status(503).json({ ok: false, db: false, request_id: req.requestId });
        }
    });

    app.use(createAuthRouter(services.auth));
    app.use(createPublicTablesRouter(services.tables));
    app.use(createPublicTableOrdersRouter(services.tableOrders));
    app.use(createPublicPaymentsRouter(services.payments, env.payment.provider));
    app.use(createPublicProductQrRouter(services.productQr));

    app.use(authMiddleware);
    app.use(requireRole("admin", "staff"));
    app.use(createProductsRouter(services.products));
    app.use(createCustomersRouter(services.customers));
    app.use(createOrdersRouter(services.orders));
    app.use(createDashboardRouter(services.dashboard));
    app.use(createPromotionsRouter(services.promotions));
    app.use(createStaffPerformanceRouter(services.staffPerformance));
    app.use(createStaffTableOrdersRouter(services.tableOrders));
    app.use(createStockRouter(services.stock));
    app.use(createCategoriesRouter(services.categories));
    app.use(createVariantsRouter(services.variants));
    app.use(createShiftsRouter(services.shifts));
    app.use(createPrescriptionsRouter(services.prescriptions));
    app.use(createWarrantiesRouter(services.warranties));
    app.use(createSuppliersRouter(services.suppliers));
    app.use(createStaffPaymentsRouter(services.payments));
    app.use(createStaffProductQrRouter(services.productQr));
    app.use(createAiRouter(services.ai));

    app.use(requireRole("admin"));
    app.use(createAdminAuthRouter(services.auth));
    app.use(createAdminStaffPerformanceRouter(services.staffPerformance));
    app.use(createAdminTablesRouter(services.tables));
    app.use(createAdminPromotionsRouter(services.promotions));
    app.use(createAdminAuditRouter(services.audit));
    app.use(createAdminCategoriesRouter(services.categories));
    app.use(createAdminPaymentsRouter(services.payments));

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}

module.exports = {
    createApp,
    createDefaultRepositories,
    createDefaultServices
};
