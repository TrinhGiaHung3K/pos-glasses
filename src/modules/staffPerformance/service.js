const { buildStaffPerformanceView } = require("./levels");

function createStaffPerformanceService(repository) {
    return {
        async findCurrentUserPerformance(userId) {
            const metrics = await repository.findByUserId(Number(userId));
            return buildStaffPerformanceView(metrics || { id: userId });
        },

        async listStaffPerformance() {
            const rows = await repository.findAll();
            return rows.map((row) => buildStaffPerformanceView(row));
        }
    };
}

module.exports = {
    createStaffPerformanceService
};
