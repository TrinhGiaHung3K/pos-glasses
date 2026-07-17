const cors = require("cors");
const express = require("express");
const path = require("node:path");
const { env } = require("./config/env");
const { getPool } = require("./db/pool");
const requestLogger = require("./middleware/requestLogger");
const requestId = require("./middleware/requestId");
const securityHeaders = require("./middleware/securityHeaders");
const authMiddleware = require("./middleware/authMiddleware");
const csrfProtection = require("./middleware/csrfProtection");
const { createPageAccessMiddleware } = require("./middleware/pageAccess");
const { createPageMetadataMiddleware } = require("./middleware/pageMetadata");
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
const { createProductImageStorage } = require("./modules/products/imageStorage");
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
        products: createProductsService(repositories.products, {
            auditService: audit,
            imageStorage: createProductImageStorage(env.cloudinary)
        }),
        customers: createCustomersService(repositories.customers),
        orders,
        promotions: createPromotionsService(repositories.promotions),
        // Lazy AI injection avoids circular init (dashboard insights → AI → summary)
        dashboard: createDashboardService(repositories.dashboard, {
            getAiService: () => services.ai
        }),
        staffPerformance: createStaffPerformanceService(repositories.staffPerformance),
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

    app.set("trust proxy", env.security.trustProxy);
    app.use(requestId);
    app.use(securityHeaders);
    app.use(cors((req, callback) => {
        const origin = String(req.headers.origin || "");
        let sameOrigin = false;
        try {
            const requestOrigin = `${req.protocol}://${String(req.headers.host || "").toLowerCase()}`;
            sameOrigin = Boolean(origin) && new URL(origin).origin.toLowerCase() === requestOrigin;
        } catch {
            sameOrigin = false;
        }
        const configured = env.security.corsOrigins;
        const allowed = !origin
            || sameOrigin
            || configured === true
            || (Array.isArray(configured) && configured.includes(origin));
        callback(null, {
            origin: allowed,
            credentials: true,
            methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key", "X-Requested-With"],
            exposedHeaders: ["X-Request-Id", "X-RateLimit-Limit", "X-RateLimit-Remaining", "Deprecation"],
            maxAge: 600
        });
    }));
    const captureRawBody = (req, res, buffer) => {
        req.rawBody = buffer.toString("utf8");
    };
    // Product images are the only large JSON request. Authenticate before
    // allocating that body; all other JSON, including webhooks, stays small.
    app.use("/products/image", authMiddleware, express.json({
        limit: "10mb",
        verify: captureRawBody
    }));
    app.use(express.json({
        limit: "256kb",
        verify(req, res, buffer) {
            captureRawBody(req, res, buffer);
        }
    }));

    app.use(requestLogger);
    const frontendRoot = path.join(__dirname, "..", "frontend");
    const staticOptions = {
        etag: true,
        fallthrough: true,
        index: false,
        maxAge: env.isProd ? "1h" : 0
    };
    app.use("/vendor/bootstrap", express.static(path.join(__dirname, "..", "node_modules", "bootstrap", "dist"), staticOptions));
    app.use("/vendor/phosphor", express.static(path.join(__dirname, "..", "node_modules", "@phosphor-icons", "web", "src"), staticOptions));
    app.use("/vendor/jsbarcode", express.static(path.join(__dirname, "..", "node_modules", "jsbarcode", "dist"), staticOptions));
    app.use("/vendor/tourguide", express.static(path.join(__dirname, "..", "node_modules", "@sjmc11", "tourguidejs", "dist"), staticOptions));
    app.use("/vendor/chartjs", express.static(path.join(__dirname, "..", "node_modules", "chart.js", "dist"), staticOptions));
    app.use("/assets", express.static(path.join(frontendRoot, "assets"), staticOptions));
    app.use(createPageAccessMiddleware());
    app.use(createPageMetadataMiddleware({ frontendRoot, publicAppUrl: env.publicAppUrl }));
    app.use(express.static(frontendRoot, staticOptions));

    app.get("/", (req, res) => {
        res.redirect(302, "/login.html");
    });

    // `frontend/favicon.ico` is normally served by the public static middleware.
    // Keep this fallback public so a missing asset never falls through to JWT auth.
    app.get("/favicon.ico", (req, res) => res.status(204).end());

    app.get("/health/live", (req, res) => {
        res.json({ ok: true, service: "pos-glasses", request_id: req.requestId });
    });

    async function readiness(req, res) {
        try {
            await db.query("SELECT 1");
            res.json({ ok: true, db: true, request_id: req.requestId });
        } catch {
            res.status(503).json({ ok: false, db: false, request_id: req.requestId });
        }
    }

    app.get("/health", readiness);
    app.get("/health/ready", readiness);

    app.use(createAuthRouter(services.auth));
    app.use(createPublicPaymentsRouter(services.payments, env.payment.provider));
    app.use(createPublicProductQrRouter(services.productQr));

    app.all("/register", (req, res) => {
        res.status(410).json({ message: "Đăng ký công khai không còn được hỗ trợ" });
    });
    app.use([
        "/api/public/tables",
        "/api/public/table-orders",
        "/api/staff/table-orders",
        "/api/admin/tables"
    ], (req, res) => {
        res.status(410).json({ message: "Luồng đặt hàng theo bàn đã được loại khỏi POS mắt kính" });
    });

    app.use(authMiddleware);
    app.use(csrfProtection);
    app.use(requireRole("admin", "staff"));
    app.post(["/orders", "/order-details"], (req, res) => {
        res.status(410).json({
            message: "API tạo đơn từng phần đã ngừng hỗ trợ. Sử dụng /api/staff/pos/checkout."
        });
    });
    app.use(createProductsRouter(services.products));
    app.use(createCustomersRouter(services.customers));
    app.use(createOrdersRouter(services.orders));
    app.use(createDashboardRouter(services.dashboard));
    app.use(createPromotionsRouter(services.promotions));
    app.use(createStaffPerformanceRouter(services.staffPerformance));
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
