const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { createCustomersController } = require("./controller");

function createCustomersRouter(service) {
    const router = express.Router();
    const controller = createCustomersController(service);

    // Static / multi-segment paths first (Express 5 path-to-regexp rejects :id(\\d+))
    router.get("/customers", asyncHandler(controller.list));
    router.get("/customers/member/:memberCode", asyncHandler(controller.findByMemberCode));
    router.get("/api/staff/customers/member/:memberCode", asyncHandler(controller.findByMemberCode));
    router.post("/customers", asyncHandler(controller.create));

    // Static multi-segment before :id
    router.get("/customers/:id/summary", asyncHandler(controller.summary));
    router.get("/api/staff/customers/:id/summary", asyncHandler(controller.summary));

    // Numeric id validated in service layer (Number(id) / findById)
    router.get("/customers/:id", asyncHandler(controller.findById));
    router.put("/customers/:id", asyncHandler(controller.update));
    router.patch("/customers/:id/status", asyncHandler(controller.setStatus));
    router.delete("/customers/:id", asyncHandler(controller.remove));

    return router;
}

module.exports = {
    createCustomersRouter
};
