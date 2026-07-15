const { env } = require("../../config/env");

function sessionCookieOptions() {
    return {
        httpOnly: true,
        secure: env.isProd,
        sameSite: "strict",
        path: "/",
        maxAge: env.security.sessionCookieMaxAgeMs
    };
}

function createAuthController(service) {
    return {
        async listUsers(req, res) {
            res.json(await service.findAllUsers());
        },

        async login(req, res) {
            const result = await service.login(req.body, { ip: req.ip });
            res.cookie(env.security.sessionCookieName, result.token, sessionCookieOptions());
            const { token, ...safeResult } = result;
            res.json({ ...safeResult, authenticated: true });
        },

        async session(req, res) {
            res.json({
                authenticated: true,
                user: {
                    id: req.user.id,
                    username: req.user.username,
                    role: req.user.role,
                    is_active: true
                }
            });
        },

        async logout(req, res) {
            res.clearCookie(env.security.sessionCookieName, {
                httpOnly: true,
                secure: env.isProd,
                sameSite: "strict",
                path: "/"
            });
            res.status(204).end();
        },

        async register(req, res) {
            res.status(201).json(await service.register(req.body));
        },

        async createUser(req, res) {
            res.status(201).json(await service.createUser(req.body, {
                role: req.body?.role
            }));
        },

        async setActive(req, res) {
            const active = req.body?.is_active !== false
                && req.body?.is_active !== 0
                && req.body?.is_active !== "0";
            res.json(await service.setUserActive(req.params.id, active, req.user));
        }
    };
}

module.exports = {
    createAuthController
};
