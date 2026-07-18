/**
 * POS Glasses promotion policy.
 *
 * Context constraints (eyewear retail POS):
 * - Catalog uses products.price in nghìn đồng (roughly 1.690–9.490 per frame)
 * - Staff manual discount cap tops at Platinum 8% (coupon may exceed, but not absurd)
 * - Coupon input shares the counter with SKU / EAN-13 member scan (prefix 29)
 * - Avoid free-order / unlimited mega-discounts that break margin discipline
 */

const { createHttpError } = require("../../middleware/httpError");

/** Lowest meaningful catalog band used for min-order floors (nghìn đồng). */
const CATALOG_MIN_PRICE_BAND = 1_500;

/** Staff ladder peak (Platinum) — coupons may go higher for campaigns. */
const STAFF_MAX_DISCOUNT_PERCENT = 8;

const POS_PROMO_POLICY = Object.freeze({
    code: Object.freeze({
        minLength: 3,
        maxLength: 20,
        /** Must start with a letter; avoids pure barcodes / phone-like digits. */
        pattern: /^[A-Z][A-Z0-9_-]{2,19}$/
    }),
    percent: Object.freeze({
        min: 1,
        max: 30,
        /** Above this, require min_order + finite max_uses. */
        elevated: 15,
        /** Above this, require description + stricter max_uses. */
        aggressive: 20
    }),
    amount: Object.freeze({
        min: 50,
        max: 2_000,
        step: 1,
        elevated: 500,
        aggressive: 1_000
    }),
    minOrder: Object.freeze({
        max: 50_000,
        /** Floor when elevated discount requires min order. */
        requiredFloor: CATALOG_MIN_PRICE_BAND,
        /** Amount discount must leave at least this share of min_order. */
        maxAmountShareOfMinOrder: 0.5
    }),
    maxUses: Object.freeze({
        min: 1,
        max: 5_000,
        elevatedMax: 1_000,
        aggressiveMax: 300
    }),
    dates: Object.freeze({
        maxSpanDays: 180,
        maxFutureStartDays: 90,
        maxPastStartDays: 7
    }),
    description: Object.freeze({
        minLengthWhenRequired: 8,
        maxLength: 255
    }),
    /** Codes that look like jokes, exploits, or confuse POS scanners. */
    blockedCodes: Object.freeze([
        "FREE",
        "FREE100",
        "100OFF",
        "0DONG",
        "ZERO",
        "ADMIN",
        "ROOT",
        "TEST",
        "TEST1",
        "DEMO",
        "NULL",
        "UNDEFINED",
        "HACK",
        "ALLFREE",
        "VIP100",
        "SALE100"
    ]),
    catalogMinPriceBand: CATALOG_MIN_PRICE_BAND,
    staffMaxDiscountPercent: STAFF_MAX_DISCOUNT_PERCENT
});

const BLOCKED_CODE_SET = new Set(POS_PROMO_POLICY.blockedCodes);

function dayMs() {
    return 24 * 60 * 60 * 1000;
}

function parseYmd(value) {
    if (value == null || value === "") {
        return null;
    }
    const raw = String(value).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return null;
    }
    const date = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date;
}

