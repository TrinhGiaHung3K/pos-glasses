const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { createAiController } = require("./controller");
const { requireRole } = require("../../middleware/requireRole");

function createAiRouter(service) {
    const router = express.Router();
    const controller = createAiController(service);
    router.post("/api/staff/ai/chat", asyncHandler(controller.chat));
    router.post("/api/admin/ai/chat", requireRole("admin"), asyncHandler(controller.chat));
    // Structured revenue/ops insights (dashboard + reports)
    router.get("/api/admin/ai/insights", requireRole("admin"), asyncHandler(controller.insights));
    router.post("/api/admin/ai/insights", requireRole("admin"), asyncHandler(controller.insights));
    router.post("/api/users/me/ai-feedback", asyncHandler(controller.feedback));
    return router;
}
module.exports = { createAiRouter };
