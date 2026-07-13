/**
 * Promotion lifecycle helpers (pure, no I/O).
 * Used by service layer and tests.
 */

function toDayStart(value) {
    if (!value) {
        return null;
    }
    const date = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    date.setHours(0, 0, 0, 0);
    return date;
}

/**
 * @returns {'disabled'|'scheduled'|'expired'|'exhausted'|'live'}
 */
function resolvePromotionLifecycle(promo, today = new Date()) {
    if (!promo) {
        return "disabled";
    }

    if (promo.is_active === false || Number(promo.is_active) === 0) {
        return "disabled";
    }

    const now = toDayStart(today) || toDayStart(new Date());
    const start = toDayStart(promo.start_date);
    const end = toDayStart(promo.end_date);

    if (start && now < start) {
        return "scheduled";
    }

    if (end && now > end) {
        return "expired";
    }

    if (
        promo.max_uses != null
        && Number(promo.used_count || 0) >= Number(promo.max_uses)
    ) {
        return "exhausted";
    }

    return "live";
}

const LIFECYCLE_LABELS = Object.freeze({
    live: "Đang chạy",
    scheduled: "Sắp tới",
    expired: "Hết hạn",
    exhausted: "Hết lượt",
    disabled: "Tắt"
});

function lifecycleLabel(lifecycle) {
    return LIFECYCLE_LABELS[lifecycle] || lifecycle;
}

/**
 * Remaining uses; null = unlimited.
 */
function remainingUses(promo) {
    if (promo == null || promo.max_uses == null) {
        return null;
    }
    return Math.max(0, Number(promo.max_uses) - Number(promo.used_count || 0));
}

/**
 * 0–100 usage progress when max_uses set; null if unlimited.
 */
function usageProgressPercent(promo) {
    if (promo == null || promo.max_uses == null || Number(promo.max_uses) <= 0) {
        return null;
    }
    const used = Number(promo.used_count || 0);
    return Math.max(0, Math.min(100, Math.round((used / Number(promo.max_uses)) * 100)));
}

module.exports = {
    resolvePromotionLifecycle,
    lifecycleLabel,
    remainingUses,
    usageProgressPercent,
    toDayStart,
    LIFECYCLE_LABELS
};
