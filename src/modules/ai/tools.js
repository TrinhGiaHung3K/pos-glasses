const { createHttpError } = require("../../middleware/httpError");

const declarations = [
    {
        name: "search_products",
        description:
            "Tra cứu catalog sản phẩm kính mắt trong POS. Dùng cho mọi câu hỏi về sản phẩm, giá, SKU, thương hiệu, tồn kho. " +
            "Giá catalog theo products.price (thang nghìn đồng, khung ~1690–9490). " +
            "Với 'rẻ nhất/giá thấp nhất' đặt sort_by=price_asc và q rỗng (hoặc từ khóa hãng). " +
            "Với 'đắt nhất/giá cao nhất' đặt sort_by=price_desc. " +
            "Không bịa giá — chỉ dùng kết quả tool.",
        parameters: {
            type: "OBJECT",
            properties: {
                q: {
                    type: "STRING",
                    description: "Từ khóa tên/SKU/thương hiệu. Để trống khi xếp hạng toàn catalog (rẻ nhất/đắt nhất)."
                },
                min_price: {
                    type: "NUMBER",
                    description: "Giá tối thiểu theo thang nghìn đồng (vd 3 triệu ≈ 3000, không dùng 3000000)."
                },
                max_price: {
                    type: "NUMBER",
                    description: "Giá tối đa theo thang nghìn đồng (vd dưới 3 triệu → 3000)."
                },
                in_stock: {
                    type: "BOOLEAN",
                    description: "true = chỉ còn hàng; false = chỉ hết hàng; bỏ trống = mọi tồn."
                },
                sort_by: {
                    type: "STRING",
                    description: "price_asc | price_desc | name_asc | id_desc. Mặc định id_desc; ranking giá phải dùng price_asc/price_desc.",
                    enum: ["price_asc", "price_desc", "name_asc", "id_desc"]
                },
                limit: {
                    type: "INTEGER",
                    description: "Số dòng trả về (1-30). Ranking giá nên 5-10."
                }
            }
        }
    },
    {
        name: "get_customer_summary",
        description: "Lấy tóm tắt hội viên theo ID khi nhân viên đang phục vụ khách.",
        parameters: {
            type: "OBJECT",
            properties: { customer_id: { type: "INTEGER" } },
            required: ["customer_id"]
        }
    },
    {
        name: "get_sales_summary",
        description: "Lấy doanh thu và xu hướng tổng hợp; chỉ admin.",
        parameters: {
            type: "OBJECT",
            properties: {
                range: { type: "STRING", enum: ["today", "7d", "30d"] }
            }
        }
    },
    {
        name: "get_order_status",
        description: "Lấy trạng thái hóa đơn theo ID.",
        parameters: {
            type: "OBJECT",
            properties: { order_id: { type: "INTEGER" } },
            required: ["order_id"]
        }
    },
    {
        name: "get_inventory_alerts",
        description: "Lấy danh sách sản phẩm sắp hết để gợi ý nhập hàng.",
        parameters: {
            type: "OBJECT",
            properties: { threshold: { type: "INTEGER" } }
        }
    }
];

function normalizeSort(value) {
    const sort = String(value || "").toLowerCase().trim();
    if (["price_asc", "price", "asc", "cheapest", "lowest"].includes(sort)) return "price_asc";
    if (["price_desc", "desc", "expensive", "highest"].includes(sort)) return "price_desc";
    if (["name_asc", "name"].includes(sort)) return "name_asc";
    return "id_desc";
}

function mapProductRow(p) {
    const { commercialUnitPrice } = require("../products/pricing");
    return {
        id: p.id,
        name: p.name,
        brand: p.brand,
        sku: p.sku,
        price: commercialUnitPrice(p),
        quantity: Number(p.quantity)
    };
}

function createAiTools(services) {
    async function execute(name, args, user) {
        if (name === "search_products") {
            const sortBy = normalizeSort(args.sort_by);
            const isPriceRank = sortBy === "price_asc" || sortBy === "price_desc";
            const limit = Math.min(30, Math.max(1, Number(args.limit) || (isPriceRank ? 8 : 10)));

            let inStock;
            if (args.in_stock === true || args.in_stock === "1" || args.in_stock === "true") {
                inStock = "1";
            } else if (args.in_stock === false || args.in_stock === "0" || args.in_stock === "false") {
                inStock = "0";
            }

            const minPrice = args.min_price != null && args.min_price !== ""
                ? Number(args.min_price)
                : null;
            const maxPrice = args.max_price != null && args.max_price !== ""
                ? Number(args.max_price)
                : null;

            const result = await services.products.list({
                q: String(args.q || "").slice(0, 100),
                in_stock: inStock,
                min_price: Number.isFinite(minPrice) ? minPrice : undefined,
                max_price: Number.isFinite(maxPrice) ? maxPrice : undefined,
                sort: sortBy,
                limit,
                page: 1
            });

            const items = Array.isArray(result) ? result : result.items || [];
            return items.map(mapProductRow);
        }

        if (name === "get_customer_summary") {
            const summary = await services.customers.summary(Number(args.customer_id));
            const customer = summary.customer || {};
            return {
                customer: {
                    id: customer.id,
                    name: customer.name,
                    membership_tier: customer.membership_tier,
                    membership_status: customer.membership_status,
                    points_balance: Number(customer.points_balance || 0),
                    lifetime_spend: Number(customer.lifetime_spend || 0)
                },
                recent_orders: (summary.recent_orders || []).slice(0, 8),
                top_products: (summary.top_products || []).slice(0, 8)
            };
        }

        if (name === "get_sales_summary") {
            if (user.role !== "admin") throw createHttpError(403, "Chỉ admin được xem phân tích doanh thu");
            return services.dashboard.getSummary({ range: args.range || "7d" });
        }

        if (name === "get_order_status") {
            return services.orders.findDetailsById(Number(args.order_id));
        }

        if (name === "get_inventory_alerts") {
            if (user.role !== "admin") throw createHttpError(403, "Chỉ admin được xem cảnh báo nhập hàng");
            const result = await services.stock.findLowStock(Math.min(50, Math.max(0, Number(args.threshold) || 5)));
            return (Array.isArray(result) ? result : result.items || []).slice(0, 30)
                .map((item) => ({
                    id: item.id || item.product_id,
                    name: item.name,
                    sku: item.sku,
                    quantity: Number(item.quantity || 0)
                }));
        }

        throw createHttpError(400, "AI tool không hợp lệ");
    }

    return { declarations, execute };
}

module.exports = { createAiTools, declarations, normalizeSort };
