const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { createShiftsController } = require("./controller");

function createShiftsRouter(service) {
    const router = express.Router();
    const controller = createShiftsController(service);

    router.get("/api/staff/shifts/current", asyncHandler(controller.current));
    router.get("/api/staff/shifts", asyncHandler(controller.list));
    router.get("/api/staff/shifts/:id", asyncHandler(controller.getById));
    router.post("/api/staff/shifts/open", asyncHandler(controller.open));
    router.post("/api/staff/shifts/:id/close", asyncHandler(controller.close));

    return router;
}

module.exports = {
    createShiftsRouter
};
