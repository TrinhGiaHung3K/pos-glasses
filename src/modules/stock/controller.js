function createStockController(service) {
    return {
        async listMovements(req, res) {
            res.json(await service.listMovements(req.query));
        },

        async summary(req, res) {
            res.json(await service.getInventorySummary());
        },

        async lowStock(req, res) {
            res.json(await service.findLowStock(req.query.threshold));
        },

        async purchaseIn(req, res) {
            res.status(201).json(await service.purchaseIn(req.body, req.user));
        },

        async adjust(req, res) {
            res.status(201).json(await service.adjust(req.body, req.user));
        }
    };
}

module.exports = {
    createStockController
};
