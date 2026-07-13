const { createHttpError } = require("../../middleware/httpError");
const { isPromotionCurrentlyValid, resolvePromotionDiscount } = require("../orders/service");
const {
    resolvePromotionLifecycle,
    lifecycleLabel,
    remainingUses,
    usageProgressPercent
} = require("./lifecycle");
const {
    enforcePromotionPolicy,
    getPromotionPolicyPublic,
    buildDefaultCreateDraft,
    POS_PROMO_POLICY
} = require("./policy");

const DISCOUNT_TYPES = new Set(["percent", "amount"]);

function normalizeCode(value) {
    const code = String(value || "").trim().toUpperCase();
    // Length/charset enforced again in enforcePromotionPolicy / assertPromoCode
    if (!code) {
        throw createHttpError(400, "Mã khuyến mãi không được để trống");
    }
    return code;
}

function normalizeDate(value, label) {
    if (value == null || value === "") {
        return null;
    }
    const raw = String(value).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        throw createHttpError(400, `${label} không hợp lệ (YYYY-MM-DD)`);
    }
    return raw;
}

function normalizePromotionPayload(payload = {}) {
    const code = normalizeCode(payload.code);
    const discountType = String(payload.discount_type || "percent").trim().toLowerCase();

    if (!DISCOUNT_TYPES.has(discountType)) {
        throw createHttpError(400, "Loại giảm giá không hợp lệ");
    }

    const rawValue = Number(
        payload.discount_value != null && payload.discount_value !== ""
            ? payload.discount_value
            : payload.discount_percent
    );

    if (!Number.isFinite(rawValue) || rawValue <= 0) {
        throw createHttpError(400, "Giá trị giảm giá không hợp lệ");
    }

    // Hard bounds before policy (policy adds domain rules)
    if (discountType === "percent" && rawValue > POS_PROMO_POLICY.percent.max) {
        throw createHttpError(
            400,
            `Phần trăm giảm tối đa ${POS_PROMO_POLICY.percent.max}%`
        );
    }

    if (discountType === "amount" && rawValue > POS_PROMO_POLICY.amount.max) {
        throw createHttpError(
            400,
            `Số tiền giảm tối đa ${POS_PROMO_POLICY.amount.max.toLocaleString("vi-VN")}đ`
        );
    }

    const minOrder = Math.max(0, Math.round(Number(payload.min_order_amount || 0)));
    let maxUses = payload.max_uses;
    if (maxUses === "" || maxUses == null) {
        maxUses = null;
    } else {
        maxUses = Number(maxUses);
        if (!Number.isInteger(maxUses) || maxUses < 1) {
            throw createHttpError(400, "Số lượt dùng tối đa không hợp lệ");
        }
    }

    const startDate = normalizeDate(payload.start_date, "Ngày bắt đầu");
    const endDate = normalizeDate(payload.end_date, "Ngày kết thúc");

    if (startDate && endDate && startDate > endDate) {
        throw createHttpError(400, "Ngày kết thúc phải sau ngày bắt đầu");
    }

    const isActive = payload.is_active === false || payload.is_active === 0 || payload.is_active === "0"
        ? 0
        : 1;

    const discountPercent = discountType === "percent" ? Math.round(rawValue) : 0;
    const discountValue = Math.round(rawValue);

    const normalized = {
        code,
        discount_type: discountType,
        discount_percent: discountPercent,
        discount_value: discountValue,
        min_order_amount: minOrder,
        max_uses: maxUses,
        is_active: isActive,
        description: payload.description ? String(payload.description).trim().slice(0, 255) : null,
        start_date: startDate,
        end_date: endDate
    };

    enforcePromotionPolicy(normalized, {
        isCreate: payload.__isCreate !== false
    });

    return normalized;
}

/**
 * Full admin/list view — never throws for invalid window.
 */
