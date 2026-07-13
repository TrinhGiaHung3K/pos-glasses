const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { createWarrantiesController } = require("./controller");

function createWarrantiesRouter(service) {
    const router = express.Router();
    const controller = createWarrantiesController(service);

    router.get("/api/staff/warranties", asyncHandler(controller.list));
    router.get("/api/staff/warranties/lookup/:serial", asyncHandler(controller.lookup));
    router.post("/api/staff/warranties", asyncHandler(controller.create));
    router.patch("/api/staff/warranties/:id/status", asyncHandler(controller.setStatus));

    return router;
}

module.exports = {
    createWarrantiesRouter
};
