class HttpError extends Error {
    constructor(status, message, details) {
        super(message);
        this.name = "HttpError";
        this.status = status;
        this.details = details;
    }
}

function createHttpError(status, message, details) {
    return new HttpError(status, message, details);
}

module.exports = {
    HttpError,
    createHttpError
};
