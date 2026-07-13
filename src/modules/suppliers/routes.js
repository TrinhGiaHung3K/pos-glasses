const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { createSuppliersController } = require("./controller");

function createSuppliersRouter(service) {
    const router = express.Router();
    const controller = createSuppliersController(service);

    router.get("/api/staff/suppliers", asyncHandler(controller.list));
    router.post("/api/staff/suppliers", asyncHandler(controller.create));
    router.get("/api/staff/suppliers/:id", asyncHandler(controller.getById));
    router.put("/api/staff/suppliers/:id", asyncHandler(controller.update));

    router.get("/api/staff/purchase-orders", asyncHandler(controller.listPurchaseOrders));
    router.post("/api/staff/purchase-orders", asyncHandler(controller.createPurchaseOrder));
    router.get("/api/staff/purchase-orders/:id", asyncHandler(controller.getPurchaseOrder));
    router.post("/api/staff/purchase-orders/:id/receive", asyncHandler(controller.receivePurchaseOrder));

    return router;
}

module.exports = {
    createSuppliersRouter
};
