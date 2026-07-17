const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { createOrdersController } = require("./controller");

function createOrdersRouter(service) {
    const router = express.Router();
    const controller = createOrdersController(service);

    router.post("/api/staff/pos/checkout", asyncHandler(controller.checkout));
    router.post("/api/staff/orders/:id/void", asyncHandler(controller.voidOrder));
    router.post("/api/staff/orders/:id/refund", asyncHandler(controller.refundOrder));
    router.get("/orders", asyncHandler(controller.list));
    router.get("/latest-orders", asyncHandler(controller.latest));
    router.get("/orders/:id", asyncHandler(controller.detail));

    return router;
}

module.exports = {
    createOrdersRouter
};
