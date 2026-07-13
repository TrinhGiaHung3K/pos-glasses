const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { createStockController } = require("./controller");

function createStockRouter(service) {
    const router = express.Router();
    const controller = createStockController(service);

    router.get("/api/staff/stock/movements", asyncHandler(controller.listMovements));
    router.get("/api/staff/stock/summary", asyncHandler(controller.summary));
    router.get("/api/staff/stock/low", asyncHandler(controller.lowStock));
    router.post("/api/staff/stock/purchase-in", asyncHandler(controller.purchaseIn));
    router.post("/api/staff/stock/adjust", asyncHandler(controller.adjust));

    return router;
}

module.exports = {
    createStockRouter
};
