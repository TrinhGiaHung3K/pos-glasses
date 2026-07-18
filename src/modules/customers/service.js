const { createHttpError } = require("../../middleware/httpError");

const MEMBER_EAN13_PREFIX = "29";
const MEMBER_ID_DIGITS = 10;

/** Extensible membership codes (store as varchar; app validates allow-list). */
const MEMBERSHIP_STATUSES = Object.freeze(["active", "inactive", "suspended"]);
const MEMBERSHIP_TIERS = Object.freeze(["standard", "silver", "gold"]);
const GENDERS = Object.freeze(["male", "female", "other", "unknown"]);
const {
    nextTierProgress,
    maxRedeemablePoints,
    POINTS_PER_VND_UNIT,
    VND_PER_POINT_REDEEM
} = require("../loyalty/policy");

function normalizeMemberCode(value) {
    return String(value || "")
        .replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xff10))
        .replace(/\D+/g, "");
}

/**
 * Normalize Vietnamese-friendly phone to 0xxxxxxxxx when possible.
 */
function normalizePhone(value) {
    let phone = String(value || "")
        .replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xff10))
        .replace(/[^\d+]/g, "")
        .trim();

    if (!phone) return "";

    if (phone.startsWith("+84")) {
        phone = `0${phone.slice(3)}`;
    } else if (phone.startsWith("84") && phone.length >= 11) {
        phone = `0${phone.slice(2)}`;
    }

    // Keep digits only for storage consistency
    phone = phone.replace(/\D+/g, "");
    return phone;
}

function isValidPhone(phone) {
    return /^0\d{8,10}$/.test(phone);
}

function normalizeEmail(value) {
    const email = String(value || "").trim().toLowerCase();
    return email || null;
}

function isValidEmail(email) {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

function calculateEan13CheckDigit(body) {
    if (!/^\d{12}$/.test(body)) {
        throw createHttpError(400, "Mã khách hàng không hợp lệ");
    }

    const total = body
        .split("")
        .reduce((sum, digit, index) => {
            const value = Number(digit);
            return sum + (index % 2 === 0 ? value : value * 3);
        }, 0);

    return String((10 - (total % 10)) % 10);
}

function generateMemberCode(customerId) {
    const numericId = Number(customerId);

    if (!Number.isSafeInteger(numericId) || numericId < 0) {
        throw createHttpError(400, "Mã khách hàng không hợp lệ");
    }

    const paddedId = String(numericId).padStart(MEMBER_ID_DIGITS, "0");
    if (paddedId.length > MEMBER_ID_DIGITS) {
        throw createHttpError(400, "Mã khách hàng không hợp lệ");
    }

    const body = `${MEMBER_EAN13_PREFIX}${paddedId}`;
    return `${body}${calculateEan13CheckDigit(body)}`;
}

function isValidEan13MemberCode(memberCode) {
    return /^\d{13}$/.test(memberCode)
        && memberCode.startsWith(MEMBER_EAN13_PREFIX)
        && calculateEan13CheckDigit(memberCode.slice(0, -1)) === memberCode.at(-1);
}

function validateMemberCode(memberCode) {
    if (!isValidEan13MemberCode(memberCode)) {
        throw createHttpError(400, "Mã khách hàng không hợp lệ");
    }
}

function normalizeName(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}

function parseDateOfBirth(value) {
    if (value == null || value === "") return null;
    const raw = String(value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        throw createHttpError(400, "Ngày sinh phải theo định dạng YYYY-MM-DD");
    }

    const date = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
        throw createHttpError(400, "Ngày sinh không hợp lệ");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) {
        throw createHttpError(400, "Ngày sinh không được ở tương lai");
    }

    const ageMs = today - date;
    const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears > 120) {
        throw createHttpError(400, "Ngày sinh không hợp lệ");
    }
    if (ageYears < 5) {
        throw createHttpError(400, "Hội viên phải từ 5 tuổi trở lên");
    }

    return raw;
}

