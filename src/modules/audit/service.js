function createAuditService(repository) {
    return {
        log(entry) {
            return repository.append(entry);
        },

        list(query) {
            return repository.list(query);
        }
    };
}

module.exports = {
    createAuditService
};
