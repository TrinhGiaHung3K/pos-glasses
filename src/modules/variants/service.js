const { createHttpError } = require("../../middleware/httpError");

function normalizeVariant(payload, productId) {
    const quantity = Number(payload.quantity ?? 0);
    if (!Number.isInteger(quantity) || quantity < 0) {
        throw createHttpError(400, "Tồn biến thể không hợp lệ");
    }
    let priceOverride = payload.price_override;
    if (priceOverride === "" || priceOverride == null) {
        priceOverride = null;
    } else {
        priceOverride = Math.round(Number(priceOverride));
        if (!Number.isFinite(priceOverride) || priceOverride < 0) {
            throw createHttpError(400, "Giá biến thể không hợp lệ");
        }
    }
    return {
        product_id: Number(productId),
        sku: payload.sku ? String(payload.sku).trim().toUpperCase() : null,
        color: payload.color ? String(payload.color).trim().slice(0, 60) : null,
        size: payload.size ? String(payload.size).trim().slice(0, 40) : null,
        barcode: payload.barcode ? String(payload.barcode).trim() : null,
        price_override: priceOverride,
        quantity,
        image: payload.image || null,
        is_default: Boolean(payload.is_default)
    };
}

function createVariantsService(repository) {
    return {
        listByProduct(productId) {
            return repository.findByProductId(Number(productId));
        },

        async create(productId, payload) {
            const variant = normalizeVariant(payload, productId);
            if (!variant.color && !variant.size && !variant.sku) {
                throw createHttpError(400, "Biến thể cần ít nhất màu, size hoặc SKU");
            }
            try {
                const result = await repository.create(variant);
                return { message: "Đã thêm biến thể", id: result.insertId };
            } catch (error) {
                if (error && (error.code === "ER_DUP_ENTRY" || error.errno === 1062)) {
                    throw createHttpError(409, "SKU biến thể đã tồn tại");
                }
                throw error;
            }
        },

        async update(id, payload) {
            const existing = await repository.findById(Number(id));
            if (!existing) {
                throw createHttpError(404, "Không tìm thấy biến thể");
            }
            const variant = normalizeVariant({ ...existing, ...payload }, existing.product_id);
            await repository.update(Number(id), variant);
            return { message: "Đã cập nhật biến thể" };
        },

        async remove(id) {
            const existing = await repository.findById(Number(id));
            if (!existing) {
                throw createHttpError(404, "Không tìm thấy biến thể");
            }
            await repository.remove(Number(id));
            return { message: "Đã xóa biến thể" };
        },

        listBrands() {
            return repository.listBrands();
        }
    };
}

module.exports = {
    createVariantsService
};
