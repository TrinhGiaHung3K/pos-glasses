const { createHttpError } = require("../../middleware/httpError");

function normalizeName(value) {
    const name = String(value || "").replace(/\s+/g, " ").trim();
    if (name.length < 2 || name.length > 100) {
        throw createHttpError(400, "Tên danh mục 2–100 ký tự");
    }
    return name;
}

function createCategoriesService(repository) {
    return {
        list() {
            return repository.findAll();
        },

        async create(payload) {
            const name = normalizeName(payload.name);
            try {
                const result = await repository.create(name);
                return { message: "Đã tạo danh mục", id: result.insertId, name };
            } catch (error) {
                if (error && (error.code === "ER_DUP_ENTRY" || error.errno === 1062)) {
                    throw createHttpError(409, "Danh mục đã tồn tại");
                }
                throw error;
            }
        },

        async update(id, payload) {
            const existing = await repository.findById(Number(id));
            if (!existing) {
                throw createHttpError(404, "Không tìm thấy danh mục");
            }
            const name = normalizeName(payload.name);
            await repository.update(Number(id), name);
            return { message: "Đã cập nhật danh mục" };
        },

        async remove(id) {
            const existing = await repository.findById(Number(id));
            if (!existing) {
                throw createHttpError(404, "Không tìm thấy danh mục");
            }
            await repository.remove(Number(id));
            return { message: "Đã xóa danh mục" };
        }
    };
}

module.exports = {
    createCategoriesService
};
