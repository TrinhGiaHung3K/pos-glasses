const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { createStaffPerformanceController } = require("./controller");

function createStaffPerformanceRouter(service) {
    const router = express.Router();
    const controller = createStaffPerformanceController(service);

    router.get("/api/staff/performance/me", asyncHandler(controller.current));

    return router;
}

function createAdminStaffPerformanceRouter(service) {
    const router = express.Router();
    const controller = createStaffPerformanceController(service);

    router.get("/api/admin/staff-performance", asyncHandler(controller.list));

    return router;
}

module.exports = {
    createAdminStaffPerformanceRouter,
    createStaffPerformanceRouter
};
