function createAuthController(service) {
    return {
        async listUsers(req, res) {
            res.json(await service.findAllUsers());
        },

        async login(req, res) {
            res.json(await service.login(req.body, { ip: req.ip }));
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