function publicPromotionView(row, subtotal = 0) {
    if (!row) {
        return null;
    }

    const lifecycle = resolvePromotionLifecycle(row);
    const validity = isPromotionCurrentlyValid(row, subtotal);
    const resolved = validity.ok
        ? resolvePromotionDiscount(row, Math.max(0, Number(subtotal) || 0))
        : null;

    const discountType = String(row.discount_type || "percent").toLowerCase();
    const discountValue = Number(
        discountType === "percent"
            ? (row.discount_value > 0 ? row.discount_value : row.discount_percent)
            : row.discount_value
    ) || 0;

    return {
        id: row.id,
        code: row.code,
        discount_type: discountType,
        discount_percent: Number(row.discount_percent || 0),
        discount_value: discountValue,
        min_order_amount: Number(row.min_order_amount || 0),
        max_uses: row.max_uses != null ? Number(row.max_uses) : null,
        used_count: Number(row.used_count || 0),
        remaining_uses: remainingUses(row),
        usage_percent: usageProgressPercent(row),
        is_active: Number(row.is_active) === 1,
        description: row.description || null,
        start_date: row.start_date,
        end_date: row.end_date,
        lifecycle,
        lifecycle_label: lifecycleLabel(lifecycle),
        valid: validity.ok,
        message: validity.ok ? null : validity.message,
        estimated_discount: resolved ? resolved.amount : 0
    };
}

function summarizePromotions(views) {
    const summary = {
        total: views.length,
        live: 0,
        scheduled: 0,
        expired: 0,
        exhausted: 0,
        disabled: 0,
        total_uses: 0
    };

    for (const view of views) {
        if (summary[view.lifecycle] != null) {
            summary[view.lifecycle] += 1;
        }
        summary.total_uses += Number(view.used_count || 0);
    }

    return summary;
}

