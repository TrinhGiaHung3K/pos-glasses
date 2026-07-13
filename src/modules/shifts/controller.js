function createShiftsController(service) {
    return {
        async current(req, res) {
            const shift = await service.getCurrent(req.user);
            res.json({ shift: shift || null });
        },

        async list(req, res) {
            res.json(await service.list(req.query, req.user));
        },

        async getById(req, res) {
            res.json(await service.getById(req.params.id, req.user));
        },

        async open(req, res) {
            res.status(201).json(await service.open(req.body || {}, req.user));
        },

        async close(req, res) {
            res.json(await service.close(req.params.id, req.body || {}, req.user));
        }
    };
}

module.exports = {
    createShiftsController
};
