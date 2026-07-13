const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { createProductQrController } = require("./controller");

function createPublicProductQrRouter(service) {
    const router = express.Router();
    const controller = createProductQrController(service);
    router.get("/api/public/products/by-qr/:code", asyncHandler(controller.resolve));
    return router;
}

function createStaffProductQrRouter(service) {
    const router = express.Router();
    const controller = createProductQrController(service);
    router.get("/api/staff/products/by-qr/:code", asyncHandler(controller.resolveForStaff));
    router.post("/api/staff/products/:id/qr", asyncHandler(controller.getOrCreate));
    router.post("/api/staff/products/:id/qr/rotate", asyncHandler(controller.rotate));
    return router;
}

module.exports = { createPublicProductQrRouter, createStaffProductQrRouter };
