const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { createTablesController } = require("./controller");

function createAdminTablesRouter(service) {
    const router = express.Router();
    const controller = createTablesController(service);

    router.get("/api/admin/tables", asyncHandler(controller.list));
    router.post("/api/admin/tables", asyncHandler(controller.create));
    router.put("/api/admin/tables/:id", asyncHandler(controller.update));
    router.patch("/api/admin/tables/:id/status", asyncHandler(controller.setActive));

    return router;
}

function createPublicTablesRouter(service) {
    const router = express.Router();
    const controller = createTablesController(service);

    router.get("/api/public/tables/:token/menu", asyncHandler(controller.publicMenu));

    return router;
}

module.exports = {
    createAdminTablesRouter,
    createPublicTablesRouter
};
