function createSuppliersController(service) {
    return {
        async list(req, res) {
            res.json(await service.list(req.query));
        },

        async getById(req, res) {
            res.json(await service.getById(req.params.id));
        },

        async create(req, res) {
            res.status(201).json(await service.create(req.body || {}, req.user));
        },

        async update(req, res) {
            res.json(await service.update(req.params.id, req.body || {}, req.user));
        },

        async listPurchaseOrders(req, res) {
            res.json(await service.listPurchaseOrders(req.query));
        },

        async getPurchaseOrder(req, res) {
            res.json(await service.getPurchaseOrder(req.params.id));
        },

        async createPurchaseOrder(req, res) {
            res.status(201).json(await service.createPurchaseOrder(req.body || {}, req.user));
        },

        async receivePurchaseOrder(req, res) {
            res.json(await service.receivePurchaseOrder(req.params.id, req.user));
        }
    };
}

module.exports = {
    createSuppliersController
};
