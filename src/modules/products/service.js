const fs = require("node:fs/promises");
const path = require("node:path");
const { createHttpError } = require("../../middleware/httpError");

// Matches products.price DECIMAL(12,2): up to 10 digits before decimal.
const MAX_PRODUCT_PRICE = 9999999999.99;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const PRODUCT_IMAGE_DIR = path.join(__dirname, "..", "..", "..", "frontend", "images", "products");
const ALLOWED_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

function normalizeProductName(value) {
    const name = String(value ?? "").trim();
    if (!name) {
        throw createHttpError(400, "Tên sản phẩm không được để trống");
    }
    return name;
}

function normalizeProductSku(value) {
    const sku = String(value ?? "").trim();
    if (!sku) {
        throw createHttpError(400, "Mã SKU không được để trống");
    }
    return sku;
}

/**
 * Normalize price for DECIMAL(12,2).
 * Accepts numbers or numeric strings like "2890000" / "2890000.00".
 * Rejects non-finite and out-of-range values before hitting MySQL.
 */
function normalizeProductPrice(value) {
    if (value == null || value === "") {
        throw createHttpError(400, "Giá bán không hợp lệ");
    }

    const price = typeof value === "number"
        ? value
        : Number(String(value).trim().replace(/,/g, ""));

    if (!Number.isFinite(price)) {
        throw createHttpError(400, "Giá bán không hợp lệ");
    }

    if (price < 0) {
        throw createHttpError(400, "Giá bán không được âm");
    }

    if (price > MAX_PRODUCT_PRICE) {
        throw createHttpError(
            400,
            `Giá bán vượt giới hạn cho phép (tối đa ${MAX_PRODUCT_PRICE.toLocaleString("vi-VN")})`
        );
    }

    // Store whole dong for POS glasses pricing consistency.
    return Math.round(price);
}

function normalizeProductQuantity(value) {
    const quantity = Number(value ?? 0);

    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isInteger(quantity)) {
        throw createHttpError(400, "Số lượng tồn kho phải là số nguyên không âm");
    }

    if (quantity > 1000000) {
        throw createHttpError(400, "Số lượng tồn kho vượt giới hạn cho phép");
    }

    return quantity;
}

function normalizeProductCost(value) {
    if (value == null || value === "") {
        return 0;
    }

    const cost = typeof value === "number"
        ? value
        : Number(String(value).trim().replace(/,/g, ""));

    if (!Number.isFinite(cost) || cost < 0) {
        throw createHttpError(400, "Giá vốn không hợp lệ");
    }

    if (cost > MAX_PRODUCT_PRICE) {
        throw createHttpError(400, "Giá vốn vượt giới hạn cho phép");
    }

    return Math.round(cost);
}

function normalizeBrand(value, productName) {
    if (value != null && String(value).trim()) {
        return String(value).trim().slice(0, 80);
    }
    // Derive brand from first word of name when omitted
    const first = String(productName || "").trim().split(/\s+/)[0] || null;
    return first ? first.slice(0, 80) : null;
}

function normalizeProductPayload(payload = {}) {
    const name = normalizeProductName(payload.name);
    return {
        category_id: Number(payload.category_id || 1) || 1,
        name,
        brand: normalizeBrand(payload.brand, name),
        sku: normalizeProductSku(payload.sku),
        price: normalizeProductPrice(payload.price),
        cost_price: normalizeProductCost(payload.cost_price),
        quantity: normalizeProductQuantity(payload.quantity),
        image: payload.image ? String(payload.image).trim() || null : null
    };
}

function sanitizeImageSlug(value) {
    const raw = String(value || "product")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);

    return raw || "product";
}

function extensionForMime(mimeType) {
    if (mimeType === "image/jpeg") return "jpg";
    if (mimeType === "image/webp") return "webp";
    return "png";
}

function parseImageDataUrl(dataUrl) {
    const raw = String(dataUrl || "").trim();
    const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);

    if (!match) {
        throw createHttpError(400, "Ảnh sản phẩm không đúng định dạng data URL");
    }

    const mimeType = match[1].toLowerCase();
    if (!ALLOWED_IMAGE_MIME.has(mimeType)) {
        throw createHttpError(400, "Chỉ hỗ trợ PNG, JPEG hoặc WebP");
    }

    const buffer = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
    if (!buffer.length) {
        throw createHttpError(400, "Dữ liệu ảnh rỗng");
    }

    if (buffer.length > MAX_IMAGE_BYTES) {
        throw createHttpError(400, "Ảnh vượt quá dung lượng cho phép (8MB)");
    }

    return { mimeType, buffer };
}

async function ensureProductImageDir() {
    await fs.mkdir(PRODUCT_IMAGE_DIR, { recursive: true });
}

/**
 * Persist a client-processed product image (transparent PNG preferred).
 * Returns a web path under /images/products suitable for products.image.
 */
