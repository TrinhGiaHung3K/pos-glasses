const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { createPaymentsController } = require("./controller");

function createPublicPaymentsRouter(service, providerName = "sepay") {
    const router = express.Router();
    const controller = createPaymentsController(service);
    router.post(`/api/webhooks/payments/${providerName}`, asyncHandler(controller.webhook));
    return router;
}

function createAdminPaymentsRouter(service) {
    const router = express.Router();
    const controller = createPaymentsController(service);
    router.post("/api/admin/payment-test-intents", asyncHandler(controller.createTestIntent));
    router.get("/api/admin/payment-test-intents/:publicId", asyncHandler(controller.getIntent));
    router.get("/api/admin/payments", asyncHandler(controller.adminList));
    return router;
}

function createStaffPaymentsRouter(service) {
    const router = express.Router();
    const controller = createPaymentsController(service);
    router.post("/api/staff/pos/payment-intents", asyncHandler(controller.createOrderIntent));
    router.post("/api/staff/payment-intents/:publicId/simulate", asyncHandler(controller.simulate));
    router.get("/api/staff/payment-intents/:publicId/stream", asyncHandler(controller.stream));
    router.get("/api/staff/payment-intents/:publicId", asyncHandler(controller.getIntent));
    return router;
}

module.exports = { createPublicPaymentsRouter, createAdminPaymentsRouter, createStaffPaymentsRouter };
