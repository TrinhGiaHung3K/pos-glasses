/**
 * Shared list pagination helpers.
 */

function parsePage(value, fallback = 1) {
    const n = Number.parseInt(value, 10);
    if (Number.isNaN(n) || n < 1) {
        return fallback;
    }
    return n;
}

function parseLimit(value, fallback = 50, max = 200) {
    const n = Number.parseInt(value, 10);
    if (Number.isNaN(n) || n < 1) {
        return fallback;
    }
    return Math.min(n, max);
}

/**
 * @returns {{ page: number, limit: number, offset: number, paginate: boolean }}
 * paginate=false when client omitted page/limit (legacy full-list response).
 */
function parseListQuery(query = {}, defaults = {}) {
    const hasPage = query.page != null && query.page !== "";
    const hasLimit = query.limit != null && query.limit !== "";
    const paginate = hasPage || hasLimit || defaults.forcePaginate === true;

    const page = parsePage(query.page, defaults.page || 1);
    const limit = parseLimit(
        query.limit,
        defaults.limit || 50,
        defaults.maxLimit || 200
    );

    return {
        page,
        limit,
        offset: (page - 1) * limit,
        paginate
    };
}

function listResponse(items, { page, limit, total, paginate }) {
    if (!paginate) {
        // Legacy: bare array
        return items;
    }
    return {
        items,
        page,
        limit,
        total: Number(total || 0),
        total_pages: Math.max(1, Math.ceil(Number(total || 0) / limit) || 1)
    };
}

module.exports = {
    parsePage,
    parseLimit,
    parseListQuery,
    listResponse
};
