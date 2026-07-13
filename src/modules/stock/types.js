const STOCK_TYPES = Object.freeze({
    SALE: "sale",
    SALE_VOID: "sale_void",
    PURCHASE_IN: "purchase_in",
    ADJUST_IN: "adjust_in",
    ADJUST_OUT: "adjust_out",
    RETURN_IN: "return_in",
    RESERVE_OUT: "reserve_out",
    RESERVE_RELEASE: "reserve_release"
});

const OUTBOUND_TYPES = new Set([
    STOCK_TYPES.SALE,
    STOCK_TYPES.ADJUST_OUT,
    STOCK_TYPES.RESERVE_OUT
]);

const INBOUND_TYPES = new Set([
    STOCK_TYPES.SALE_VOID,
    STOCK_TYPES.PURCHASE_IN,
    STOCK_TYPES.ADJUST_IN,
    STOCK_TYPES.RETURN_IN,
    STOCK_TYPES.RESERVE_RELEASE
]);

const ALL_STOCK_TYPES = new Set([
    ...OUTBOUND_TYPES,
    ...INBOUND_TYPES
]);

function isOutboundType(type) {
    return OUTBOUND_TYPES.has(type);
}

function stockDelta(type, qty) {
    const quantity = Math.abs(Number(qty) || 0);
    if (OUTBOUND_TYPES.has(type)) {
        return -quantity;
    }
    if (INBOUND_TYPES.has(type)) {
        return quantity;
    }
    throw new Error(`Unknown stock movement type: ${type}`);
}

module.exports = {
    STOCK_TYPES,
    OUTBOUND_TYPES,
    INBOUND_TYPES,
    ALL_STOCK_TYPES,
    isOutboundType,
    stockDelta
};
