/**
 * Product pricing helpers for POS Glasses.
 *
 * Single source of truth: products.price / products.cost_price (nghìn đồng).
 * Used for catalog display, cash checkout, bank-transfer QR, invoices, reports.
 */

function toMoney(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return 0;
    return Math.round(amount);
}

/**
 * Catalog sell price for display, checkout snapshots, invoices, reports.
 * Uses products.price; falls back to original_price only when price is missing.
 */
function commercialUnitPrice(product = {}) {
    const price = Number(product.price);
    if (Number.isFinite(price) && price > 0) {
        return toMoney(price);
    }
    const original = Number(product.original_price);
    if (Number.isFinite(original) && original > 0) {
        return toMoney(original);
    }
    return 0;
}

/**
 * Catalog cost for margin/report snapshots.
 * Uses products.cost_price; falls back to original_cost_price when missing.
 */
function commercialUnitCost(product = {}) {
    if (product.cost_price != null && product.cost_price !== "") {
        const cost = Number(product.cost_price);
        if (Number.isFinite(cost) && cost >= 0) {
            return toMoney(cost);
        }
    }
    if (product.original_cost_price != null && product.original_cost_price !== "") {
        const original = Number(product.original_cost_price);
        if (Number.isFinite(original) && original >= 0) {
            return toMoney(original);
        }
    }
    return 0;
}

/**
 * Bank-transfer charge unit — same as catalog price (products.price).
 */
function chargeUnitPrice(product = {}) {
    return commercialUnitPrice(product);
}

/**
 * Normalize a DB product row for API/UI.
 * `price` is always products.price (nghìn đồng).
 */
function presentProductPricing(product = {}) {
    if (!product || typeof product !== "object") return product;
    const unit = commercialUnitPrice(product);
    const unitCost = commercialUnitCost(product);
    return {
        ...product,
        price: unit,
        cost_price: unitCost,
        original_price: product.original_price != null
            ? toMoney(product.original_price)
            : unit,
        original_cost_price: product.original_cost_price != null
            ? toMoney(product.original_cost_price)
            : unitCost,
        charge_price: unit,
        demo_price: unit
    };
}

function presentProductsPricing(rows) {
    if (!Array.isArray(rows)) return rows;
    return rows.map(presentProductPricing);
}

/**
 * Scale an absolute discount from one subtotal onto another.
 * With unified pricing both sides are usually equal; kept for compatibility.
 */
function scaleAbsoluteDiscount(sourceDiscount, sourceSubtotal, targetSubtotal) {
    const discount = Math.max(0, toMoney(sourceDiscount));
    const source = Math.max(0, toMoney(sourceSubtotal));
    const target = Math.max(0, toMoney(targetSubtotal));
    if (discount <= 0 || target <= 0) return 0;
    if (source <= 0) return Math.min(discount, target);
    return Math.min(target, Math.round(discount * (target / source)));
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
