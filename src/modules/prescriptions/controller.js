function createPrescriptionsController(service) {
    return {
        async listByCustomer(req, res) {
            res.json(await service.listByCustomer(req.params.customerId || req.params.id));
        },

        async getById(req, res) {
            res.json(await service.getById(req.params.id));
        },

        async create(req, res) {
            const customerId = req.params.customerId || req.params.id;
            res.status(201).json(await service.create(customerId, req.body || {}, req.user));
        },

        async update(req, res) {
            res.json(await service.update(req.params.id, req.body || {}, req.user));
        },

        async remove(req, res) {
            res.json(await service.remove(req.params.id, req.user));
        }
    };
}

module.exports = {
    createPrescriptionsController
};
