const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { createTableOrdersController } = require("./controller");

function createPublicTableOrdersRouter(service) {
    const router = express.Router();
    const controller = createTableOrdersController(service);

    router.post("/api/public/table-orders", asyncHandler(controller.createPublic));

    return router;
}

function createStaffTableOrdersRouter(service) {
    const router = express.Router();
    const controller = createTableOrdersController(service);

    // Static path before :id
    router.get("/api/staff/table-orders/stream", asyncHandler(controller.stream));
    router.get("/api/staff/table-orders", asyncHandler(controller.listPending));
    router.get("/api/staff/table-orders/:id", asyncHandler(controller.detail));
    router.post("/api/staff/table-orders/:id/confirm", asyncHandler(controller.confirm));
    router.post("/api/staff/table-orders/:id/cancel", asyncHandler(controller.cancel));

    return router;
}

module.exports = {
    createPublicTableOrdersRouter,
    createStaffTableOrdersRouter
};
