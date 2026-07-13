function createWarrantiesController(service) {
    return {
        async list(req, res) {
            res.json(await service.list(req.query));
        },

        async lookup(req, res) {
            res.json(await service.lookup(req.params.serial || req.query.serial));
        },

        async create(req, res) {
            res.status(201).json(await service.create(req.body || {}, req.user));
        },

        async setStatus(req, res) {
            res.json(await service.setStatus(req.params.id, req.body || {}, req.user));
        }
    };
}

module.exports = {
    createWarrantiesController
};
