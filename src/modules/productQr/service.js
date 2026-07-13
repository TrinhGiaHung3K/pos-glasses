const crypto = require("node:crypto");
const QRCode = require("qrcode");
const { createHttpError } = require("../../middleware/httpError");

function validCode(value) {
    const code = String(value || "").trim();
    return /^[A-Za-z0-9_-]{32,64}$/.test(code) ? code : null;
}

function createProductQrService(repository, options = {}) {
    const publicAppUrl = String(options.publicAppUrl || "http://localhost:3000").replace(/\/$/, "");
    async function present(record, product) {
        const url = `${publicAppUrl}/qr/product.html?code=${encodeURIComponent(record.public_code)}`;
        return { ...record, product, url, qr_data_url: await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, width: 320 }) };
    }
    return {
        async getOrCreate(productId, user) {
            const id = Number(productId);
            const product = await repository.findProduct(id);
            if (!product) throw createHttpError(404, "Sản phẩm không tồn tại");
            let record = await repository.findActiveByProduct(id);
            if (!record) {
                record = await repository.createCode({
                    product_id: id,
                    public_code: crypto.randomBytes(24).toString("base64url"),
                    version: 1,
                    created_by: user?.id
                });
            }
            return present(record, product);
        },
        async rotate(productId, user) {
            const id = Number(productId);
            const product = await repository.findProduct(id);
            if (!product) throw createHttpError(404, "Sản phẩm không tồn tại");
            const record = await repository.rotate(id, crypto.randomBytes(24).toString("base64url"), user?.id);
            return present(record, product);
        },
        async resolve(codeValue) {
            const code = validCode(codeValue);
            if (!code) throw createHttpError(404, "Không tìm thấy sản phẩm");
            const product = await repository.findPublicByCode(code);
            if (!product) throw createHttpError(404, "Không tìm thấy sản phẩm");
            return {
                name: product.name,
                brand: product.brand || null,
                sku: product.sku,
                image: product.image || null,
                price: Number(product.price),
                availability: Number(product.quantity) > 0 ? "in_stock" : "out_of_stock",
                public_code: product.public_code
            };
        },
        async resolveForStaff(codeValue) {
            const code = validCode(codeValue);
            if (!code) throw createHttpError(404, "Không tìm thấy sản phẩm");
            const product = await repository.findPublicByCode(code);
            if (!product) throw createHttpError(404, "Không tìm thấy sản phẩm");
            return {
                id: Number(product.id),
                name: product.name,
                sku: product.sku,
                price: Number(product.price),
                quantity: Number(product.quantity),
                public_code: product.public_code
            };
        }
    };
}

module.exports = { createProductQrService, validCode };
