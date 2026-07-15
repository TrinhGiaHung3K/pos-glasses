const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { requireRole } = require("../../middleware/requireRole");
const { createProductsController } = require("./controller");

function createProductsRouter(service) {
    const router = express.Router();
    const controller = createProductsController(service);

    router.get("/products", asyncHandler(controller.list));
    // Image upload must be registered before /products/:id
    router.post("/products/image", requireRole("admin"), asyncHandler(controller.saveImage));
    router.get("/products/:id", asyncHandler(controller.get));
    router.post("/products", requireRole("admin"), asyncHandler(controller.create));
    router.put("/products/:id", requireRole("admin"), asyncHandler(controller.update));
    // Lightweight image-only update after client BG removal
    router.patch("/products/:id/image", requireRole("admin"), asyncHandler(controller.updateImage));
    router.delete("/products/:id", requireRole("admin"), asyncHandler(controller.remove));

    return router;
}

module.exports = {
    createProductsRouter
};
