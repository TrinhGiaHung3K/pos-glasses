function createAuditController(service) {
    return {
        async list(req, res) {
            res.json(await service.list({
                page: req.query.page,
                limit: req.query.limit,
                entity_type: req.query.entity_type
            }));
        }
    };
}

module.exports = {
    createAuditController
};
