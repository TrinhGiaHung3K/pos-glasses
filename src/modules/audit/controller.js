function createAuditController(service) {
    return {
        async list(req, res) {
            res.json(await service.list({
                page: req.query.page,
                limit: req.query.limit,
                entity_type: req.query.entity_type,
                // Exact COUNT(*) is expensive; only when client opts in
                include_total: req.query.include_total
            }));
        }
    };
}

module.exports = {
    createAuditController
};
