function createVariantsController(service) {
    return {
        async listByProduct(req, res) {
            res.json(await service.listByProduct(req.params.productId));
        },
        async create(req, res) {
            res.status(201).json(await service.create(req.params.productId, req.body));
        },
        async update(req, res) {
            res.json(await service.update(req.params.id, req.body));
        },
        async remove(req, res) {
            res.json(await service.remove(req.params.id));
        },
        async listBrands(req, res) {
            res.json(await service.listBrands());
        }
    };
}

module.exports = {
    createVariantsController
};
