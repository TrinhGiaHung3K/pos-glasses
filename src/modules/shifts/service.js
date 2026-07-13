const { createHttpError } = require("../../middleware/httpError");

function money(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
        return 0;
    }
    return Math.round(n * 100) / 100;
}

function createShiftsService(repository, options = {}) {
    const auditService = options.auditService || null;

    async function writeAudit(entry) {
        if (!auditService || typeof auditService.log !== "function") return;
        try {
            await auditService.log(entry);
        } catch {
            // non-blocking
        }
    }

    return {
        getCurrent(user) {
            if (!user?.id) {
                throw createHttpError(401, "Vui lòng đăng nhập");
            }
            return repository.findOpenByUser(Number(user.id));
        },

        list(query = {}, user) {
            if (!user?.id) {
                throw createHttpError(401, "Vui lòng đăng nhập");
            }
            // Staff sees own shifts; admin can filter any
            const userId = user.role === "admin" && query.user_id
                ? Number(query.user_id)
                : user.role === "admin" && query.all === "1"
                    ? null
                    : Number(user.id);

            return repository.list({
                page: query.page,
                limit: query.limit,
                userId,
                status: query.status || null
            });
        },

        async getById(id, user) {
            const shift = await repository.findById(Number(id));
            if (!shift) {
                throw createHttpError(404, "Không tìm thấy ca");
            }
            if (user.role !== "admin" && Number(shift.user_id) !== Number(user.id)) {
                throw createHttpError(403, "Không có quyền xem ca này");
            }
            return shift;
        },

        async open(payload, user) {
            if (!user?.id) {
                throw createHttpError(401, "Vui lòng đăng nhập");
            }

            const existing = await repository.findOpenByUser(Number(user.id));
            if (existing) {
                throw createHttpError(400, "Bạn đang có ca mở. Hãy đóng ca trước.");
            }

            const openingCash = money(payload.opening_cash ?? payload.openingCash ?? 0);
            const note = payload.note ? String(payload.note).trim().slice(0, 500) : null;

            const shift = await repository.open({
                userId: Number(user.id),
                openingCash,
                note
            });

            await writeAudit({
                actor_id: user.id,
                action: "shift.open",
                entity_type: "shift",
                entity_id: shift.id,
                payload: { opening_cash: openingCash }
            });

            return {
                message: "Đã mở ca",
                shift
            };
        },

        async close(id, payload, user) {
            if (!user?.id) {
                throw createHttpError(401, "Vui lòng đăng nhập");
            }

            const shiftId = Number(id);
            let shift = await repository.findById(shiftId);
            if (!shift) {
                throw createHttpError(404, "Không tìm thấy ca");
            }
            if (shift.status !== "open") {
                throw createHttpError(400, "Ca đã đóng");
            }
            if (user.role !== "admin" && Number(shift.user_id) !== Number(user.id)) {
                throw createHttpError(403, "Chỉ đóng được ca của bạn");
            }

            // Refresh totals from orders for accuracy
            if (typeof repository.recomputeFromOrders === "function") {
                try {
                    shift = await repository.recomputeFromOrders(shiftId);
                } catch {
                    // keep counters if recompute fails (legacy schema)
                }
            }

            const closingCash = money(payload.closing_cash ?? payload.closingCash);
            if (payload.closing_cash == null && payload.closingCash == null) {
                throw createHttpError(400, "Vui lòng nhập tiền mặt cuối ca");
            }

            const expectedCash = money(Number(shift.opening_cash) + Number(shift.cash_sales));
            const variance = Math.round((closingCash - expectedCash) * 100) / 100;
            const note = payload.note != null ? String(payload.note).trim().slice(0, 500) : null;

            const closed = await repository.close({
                id: shiftId,
                closingCash,
                expectedCash,
                variance,
                closedBy: Number(user.id),
                note
            });

            await writeAudit({
                actor_id: user.id,
                action: "shift.close",
                entity_type: "shift",
                entity_id: shiftId,
                payload: {
                    closing_cash: closingCash,
                    expected_cash: expectedCash,
                    variance,
                    order_count: closed.order_count
                }
            });

            return {
                message: "Đã đóng ca",
                shift: closed,
                report: {
                    opening_cash: Number(closed.opening_cash) || 0,
                    cash_sales: Number(closed.cash_sales) || 0,
                    card_sales: Number(closed.card_sales) || 0,
                    bank_sales: Number(closed.bank_sales) || 0,
                    expected_cash: expectedCash,
                    closing_cash: closingCash,
                    variance,
                    order_count: Number(closed.order_count) || 0,
                    void_count: Number(closed.void_count) || 0
                }
            };
        }
    };
}

module.exports = {
    createShiftsService
};