function normalizeEnum(value, allowed, fieldLabel, fallback) {
    if (value == null || value === "") return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (!allowed.includes(normalized)) {
        throw createHttpError(
            400,
            `${fieldLabel} không hợp lệ. Cho phép: ${allowed.join(", ")}`
        );
    }
    return normalized;
}

function normalizeNotes(value) {
    const notes = String(value || "").trim();
    if (notes.length > 1000) {
        throw createHttpError(400, "Ghi chú tối đa 1000 ký tự");
    }
    return notes || null;
}

function normalizeAddress(value) {
    const address = String(value || "").replace(/\s+/g, " ").trim();
    if (address.length > 500) {
        throw createHttpError(400, "Địa chỉ tối đa 500 ký tự");
    }
    return address || null;
}

function parseRegisteredBy(value) {
    if (value == null || value === "") return null;
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw createHttpError(400, "Nhân viên đăng ký không hợp lệ");
    }
    return id;
}

/**
 * Validate + normalize a membership registration / update payload.
 * @param {object} payload
 * @param {{ partial?: boolean }} options - partial: update may omit fields via merge with existing
 */
function buildCustomerRecord(payload, options = {}) {
    const base = options.base || {};
    const name = normalizeName(payload.name !== undefined ? payload.name : base.name);
    const phone = normalizePhone(payload.phone !== undefined ? payload.phone : base.phone);
    const email = normalizeEmail(payload.email !== undefined ? payload.email : base.email);
    const address = payload.address !== undefined
        ? normalizeAddress(payload.address)
        : (base.address ?? null);

    if (!name || name.length < 2) {
        throw createHttpError(400, "Họ tên hội viên phải có ít nhất 2 ký tự");
    }
    if (name.length > 120) {
        throw createHttpError(400, "Họ tên tối đa 120 ký tự");
    }
    if (!phone) {
        throw createHttpError(400, "Số điện thoại là bắt buộc");
    }
    if (!isValidPhone(phone)) {
        throw createHttpError(400, "Số điện thoại không hợp lệ (VD: 09xxxxxxxx)");
    }
    if (!isValidEmail(email)) {
        throw createHttpError(400, "Email không hợp lệ");
    }

    const gender = normalizeEnum(
        payload.gender !== undefined ? payload.gender : base.gender,
        GENDERS,
        "Giới tính",
        "unknown"
    );
    const membership_status = normalizeEnum(
        payload.membership_status !== undefined ? payload.membership_status : base.membership_status,
        MEMBERSHIP_STATUSES,
        "Trạng thái hội viên",
        "active"
    );
    const membership_tier = normalizeEnum(
        payload.membership_tier !== undefined ? payload.membership_tier : base.membership_tier,
        MEMBERSHIP_TIERS,
        "Hạng hội viên",
        "standard"
    );

    const date_of_birth = payload.date_of_birth !== undefined
        ? parseDateOfBirth(payload.date_of_birth)
        : (base.date_of_birth
            ? (base.date_of_birth instanceof Date
                ? base.date_of_birth.toISOString().slice(0, 10)
                : String(base.date_of_birth).slice(0, 10))
            : null);

    const notes = payload.notes !== undefined
        ? normalizeNotes(payload.notes)
        : (base.notes ?? null);

    return {
        name,
        phone,
        email,
        address,
        gender,
        date_of_birth,
        notes,
        membership_status,
        membership_tier
    };
}

function decorateCustomer(customer) {
    if (!customer) return null;
    const status = customer.membership_status || "active";
    const lifetime = Number(customer.lifetime_spend) || 0;
    const points = Number(customer.points_balance) || 0;
    const tierProgress = nextTierProgress(lifetime);
    return {
        ...customer,
        is_member: status === "active",
        membership_status: status,
        membership_tier: customer.membership_tier || tierProgress.current_tier || "standard",
        gender: customer.gender || "unknown",
        points_balance: points,
        lifetime_spend: lifetime,
        tier_progress: tierProgress,
        loyalty: {
            points_balance: points,
            lifetime_spend: lifetime,
            points_per_vnd_unit: POINTS_PER_VND_UNIT,
            vnd_per_point: VND_PER_POINT_REDEEM,
            max_redeem_points_example: maxRedeemablePoints(3_000, points)
        }
    };
}

