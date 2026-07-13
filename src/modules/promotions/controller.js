function createPromotionsController(service) {
    return {
        async getByCode(req, res) {
            res.json(await service.findByCode(req.params.code, {
                subtotal: req.query.subtotal
            }));
        },

        async list(req, res) {
            res.json(await service.list(req.query));
        },

        async policy(req, res) {
            res.json({
                policy: service.getPolicy(),
                defaults: service.getCreateDefaults()
            });
        },

        async create(req, res) {
            res.status(201).json(await service.create(req.body));
        },

        async update(req, res) {
            res.json(await service.update(req.params.id, req.body));
        },

        async setActive(req, res) {
            const active = req.body?.is_active !== false
                && req.body?.is_active !== 0
                && req.body?.is_active !== "0";
            res.json(await service.setActive(req.params.id, active));
        },

        async remove(req, res) {
            res.json(await service.remove(req.params.id));
        },

        async preview(req, res) {
            res.json(await service.preview(
                req.params.code || req.body?.code,
                req.query.subtotal ?? req.body?.subtotal
            ));
        }
    };
}

module.exports = {
    createPromotionsController
};