function todayStart(now = new Date()) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function toYmd(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Public rules payload for admin UI.
 */
function getPromotionPolicyPublic() {
    return {
        ...POS_PROMO_POLICY,
        blockedCodes: [...POS_PROMO_POLICY.blockedCodes],
        notes: [
            "Mã phải bắt đầu bằng chữ cái, không trùng barcode hội viên (29…) hay SKU số thuần.",
            `Giảm % tối đa ${POS_PROMO_POLICY.percent.max}% (cao hơn cap tay NV Platinum ${STAFF_MAX_DISCOUNT_PERCENT}%).`,
            `Giảm tiền ${POS_PROMO_POLICY.amount.min.toLocaleString("vi-VN")}–${POS_PROMO_POLICY.amount.max.toLocaleString("vi-VN")}đ (thang nghìn đồng catalog).`,
            `Giảm mạnh (≥${POS_PROMO_POLICY.percent.elevated}% hoặc ≥${POS_PROMO_POLICY.amount.elevated.toLocaleString("vi-VN")}đ) bắt buộc đơn tối thiểu ≥ ${CATALOG_MIN_PRICE_BAND.toLocaleString("vi-VN")}đ.`,
            "Bắt buộc khung ngày; tối đa 180 ngày/campaign.",
            "Mã giảm mạnh bắt buộc giới hạn lượt dùng và mô tả chiến dịch."
        ],
        templates: [
            {
                id: "sale10",
                label: "SALE10",
                description: "Giảm 10% đơn từ 1.500đ",
                payload: {
                    code: "SALE10",
                    discount_type: "percent",
                    discount_value: 10,
                    min_order_amount: CATALOG_MIN_PRICE_BAND,
                    max_uses: 200,
                    description: "Giảm 10% cho đơn kính từ 1.500đ"
                }
            },
            {
                id: "summer15",
                label: "SUMMER15",
                description: "Giảm 15% hè",
                payload: {
                    code: "SUMMER15",
                    discount_type: "percent",
                    discount_value: 15,
                    min_order_amount: 2_000,
                    max_uses: 150,
                    description: "Khuyến mãi hè giảm 15% đơn từ 2.000đ"
                }
            },
            {
                id: "vip20",
                label: "VIP20",
                description: "Giảm 20% VIP",
                payload: {
                    code: "VIP20",
                    discount_type: "percent",
                    discount_value: 20,
                    min_order_amount: 3_000,
                    max_uses: 80,
                    description: "Ưu đãi VIP giảm 20% đơn từ 3.000đ"
                }
            },
            {
                id: "fix200",
                label: "FIX200",
                description: "Trừ 200đ",
                payload: {
                    code: "FIX200",
                    discount_type: "amount",
                    discount_value: 200,
                    min_order_amount: CATALOG_MIN_PRICE_BAND,
                    max_uses: 300,
                    description: "Giảm cố định 200đ cho đơn từ 1.500đ"
                }
            },
            {
                id: "newmember",
                label: "NEWMEMBER",
                description: "Khách mới 100đ",
                payload: {
                    code: "NEWMEMBER",
                    discount_type: "amount",
                    discount_value: 100,
                    min_order_amount: CATALOG_MIN_PRICE_BAND,
                    max_uses: 500,
                    description: "Chào khách mới giảm 100đ"
                }
            }
        ]
    };
}

function assertPromoCode(code) {
    const policy = POS_PROMO_POLICY.code;
    if (!code || code.length < policy.minLength || code.length > policy.maxLength) {
        throw createHttpError(
            400,
            `Mã coupon phải từ ${policy.minLength}–${policy.maxLength} ký tự`
        );
    }
    if (!policy.pattern.test(code)) {
        throw createHttpError(
            400,
            "Mã phải bắt đầu bằng chữ cái, chỉ gồm A-Z 0-9 _ - (tránh trùng barcode/SKU số)"
        );
    }
    if (BLOCKED_CODE_SET.has(code)) {
        throw createHttpError(400, `Mã "${code}" bị chặn vì không phù hợp vận hành POS Glasses`);
    }
    // Member EAN-13 internal codes start with 29 and are 13 digits — block digit-heavy lookalikes
    if (/^29\d{11}$/.test(code) || /^\d{8,}$/.test(code)) {
        throw createHttpError(400, "Mã không được giống barcode hội viên/sản phẩm dạng số dài");
    }
    // Confusable with all-free campaigns
    if (/(FREE|100OFF|0DONG|ALLFREE)/.test(code)) {
        throw createHttpError(400, "Mã gợi ý miễn phí / 100% off không được phép");
    }
    return code;
}

/**
 * Validate business rules after basic field parsing.
 * Mutates nothing; throws HTTP 400 with Vietnamese messages.
 *
 * @param {object} promo - normalized promo fields
 * @param {{ isCreate?: boolean, now?: Date }} options
 */
function enforcePromotionPolicy(promo, options = {}) {
    const now = options.now || new Date();
    const today = todayStart(now);
    const isCreate = options.isCreate !== false;

    assertPromoCode(promo.code);

    const type = promo.discount_type;
    const value = Number(promo.discount_value);

    if (type === "percent") {
        if (!Number.isInteger(value) || value < POS_PROMO_POLICY.percent.min) {
            throw createHttpError(
                400,
                `Phần trăm giảm tối thiểu ${POS_PROMO_POLICY.percent.min}%`
            );
        }
        if (value > POS_PROMO_POLICY.percent.max) {
            throw createHttpError(
                400,
                `POS Glasses chỉ cho phép coupon tối đa ${POS_PROMO_POLICY.percent.max}% (tránh đốt margin kính cao cấp)`
            );
        }
    } else if (type === "amount") {
        if (value < POS_PROMO_POLICY.amount.min) {
            throw createHttpError(
                400,
                `Giảm tiền tối thiểu ${POS_PROMO_POLICY.amount.min.toLocaleString("vi-VN")}đ (quá nhỏ so với giá kính)`
            );
        }
        if (value > POS_PROMO_POLICY.amount.max) {
            throw createHttpError(
                400,
                `Giảm tiền tối đa ${POS_PROMO_POLICY.amount.max.toLocaleString("vi-VN")}đ mỗi đơn`
            );
        }
        if (value % POS_PROMO_POLICY.amount.step !== 0) {
            throw createHttpError(400, "Số tiền giảm không hợp lệ");
        }
    }

    const minOrder = Number(promo.min_order_amount || 0);
    if (minOrder < 0 || minOrder > POS_PROMO_POLICY.minOrder.max) {
        throw createHttpError(400, "Đơn tối thiểu không hợp lệ");
    }
    if (minOrder > 0 && !Number.isInteger(minOrder)) {
        throw createHttpError(400, "Đơn tối thiểu phải là số nguyên");
    }

    const elevated =
        (type === "percent" && value >= POS_PROMO_POLICY.percent.elevated)
        || (type === "amount" && value >= POS_PROMO_POLICY.amount.elevated);
    const aggressive =
        (type === "percent" && value >= POS_PROMO_POLICY.percent.aggressive)
        || (type === "amount" && value >= POS_PROMO_POLICY.amount.aggressive);

    if (elevated) {
        if (minOrder < POS_PROMO_POLICY.minOrder.requiredFloor) {
            throw createHttpError(
                400,
                `Giảm mạnh cần đơn tối thiểu ≥ ${POS_PROMO_POLICY.minOrder.requiredFloor.toLocaleString("vi-VN")}đ (mức giá kính thấp nhất cửa hàng)`
            );
        }
    }

    if (type === "amount" && minOrder > 0) {
        const maxShare = POS_PROMO_POLICY.minOrder.maxAmountShareOfMinOrder;
        if (value > Math.round(minOrder * maxShare)) {
            throw createHttpError(
                400,
                `Giảm tiền không được vượt ${Math.round(maxShare * 100)}% đơn tối thiểu (tránh đơn 0đ)`
            );
        }
    }

    // max_uses
    let maxUses = promo.max_uses;
    if (maxUses != null) {
        if (!Number.isInteger(maxUses) || maxUses < POS_PROMO_POLICY.maxUses.min) {
            throw createHttpError(400, "Số lượt dùng tối đa không hợp lệ");
        }
        const hardMax = aggressive
            ? POS_PROMO_POLICY.maxUses.aggressiveMax
            : elevated
                ? POS_PROMO_POLICY.maxUses.elevatedMax
                : POS_PROMO_POLICY.maxUses.max;
        if (maxUses > hardMax) {
            throw createHttpError(
                400,
                `Với mức giảm này, max lượt dùng là ${hardMax.toLocaleString("vi-VN")}`
            );
        }
    } else if (elevated) {
        throw createHttpError(
            400,
            "Giảm mạnh bắt buộc giới hạn số lượt dùng (không cho unlimited)"
        );
    }

    // dates required
    if (!promo.start_date || !promo.end_date) {
        throw createHttpError(
            400,
            "Campaign phải có ngày bắt đầu và kết thúc (bắt buộc cho POS Glasses)"
        );
    }

    const start = parseYmd(promo.start_date);
    const end = parseYmd(promo.end_date);
    if (!start || !end) {
        throw createHttpError(400, "Ngày campaign không hợp lệ (YYYY-MM-DD)");
    }
    if (end < start) {
        throw createHttpError(400, "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu");
    }

    const spanDays = Math.round((end - start) / dayMs()) + 1;
    if (spanDays > POS_PROMO_POLICY.dates.maxSpanDays) {
        throw createHttpError(
            400,
            `Khung campaign tối đa ${POS_PROMO_POLICY.dates.maxSpanDays} ngày`
        );
    }

    const earliestStart = addDays(today, -POS_PROMO_POLICY.dates.maxPastStartDays);
    const latestStart = addDays(today, POS_PROMO_POLICY.dates.maxFutureStartDays);

    if (isCreate && start < earliestStart) {
        throw createHttpError(
            400,
            `Ngày bắt đầu không được trước hôm nay quá ${POS_PROMO_POLICY.dates.maxPastStartDays} ngày`
        );
    }
    if (start > latestStart) {
        throw createHttpError(
            400,
            `Ngày bắt đầu không được lên lịch quá ${POS_PROMO_POLICY.dates.maxFutureStartDays} ngày`
        );
    }

    // Active campaigns cannot end in the past
    if (Number(promo.is_active) === 1 && end < today) {
        throw createHttpError(
            400,
            "Không thể bật mã đã hết hạn — hãy gia hạn end_date hoặc để tắt"
        );
    }

    // description
    const desc = promo.description ? String(promo.description).trim() : "";
    if (aggressive) {
        if (desc.length < POS_PROMO_POLICY.description.minLengthWhenRequired) {
            throw createHttpError(
                400,
                "Giảm mạnh cần mô tả chiến dịch (tối thiểu 8 ký tự) để audit"
            );
        }
    }
    if (desc.length > POS_PROMO_POLICY.description.maxLength) {
        throw createHttpError(400, "Mô tả tối đa 255 ký tự");
    }

    return true;
}

/**
 * Sensible defaults for admin create form.
 */
function buildDefaultCreateDraft(now = new Date()) {
    const start = todayStart(now);
    const end = addDays(start, 30);
    return {
        code: "",
        discount_type: "percent",
        discount_value: 10,
        min_order_amount: CATALOG_MIN_PRICE_BAND,
        max_uses: 100,
        start_date: toYmd(start),
        end_date: toYmd(end),
        description: "",
        is_active: 1
    };
}

module.exports = {
    POS_PROMO_POLICY,
    getPromotionPolicyPublic,
    enforcePromotionPolicy,
    assertPromoCode,
    buildDefaultCreateDraft,
    CATALOG_MIN_PRICE_BAND
};