function createCustomersService(repository) {
    return {
        async findAll() {
            const rows = await repository.findAll();
            return rows.map(decorateCustomer);
        },

        async list(query = {}) {
            const { parseListQuery, listResponse } = require("../../utils/pagination");
            const pageInfo = parseListQuery(query);
            if (typeof repository.findFiltered !== "function") {
                const rows = await repository.findAll();
                return listResponse(rows.map(decorateCustomer), {
                    ...pageInfo,
                    total: rows.length
                });
            }
            const result = await repository.findFiltered({
                q: query.q ? String(query.q).trim() : "",
                tier: query.tier || query.membership_tier || "",
                status: query.status || query.membership_status || "",
                page: pageInfo.page,
                limit: pageInfo.limit,
                offset: pageInfo.offset,
                paginate: pageInfo.paginate
            });
            return listResponse(result.items.map(decorateCustomer), {
                ...pageInfo,
                total: result.total
            });
        },

        async findById(id) {
            const customerId = Number(id);
            if (!Number.isSafeInteger(customerId) || customerId <= 0) {
                throw createHttpError(400, "Mã hội viên không hợp lệ");
            }

            const customer = await repository.findById(customerId);
            if (!customer) {
                throw createHttpError(404, "Không tìm thấy hội viên");
            }
            return decorateCustomer(customer);
        },

        async summary(id) {
            const customerId = Number(id);
            if (!Number.isSafeInteger(customerId) || customerId <= 0) {
                throw createHttpError(400, "Mã hội viên không hợp lệ");
            }
            if (typeof repository.findSummary !== "function") {
                const customer = await this.findById(customerId);
                return {
                    customer,
                    recent_orders: [],
                    top_products: [],
                    points_ledger: []
                };
            }
            const data = await repository.findSummary(customerId);
            if (!data) {
                throw createHttpError(404, "Không tìm thấy hội viên");
            }
            return {
                customer: decorateCustomer(data.customer),
                recent_orders: data.recent_orders || [],
                top_products: data.top_products || [],
                points_ledger: data.points_ledger || []
            };
        },

        async findByMemberCode(value) {
            const memberCode = normalizeMemberCode(value);

            if (!memberCode) {
                throw createHttpError(400, "Vui lòng quét mã khách hàng");
            }

            validateMemberCode(memberCode);

            const customer = await repository.findByMemberCode(memberCode);

            if (!customer) {
                throw createHttpError(404, "Không tìm thấy hội viên trong hệ thống");
            }

            const decorated = decorateCustomer(customer);

            if (decorated.membership_status === "suspended") {
                throw createHttpError(403, "Hội viên đang bị tạm khóa");
            }

            // inactive: still return for staff awareness but is_member=false
            return decorated;
        },

        async create(payload) {
            const record = buildCustomerRecord(payload || {});
            const registeredBy = parseRegisteredBy(payload?.registered_by);

            const existingPhone = await repository.findByPhone(record.phone);
            if (existingPhone) {
                throw createHttpError(
                    409,
                    `Số điện thoại đã thuộc hội viên #${existingPhone.id} (${existingPhone.name})`
                );
            }

            const requestedMemberCode = normalizeMemberCode(payload?.member_code);
            if (requestedMemberCode) {
                validateMemberCode(requestedMemberCode);
            }

            const memberSince = record.membership_status === "active"
                ? new Date()
                : null;

            const result = await repository.create({
                ...record,
                member_code: requestedMemberCode || null,
                member_since: memberSince,
                registered_by: registeredBy
            });

            const memberCode = requestedMemberCode || generateMemberCode(result.insertId);

            if (!requestedMemberCode) {
                await repository.assignMemberCode(result.insertId, memberCode);
            }

            const created = await repository.findById(result.insertId);

            return {
                message: "Đã đăng ký hội viên thành công",
                id: result.insertId,
                member_code: memberCode,
                customer: decorateCustomer(created)
            };
        },

        async update(id, payload) {
            const customerId = Number(id);
            if (!Number.isSafeInteger(customerId) || customerId <= 0) {
                throw createHttpError(400, "Mã hội viên không hợp lệ");
            }

            const existing = await repository.findById(customerId);
            if (!existing) {
                throw createHttpError(404, "Không tìm thấy hội viên");
            }

            const record = buildCustomerRecord(payload || {}, { base: existing });

            if (record.phone !== existing.phone) {
                const phoneOwner = await repository.findByPhone(record.phone);
                if (phoneOwner && Number(phoneOwner.id) !== customerId) {
                    throw createHttpError(
                        409,
                        `Số điện thoại đã thuộc hội viên #${phoneOwner.id} (${phoneOwner.name})`
                    );
                }
            }

            // Reactivate: ensure member_since is set
            if (
                record.membership_status === "active"
                && existing.membership_status !== "active"
                && !existing.member_since
            ) {
                // member_since only set on create path; patch via raw if needed later
            }

            await repository.update(customerId, record);

            const optionalCode = normalizeMemberCode(payload?.member_code);
            if (optionalCode) {
                validateMemberCode(optionalCode);
                await repository.assignMemberCode(customerId, optionalCode);
            }

            const updated = await repository.findById(customerId);

            return {
                message: "Đã cập nhật hội viên",
                customer: decorateCustomer(updated)
            };
        },

        /**
         * Soft deactivate membership (default).
         * Pass { hard: true } to permanently delete (orders.customer_id -> NULL).
         */
        async remove(id, options = {}) {
            const customerId = Number(id);
            if (!Number.isSafeInteger(customerId) || customerId <= 0) {
                throw createHttpError(400, "Mã hội viên không hợp lệ");
            }

            const existing = await repository.findById(customerId);
            if (!existing) {
                throw createHttpError(404, "Không tìm thấy hội viên");
            }

            if (options.hard === true || options.hard === "1" || options.hard === 1) {
                await repository.remove(customerId);
                return {
                    message: "Đã xóa vĩnh viễn hội viên",
                    hard: true
                };
            }

            await repository.updateStatus(customerId, "inactive");
            return {
                message: "Đã vô hiệu hóa hội viên (giữ lịch sử đơn hàng)",
                hard: false,
                membership_status: "inactive"
            };
        },

        async setStatus(id, status) {
            const customerId = Number(id);
            if (!Number.isSafeInteger(customerId) || customerId <= 0) {
                throw createHttpError(400, "Mã hội viên không hợp lệ");
            }

            const membership_status = normalizeEnum(status, MEMBERSHIP_STATUSES, "Trạng thái hội viên", null);
            if (!membership_status) {
                throw createHttpError(400, "Trạng thái hội viên là bắt buộc");
            }

            const existing = await repository.findById(customerId);
            if (!existing) {
                throw createHttpError(404, "Không tìm thấy hội viên");
            }

            await repository.updateStatus(customerId, membership_status);
            const updated = await repository.findById(customerId);
            return {
                message: "Đã cập nhật trạng thái hội viên",
                customer: decorateCustomer(updated)
            };
        }
    };
}

module.exports = {
    MEMBERSHIP_STATUSES,
    MEMBERSHIP_TIERS,
    GENDERS,
    calculateEan13CheckDigit,
    createCustomersService,
    generateMemberCode,
    isValidEan13MemberCode,
    normalizeMemberCode,
    normalizePhone,
    buildCustomerRecord
};
