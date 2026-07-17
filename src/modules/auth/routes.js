const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { createAuthController } = require("./controller");
const { createLoginRateLimiter } = require("../../middleware/rateLimit");
const { env } = require("../../config/env");
const authMiddleware = require("../../middleware/authMiddleware");

function createAuthRouter(service) {
    const router = express.Router();
    const controller = createAuthController(service);
    const loginLimiter = createLoginRateLimiter(env.security);

    router.post("/login", loginLimiter, asyncHandler(controller.login));
    router.get("/api/auth/session", authMiddleware, asyncHandler(controller.session));
    router.post("/logout", asyncHandler(controller.logout));

    return router;
}

function createAdminAuthRouter(service) {
    const router = express.Router();
    const controller = createAuthController(service);

    router.get("/api/admin/users", asyncHandler(controller.listUsers));
    router.get("/users", asyncHandler(controller.listUsers));
    router.post("/api/admin/users", asyncHandler(controller.createUser));
    router.patch("/api/admin/users/:id/active", asyncHandler(controller.setActive));

    return router;
}

module.exports = {
    createAuthRouter,
    createAdminAuthRouter
};
