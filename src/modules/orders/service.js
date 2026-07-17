const { createHttpError } = require("../../middleware/httpError");
const { buildStaffPerformanceView } = require("../staffPerformance/levels");
const {
    earnPointsFromTotal,
    redeemValueVnd,
    maxRedeemablePoints
} = require("../loyalty/policy");
const {
    commercialUnitPrice,
    commercialUnitCost,
    chargeUnitPrice,
    scaleAbsoluteDiscount
} = require("../products/pricing");

const PAYMENT_METHODS = new Set(["cash", "bank_transfer", "card"]);
const MANUAL_DISCOUNT_TYPES = new Set(["percent", "amount"]);

function toNumber(value) {
    return Number(value || 0);
}

function toPositiveInteger(value, fieldName) {
    const numberValue = Number(value);

    if (!Number.isInteger(numberValue) || numberValue < 1) {
        throw createHttpError(400, `${fieldName} không hợp lệ`);
    }

    return numberValue;
}

function normalizeCheckoutItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw createHttpError(400, "Vui lòng chọn ít nhất một sản phẩm");
    }

    const byProductId = new Map();

    for (const item of items) {
        const productId = toPositiveInteger(item.product_id, "Sản phẩm");
        const quantity = toPositiveInteger(item.quantity, "Số lượng");
        byProductId.set(productId, (byProductId.get(productId) || 0) + quantity);
    }

    return [...byProductId.entries()].map(([product_id, quantity]) => ({
        product_id,
        quantity
    }));
}

function validatePayment(payment = {}) {
    const method = String(payment.method || "cash").trim();

    if (!PAYMENT_METHODS.has(method)) {
        throw createHttpError(400, "Phương thức thanh toán không hợp lệ");
    }

    return {
        method,
        amount_paid: Math.max(0, Math.round(toNumber(payment.amount_paid)))
    };
}

function normalizeManualDiscount(manualDiscount = {}) {
    const type = manualDiscount.type ? String(manualDiscount.type).trim() : null;
    const value = Math.max(0, toNumber(manualDiscount.value));

    if (!type && value === 0) {
        return {
            type: null,
            value: 0
        };
    }

    if (!MANUAL_DISCOUNT_TYPES.has(type) || value <= 0) {
        throw createHttpError(400, "Giảm giá không hợp lệ");
    }

    if (type === "percent" && value > 100) {
        throw createHttpError(400, "Giảm giá không hợp lệ");
    }

    return {
        type,
        value
    };
}

function mapProductsById(products) {
    return new Map(products.map((product) => [Number(product.id), product]));
}

function calculateManualDiscount(subtotal, discount) {
    if (!discount.type) {
        return 0;
    }

    if (discount.type === "percent") {
        return Math.round(subtotal * discount.value / 100);
    }

    return Math.round(discount.value);
}

function startOfLocalDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function isSameLocalDay(value) {
    if (!value) {
        return false;
    }
    const created = new Date(value);
    if (Number.isNaN(created.getTime())) {
        return false;
    }
    return startOfLocalDay(created).getTime() === startOfLocalDay().getTime();
}

