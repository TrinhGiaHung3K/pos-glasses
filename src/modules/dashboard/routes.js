const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { createDashboardController } = require("./controller");
const { requireRole } = require("../../middleware/requireRole");

function createDashboardRouter(service) {
    const router = express.Router();
    const controller = createDashboardController(service);

    router.get("/dashboard", asyncHandler(controller.summary));
    // Admin-only AI insight panel (same auth stack as other /dashboard routes)
    router.get(
        "/dashboard/ai-insights",
        requireRole("admin"),
        asyncHandler(controller.aiInsights)
    );

    return router;
}

module.exports = {
    createDashboardRouter
};
