/**
 * POS Glasses - System SKU standard
 *
 * Canonical format: {BRAND}{SEQ}
 *   - BRAND: 2 uppercase letters (RB, OK, GG, ...)
 *   - SEQ:   3 zero-padded digits (001, 002, ...)
 *   - Example: RB014, OK008, GM003
 *
 * Special case: if product name already contains a manufacturer model
 * code (RB3025, GG0396S, VE4361, FT0906, PO0714, ...), prefer that
 * normalized code when it is unique in catalog.
 */
(function attachSkuHelpers(window) {
    const BRAND_PREFIXES = [
        { match: ["rayban", "ray-ban", "ray ban"], code: "RB", label: "RayBan" },
        { match: ["oakley"], code: "OK", label: "Oakley" },
        { match: ["gucci"], code: "GG", label: "Gucci" },
        { match: ["prada"], code: "PR", label: "Prada" },
        { match: ["dior"], code: "DR", label: "Dior" },
        { match: ["versace"], code: "VS", label: "Versace" },
        { match: ["tom ford", "tomford"], code: "TF", label: "Tom Ford" },
        { match: ["police"], code: "PL", label: "Police" },
        { match: ["moscot"], code: "MS", label: "Moscot" },
        { match: ["persol"], code: "PS", label: "Persol" },
        { match: ["gentle monster", "gentlemonster"], code: "GM", label: "Gentle Monster" }
    ];

    /** Fallback brand code for unknown / unbranded frames */
    const GENERIC_BRAND_CODE = "PG"; // POS Glasses

    /** Standard sequential width */
    const SEQ_WIDTH = 3;

    /**
     * Model-like tokens often embedded in eyewear names.
     * Examples: RB3025, RB4171, GG0396S, VE4361, FT0237, PO0714, SPL872, PR17WS
     */
    const MODEL_CODE_PATTERN = /\b([A-Z]{1,3}\d{2,5}[A-Z]{0,3})\b/gi;

    function normalizeKey(value) {
        return String(value || "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    function normalizeSku(value) {
        return String(value || "")
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
    }

    function getBrandFromName(name) {
        const key = normalizeKey(name);
        const found = BRAND_PREFIXES.find((brand) =>
            brand.match.some((token) => key.includes(token))
        );
        return found || { code: GENERIC_BRAND_CODE, label: "Khác", match: [] };
    }

    function getBrandCode(name) {
        return getBrandFromName(name).code;
    }

    /**
     * Extract the strongest manufacturer model code from a product name.
     * Prefers longer alphanumerics that look like frame model IDs.
     */
    function extractModelCode(name) {
        const text = String(name || "").toUpperCase();
        const matches = text.match(MODEL_CODE_PATTERN) || [];
        if (!matches.length) {
            return "";
        }

        // Prefer codes with both letters and digits, longer first.
        const ranked = matches
            .map((code) => normalizeSku(code))
            .filter((code) => /[A-Z]/.test(code) && /\d/.test(code) && code.length >= 4)
            .sort((a, b) => b.length - a.length || a.localeCompare(b));

        return ranked[0] || "";
    }

    function isSkuTaken(sku, existingSkus, excludeSku = "") {
        const target = normalizeSku(sku);
        const exclude = normalizeSku(excludeSku);
        if (!target) return false;

        return existingSkus.some((item) => {
            const current = normalizeSku(item);
            return current && current === target && current !== exclude;
        });
    }

    /**
     * Collect next free sequence for a brand prefix among existing SKUs.
     * Recognizes both modern PREFIX### and legacy PREFIX# / PREFIX## forms.
     */
    function nextSequenceForPrefix(prefix, existingSkus) {
        const code = normalizeSku(prefix);
        const pattern = new RegExp(`^${code}(\\d{1,4})$`, "i");
        let max = 0;

        existingSkus.forEach((sku) => {
            const normalized = normalizeSku(sku);
            const match = normalized.match(pattern);
            if (match) {
                max = Math.max(max, Number(match[1]) || 0);
            }
        });

        return max + 1;
    }

    function formatSequentialSku(prefix, sequence) {
        const code = normalizeSku(prefix) || GENERIC_BRAND_CODE;
        const seq = Math.max(1, Number(sequence) || 1);
        return `${code}${String(seq).padStart(SEQ_WIDTH, "0")}`;
    }

    /**
     * Build a unique sequential SKU for a brand prefix.
     */
    function buildSequentialSku(prefix, existingSkus, excludeSku = "") {
        let seq = nextSequenceForPrefix(prefix, existingSkus);
        let candidate = formatSequentialSku(prefix, seq);

        // Extremely defensive uniqueness loop (handles legacy gaps / collisions).
        let guard = 0;
        while (isSkuTaken(candidate, existingSkus, excludeSku) && guard < 9999) {
            seq += 1;
            candidate = formatSequentialSku(prefix, seq);
            guard += 1;
        }

        return candidate;
    }

    /**
     * Suggest a system-standard SKU.
     *
     * @param {object} options
     * @param {string} options.name - Product name
     * @param {string[]|Array<{sku?: string}>} [options.existing] - Existing SKUs or products
     * @param {string} [options.excludeSku] - SKU to ignore (edit mode)
     * @returns {{ sku: string, source: "model"|"sequential", brandCode: string, brandLabel: string, reason: string }}
     */
    function suggestProductSku(options = {}) {
        const name = String(options.name || "").trim();
        const excludeSku = options.excludeSku || "";
        const existingList = Array.isArray(options.existing) ? options.existing : [];
        const existingSkus = existingList.map((item) =>
            typeof item === "string" ? item : item?.sku
        ).filter(Boolean);

        const brand = getBrandFromName(name);
        const modelCode = extractModelCode(name);

        if (modelCode && !isSkuTaken(modelCode, existingSkus, excludeSku)) {
            return {
                sku: modelCode,
                source: "model",
                brandCode: brand.code,
                brandLabel: brand.label,
                reason: `Lấy mã model từ tên sản phẩm (${modelCode}).`
            };
        }

        // Model code taken or missing → brand sequential standard.
        const sku = buildSequentialSku(brand.code, existingSkus, excludeSku);
        return {
            sku,
            source: "sequential",
            brandCode: brand.code,
            brandLabel: brand.label,
            reason: modelCode
                ? `Mã model ${modelCode} đã tồn tại. Dùng chuẩn ${brand.code} + số thứ tự.`
                : `Chuẩn hệ thống: ${brand.code} + số thứ tự 3 chữ số.`
        };
    }

    /**
     * Validate SKU against system rules (soft guidance, not blocking legacy codes).
     * Modern standard: 2-letter brand + 3 digits, OR manufacturer model code.
     */
    function validateSkuFormat(sku) {
        const normalized = normalizeSku(sku);
        if (!normalized) {
            return { ok: false, message: "SKU không được để trống." };
        }
        if (normalized.length < 3 || normalized.length > 20) {
            return { ok: false, message: "SKU nên dài từ 3 đến 20 ký tự." };
        }
        if (!/^[A-Z0-9]+$/.test(normalized)) {
            return { ok: false, message: "SKU chỉ gồm chữ in hoa và số (A-Z, 0-9)." };
        }

        const isStandardSeq = /^[A-Z]{2}\d{3}$/.test(normalized);
        const isModelLike = /^[A-Z]{1,3}\d{2,5}[A-Z]{0,3}$/.test(normalized);

        if (!isStandardSeq && !isModelLike) {
            return {
                ok: true,
                warning: "SKU không theo chuẩn BRAND+### (VD: RB014). Nên dùng gợi ý hệ thống.",
                normalized
            };
        }

        return { ok: true, normalized };
    }

    function listBrandPrefixes() {
        return BRAND_PREFIXES.map((item) => ({
            code: item.code,
            label: item.label
        })).concat([{ code: GENERIC_BRAND_CODE, label: "Khác / POS Glasses" }]);
    }

    window.POS_SKU = {
        BRAND_PREFIXES,
        GENERIC_BRAND_CODE,
        SEQ_WIDTH,
        normalizeSku,
        getBrandFromName,
        getBrandCode,
        extractModelCode,
        isSkuTaken,
        nextSequenceForPrefix,
        buildSequentialSku,
        suggestProductSku,
        validateSkuFormat,
        listBrandPrefixes
    };

    // Flat exports for convenience
    window.suggestProductSku = suggestProductSku;
    window.normalizeSku = normalizeSku;
    window.validateSkuFormat = validateSkuFormat;
})(window);
