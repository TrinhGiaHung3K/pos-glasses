const { createHttpError } = require("../../middleware/httpError");

function addMonths(dateStr, months) {
    const d = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) {
        throw createHttpError(400, "Ngày bắt đầu không hợp lệ");
    }
    d.setMonth(d.getMonth() + months);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function todayIso() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function createWarrantiesService(repository) {
    return {
        list(query = {}) {
            return repository.list({
                q: String(query.q || "").trim(),
                page: query.page,
                limit: query.limit,
                status: query.status || null
            });
        },

        async lookup(serial) {
            const code = String(serial || "").trim().toUpperCase();
            if (!code) {
                throw createHttpError(400, "Nhập số serial");
            }
            const row = await repository.findBySerial(code);
            if (!row) {
                throw createHttpError(404, "Không tìm thấy bảo hành với serial này");
            }

            const end = String(row.end_date).slice(0, 10);
            const expired = end < todayIso();
            return {
                ...row,
                is_expired: expired || row.status === "expired",
                days_left: expired
                    ? 0
                    : Math.max(
                        0,
                        Math.ceil((new Date(`${end}T00:00:00`) - new Date(`${todayIso()}T00:00:00`)) / 86400000)
                    )
            };
        },

        async create(payload, user) {
            if (!user?.id) {
                throw createHttpError(401, "Vui lòng đăng nhập");
            }

            const serial = String(payload.serial_number || payload.serial || "")
                .trim()
                .toUpperCase()
                .slice(0, 80);
            if (!serial) {
                throw createHttpError(400, "Serial bắt buộc");
            }

            const existing = await repository.findBySerial(serial);
            if (existing) {
                throw createHttpError(400, "Serial đã được đăng ký bảo hành");
            }

            const months = Math.min(120, Math.max(1, Number(payload.months) || 12));
            const startDate = payload.start_date
                ? String(payload.start_date).slice(0, 10)
                : todayIso();
            const endDate = payload.end_date
                ? String(payload.end_date).slice(0, 10)
                : addMonths(startDate, months);

            try {
                const created = await repository.create({
                    order_id: payload.order_id ? Number(payload.order_id) : null,
                    product_id: payload.product_id ? Number(payload.product_id) : null,
                    customer_id: payload.customer_id ? Number(payload.customer_id) : null,
                    serial_number: serial,
                    months,
                    start_date: startDate,
                    end_date: endDate,
                    note: payload.note ? String(payload.note).trim().slice(0, 500) : null,
                    status: "active",
                    created_by: Number(user.id)
                });
                return created;
            } catch (error) {
                if (error && (error.code === "ER_DUP_ENTRY" || error.errno === 1062)) {
                    throw createHttpError(400, "Serial đã được đăng ký bảo hành");
                }
                throw error;
            }
        },

        async setStatus(id, payload, user) {
            if (!user?.id) {
                throw createHttpError(401, "Vui lòng đăng nhập");
            }
            const status = String(payload.status || "").trim().toLowerCase();
            if (!["active", "claimed", "expired", "void"].includes(status)) {
                throw createHttpError(400, "Trạng thái không hợp lệ");
            }
            const row = await repository.findById(Number(id));
            if (!row) {
                throw createHttpError(404, "Không tìm thấy bảo hành");
            }
            const note = payload.note != null ? String(payload.note).trim().slice(0, 500) : null;
            return repository.updateStatus(Number(id), status, note);
        }
    };
}

module.exports = {
    createWarrantiesService
};
