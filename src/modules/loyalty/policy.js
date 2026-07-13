/**
 * POS Glasses loyalty policy (eyewear retail).
 *
 * Earn: 1 point per 100.000đ paid (net total after discounts).
 * Redeem: 1 point = 1.000đ, max 20% of subtotal, only for active members.
 * Auto-tier by lifetime_spend (completed orders net).
 */

const POINTS_PER_VND_UNIT = 100_000;
const VND_PER_POINT_REDEEM = 1_000;
const MAX_REDEEM_PERCENT_OF_SUBTOTAL = 20;

/** Lifetime spend thresholds (VND) for membership_tier. */
const TIER_THRESHOLDS = Object.freeze([
    { code: "standard", min_spend: 0 },
    { code: "silver", min_spend: 10_000_000 },
    { code: "gold", min_spend: 30_000_000 }
]);

function earnPointsFromTotal(totalAmount) {
    const total = Math.max(0, Math.round(Number(totalAmount) || 0));
    return Math.floor(total / POINTS_PER_VND_UNIT);
}

function redeemValueVnd(points) {
    const p = Math.max(0, Math.round(Number(points) || 0));
    return p * VND_PER_POINT_REDEEM;
}

function maxRedeemablePoints(subtotal, balance) {
    const sub = Math.max(0, Math.round(Number(subtotal) || 0));
    const bal = Math.max(0, Math.round(Number(balance) || 0));
    if (sub <= 0 || bal <= 0) {
        return 0;
    }
    const maxBySubtotal = Math.floor(
        (sub * MAX_REDEEM_PERCENT_OF_SUBTOTAL / 100) / VND_PER_POINT_REDEEM
    );
    return Math.max(0, Math.min(bal, maxBySubtotal));
}

function resolveTierFromSpend(lifetimeSpend) {
    const spend = Math.max(0, Number(lifetimeSpend) || 0);
    let tier = TIER_THRESHOLDS[0].code;
    for (const row of TIER_THRESHOLDS) {
        if (spend >= row.min_spend) {
            tier = row.code;
        }
    }
    return tier;
}

function nextTierProgress(lifetimeSpend) {
    const spend = Math.max(0, Number(lifetimeSpend) || 0);
    const current = resolveTierFromSpend(spend);
    const idx = TIER_THRESHOLDS.findIndex((t) => t.code === current);
    const next = TIER_THRESHOLDS[idx + 1] || null;
    if (!next) {
        return {
            current_tier: current,
            next_tier: null,
            remaining_spend: 0,
            progress_percent: 100
        };
    }
    const prevMin = TIER_THRESHOLDS[idx].min_spend;
    const span = next.min_spend - prevMin;
    const progress = span > 0
        ? Math.min(100, Math.round(((spend - prevMin) / span) * 100))
        : 100;
    return {
        current_tier: current,
        next_tier: next.code,
        remaining_spend: Math.max(0, next.min_spend - spend),
        progress_percent: progress
    };
}

module.exports = {
    POINTS_PER_VND_UNIT,
    VND_PER_POINT_REDEEM,
    MAX_REDEEM_PERCENT_OF_SUBTOTAL,
    TIER_THRESHOLDS,
    earnPointsFromTotal,
    redeemValueVnd,
    maxRedeemablePoints,
    resolveTierFromSpend,
    nextTierProgress
};
