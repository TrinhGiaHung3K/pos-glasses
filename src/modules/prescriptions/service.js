const { createHttpError } = require("../../middleware/httpError");

function numOrNull(value, label, { min = -30, max = 30 } = {}) {
    if (value == null || value === "") return null;
    const n = Number(value);
    if (!Number.isFinite(n)) {
        throw createHttpError(400, `${label} không hợp lệ`);
    }
    if (n < min || n > max) {
        throw createHttpError(400, `${label} ngoài khoảng cho phép`);
    }
    return Math.round(n * 100) / 100;
}

function intOrNull(value, label, { min = 0, max = 180 } = {}) {
    if (value == null || value === "") return null;
    const n = Number(value);
    if (!Number.isInteger(n) || n < min || n > max) {
        throw createHttpError(400, `${label} không hợp lệ`);
    }
    return n;
}

function normalizePayload(payload, customerId, userId, isUpdate = false) {
    const measuredAt = payload.measured_at
        ? String(payload.measured_at).slice(0, 10)
        : null;

    return {
        customer_id: customerId,
        measured_at: measuredAt,
        doctor_name: payload.doctor_name ? String(payload.doctor_name).trim().slice(0, 120) : null,
        clinic_name: payload.clinic_name ? String(payload.clinic_name).trim().slice(0, 160) : null,
        od_sph: numOrNull(payload.od_sph, "OD SPH"),
        od_cyl: numOrNull(payload.od_cyl, "OD CYL"),
        od_axis: intOrNull(payload.od_axis, "OD AXIS"),
        os_sph: numOrNull(payload.os_sph, "OS SPH"),
        os_cyl: numOrNull(payload.os_cyl, "OS CYL"),
        os_axis: intOrNull(payload.os_axis, "OS AXIS"),
        pd: numOrNull(payload.pd, "PD", { min: 40, max: 80 }),
        add_power: numOrNull(payload.add_power, "ADD", { min: 0, max: 5 }),
        notes: payload.notes ? String(payload.notes).trim().slice(0, 500) : null,
        is_active: payload.is_active === false || payload.is_active === 0 ? 0 : 1,
        created_by: isUpdate ? undefined : userId
    };
}

function createPrescriptionsService(repository) {
    return {
        listByCustomer(customerId) {
            const id = Number(customerId);
            if (!Number.isInteger(id) || id < 1) {
                throw createHttpError(400, "Khách hàng không hợp lệ");
            }
            return repository.listByCustomer(id);
        },

        async getById(id) {
            const row = await repository.findById(Number(id));
            if (!row) {
                throw createHttpError(404, "Không tìm thấy đơn kính");
            }
            return row;
        },

        async create(customerId, payload, user) {
            if (!user?.id) {
                throw createHttpError(401, "Vui lòng đăng nhập");
            }
            const cid = Number(customerId);
            if (!Number.isInteger(cid) || cid < 1) {
                throw createHttpError(400, "Khách hàng không hợp lệ");
            }

            const row = normalizePayload(payload || {}, cid, Number(user.id), false);
            const created = await repository.create(row);

            if (created.is_active) {
                await repository.deactivateOthers(cid, created.id);
            }

            return created;
        },

        async update(id, payload, user) {
            if (!user?.id) {
                throw createHttpError(401, "Vui lòng đăng nhập");
            }
            const existing = await repository.findById(Number(id));
            if (!existing) {
                throw createHttpError(404, "Không tìm thấy đơn kính");
            }

            const row = normalizePayload(
                { ...existing, ...(payload || {}) },
                Number(existing.customer_id),
                Number(user.id),
                true
            );
            const updated = await repository.update(Number(id), row);

            if (updated.is_active) {
                await repository.deactivateOthers(Number(updated.customer_id), updated.id);
            }

            return updated;
        },

        async remove(id, user) {
            if (!user?.id) {
                throw createHttpError(401, "Vui lòng đăng nhập");
            }
            const existing = await repository.findById(Number(id));
            if (!existing) {
                throw createHttpError(404, "Không tìm thấy đơn kính");
            }
            await repository.remove(Number(id));
            return { message: "Đã xóa đơn kính" };
        }
    };
}

module.exports = {
    createPrescriptionsService
};
