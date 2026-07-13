function createProductQrController(service) {
    return {
        async getOrCreate(req, res) {
            res.json(await service.getOrCreate(req.params.id, req.user));
        },
        async rotate(req, res) {
            res.status(201).json(await service.rotate(req.params.id, req.user));
        },
        async resolve(req, res) {
            res.json(await service.resolve(req.params.code));
        },
        async resolveForStaff(req, res) {
            res.json(await service.resolveForStaff(req.params.code));
        }
    };
}

module.exports = { createProductQrController };
