const { createHttpError } = require("../../middleware/httpError");

function createDashboardService(repository, options = {}) {
    return {
        getSummary(query = {}) {
            return repository.getSummary(query);
        },

        /**
         * AI narrative for dashboard KPIs (admin).
         * Delegates to AI service; snapshot always comes from getSummary.
         */
        async getAiInsights(query = {}, user) {
            if (user?.role !== "admin") {
                throw createHttpError(403, "Chỉ admin được xem gợi ý AI dashboard");
            }

            const aiService = typeof options.getAiService === "function"
                ? options.getAiService()
                : options.aiService;

            if (!aiService || typeof aiService.insights !== "function") {
                throw createHttpError(503, "Trợ lý AI chưa sẵn sàng");
            }

            return aiService.insights({
                range: query.range || "today",
                from: query.from,
                to: query.to,
                focus: query.focus,
                surface: "dashboard"
            }, user);
        }
    };
}

module.exports = {
    createDashboardService
};
