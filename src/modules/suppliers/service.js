const { createHttpError } = require("../../middleware/httpError");

function normalizeSupplier(payload) {
    const name = String(payload.name || "").trim();
    if (!name) {
        throw createHttpError(400, "Tên nhà cung cấp bắt buộc");
    }
    return {
        name: name.slice(0, 160),
        phone: payload.phone ? String(payload.phone).trim().slice(0, 30) : null,
        email: payload.email ? String(payload.email).trim().slice(0, 120) : null,
        address: payload.address ? String(payload.address).trim().slice(0, 500) : null,
        note: payload.note ? String(payload.note).trim().slice(0, 500) : null,
        is_active: payload.is_active === false || payload.is_active === 0 ? 0 : 1
    };
}

function createSuppliersService(repository, options = {}) {
    const stockRepository = options.stockRepository || null;

    return {
        list(query = {}) {
            return repository.list({
                q: String(query.q || "").trim(),
                activeOnly: query.all !== "1"
            });
        },

        async getById(id) {
            const row = await repository.findById(Number(id));
            if (!row) {
                throw createHttpError(404, "Không tìm thấy NCC");
            }
            return row;
        },

        async create(payload, user) {
            if (!user?.id) {
                throw createHttpError(401, "Vui lòng đăng nhập");
            }
            return repository.create(normalizeSupplier(payload || {}));
        },

        async update(id, payload, user) {
            if (!user?.id) {
                throw createHttpError(401, "Vui lòng đăng nhập");
            }
            const existing = await repository.findById(Number(id));
            if (!existing) {
                throw createHttpError(404, "Không tìm thấy NCC");
            }
            return repository.update(Number(id), normalizeSupplier({ ...existing, ...(payload || {}) }));
        },

        listPurchaseOrders(query = {}) {
            return repository.listPurchaseOrders({
                page: query.page,
                limit: query.limit,
                status: query.status || null,
                supplierId: query.supplier_id || null
            });
        },

        async getPurchaseOrder(id) {
            const po = await repository.getPurchaseOrderDetail(Number(id));
            if (!po) {
                throw createHttpError(404, "Không tìm thấy đơn nhập");
            }
            return po;
        },

        async createPurchaseOrder(payload, user) {
            if (!user?.id) {
                throw createHttpError(401, "Vui lòng đăng nhập");
            }
            const supplierId = Number(payload.supplier_id);
            if (!Number.isInteger(supplierId) || supplierId < 1) {
                throw createHttpError(400, "Nhà cung cấp không hợp lệ");
            }
            const supplier = await repository.findById(supplierId);
            if (!supplier || !supplier.is_active) {
                throw createHttpError(400, "Nhà cung cấp không hoạt động");
            }

            const rawItems = Array.isArray(payload.items) ? payload.items : [];
            if (!rawItems.length) {
                throw createHttpError(400, "Cần ít nhất một dòng sản phẩm");
            }

            const items = rawItems.map((item, index) => {
                const productId = Number(item.product_id);
                const qty = Number(item.qty ?? item.qty_ordered ?? item.quantity);
                if (!Number.isInteger(productId) || productId < 1) {
                    throw createHttpError(400, `Dòng ${index + 1}: sản phẩm không hợp lệ`);
                }
                if (!Number.isInteger(qty) || qty < 1) {
                    throw createHttpError(400, `Dòng ${index + 1}: số lượng không hợp lệ`);
                }
                return {
                    product_id: productId,
                    qty_ordered: qty,
                    unit_cost: Math.max(0, Number(item.unit_cost) || 0)
                };
            });

            return repository.createPurchaseOrder({
                supplierId,
                note: payload.note ? String(payload.note).trim().slice(0, 500) : null,
                createdBy: Number(user.id),
                items
            });
        },

        async receivePurchaseOrder(id, user) {
            if (!user?.id) {
                throw createHttpError(401, "Vui lòng đăng nhập");
            }

            const stockApply = stockRepository && typeof stockRepository.applyMovementOnConnection === "function"
                ? async (connection, lines) => {
                    for (const line of lines) {
                        await stockRepository.applyMovementOnConnection(connection, line);
                    }
                }
                : stockRepository && typeof stockRepository.applyMovements === "function"
                    ? async (_connection, lines) => stockRepository.applyMovements(lines)
                    : null;

            try {
                const result = await repository.receivePurchaseOrder(Number(id), {
                    receivedBy: Number(user.id),
                    stockApply
                });
                return {
                    message: "Đã nhận hàng và cập nhật tồn kho",
                    purchase_order: result.po,
                    stock_lines: result.movements.length
                };
            } catch (error) {
                if (error.status) {
                    throw createHttpError(error.status, error.message);
                }
                throw error;
            }
        }
    };
}

module.exports = {
    createSuppliersService
};