async function saveProcessedProductImage(payload = {}, imageStorage = null) {
    const dataUrl = payload.dataUrl || payload.data_url || payload.image;
    const { mimeType, buffer } = parseImageDataUrl(dataUrl);
    const slug = sanitizeImageSlug(payload.sku || payload.filename || "product");
    const ext = extensionForMime(mimeType);
    const filename = `${slug}-${Date.now()}.${ext}`;

    if (imageStorage?.upload) {
        try {
            const uploaded = await imageStorage.upload({ buffer, mimeType, slug, filename });
            return {
                message: "Đã tải ảnh sản phẩm lên Cloudinary",
                path: uploaded.path,
                image: uploaded.path,
                provider: uploaded.provider || imageStorage.name || "cloudinary",
                public_id: uploaded.publicId || null,
                mimeType,
                bytes: uploaded.bytes || buffer.length,
                width: uploaded.width || null,
                height: uploaded.height || null
            };
        } catch (error) {
            throw createHttpError(502, `Không thể tải ảnh lên Cloudinary: ${error.message}`);
        }
    }

    await ensureProductImageDir();
    const absolutePath = path.join(PRODUCT_IMAGE_DIR, filename);
    await fs.writeFile(absolutePath, buffer);

    const publicPath = `images/products/${filename}`;
    return {
        message: "Đã lưu ảnh sản phẩm",
        path: publicPath,
        image: publicPath,
        provider: "local",
        mimeType,
        bytes: buffer.length
    };
}

function createProductsService(repository, options = {}) {
    const auditService = options.auditService || null;
    const imageStorage = options.imageStorage || null;

    async function writeAudit(entry) {
        if (!auditService?.log) return;
        try { await auditService.log(entry); } catch { /* ignore */ }
    }

    return {
        findAll() {
            return repository.findAll();
        },

        async list(query = {}) {
            const { parseListQuery, listResponse } = require("../../utils/pagination");
            const pageInfo = parseListQuery(query);
            const minPrice = query.min_price != null && query.min_price !== ""
                ? Number(query.min_price)
                : null;
            const maxPrice = query.max_price != null && query.max_price !== ""
                ? Number(query.max_price)
                : null;
            const result = await repository.findFiltered({
                q: query.q ? String(query.q).trim() : "",
                category_id: query.category_id ? Number(query.category_id) : null,
                brand: query.brand ? String(query.brand).trim() : "",
                in_stock: query.in_stock,
                min_price: Number.isFinite(minPrice) ? minPrice : null,
                max_price: Number.isFinite(maxPrice) ? maxPrice : null,
                sort: query.sort || query.sort_by || "id_desc",
                page: pageInfo.page,
                limit: pageInfo.limit,
                offset: pageInfo.offset,
                paginate: pageInfo.paginate
            });
            return listResponse(result.items, {
                ...pageInfo,
                total: result.total
            });
        },

        async findById(id) {
            const product = await repository.findById(Number(id));

            if (!product) {
                throw createHttpError(404, "Product not found");
            }

            return product;
        },

        async create(payload, meta = {}) {
            const product = normalizeProductPayload(payload);
            const result = await repository.create(product);
            await writeAudit({
                actor_id: meta.actorId,
                action: "product.create",
                entity_type: "product",
                entity_id: result.insertId,
                payload: { sku: product.sku, name: product.name },
                ip: meta.ip
            });
            return {
                message: "Product added successfully",
                id: result.insertId
            };
        },

        async update(id, payload, meta = {}) {
            const product = normalizeProductPayload(payload);
            await repository.update(Number(id), product);
            await writeAudit({
                actor_id: meta.actorId,
                action: "product.update",
                entity_type: "product",
                entity_id: Number(id),
                payload: { sku: product.sku },
                ip: meta.ip
            });
            return {
                message: "Product updated successfully"
            };
        },

        async remove(id, meta = {}) {
            await repository.remove(Number(id));
            await writeAudit({
                actor_id: meta.actorId,
                action: "product.delete",
                entity_type: "product",
                entity_id: Number(id),
                payload: {},
                ip: meta.ip
            });

            return {
                message: "Product deleted successfully"
            };
        },

        saveProcessedImage(payload) {
            return saveProcessedProductImage(payload, imageStorage);
        },

        /**
         * Update only the image path (after client-side background removal upload).
         */
        async updateImage(id, payload = {}, meta = {}) {
            const productId = Number(id);
            const existing = await repository.findById(productId);
            if (!existing) {
                throw createHttpError(404, "Product not found");
            }

            const image = payload.image != null
                ? String(payload.image).trim() || null
                : null;
            if (!image) {
                throw createHttpError(400, "Thiếu đường dẫn ảnh");
            }
            if (image.length > 255) {
                throw createHttpError(400, "Đường dẫn ảnh quá dài");
            }

            await repository.updateImage(productId, image);
            await writeAudit({
                actor_id: meta.actorId,
                action: "product.image_update",
                entity_type: "product",
                entity_id: productId,
                payload: { image, previous: existing.image || null },
                ip: meta.ip
            });

            return {
                message: "Đã cập nhật ảnh sản phẩm",
                id: productId,
                image
            };
        }
    };
}

module.exports = {
    createProductsService,
    saveProcessedProductImage,
    parseImageDataUrl,
    sanitizeImageSlug
};
