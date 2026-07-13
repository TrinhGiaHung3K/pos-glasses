const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { createPromotionsController } = require("./controller");

function createPromotionsRouter(service) {
    const router = express.Router();
    const controller = createPromotionsController(service);

    // Staff: list first (before :code param routes)
    router.get("/api/staff/promotions", asyncHandler(controller.list));
    // Staff POS: validate coupon codes
    router.get("/promotions/:code", asyncHandler(controller.getByCode));
    router.get("/api/staff/promotions/:code", asyncHandler(controller.getByCode));

    return router;
}

function createAdminPromotionsRouter(service) {
    const router = express.Router();
    const controller = createPromotionsController(service);

    // Static paths before :param routes
    router.get("/api/admin/promotions/policy", asyncHandler(controller.policy));
    router.get("/api/admin/promotions", asyncHandler(controller.list));
    router.post("/api/admin/promotions", asyncHandler(controller.create));
    router.get("/api/admin/promotions/:code/preview", asyncHandler(controller.preview));
    router.put("/api/admin/promotions/:id", asyncHandler(controller.update));
    router.patch("/api/admin/promotions/:id/active", asyncHandler(controller.setActive));
    router.delete("/api/admin/promotions/:id", asyncHandler(controller.remove));

    return router;
}

module.exports = {
    createPromotionsRouter,
    createAdminPromotionsRouter
};
