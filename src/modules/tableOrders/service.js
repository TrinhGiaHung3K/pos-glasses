const { createHttpError } = require("../../middleware/httpError");
const { publishTableOrderEvent } = require("./events");

function toPositiveInteger(value, fieldName) {
    const numberValue = Number(value);

    if (!Number.isInteger(numberValue) || numberValue < 1) {
        throw createHttpError(400, `${fieldName} không hợp lệ`);
    }

    return numberValue;
}

function normalizeItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw createHttpError(400, "Vui lòng chọn ít nhất một sản phẩm");
    }

    const byProductId = new Map();

    for (const item of items) {
        const productId = toPositiveInteger(item.product_id, "Sản phẩm");
        const quantity = toPositiveInteger(item.quantity, "Số lượng");
        byProductId.set(productId, (byProductId.get(productId) || 0) + quantity);
    }

    return [...byProductId.entries()].map(([product_id, quantity]) => ({
        product_id,
        quantity
    }));
}

function mapProductsById(products) {
    return new Map(products.map((product) => [Number(product.id), product]));
}

function ensureProductsAvailable(items, productsById) {
    for (const item of items) {
        const product = productsById.get(item.product_id);

        if (!product) {
            throw createHttpError(404, "Sản phẩm không tồn tại");
        }

        if (Number(product.quantity) < item.quantity) {
            throw createHttpError(
                400,
                `Sản phẩm ${product.name} không đủ tồn kho`
            );
        }
    }
}

function createTableOrdersService(repository) {
    return {
        async createPublicOrder(payload) {
            const items = normalizeItems(payload.items);
            const table = await repository.findActiveTableByToken(String(payload.token || "").trim());

            if (!table) {
                throw createHttpError(404, "Bàn không tồn tại hoặc đã tạm ngưng");
            }

            const products = await repository.findProductsByIds(items.map((item) => item.product_id));
            const productsById = mapProductsById(products);
            ensureProductsAvailable(items, productsById);

            const orderItems = items.map((item) => {
                const product = productsById.get(item.product_id);

                const { commercialUnitPrice } = require("../products/pricing");
                return {
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_price_snapshot: commercialUnitPrice(product),
                    product_name_snapshot: product.name
                };
            });

            const result = await repository.createPendingTableOrder({
                table_id: table.id,
                items: orderItems
            });

            publishTableOrderEvent({
                type: "created",
                id: result.insertId,
                table_code: table.code,
                table_name: table.name
            });

            return {
                message: "Đã gửi yêu cầu đặt hàng",
                id: result.insertId,
                table: {
                    id: table.id,
                    code: table.code,
                    name: table.name
                }
            };
        },

        findPending() {
            return repository.findPending();
        },

        async findDetail(id) {
            const order = await repository.findOrderWithItems(Number(id));

            if (!order) {
                throw createHttpError(404, "Không tìm thấy yêu cầu đặt hàng");
            }

            return order;
        },

        async confirm(id, user) {
            if (!user || !user.id) {
                throw createHttpError(401, "Vui lòng đăng nhập để tiếp tục");
            }

            const tableOrderId = Number(id);
            const order = await repository.findPendingOrderWithItems(tableOrderId);

            if (!order) {
                throw createHttpError(404, "Không tìm thấy yêu cầu đang chờ xác nhận");
            }

            const items = order.items.map((item) => ({
                product_id: Number(item.product_id),
                quantity: Number(item.quantity),
                price: Number(item.unit_price_snapshot),
                product_name_snapshot: item.product_name_snapshot
            }));
            const products = await repository.findProductsByIds(items.map((item) => item.product_id));
            const productsById = mapProductsById(products);
            ensureProductsAvailable(items, productsById);

            const totalAmount = items.reduce(
                (total, item) => total + item.quantity * item.price,
                0
            );
            const result = await repository.confirmPendingOrder({
                table_order_id: tableOrderId,
                table_id: Number(order.table_id),
                user_id: Number(user.id),
                total_amount: totalAmount,
                items: items.map((item) => ({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    price: item.price
                }))
            });

            publishTableOrderEvent({
                type: "confirmed",
                id: tableOrderId,
                order_id: result.orderId
            });

            return {
                message: "Đã xác nhận yêu cầu và tạo hóa đơn",
                order_id: result.orderId
            };
        },

        async cancel(id) {
            await repository.cancelPendingOrder(Number(id));
            publishTableOrderEvent({
                type: "cancelled",
                id: Number(id)
            });

            return {
                message: "Đã hủy yêu cầu đặt hàng"
            };
        }
    };
}

module.exports = {
    createTableOrdersService,
    normalizeItems
};
