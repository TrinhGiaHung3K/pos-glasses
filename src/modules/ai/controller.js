function createAiController(service) {
    return {
        async chat(req, res) { res.json(await service.chat(req.body, req.user)); },
        async insights(req, res) {
            const payload = {
                ...(req.query || {}),
                ...(req.body || {})
            };
            res.json(await service.insights(payload, req.user));
        },
        async feedback(req, res) { res.json(await service.feedback(req.body, req.user)); }
    };
}
module.exports = { createAiController };
