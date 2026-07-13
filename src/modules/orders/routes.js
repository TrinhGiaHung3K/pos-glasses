const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { createOrdersController } = require("./controller");

function deprecationHeaders(sunset) {
    return (req, res, next) => {
        res.setHeader("Deprecation", "true");
        res.setHeader("Sunset", sunset || "Sat, 01 Aug 2026 00:00:00 GMT");
        res.setHeader(
            "Link",
            '</api/staff/pos/checkout>; rel="successor-version"'
        );
        next();
    };
}

function createOrdersRouter(service) {
    const router = express.Router();
    const controller = createOrdersController(service);

    // Legacy paths — prefer POST /api/staff/pos/checkout
    router.post(
        "/orders",
        deprecationHeaders(),
        asyncHandler(controller.create)
    );
    router.post(
        "/order-details",
        deprecationHeaders(),
        asyncHandler(controller.addDetail)
    );
    router.post("/api/staff/pos/checkout", asyncHandler(controller.checkout));
    router.post("/api/staff/orders/:id/void", asyncHandler(controller.voidOrder));
    router.post("/api/staff/orders/:id/refund", asyncHandler(controller.refundOrder));
    router.get("/orders", asyncHandler(controller.list));
    router.get("/latest-orders", asyncHandler(controller.latest));
    router.get("/orders/:id", asyncHandler(controller.detail));

    return router;
}

module.exports = {
    createOrdersRouter
};
