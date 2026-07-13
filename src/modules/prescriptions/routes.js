const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { createPrescriptionsController } = require("./controller");

function createPrescriptionsRouter(service) {
    const router = express.Router();
    const controller = createPrescriptionsController(service);

    router.get(
        "/api/staff/customers/:customerId/prescriptions",
        asyncHandler(controller.listByCustomer)
    );
    router.post(
        "/api/staff/customers/:customerId/prescriptions",
        asyncHandler(controller.create)
    );
    router.get("/api/staff/prescriptions/:id", asyncHandler(controller.getById));
    router.put("/api/staff/prescriptions/:id", asyncHandler(controller.update));
    router.delete("/api/staff/prescriptions/:id", asyncHandler(controller.remove));

    return router;
}

module.exports = {
    createPrescriptionsRouter
};
