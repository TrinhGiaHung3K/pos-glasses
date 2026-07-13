function createCategoriesController(service) {
    return {
        async list(req, res) {
            res.json(await service.list());
        },
        async create(req, res) {
            res.status(201).json(await service.create(req.body));
        },
        async update(req, res) {
            res.json(await service.update(req.params.id, req.body));
        },
        async remove(req, res) {
            res.json(await service.remove(req.params.id));
        }
    };
}

module.exports = {
    createCategoriesController
};
