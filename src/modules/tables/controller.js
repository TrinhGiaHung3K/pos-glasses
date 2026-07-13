function createTablesController(service) {
    return {
        async list(req, res) {
            res.json(await service.findAll());
        },

        async publicMenu(req, res) {
            res.json(await service.getPublicMenu(req.params.token));
        },

        async create(req, res) {
            res.status(201).json(await service.create(req.body));
        },

        async update(req, res) {
            res.json(await service.update(req.params.id, req.body));
        },

        async setActive(req, res) {
            res.json(await service.setActive(req.params.id, Boolean(req.body.is_active)));
        }
    };
}

module.exports = {
    createTablesController
};
