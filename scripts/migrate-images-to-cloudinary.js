/**
 * Migrate local product images to Cloudinary and rewrite products.image URLs.
 *
 * Usage:
 *   node scripts/migrate-images-to-cloudinary.js           # apply
 *   node scripts/migrate-images-to-cloudinary.js --dry-run # preview only
 *   node scripts/migrate-images-to-cloudinary.js --limit=5
 *
 * Requires CLOUDINARY_* + DB_* in .env (see .env.example).
 */
require("dotenv").config();

const fs = require("node:fs/promises");
const path = require("node:path");
const mysql = require("mysql2/promise");
const { v2: cloudinary } = require("cloudinary");

const ROOT = path.resolve(__dirname, "..");
const FRONTEND_ROOT = path.join(ROOT, "frontend");
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = (() => {
    const arg = process.argv.find((item) => item.startsWith("--limit="));
    return arg ? Math.max(1, Number(arg.split("=")[1]) || 0) : 0;
})();

function requiredEnv(name) {
    const value = String(process.env[name] || "").trim();
    if (!value) {
        throw new Error(`Missing required env: ${name}`);
    }
    return value;
}

function parseCloudinaryConfig() {
    const url = String(process.env.CLOUDINARY_URL || "").trim();
    if (url) {
        const parsed = new URL(url);
        if (parsed.protocol !== "cloudinary:") {
            throw new Error("CLOUDINARY_URL must be cloudinary://API_KEY:API_SECRET@CLOUD_NAME");
        }
        return {
            cloud_name: parsed.hostname,
            api_key: decodeURIComponent(parsed.username),
            api_secret: decodeURIComponent(parsed.password),
            folder: process.env.CLOUDINARY_PRODUCT_FOLDER || "pos-glasses/products"
        };
    }

    return {
        cloud_name: requiredEnv("CLOUDINARY_CLOUD_NAME"),
        api_key: requiredEnv("CLOUDINARY_API_KEY"),
        api_secret: requiredEnv("CLOUDINARY_API_SECRET"),
        folder: process.env.CLOUDINARY_PRODUCT_FOLDER || "pos-glasses/products"
    };
}

function isRemoteUrl(value) {
    return /^https?:\/\//i.test(String(value || "").trim());
}

function isLocalImagePath(value) {
    const raw = String(value || "").trim().replace(/\\/g, "/");
    if (!raw || isRemoteUrl(raw) || raw.startsWith("data:")) return false;
    return raw.startsWith("images/") || raw.startsWith("/images/");
}

function resolveLocalFile(imagePath) {
    const relative = String(imagePath || "").trim().replace(/\\/g, "/").replace(/^\//, "");
    return path.join(FRONTEND_ROOT, relative);
}

function sanitizeSlug(value) {
    return String(value || "product")
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "product";
}

function publicIdForProduct(product, folder) {
    const base = path.basename(String(product.image || ""), path.extname(String(product.image || "")));
    const slug = sanitizeSlug(product.sku || base || `product-${product.id}`);
    // Stable public_id so re-runs overwrite instead of cluttering the cloud.
    return `${folder}/${slug}`;
}

async function uploadLocalImage(absolutePath, publicId) {
    return cloudinary.uploader.upload(absolutePath, {
        resource_type: "image",
        public_id: publicId,
        overwrite: true,
        unique_filename: false,
        invalidate: true,
        tags: ["pos-glasses", "product", "migrated"]
    });
}

async function main() {
    const cloudinaryConfig = parseCloudinaryConfig();
    cloudinary.config({
        cloud_name: cloudinaryConfig.cloud_name,
        api_key: cloudinaryConfig.api_key,
        api_secret: cloudinaryConfig.api_secret,
        secure: true
    });

    const connection = await mysql.createConnection({
        host: requiredEnv("DB_HOST"),
        port: Number(process.env.DB_PORT || 3306),
        user: requiredEnv("DB_USER"),
        password: process.env.DB_PASSWORD || "",
        database: requiredEnv("DB_NAME"),
        ssl: process.env.DB_SSL === "false" ? undefined : { rejectUnauthorized: false }
    });

    try {
        const [rows] = await connection.query(
            "SELECT id, sku, name, image FROM products ORDER BY id ASC"
        );

        const candidates = rows.filter((row) => isLocalImagePath(row.image));
        const selected = LIMIT > 0 ? candidates.slice(0, LIMIT) : candidates;

        console.log("Cloudinary:", {
            cloud_name: cloudinaryConfig.cloud_name,
            folder: cloudinaryConfig.folder,
            dryRun: DRY_RUN
        });
        console.log("Products:", {
            total: rows.length,
            localImages: candidates.length,
            migrating: selected.length,
            alreadyRemote: rows.filter((row) => isRemoteUrl(row.image)).length
        });

        const summary = {
            uploaded: 0,
            updated: 0,
            skippedMissingFile: 0,
            failed: 0,
            errors: []
        };

        for (const product of selected) {
            const absolutePath = resolveLocalFile(product.image);
            let exists = false;
            try {
                await fs.access(absolutePath);
                exists = true;
            } catch {
                exists = false;
            }

            if (!exists) {
                summary.skippedMissingFile += 1;
                console.warn(`[skip] #${product.id} ${product.sku} missing file: ${product.image}`);
                continue;
            }

            const publicId = publicIdForProduct(product, cloudinaryConfig.folder);
            console.log(`[upload] #${product.id} ${product.sku} <= ${product.image} => ${publicId}`);

            if (DRY_RUN) {
                summary.uploaded += 1;
                summary.updated += 1;
                continue;
            }

            try {
                const uploaded = await uploadLocalImage(absolutePath, publicId);
                const secureUrl = uploaded.secure_url;
                await connection.execute(
                    "UPDATE products SET image = ? WHERE id = ?",
                    [secureUrl, product.id]
                );
                summary.uploaded += 1;
                summary.updated += 1;
                console.log(`  -> ${secureUrl}`);
            } catch (error) {
                summary.failed += 1;
                summary.errors.push({
                    id: product.id,
                    sku: product.sku,
                    message: error.message
                });
                console.error(`  !! failed: ${error.message}`);
            }
        }

        console.log("\nDone:", summary);
        if (summary.failed > 0) {
            process.exitCode = 1;
        }
    } finally {
        await connection.end();
    }
}

main().catch((error) => {
    console.error("Migration failed:", error.message || error);
    process.exit(1);
});