function isPromotionCurrentlyValid(promotion, subtotal = 0) {
    if (!promotion) {
        return { ok: false, message: "Mã giảm giá không tồn tại hoặc đã hết hạn" };
    }

    if (promotion.is_active != null && Number(promotion.is_active) !== 1) {
        return { ok: false, message: "Mã giảm giá đã bị tắt" };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (promotion.start_date) {
        const start = new Date(promotion.start_date);
        start.setHours(0, 0, 0, 0);
        if (today < start) {
            return { ok: false, message: "Mã giảm giá chưa đến ngày áp dụng" };
        }
    }

    if (promotion.end_date) {
        const end = new Date(promotion.end_date);
        end.setHours(0, 0, 0, 0);
        if (today > end) {
            return { ok: false, message: "Mã giảm giá đã hết hạn" };
        }
    }

    const minOrder = toNumber(promotion.min_order_amount);
    if (minOrder > 0 && subtotal < minOrder) {
        return {
            ok: false,
            message: `Đơn tối thiểu ${minOrder.toLocaleString("vi-VN")}đ để dùng mã này`
        };
    }

    if (
        promotion.max_uses != null
        && Number(promotion.used_count || 0) >= Number(promotion.max_uses)
    ) {
        return { ok: false, message: "Mã giảm giá đã hết lượt sử dụng" };
    }

    return { ok: true };
}

function resolvePromotionDiscount(promotion, subtotal) {
    const type = String(promotion.discount_type || "percent").toLowerCase();
    if (type === "amount") {
        const value = Math.round(toNumber(promotion.discount_value));
        return {
            type: "amount",
            percent: 0,
            amount: Math.min(subtotal, Math.max(0, value))
        };
    }

    const percent = toNumber(
        promotion.discount_value > 0 ? promotion.discount_value : promotion.discount_percent
    );
    return {
        type: "percent",
        percent,
        amount: Math.round(subtotal * percent / 100)
    };
}

async function resolveStaffPerformance(repository, user) {
    if (typeof repository.findStaffPerformanceByUserId !== "function") {
        return buildStaffPerformanceView({ id: user.id, username: user.username, role: user.role });
    }

    const metrics = await repository.findStaffPerformanceByUserId(Number(user.id));
    return buildStaffPerformanceView(metrics || { id: user.id, username: user.username, role: user.role });
}

async function enforceStaffDiscountCap(repository, user, subtotal, manualDiscountAmount) {
    if (manualDiscountAmount <= 0) {
        return;
    }

    const staffPerformance = await resolveStaffPerformance(repository, user);
    const maxDiscountAmount = Math.round(subtotal * staffPerformance.level.discount_percent / 100);

    if (manualDiscountAmount > maxDiscountAmount) {
        throw createHttpError(
            400,
            `Hạng nhân viên ${staffPerformance.level.code} chỉ được giảm tối đa ${staffPerformance.level.discount_percent}%`
        );
    }
}

function createOrdersService(repository, options = {}) {
    const auditService = options.auditService || null;
    const shiftsRepository = options.shiftsRepository || null;

    async function writeAudit(entry) {
        if (!auditService || typeof auditService.log !== "function") {
            return;
        }
        try {
            await auditService.log(entry);
        } catch {
            // never block sales flow
        }
    }

    async function resolveShiftId(userId, explicitShiftId) {
        if (explicitShiftId) {
            return Number(explicitShiftId);
        }
        if (!shiftsRepository || typeof shiftsRepository.findOpenByUser !== "function") {
            return null;
        }
        try {
            const open = await shiftsRepository.findOpenByUser(Number(userId));
            return open?.id ? Number(open.id) : null;
        } catch {
            return null;
        }
    }

    async function noteShiftSale(shiftId, paymentMethod, totalAmount) {
        if (!shiftId || !shiftsRepository || typeof shiftsRepository.recordSale !== "function") {
            return;
        }
        try {
            await shiftsRepository.recordSale(shiftId, { paymentMethod, totalAmount });
        } catch {
            // non-blocking
        }
    }

    async function refreshShiftAfterMutation(shiftId, { isVoid = false } = {}) {
        if (!shiftId || !shiftsRepository) {
            return;
        }
        try {
            if (typeof shiftsRepository.recomputeFromOrders === "function") {
                await shiftsRepository.recomputeFromOrders(shiftId);
            } else if (isVoid && typeof shiftsRepository.recordVoid === "function") {
                await shiftsRepository.recordVoid(shiftId);
            }
        } catch {
            // non-blocking — shift UI may lag until close
        }
    }

    return {
        async checkout(payload, user, meta = {}) {
            if (!user || !user.id) {
                throw createHttpError(401, "Vui lòng đăng nhập để tiếp tục");
            }

            const idempotencyKey = meta.idempotencyKey
                ? String(meta.idempotencyKey).trim().slice(0, 80)
                : "";

            if (idempotencyKey && typeof repository.findIdempotency === "function") {
                const existing = await repository.findIdempotency(Number(user.id), idempotencyKey);
                if (existing?.response_json) {
                    const body = typeof existing.response_json === "string"
                        ? JSON.parse(existing.response_json)
                        : existing.response_json;
                    return body;
                }
            }

            // Preserve optional variant_id per line (merge qty by product+variant key)
            const rawItems = Array.isArray(payload.items) ? payload.items : [];
            if (!rawItems.length) {
                throw createHttpError(400, "Vui lòng chọn ít nhất một sản phẩm");
            }
            const lineMap = new Map();
            for (const item of rawItems) {
                const productId = toPositiveInteger(item.product_id, "Sản phẩm");
                const quantity = toPositiveInteger(item.quantity, "Số lượng");
                const variantId = item.variant_id ? toPositiveInteger(item.variant_id, "Biến thể") : null;
                const key = `${productId}:${variantId || 0}`;
                const prev = lineMap.get(key) || { product_id: productId, variant_id: variantId, quantity: 0 };
                prev.quantity += quantity;
                lineMap.set(key, prev);
            }
            const items = [...lineMap.values()];

            const payment = validatePayment(payload.payment);
            const deferPayment = payment.method === "bank_transfer" && meta.deferPayment === true;
            if (payment.method === "bank_transfer" && !deferPayment) {
                throw createHttpError(409, "Chuyển khoản cần tạo QR và chờ ngân hàng xác nhận");
            }
            const manualDiscount = normalizeManualDiscount(payload.manual_discount);
            const couponCode = String(payload.coupon_code || "").trim() || null;
            const products = await repository.findProductsByIds(
                items.map((item) => item.product_id)
            );
            const productsById = mapProductsById(products);
            const checkoutItems = [];

            for (const item of items) {
                const product = productsById.get(item.product_id);

                if (!product) {
                    throw createHttpError(404, "Sản phẩm không tồn tại");
                }

                if (Number(product.quantity) < item.quantity) {
                    throw createHttpError(400, `Sản phẩm ${product.name} không đủ tồn kho`);
                }

                checkoutItems.push({
                    product_id: item.product_id,
                    variant_id: item.variant_id || null,
                    quantity: item.quantity,
                    // Invoice / reports / dashboard always snapshot commercial prices.
                    price: commercialUnitPrice(product),
                    cost_price: commercialUnitCost(product),
                    // Bank-transfer charge uses products.price (scaled for project demo).
                    charge_price: chargeUnitPrice(product)
                });
            }

            const subtotal = checkoutItems.reduce(
                (sum, item) => sum + item.quantity * item.price,
                0
            );
            const chargeSubtotal = checkoutItems.reduce(
                (sum, item) => sum + item.quantity * Number(item.charge_price || item.price),
                0
            );

            let couponDiscountPercent = 0;
            let couponDiscount = 0;
            let promotionId = null;

            if (couponCode) {
                const promotion = await repository.findPromotionByCode(couponCode);
                const validity = isPromotionCurrentlyValid(promotion, subtotal);

                if (!validity.ok) {
                    throw createHttpError(400, validity.message);
                }

                const resolved = resolvePromotionDiscount(promotion, subtotal);
                couponDiscountPercent = resolved.percent;
                couponDiscount = resolved.amount;
                promotionId = promotion.id != null ? Number(promotion.id) : null;
            }

            const manualDiscountAmount = calculateManualDiscount(subtotal, manualDiscount);

            // Loyalty redeem (optional)
            let pointsRedeemed = Math.max(0, Math.round(Number(payload.redeem_points) || 0));
            let pointsDiscountAmount = 0;
            const customerId = payload.customer_id ? Number(payload.customer_id) : null;

            if (pointsRedeemed > 0) {
                if (!customerId) {
                    throw createHttpError(400, "Cần hội viên để đổi điểm");
                }
                if (typeof repository.getCustomerLoyalty !== "function") {
                    throw createHttpError(400, "Hệ thống điểm chưa sẵn sàng");
                }
                const member = await repository.getCustomerLoyalty(customerId);
                if (!member || String(member.membership_status || "active") !== "active") {
                    throw createHttpError(400, "Hội viên không thể dùng điểm");
                }
                const maxPts = maxRedeemablePoints(subtotal, member.points_balance);
                if (pointsRedeemed > maxPts) {
                    throw createHttpError(
                        400,
                        `Chỉ đổi tối đa ${maxPts} điểm trên đơn này (số dư / trần 20% đơn)`
                    );
                }
                pointsDiscountAmount = redeemValueVnd(pointsRedeemed);
            }

            const discountAmount = couponDiscount + manualDiscountAmount + pointsDiscountAmount;

            if (discountAmount > subtotal) {
                throw createHttpError(400, "Giảm giá không hợp lệ");
            }

            await enforceStaffDiscountCap(repository, user, subtotal, manualDiscountAmount);

            const total = subtotal - discountAmount;
            // Mirror commercial discounts onto the demo charge total so the QR
            // amount stays proportional while using products.price.
            const chargeCouponDiscount = couponDiscountPercent > 0
                ? Math.round(chargeSubtotal * couponDiscountPercent / 100)
                : scaleAbsoluteDiscount(couponDiscount, subtotal, chargeSubtotal);
            const chargeManualDiscount = manualDiscount.type === "percent"
                ? calculateManualDiscount(chargeSubtotal, manualDiscount)
                : scaleAbsoluteDiscount(manualDiscountAmount, subtotal, chargeSubtotal);
            const chargePointsDiscount = scaleAbsoluteDiscount(
                pointsDiscountAmount,
                subtotal,
                chargeSubtotal
            );
            const chargeDiscountAmount = Math.min(
                chargeSubtotal,
                chargeCouponDiscount + chargeManualDiscount + chargePointsDiscount
            );
            const chargeTotal = Math.max(0, chargeSubtotal - chargeDiscountAmount);
            const pointsEarned = customerId ? earnPointsFromTotal(total) : 0;

            const amountPaid = deferPayment ? 0 : payment.method === "cash"
                ? payment.amount_paid
                : Math.max(payment.amount_paid, total);

            if (payment.method === "cash" && amountPaid < total) {
                throw createHttpError(400, "Tiền khách đưa chưa đủ");
            }

            const changeAmount = payment.method === "cash" ? amountPaid - total : 0;
            const shiftId = await resolveShiftId(user.id, payload.shift_id);
            const request = {
                customer_id: customerId,
                user_id: Number(user.id),
                shift_id: shiftId,
                source: "pos",
                status: deferPayment ? "payment_pending" : "completed",
                payment_status: deferPayment ? "pending" : "paid",
                defer_payment: deferPayment,
                items: checkoutItems,
                subtotal_amount: subtotal,
                discount_amount: discountAmount,
                total_amount: total,
                coupon_code: couponCode,
                discount_percent: couponDiscountPercent,
                promotion_id: promotionId,
                manual_discount_type: manualDiscount.type,
                manual_discount_value: manualDiscount.value,
                payment_method: payment.method,
                amount_paid: amountPaid,
                change_amount: changeAmount,
                points_earned: pointsEarned,
                points_redeemed: pointsRedeemed,
                points_discount_amount: pointsDiscountAmount
            };
            const result = await repository.checkout(request);
            if (!deferPayment) {
                await noteShiftSale(shiftId, payment.method, total);
            }

            const response = {
                message: deferPayment ? "Đang chờ xác nhận chuyển khoản" : "Thanh toán thành công",
                order_id: result.orderId,
                subtotal_amount: subtotal,
                discount_amount: discountAmount,
                total_amount: total,
                // Used only by bank-transfer payment intents.
                charge_amount: chargeTotal,
                charge_subtotal_amount: chargeSubtotal,
                payment_method: payment.method,
                amount_paid: amountPaid,
                change_amount: changeAmount,
                points_earned: pointsEarned,
                points_redeemed: pointsRedeemed,
                points_discount_amount: pointsDiscountAmount,
                shift_id: shiftId,
                payment_status: deferPayment ? "pending" : "paid",
                bank_transfer_content: null
            };

            if (idempotencyKey && typeof repository.saveIdempotency === "function") {
                await repository.saveIdempotency(
                    Number(user.id),
                    idempotencyKey,
                    result.orderId,
                    response
                );
            }

            await writeAudit({
                actor_id: user.id,
                action: "order.checkout",
                entity_type: "order",
                entity_id: result.orderId,
                payload: {
                    total_amount: total,
                    payment_method: payment.method,
                    item_count: checkoutItems.length
                },
                ip: meta.ip || null
            });

            return response;
        },

        async finalizePendingPayment(orderId) {
            const result = await repository.finalizePendingPayment(Number(orderId));
            await noteShiftSale(result.shift_id, result.payment_method, result.total_amount);
            return result;
        },

        async cancelPendingPayment(orderId, reason = "Payment intent expired") {
            return repository.cancelPendingPayment(Number(orderId), String(reason));
        },

        async voidOrder(orderId, user, payload = {}, meta = {}) {
            if (!user?.id) {
                throw createHttpError(401, "Vui lòng đăng nhập để tiếp tục");
            }

            const id = toPositiveInteger(orderId, "Mã hóa đơn");
            const reason = String(payload.reason || "").trim();

            if (reason.length < 3) {
                throw createHttpError(400, "Vui lòng nhập lý do hủy hóa đơn (tối thiểu 3 ký tự)");
            }

            const order = await repository.findOrderHeaderById(id);
            if (!order) {
                throw createHttpError(404, "Không tìm thấy hóa đơn");
            }

            if (String(order.status) !== "completed") {
                throw createHttpError(400, "Chỉ hủy được hóa đơn đã hoàn tất");
            }

            // Staff may void only same-day; admin any time
            if (user.role !== "admin" && !isSameLocalDay(order.created_at)) {
                throw createHttpError(403, "Nhân viên chỉ được hủy hóa đơn trong ngày");
            }

            const lines = await repository.findOrderLinesById(id);
            const result = await repository.voidOrder({
                orderId: id,
                userId: Number(user.id),
                reason: reason.slice(0, 500),
                lines
            });

            const shiftId = result.shift_id || order.shift_id || null;
            await refreshShiftAfterMutation(shiftId, { isVoid: true });

            await writeAudit({
                actor_id: user.id,
                action: "order.void",
                entity_type: "order",
                entity_id: id,
                payload: { reason },
                ip: meta.ip || null
            });

            return {
                message: "Đã hủy hóa đơn và hoàn kho",
                order_id: result.orderId,
                status: result.status
            };
        },

        async refundOrder(orderId, user, payload = {}, meta = {}) {
            if (!user?.id) {
                throw createHttpError(401, "Vui lòng đăng nhập để tiếp tục");
            }

            const id = toPositiveInteger(orderId, "Mã hóa đơn");
            const reason = String(payload.reason || "").trim();

            if (reason.length < 3) {
                throw createHttpError(400, "Vui lòng nhập lý do hoàn tiền (tối thiểu 3 ký tự)");
            }

            const order = await repository.findOrderHeaderById(id);
            if (!order) {
                throw createHttpError(404, "Không tìm thấy hóa đơn");
            }

            if (!["completed", "partial_refund"].includes(String(order.status))) {
                throw createHttpError(400, "Hóa đơn không thể hoàn tiền ở trạng thái hiện tại");
            }

            const lines = await repository.findOrderLinesById(id);
            const linesById = new Map(lines.map((line) => [Number(line.id), line]));

            let requested = Array.isArray(payload.items) ? payload.items : null;

            // Full refund when items omitted
            if (!requested || requested.length === 0) {
                requested = lines
                    .map((line) => {
                        const remaining = Number(line.quantity) - Number(line.refunded_quantity || 0);
                        return remaining > 0
                            ? { order_detail_id: line.id, quantity: remaining }
                            : null;
                    })
                    .filter(Boolean);
            }

            if (!requested.length) {
                throw createHttpError(400, "Không còn dòng hàng nào để hoàn");
            }

            const refundLines = [];
            let grossRefundAmount = 0;

            for (const item of requested) {
                const detailId = toPositiveInteger(
                    item.order_detail_id ?? item.id,
                    "Dòng hóa đơn"
                );
                const refundQty = toPositiveInteger(item.quantity, "Số lượng hoàn");
                const line = linesById.get(detailId);

                if (!line || Number(line.order_id) !== id && line.order_id == null) {
                    // order_id may not be on line object - already filtered by order
                }

                if (!line) {
                    throw createHttpError(404, `Không tìm thấy dòng hóa đơn #${detailId}`);
                }

                const remaining = Number(line.quantity) - Number(line.refunded_quantity || 0);
                if (refundQty > remaining) {
                    throw createHttpError(
                        400,
                        `Dòng #${detailId} chỉ còn hoàn được ${remaining}`
                    );
                }

                if (!line.product_id) {
                    throw createHttpError(400, `Dòng #${detailId} không còn liên kết sản phẩm`);
                }

                refundLines.push({
                    id: detailId,
                    product_id: Number(line.product_id),
                    variant_id: line.variant_id ? Number(line.variant_id) : null,
                    refund_qty: refundQty,
                    cost_price: Number(line.cost_price) || 0,
                    price: Number(line.price) || 0
                });
                grossRefundAmount += refundQty * Number(line.price);
            }

            // Determine if fully refunded after this operation
            const remainingAfter = new Map(
                lines.map((line) => [
                    Number(line.id),
                    Number(line.quantity) - Number(line.refunded_quantity || 0)
                ])
            );
            for (const line of refundLines) {
                remainingAfter.set(
                    line.id,
                    (remainingAfter.get(line.id) || 0) - line.refund_qty
                );
            }
            const fullyRefunded = [...remainingAfter.values()].every((qty) => qty <= 0);
            const nextStatus = fullyRefunded ? "refunded" : "partial_refund";

            // Pro-rate refund against net order total (coupon / manual / points discounts)
            const remainingGross = lines.reduce((sum, line) => {
                const rem = Number(line.quantity) - Number(line.refunded_quantity || 0);
                return sum + rem * Number(line.price || 0);
            }, 0);
            const alreadyRefunded = Math.max(0, Number(order.refunded_amount) || 0);
            const remainingNet = Math.max(
                0,
                Number(order.total_amount || 0) - alreadyRefunded
            );
            let refundAmount = grossRefundAmount;
            if (remainingGross > 0 && remainingNet < remainingGross) {
                refundAmount = Math.round((grossRefundAmount / remainingGross) * remainingNet);
            }
            // Clamp so cumulative refund never exceeds order total
            const maxRefundable = Math.max(
                0,
                Number(order.total_amount || 0) - alreadyRefunded
            );
            refundAmount = Math.min(refundAmount, maxRefundable);

            const result = await repository.refundOrder({
                orderId: id,
                userId: Number(user.id),
                reason: reason.slice(0, 500),
                refundLines,
                refundAmount,
                nextStatus
            });

            const shiftId = result.shift_id || order.shift_id || null;
            await refreshShiftAfterMutation(shiftId, { isVoid: false });

            await writeAudit({
                actor_id: user.id,
                action: "order.refund",
                entity_type: "order",
                entity_id: id,
                payload: {
                    reason,
                    refund_amount: refundAmount,
                    status: nextStatus,
                    lines: refundLines.map((line) => ({
                        order_detail_id: line.id,
                        quantity: line.refund_qty
                    }))
                },
                ip: meta.ip || null
            });

            return {
                message: fullyRefunded ? "Đã hoàn tiền toàn bộ" : "Đã hoàn tiền một phần",
                order_id: result.orderId,
                status: result.status,
                refund_amount: refundAmount
            };
        },

        findDetailsById(orderId) {
            return repository.findDetailsById(Number(orderId));
        },

        async findAll(filters = {}) {
            const { parseListQuery, listResponse } = require("../../utils/pagination");
            const pageInfo = parseListQuery(filters);
            const result = await repository.findAll({
                ...filters,
                page: pageInfo.page,
                limit: pageInfo.limit,
                offset: pageInfo.offset,
                paginate: pageInfo.paginate
            });

            // Backward compat: repository may return array (old) or {items,total}
            if (Array.isArray(result)) {
                return listResponse(result, { ...pageInfo, total: result.length });
            }
            return listResponse(result.items, {
                ...pageInfo,
                total: result.total
            });
        },

        findLatest(limit = 5) {
            return repository.findLatest(Number(limit) || 5);
        }
    };
}

module.exports = {
    calculateManualDiscount,
    createOrdersService,
    normalizeCheckoutItems,
    validatePayment,
    normalizeManualDiscount,
    isPromotionCurrentlyValid,
    resolvePromotionDiscount
};
