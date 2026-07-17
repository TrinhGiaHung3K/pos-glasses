/**
 * POS Glasses - Product image background pipeline (system-wide)
 *
 * Goal: when staff import / paste eyewear photos, produce a clean catalog
 * asset with studio-ready transparent subject and consistent framing.
 *
 * Pipeline:
 *  1. Load source (URL, File, data URL, HTMLImageElement)
 *  2. Downscale for processing (max edge)
 *  3. Edge flood-fill remove background (light studio / near-uniform)
 *  4. Soften fringe (semi-transparent edge cleanup)
 *  5. Fit subject into square canvas with padding
 *  6. Export PNG data URL (alpha)
 *
 * Display surfaces should use `.pos-product-media` CSS so transparent PNGs
 * and legacy JPEGs share the same soft studio backdrop.
 */
(function attachProductImageHelpers(window) {
    const DEFAULTS = {
        maxProcessEdge: 900,
        outputSize: 800,
        paddingRatio: 0.08,
        /** Color distance (0-441 approx for RGB Euclidean) */
        colorThreshold: 48,
        /** Luma threshold: pixels brighter than this near edges are bg candidates */
        lumaThreshold: 236,
        /** Second pass fringe cleanup radius */
        fringeBoost: 18,
        mimeType: "image/png",
        quality: 0.92
    };

    function mergeOptions(options) {
        return { ...DEFAULTS, ...(options || {}) };
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function colorDistance(r1, g1, b1, r2, g2, b2) {
        const dr = r1 - r2;
        const dg = g1 - g2;
        const db = b1 - b2;
        return Math.sqrt(dr * dr + dg * dg + db * db);
    }

    function luma(r, g, b) {
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    function loadImageElement(source) {
        return new Promise((resolve, reject) => {
            if (source instanceof HTMLImageElement) {
                if (source.complete && source.naturalWidth) {
                    resolve(source);
                    return;
                }
                source.onload = () => resolve(source);
                source.onerror = () => reject(new Error("Không tải được ảnh sản phẩm"));
                return;
            }

            const img = new Image();
            img.decoding = "async";

            const fail = () => reject(new Error("Không tải được ảnh sản phẩm"));

            if (source instanceof File || source instanceof Blob) {
                const url = URL.createObjectURL(source);
                img.onload = () => {
                    URL.revokeObjectURL(url);
                    resolve(img);
                };
                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    fail();
                };
                img.src = url;
                return;
            }

            const src = String(source || "").trim();
            if (!src) {
                reject(new Error("Thiếu nguồn ảnh sản phẩm"));
                return;
            }

            // Same-origin relative paths work without CORS; remote may taint canvas.
            if (/^https?:\/\//i.test(src) && !src.startsWith(window.location.origin)) {
                img.crossOrigin = "anonymous";
            }

            img.onload = () => resolve(img);
            img.onerror = fail;
            img.src = src;
        });
    }

    function createCanvas(width, height) {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(height));
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
            throw new Error("Trình duyệt không hỗ trợ canvas 2D");
        }
        return { canvas, ctx };
    }

    /**
     * Estimate studio background color from image border samples.
     */
    function sampleBackgroundColor(data, width, height) {
        const samples = [];
        const stepX = Math.max(1, Math.floor(width / 24));
        const stepY = Math.max(1, Math.floor(height / 24));

        function pushPixel(x, y) {
            const i = (y * width + x) * 4;
            samples.push([data[i], data[i + 1], data[i + 2]]);
        }

        for (let x = 0; x < width; x += stepX) {
            pushPixel(x, 0);
            pushPixel(x, height - 1);
        }
        for (let y = 0; y < height; y += stepY) {
            pushPixel(0, y);
            pushPixel(width - 1, y);
        }

        // Median-ish via sorted channel averages of the brightest half
        // (product photos usually sit on light paper / seamless).
        samples.sort((a, b) => luma(b[0], b[1], b[2]) - luma(a[0], a[1], a[2]));
        const take = samples.slice(0, Math.max(1, Math.floor(samples.length * 0.55)));
        let r = 0;
        let g = 0;
        let b = 0;
        take.forEach((pixel) => {
            r += pixel[0];
            g += pixel[1];
            b += pixel[2];
        });
        const n = take.length;
        return {
            r: Math.round(r / n),
            g: Math.round(g / n),
            b: Math.round(b / n)
        };
    }

    function isBackgroundPixel(r, g, b, bg, threshold, lumaThreshold) {
        const distance = colorDistance(r, g, b, bg.r, bg.g, bg.b);
        if (distance <= threshold) {
            return true;
        }
        // Bright near-white studio paper even if slightly off sampled bg
        const y = luma(r, g, b);
        if (y >= lumaThreshold && distance <= threshold + 28) {
            return true;
        }
        return false;
    }

    /**
     * Flood-fill transparency from all edge pixels that match background.
     * Avoids punching holes through light lenses when not edge-connected.
     */
    function removeBackgroundFlood(imageData, options) {
        const { width, height, data } = imageData;
        const bg = sampleBackgroundColor(data, width, height);
        const threshold = options.colorThreshold;
        const lumaThreshold = options.lumaThreshold;
        const visited = new Uint8Array(width * height);
        const queue = new Int32Array(width * height);
        let head = 0;
        let tail = 0;

        function enqueue(x, y) {
            const idx = y * width + x;
            if (visited[idx]) return;
            const i = idx * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (!isBackgroundPixel(r, g, b, bg, threshold, lumaThreshold)) {
                return;
            }
            visited[idx] = 1;
            queue[tail++] = idx;
        }

        for (let x = 0; x < width; x += 1) {
            enqueue(x, 0);
            enqueue(x, height - 1);
        }
        for (let y = 0; y < height; y += 1) {
            enqueue(0, y);
            enqueue(width - 1, y);
        }

        while (head < tail) {
            const idx = queue[head++];
            const x = idx % width;
            const y = (idx - x) / width;
            const i = idx * 4;
            data[i + 3] = 0;

            if (x > 0) enqueue(x - 1, y);
            if (x + 1 < width) enqueue(x + 1, y);
            if (y > 0) enqueue(x, y - 1);
            if (y + 1 < height) enqueue(x, y + 1);
        }

        // Fringe soften: lower alpha for near-bg pixels adjacent to transparent
        const copy = new Uint8ClampedArray(data);
        for (let y = 1; y < height - 1; y += 1) {
            for (let x = 1; x < width - 1; x += 1) {
                const idx = y * width + x;
                const i = idx * 4;
                if (copy[i + 3] === 0) continue;

                const r = copy[i];
                const g = copy[i + 1];
                const b = copy[i + 2];
                const dist = colorDistance(r, g, b, bg.r, bg.g, bg.b);
                if (dist > threshold + options.fringeBoost) continue;

                let transparentNeighbor = false;
                for (let oy = -1; oy <= 1 && !transparentNeighbor; oy += 1) {
                    for (let ox = -1; ox <= 1; ox += 1) {
                        if (ox === 0 && oy === 0) continue;
                        const ni = ((y + oy) * width + (x + ox)) * 4;
                        if (copy[ni + 3] === 0) {
                            transparentNeighbor = true;
                            break;
                        }
                    }
                }

                if (transparentNeighbor) {
                    const fade = clamp(1 - dist / (threshold + options.fringeBoost), 0, 1);
                    data[i + 3] = Math.round(copy[i + 3] * (1 - fade * 0.85));
                }
            }
        }

        return { imageData, background: bg };
    }

    /**
     * True when the image already has meaningful transparency
     * (e.g. previously processed PNG) — batch jobs can skip.
     */
    function hasSignificantTransparency(imageData, minRatio = 0.06) {
        const { data } = imageData;
        const total = data.length / 4;
        if (!total) return false;
        let transparent = 0;
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 248) transparent += 1;
        }
        return transparent / total >= minRatio;
    }

    function getOpaqueBounds(data, width, height) {
        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                const a = data[(y * width + x) * 4 + 3];
                if (a > 8) {
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }
        }

        if (maxX < minX || maxY < minY) {
            return null;
        }

        return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
    }

    function drawImageContained(ctx, img, width, height) {
        const scale = Math.min(width / img.naturalWidth || img.width, height / img.naturalHeight || img.height, 1);
        const w = (img.naturalWidth || img.width) * scale;
        const h = (img.naturalHeight || img.height) * scale;
        const x = (width - w) / 2;
        const y = (height - h) / 2;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, x, y, w, h);
    }

    /**
     * Process a product image source into a transparent PNG data URL.
     *
     * @param {string|File|Blob|HTMLImageElement} source
     * @param {object} [options]
     * @returns {Promise<{ dataUrl: string, width: number, height: number, background: object, skipped: boolean }>}
     */
    async function processProductImage(source, options = {}) {
        const opts = mergeOptions(options);
        const img = await loadImageElement(source);
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;

        if (!srcW || !srcH) {
            throw new Error("Ảnh không hợp lệ");
        }

        const scale = Math.min(1, opts.maxProcessEdge / Math.max(srcW, srcH));
        const procW = Math.max(1, Math.round(srcW * scale));
        const procH = Math.max(1, Math.round(srcH * scale));
        const { canvas, ctx } = createCanvas(procW, procH);

        ctx.drawImage(img, 0, 0, procW, procH);

        let imageData;
        try {
            imageData = ctx.getImageData(0, 0, procW, procH);
        } catch (error) {
            // Canvas tainted (cross-origin without CORS) — return original as-is path signal
            throw new Error(
                "Không xử lý được ảnh ngoài domain (CORS). Hãy tải ảnh về máy rồi chọn file local."
            );
        }

        // Already transparent PNG from a previous pass — only reframe unless forced
        if (!opts.force && hasSignificantTransparency(imageData)) {
            const bounds = getOpaqueBounds(imageData.data, procW, procH);
            const out = opts.outputSize;
            const { canvas: outCanvas, ctx: outCtx } = createCanvas(out, out);
            outCtx.clearRect(0, 0, out, out);
            if (bounds) {
                const pad = Math.round(out * opts.paddingRatio);
                const fit = out - pad * 2;
                const subjectScale = Math.min(fit / bounds.width, fit / bounds.height);
                const dw = bounds.width * subjectScale;
                const dh = bounds.height * subjectScale;
                const dx = (out - dw) / 2;
                const dy = (out - dh) / 2;
                outCtx.imageSmoothingEnabled = true;
                outCtx.imageSmoothingQuality = "high";
                outCtx.drawImage(
                    canvas,
                    bounds.minX,
                    bounds.minY,
                    bounds.width,
                    bounds.height,
                    dx,
                    dy,
                    dw,
                    dh
                );
            } else {
                drawImageContained(outCtx, img, out, out);
            }
            return {
                dataUrl: outCanvas.toDataURL(opts.mimeType, opts.quality),
                width: out,
                height: out,
                background: null,
                skipped: true,
                alreadyTransparent: true
            };
        }

        const { background } = removeBackgroundFlood(imageData, opts);
        ctx.putImageData(imageData, 0, 0);

        const bounds = getOpaqueBounds(imageData.data, procW, procH);
        const out = opts.outputSize;
        const { canvas: outCanvas, ctx: outCtx } = createCanvas(out, out);
        outCtx.clearRect(0, 0, out, out);

        if (!bounds) {
            // Entire image considered background — keep original contained (no wipe)
            drawImageContained(outCtx, img, out, out);
            return {
                dataUrl: outCanvas.toDataURL(opts.mimeType, opts.quality),
                width: out,
                height: out,
                background,
                skipped: true
            };
        }

        const pad = Math.round(out * opts.paddingRatio);
        const fit = out - pad * 2;
        const subjectScale = Math.min(fit / bounds.width, fit / bounds.height);
        const dw = bounds.width * subjectScale;
        const dh = bounds.height * subjectScale;
        const dx = (out - dw) / 2;
        const dy = (out - dh) / 2;

        outCtx.imageSmoothingEnabled = true;
        outCtx.imageSmoothingQuality = "high";
        outCtx.drawImage(
            canvas,
            bounds.minX,
            bounds.minY,
            bounds.width,
            bounds.height,
            dx,
            dy,
            dw,
            dh
        );

        return {
            dataUrl: outCanvas.toDataURL(opts.mimeType, opts.quality),
            width: out,
            height: out,
            background,
            skipped: false
        };
    }

    /**
     * Build HTML for a standardized product media surface.
     */
    function productMediaHtml(imageSrc, options = {}) {
        const alt = options.alt || "Sản phẩm";
        const fallback = options.fallback || "/assets/images/pos-glasses-optic-bridge-logo.png";
        const className = options.className ? ` ${options.className}` : "";
        const src = imageSrc || fallback;
        const escape = typeof window.escapeHtml === "function"
            ? window.escapeHtml
            : (value) => String(value ?? "")
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
                .replaceAll('"', "&quot;");

        return `
            <div class="pos-product-media${className}">
                <img
                    src="${escape(src)}"
                    alt="${escape(alt)}"
                    loading="${options.loading || "lazy"}"
                    onerror="this.onerror=null;this.src='${escape(fallback)}'">
            </div>
        `;
    }

    /**
     * Convert data URL → pure base64 payload for API upload.
     */
    function parseDataUrl(dataUrl) {
        const raw = String(dataUrl || "");
        const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (!match) {
            return null;
        }
        return {
            mimeType: match[1],
            base64: match[2]
        };
    }

    /**
     * Upload processed data URL then PATCH product image path.
     * Used by single-edit save and catalog-wide batch strip.
     */
    async function uploadAndAttachProductImage(apiRequest, product, dataUrl) {
        if (typeof apiRequest !== "function") {
            throw new Error("apiRequest chưa sẵn sàng");
        }
        const sku = product?.sku || "product";
        const id = Number(product?.id);
        const uploaded = await apiRequest("/products/image", {
            method: "POST",
            body: { dataUrl, sku }
        });
        const image = uploaded?.path || uploaded?.image;
        if (!image) {
            throw new Error("Máy chủ không trả về đường dẫn ảnh");
        }
        if (id) {
            await apiRequest(`/products/${id}/image`, {
                method: "PATCH",
                body: { image }
            });
        }
        return image;
    }

    window.POS_PRODUCT_IMAGE = {
        DEFAULTS,
        processProductImage,
        productMediaHtml,
        parseDataUrl,
        loadImageElement,
        sampleBackgroundColor,
        hasSignificantTransparency,
        uploadAndAttachProductImage
    };

    window.processProductImage = processProductImage;
    window.productMediaHtml = productMediaHtml;
    window.parseProductImageDataUrl = parseDataUrl;
    window.uploadAndAttachProductImage = uploadAndAttachProductImage;
})(window);
