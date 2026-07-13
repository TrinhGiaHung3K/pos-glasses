function createProductsController(service) {
    return {
        async list(req, res) {
            if (typeof service.list === "function") {
                res.json(await service.list(req.query));
            } else {
                res.json(await service.findAll());
            }
        },

        async get(req, res) {
            res.json(await service.findById(req.params.id));
        },

        async create(req, res) {
            res.json(await service.create(req.body, {
                actorId: req.user?.id,
                ip: req.ip
            }));
        },

        async update(req, res) {
            res.json(await service.update(req.params.id, req.body, {
                actorId: req.user?.id,
                ip: req.ip
            }));
        },

        async remove(req, res) {
            res.json(await service.remove(req.params.id, {
                actorId: req.user?.id,
                ip: req.ip
            }));
        },

        async saveImage(req, res) {
            res.status(201).json(await service.saveProcessedImage(req.body));
        },

        async updateImage(req, res) {
            res.json(await service.updateImage(req.params.id, req.body, {
                actorId: req.user?.id,
                ip: req.ip
            }));
        }
    };
}

module.exports = {
    createProductsController
};
