function createStaffPerformanceController(service) {
    return {
        async current(req, res) {
            res.json(await service.findCurrentUserPerformance(req.user.id));
        },

        async list(req, res) {
            res.json(await service.listStaffPerformance());
        }
    };
}

module.exports = {
    createStaffPerformanceController
};
