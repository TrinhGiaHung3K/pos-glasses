const crypto = require("node:crypto");
const { createHttpError } = require("../../middleware/httpError");

function sanitizeTable(table) {
    return {
        id: table.id,
        code: table.code,
        name: table.name
    };
}

function generateQrToken(code) {
    const cleanCode = String(code || "table")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return `${cleanCode}-${crypto.randomBytes(12).toString("hex")}`;
}

function createTablesService(repository) {
    return {
        findAll() {
            return repository.findAll();
        },

        async getPublicMenu(token) {
            const table = await repository.findActiveByToken(String(token || "").trim());

            if (!table) {
                throw createHttpError(404, "Bàn không tồn tại hoặc đã tạm ngưng");
            }

            const products = await repository.findAvailableProducts();
            const { presentProductsPricing } = require("../products/pricing");

            return {
                table: sanitizeTable(table),
                products: presentProductsPricing(products)
            };
        },

        async create(payload) {
            const code = String(payload.code || "").trim();
            const name = String(payload.name || "").trim();

            if (!code || !name) {
                throw createHttpError(400, "Vui lòng nhập mã bàn và tên bàn");
            }

            const result = await repository.create({
                code,
                name,
                qr_token: String(payload.qr_token || "").trim() || generateQrToken(code),
                is_active: payload.is_active === false ? 0 : 1
            });

            return {
                message: "Đã tạo bàn",
                id: result.insertId
            };
        },

        async update(id, payload) {
            const code = String(payload.code || "").trim();
            const name = String(payload.name || "").trim();

            if (!code || !name) {
                throw createHttpError(400, "Vui lòng nhập mã bàn và tên bàn");
            }

            await repository.update(Number(id), {
                code,
                name,
                qr_token: String(payload.qr_token || "").trim() || null,
                is_active: payload.is_active === false ? 0 : 1
            });

            return {
                message: "Đã cập nhật bàn"
            };
        },

        async setActive(id, isActive) {
            await repository.setActive(Number(id), isActive ? 1 : 0);

            return {
                message: isActive ? "Đã kích hoạt bàn" : "Đã tạm ngưng bàn"
            };
        }
    };
}

module.exports = {
    createTablesService,
    generateQrToken
};
