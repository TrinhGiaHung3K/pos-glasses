function createDashboardController(service) {
    return {
        async summary(req, res) {
            res.json(await service.getSummary(req.query));
        },

        async aiInsights(req, res) {
            res.json(await service.getAiInsights(req.query, req.user));
        }
    };
}

module.exports = {
    createDashboardController
};
