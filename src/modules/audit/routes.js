const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { createAuditController } = require("./controller");

function createAdminAuditRouter(service) {
    const router = express.Router();
    const controller = createAuditController(service);

    router.get("/api/admin/audit-logs", asyncHandler(controller.list));

    return router;
}

module.exports = {
    createAdminAuditRouter
};
