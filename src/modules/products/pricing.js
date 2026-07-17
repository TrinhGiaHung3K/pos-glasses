/**
 * Dual-price helpers for POS Glasses.
 *
 * - commercial: original_price / original_cost_price (invoice, reports, dashboard)
 * - charge: products.price (demo bank-transfer QR amount)
 */

function toMoney(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return 0;
    return Math.round(amount);
}

/**
 * Catalog sell price for display, checkout snapshots, invoices, reports.
 * Prefers original_price; falls back to price when original is missing.
 */
function commercialUnitPrice(product = {}) {
    const original = Number(product.original_price);
    if (Number.isFinite(original) && original > 0) {
        return toMoney(original);
    }
    return toMoney(product.price);
}

/**
 * Catalog cost for margin/report snapshots.
 * Prefers original_cost_price when present (including 0).
 */
function commercialUnitCost(product = {}) {
    if (product.original_cost_price != null && product.original_cost_price !== "") {
        const original = Number(product.original_cost_price);
        if (Number.isFinite(original) && original >= 0) {
            return toMoney(original);
        }
    }
    return toMoney(product.cost_price);
}

/**
 * Bank-transfer charge unit from products.price.
 * Falls back to the commercial price when the demo price is missing.
 */
function chargeUnitPrice(product = {}) {
    const demo = Number(product.price);
    if (Number.isFinite(demo) && demo > 0) {
        return toMoney(demo);
    }
    return commercialUnitPrice(product);
}

/**
 * Normalize a DB product row for API/UI: `price` becomes commercial.
 * Keeps raw columns for debugging / charge math.
 */
function presentProductPricing(product = {}) {
    if (!product || typeof product !== "object") return product;
    const commercial = commercialUnitPrice(product);
    const commercialCost = commercialUnitCost(product);
    return {
        ...product,
        price: commercial,
        cost_price: commercialCost,
        original_price: product.original_price != null
            ? toMoney(product.original_price)
            : commercial,
        original_cost_price: product.original_cost_price != null
            ? toMoney(product.original_cost_price)
            : commercialCost,
        charge_price: toMoney(product.price),
        demo_price: toMoney(product.price)
    };
}

function presentProductsPricing(rows) {
    if (!Array.isArray(rows)) return rows;
    return rows.map(presentProductPricing);
}

/**
 * Scale an absolute commercial discount onto a charge subtotal.
 * Percent discounts should be reapplied on charge subtotal separately.
 */
function scaleAbsoluteDiscount(commercialDiscount, commercialSubtotal, chargeSubtotal) {
    const commercial = Math.max(0, toMoney(commercialDiscount));
    const cSub = Math.max(0, toMoney(commercialSubtotal));
    const tSub = Math.max(0, toMoney(chargeSubtotal));
    if (commercial <= 0 || tSub <= 0) return 0;
    if (cSub <= 0) return Math.min(commercial, tSub);
    return Math.min(tSub, Math.round(commercial * (tSub / cSub)));
}

module.exports = {
    toMoney,
    commercialUnitPrice,
    commercialUnitCost,
    chargeUnitPrice,
    presentProductPricing,
    presentProductsPricing,
    scaleAbsoluteDiscount
};
