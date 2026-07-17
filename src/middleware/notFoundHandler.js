function notFoundHandler(req, res) {
    res.status(404).json({
        message: `Route not found: ${req.method} ${req.path}`,
        request_id: req.requestId
    });
}

module.exports = notFoundHandler;
