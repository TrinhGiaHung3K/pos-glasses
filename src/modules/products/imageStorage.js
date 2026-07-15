const { v2: cloudinary } = require("cloudinary");

function parseCloudinaryUrl(value) {
    if (!value) return null;
    const parsed = new URL(String(value));
    if (parsed.protocol !== "cloudinary:") {
        throw new Error("CLOUDINARY_URL phải dùng định dạng cloudinary://API_KEY:API_SECRET@CLOUD_NAME");
    }
    return {
        cloud_name: parsed.hostname,
        api_key: decodeURIComponent(parsed.username),
        api_secret: decodeURIComponent(parsed.password)
    };
}

function createProductImageStorage(config = {}) {
    if (!config.enabled) return null;

    const fromUrl = parseCloudinaryUrl(config.url);
    const credentials = fromUrl || {
        cloud_name: config.cloudName,
        api_key: config.apiKey,
        api_secret: config.apiSecret
    };
    if (!credentials.cloud_name || !credentials.api_key || !credentials.api_secret) {
        throw new Error("Cloudinary đã bật nhưng chưa đủ cloud name, API key và API secret");
    }

    cloudinary.config({ ...credentials, secure: true });

    return {
        name: "cloudinary",
        async upload({ buffer, slug }) {
            const publicId = `${slug}-${Date.now()}`;
            const result = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream({
                    resource_type: "image",
                    folder: config.folder || "pos-glasses/products",
                    public_id: publicId,
                    overwrite: false,
                    unique_filename: false,
                    tags: ["pos-glasses", "product"]
                }, (error, uploaded) => {
                    if (error) reject(error);
                    else resolve(uploaded);
                });
                stream.end(buffer);
            });

            return {
                provider: "cloudinary",
                path: result.secure_url,
                publicId: result.public_id,
                bytes: Number(result.bytes || buffer.length),
                width: Number(result.width || 0),
                height: Number(result.height || 0),
                format: result.format || null
            };
        }
    };
}

module.exports = { createProductImageStorage, parseCloudinaryUrl };
