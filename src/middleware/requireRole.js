const { createHttpError } = require("./httpError");

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            throw createHttpError(401, "Vui lòng đăng nhập để tiếp tục");
        }

        if (!allowedRoles.includes(req.user.role)) {
            throw createHttpError(403, "Bạn không có quyền truy cập chức năng này");
        }

        next();
    };
}

module.exports = {
    requireRole
};
