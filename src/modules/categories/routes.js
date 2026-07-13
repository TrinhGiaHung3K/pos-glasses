const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { createCategoriesController } = require("./controller");

function createCategoriesRouter(service) {
    const router = express.Router();
    const controller = createCategoriesController(service);
    router.get("/categories", asyncHandler(controller.list));
    router.get("/api/staff/categories", asyncHandler(controller.list));
    return router;
}

function createAdminCategoriesRouter(service) {
    const router = express.Router();
    const controller = createCategoriesController(service);
    router.get("/api/admin/categories", asyncHandler(controller.list));
    router.post("/api/admin/categories", asyncHandler(controller.create));
    router.put("/api/admin/categories/:id", asyncHandler(controller.update));
    router.delete("/api/admin/categories/:id", asyncHandler(controller.remove));
    return router;
}

module.exports = {
    createCategoriesRouter,
    createAdminCategoriesRouter
};
