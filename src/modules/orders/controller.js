function createOrdersController(service) {
    return {
        async checkout(req, res) {
            const idempotencyKey = req.get("Idempotency-Key") || req.get("idempotency-key") || "";
            res.status(201).json(await service.checkout(req.body, req.user, {
                idempotencyKey,
                ip: req.ip
            }));
        },

        async voidOrder(req, res) {
            res.json(await service.voidOrder(req.params.id, req.user, req.body, { ip: req.ip }));
        },

        async refundOrder(req, res) {
            res.json(await service.refundOrder(req.params.id, req.user, req.body, { ip: req.ip }));
        },

        async detail(req, res) {
            res.json(await service.findDetailsById(req.params.id));
        },

        async list(req, res) {
            res.json(await service.findAll({
                status: req.query.status,
                source: req.query.source,
                payment_method: req.query.payment_method,
                from: req.query.from,
                to: req.query.to,
                user_id: req.query.user_id,
                page: req.query.page,
                limit: req.query.limit
            }));
        },

        async latest(req, res) {
            res.json(await service.findLatest(req.query.limit || 5));
        }
    };
}

module.exports = {
    createOrdersController
};
