const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { createVariantsController } = require("./controller");

function createVariantsRouter(service) {
    const router = express.Router();
    const controller = createVariantsController(service);

    router.get("/api/staff/brands", asyncHandler(controller.listBrands));
    router.get("/api/staff/products/:productId/variants", asyncHandler(controller.listByProduct));
    router.post("/api/staff/products/:productId/variants", asyncHandler(controller.create));
    router.put("/api/staff/variants/:id", asyncHandler(controller.update));
    router.delete("/api/staff/variants/:id", asyncHandler(controller.remove));

    return router;
}

module.exports = {
    createVariantsRouter
};
