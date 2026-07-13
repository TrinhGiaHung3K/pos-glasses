const { createHttpError } = require("../../middleware/httpError");
const { STOCK_TYPES, ALL_STOCK_TYPES } = require("./types");

function toPositiveInt(value, label) {
    const numberValue = Number(value);
    if (!Number.isInteger(numberValue) || numberValue < 1) {
        throw createHttpError(400, `${label} không hợp lệ`);
    }
    return numberValue;
}

function normalizeLines(lines, type) {
    if (!Array.isArray(lines) || lines.length === 0) {
        throw createHttpError(400, "Vui lòng chọn ít nhất một sản phẩm");
    }

    return lines.map((line, index) => {
        const productId = toPositiveInt(line.product_id, `Dòng ${index + 1}: sản phẩm`);
        const qty = toPositiveInt(line.qty ?? line.quantity, `Dòng ${index + 1}: số lượng`);
        const unitCost = line.unit_cost != null ? Math.max(0, Number(line.unit_cost) || 0) : null;

        return {
            product_id: productId,
            type,
            qty,
            unit_cost: unitCost,
            note: line.note ? String(line.note).trim().slice(0, 500) : null
        };
    });
}

function createStockService(repository) {
    return {
        listMovements(query = {}) {
            return repository.listMovements(query);
        },

        getInventorySummary() {
            return repository.getInventorySummary();
        },

        findLowStock(threshold) {
            return repository.findLowStock(threshold);
        },

        /**
         * Purchase / stock-in (multi-line).
         */
        async purchaseIn(payload, user) {
            if (!user?.id) {
                throw createHttpError(401, "Vui lòng đăng nhập để tiếp tục");
            }

            const note = String(payload.note || "Nhập hàng").trim().slice(0, 500);
            const lines = normalizeLines(payload.lines || payload.items, STOCK_TYPES.PURCHASE_IN);
            const movements = lines.map((line) => ({
                ...line,
                ref_type: "purchase",
                ref_id: null,
                note: line.note || note,
                created_by: Number(user.id)
            }));

            const results = await repository.applyMovements(movements);
            return {
                message: "Nhập kho thành công",
                movements: results
            };
        },

        /**
         * Manual adjust in/out.
         * payload.direction: 'in' | 'out'
         */
        async adjust(payload, user) {
            if (!user?.id) {
                throw createHttpError(401, "Vui lòng đăng nhập để tiếp tục");
            }

            const direction = String(payload.direction || "in").trim().toLowerCase();
            const type = direction === "out" ? STOCK_TYPES.ADJUST_OUT : STOCK_TYPES.ADJUST_IN;
            const note = String(payload.note || "").trim();

            if (!note) {
                throw createHttpError(400, "Vui lòng nhập lý do điều chỉnh kho");
            }

            const lines = normalizeLines(payload.lines || payload.items, type);
            const movements = lines.map((line) => ({
                ...line,
                ref_type: "adjust",
                ref_id: null,
                note: line.note || note.slice(0, 500),
                created_by: Number(user.id)
            }));

            const results = await repository.applyMovements(movements);
            return {
                message: direction === "out" ? "Đã xuất điều chỉnh kho" : "Đã nhập điều chỉnh kho",
                movements: results
            };
        },

        /**
         * Low-level multi movement (for internal/admin tools).
         */
        async applyRawMovements(movements, user) {
            if (!user?.id) {
                throw createHttpError(401, "Vui lòng đăng nhập để tiếp tục");
            }

            const normalized = (movements || []).map((movement, index) => {
                const type = String(movement.type || "").trim();
                if (!ALL_STOCK_TYPES.has(type)) {
                    throw createHttpError(400, `Dòng ${index + 1}: loại biến động không hợp lệ`);
                }
                return {
                    product_id: toPositiveInt(movement.product_id, `Dòng ${index + 1}: sản phẩm`),
                    type,
                    qty: toPositiveInt(movement.qty ?? movement.quantity, `Dòng ${index + 1}: số lượng`),
                    unit_cost: movement.unit_cost != null ? Math.max(0, Number(movement.unit_cost) || 0) : null,
                    ref_type: movement.ref_type || null,
                    ref_id: movement.ref_id != null ? Number(movement.ref_id) : null,
                    note: movement.note ? String(movement.note).trim().slice(0, 500) : null,
                    created_by: Number(user.id)
                };
            });

            if (!normalized.length) {
                throw createHttpError(400, "Không có biến động kho");
            }

            const results = await repository.applyMovements(normalized);
            return {
                message: "Đã ghi nhận biến động kho",
                movements: results
            };
        }
    };
}

module.exports = {
    createStockService,
    normalizeLines
};