function createPromotionsService(repository) {
    return {
        getPolicy() {
            return getPromotionPolicyPublic();
        },

        getCreateDefaults() {
            return buildDefaultCreateDraft();
        },

        /**
         * POS validate: only returns when coupon is currently redeemable.
         * Response keeps legacy array shape for orders.html.
         */
        async findByCode(code, options = {}) {
            const rows = await repository.findByCode(String(code || "").trim());
            const row = rows[0] || null;
            const subtotal = Number(options.subtotal || 0);
            const view = publicPromotionView(row, subtotal);

            if (!view) {
                throw createHttpError(404, "Mã giảm giá không tồn tại hoặc đã hết hạn");
            }

            if (!view.valid) {
                throw createHttpError(400, view.message || "Mã giảm giá không áp dụng được");
            }

            return [
                {
                    ...view,
                    // POS legacy: percent field used when type=percent
                    discount_percent: view.discount_type === "percent"
                        ? view.discount_value
                        : 0
                }
            ];
        },

        async list(query = {}) {
            const rows = await repository.findAll();
            let views = rows.map((row) => publicPromotionView(row));

            const lifecycle = String(query.lifecycle || "").trim().toLowerCase();
            if (lifecycle && lifecycle !== "all") {
                views = views.filter((view) => view.lifecycle === lifecycle);
            }

            const type = String(query.discount_type || "").trim().toLowerCase();
            if (type === "percent" || type === "amount") {
                views = views.filter((view) => view.discount_type === type);
            }

            const q = String(query.q || "").trim().toLowerCase();
            if (q) {
                views = views.filter((view) => {
                    const hay = `${view.code} ${view.description || ""}`.toLowerCase();
                    return hay.includes(q);
                });
            }

            const sort = String(query.sort || "newest");
            views = views.slice().sort((a, b) => {
                if (sort === "code") {
                    return String(a.code).localeCompare(String(b.code), "vi");
                }
                if (sort === "uses") {
                    return Number(b.used_count) - Number(a.used_count);
                }
                if (sort === "ending") {
                    const ae = a.end_date ? String(a.end_date) : "9999";
                    const be = b.end_date ? String(b.end_date) : "9999";
                    return ae.localeCompare(be);
                }
                return Number(b.id) - Number(a.id);
            });

            return {
                items: views,
                summary: summarizePromotions(rows.map((row) => publicPromotionView(row)))
            };
        },

        async create(payload) {
            const promo = normalizePromotionPayload({
                ...payload,
                __isCreate: true
            });
            try {
                const result = await repository.create(promo);
                return {
                    message: "Đã tạo mã khuyến mãi",
                    id: result.insertId,
                    code: promo.code
                };
            } catch (error) {
                if (error && (error.code === "ER_DUP_ENTRY" || error.errno === 1062)) {
                    throw createHttpError(409, "Mã khuyến mãi đã tồn tại");
                }
                throw error;
            }
        },

        async update(id, payload) {
            const existing = await repository.findById(Number(id));
            if (!existing) {
                throw createHttpError(404, "Không tìm thấy mã khuyến mãi");
            }

            // Merge carefully: empty strings from forms should not wipe required fields incorrectly
            const merged = {
                ...existing,
                ...payload,
                code: payload.code != null && payload.code !== "" ? payload.code : existing.code,
                discount_type: payload.discount_type != null && payload.discount_type !== ""
                    ? payload.discount_type
                    : existing.discount_type,
                discount_value: payload.discount_value != null && payload.discount_value !== ""
                    ? payload.discount_value
                    : (existing.discount_value > 0
                        ? existing.discount_value
                        : existing.discount_percent),
                description: payload.description !== undefined
                    ? payload.description
                    : existing.description,
                start_date: payload.start_date !== undefined
                    ? payload.start_date
                    : existing.start_date,
                end_date: payload.end_date !== undefined
                    ? payload.end_date
                    : existing.end_date,
                min_order_amount: payload.min_order_amount !== undefined
                    ? payload.min_order_amount
                    : existing.min_order_amount,
                max_uses: payload.max_uses !== undefined
                    ? payload.max_uses
                    : existing.max_uses,
                is_active: payload.is_active !== undefined
                    ? payload.is_active
                    : existing.is_active,
                __isCreate: false
            };

            const promo = normalizePromotionPayload(merged);

            try {
                await repository.update(Number(id), promo);
            } catch (error) {
                if (error && (error.code === "ER_DUP_ENTRY" || error.errno === 1062)) {
                    throw createHttpError(409, "Mã khuyến mãi đã tồn tại");
                }
                throw error;
            }

            return { message: "Đã cập nhật mã khuyến mãi" };
        },

        async setActive(id, isActive) {
            const existing = await repository.findById(Number(id));
            if (!existing) {
                throw createHttpError(404, "Không tìm thấy mã khuyến mãi");
            }
            await repository.setActive(Number(id), Boolean(isActive));
            return {
                message: isActive ? "Đã bật mã khuyến mãi" : "Đã tắt mã khuyến mãi",
                is_active: Boolean(isActive)
            };
        },

        async remove(id) {
            const existing = await repository.findById(Number(id));
            if (!existing) {
                throw createHttpError(404, "Không tìm thấy mã khuyến mãi");
            }

            // Soft-guard: codes already used keep history; still allow admin hard delete
            // Prefer disable if heavily used — still honor explicit delete
            await repository.remove(Number(id));
            return { message: "Đã xóa mã khuyến mãi" };
        },

        /**
         * Preview discount for admin calculator (does not consume uses).
         */
        async preview(code, subtotal) {
            const rows = await repository.findByCode(String(code || "").trim());
            const view = publicPromotionView(rows[0] || null, Number(subtotal) || 0);
            if (!view) {
                throw createHttpError(404, "Mã giảm giá không tồn tại");
            }
            return view;
        }
    };
}

module.exports = {
    createPromotionsService,
    normalizePromotionPayload,
    publicPromotionView,
    summarizePromotions
};
