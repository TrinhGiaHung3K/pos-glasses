function createCustomersController(service) {
    return {
        async list(req, res) {
            if (typeof service.list === "function") {
                res.json(await service.list(req.query));
            } else {
                res.json(await service.findAll());
            }
        },

        async findById(req, res) {
            res.json(await service.findById(req.params.id));
        },

        async summary(req, res) {
            res.json(await service.summary(req.params.id));
        },

        async findByMemberCode(req, res) {
            res.json(await service.findByMemberCode(req.params.memberCode));
        },

        async create(req, res) {
            res.status(201).json(await service.create(req.body));
        },

        async update(req, res) {
            res.json(await service.update(req.params.id, req.body));
        },

        async setStatus(req, res) {
            const status = req.body?.membership_status || req.body?.status;
            res.json(await service.setStatus(req.params.id, status));
        },

        async remove(req, res) {
            const hard = req.query.hard === "1" || req.query.hard === "true" || req.body?.hard === true;
            res.json(await service.remove(req.params.id, { hard }));
        }
    };
}

module.exports = {
    createCustomersController
};
