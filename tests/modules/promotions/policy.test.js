const assert = require("node:assert/strict");
const test = require("node:test");
const {
    enforcePromotionPolicy,
    assertPromoCode,
    buildDefaultCreateDraft,
    POS_PROMO_POLICY
} = require("../../../src/modules/promotions/policy");
const { createPromotionsService } = require("../../../src/modules/promotions/service");

const now = new Date("2026-07-10T10:00:00");

function basePromo(overrides = {}) {
    return {
        code: "SALE10",
        discount_type: "percent",
        discount_value: 10,
        discount_percent: 10,
        min_order_amount: 1_500_000,
        max_uses: 100,
        is_active: 1,
        description: "Giảm 10% đơn kính",
        start_date: "2026-07-10",
        end_date: "2026-08-10",
        ...overrides
    };
}

test("assertPromoCode rejects free/admin and digit barcodes", () => {
    assert.throws(() => assertPromoCode("FREE"), { status: 400 });
    assert.throws(() => assertPromoCode("ADMIN"), { status: 400 });
    assert.throws(() => assertPromoCode("12345"), { status: 400 });
    assert.throws(() => assertPromoCode("29" + "0".repeat(11)), { status: 400 });
    assert.equal(assertPromoCode("SALE10"), "SALE10");
});

test("policy rejects percent above POS max", () => {
    assert.throws(
        () => enforcePromotionPolicy(basePromo({ discount_value: 50, discount_percent: 50 }), { now }),
        { status: 400 }
    );
});

test("policy rejects elevated discount without min order floor", () => {
    assert.throws(
        () => enforcePromotionPolicy(basePromo({
            discount_value: 20,
            discount_percent: 20,
            min_order_amount: 0,
            max_uses: 50,
            description: "VIP summer campaign glasses"
        }), { now }),
        { status: 400 }
    );
});

test("policy rejects unlimited uses on elevated discount", () => {
    assert.throws(
        () => enforcePromotionPolicy(basePromo({
            discount_value: 15,
            discount_percent: 15,
            min_order_amount: 1_500_000,
            max_uses: null
        }), { now }),
        { status: 400 }
    );
});

test("policy rejects amount discount over half of min order", () => {
    assert.throws(
        () => enforcePromotionPolicy(basePromo({
            discount_type: "amount",
            discount_value: 900_000,
            discount_percent: 0,
            min_order_amount: 1_500_000,
            max_uses: 50
        }), { now }),
        { status: 400 }
    );
});

test("policy accepts valid SALE10-style campaign", () => {
    assert.equal(enforcePromotionPolicy(basePromo(), { now, isCreate: true }), true);
});

test("policy accepts amount FIX200K style", () => {
    assert.equal(
        enforcePromotionPolicy(basePromo({
            code: "FIX200K",
            discount_type: "amount",
            discount_value: 200_000,
            discount_percent: 0,
            min_order_amount: 1_500_000,
            max_uses: 200,
            description: "Giảm cố định 200k"
        }), { now, isCreate: true }),
        true
    );
});

test("service create rejects nonsense free codes", async () => {
    const service = createPromotionsService({
        create: async () => ({ insertId: 1 }),
        findAll: async () => []
    });

    await assert.rejects(
        () => service.create({
            code: "FREE100",
            discount_type: "percent",
            discount_value: 10,
            min_order_amount: 1_500_000,
            max_uses: 10,
            start_date: "2026-07-10",
            end_date: "2026-08-10",
            description: "bad"
        }),
        { status: 400 }
    );
});

test("service create accepts policy-compliant payload", async () => {
    const calls = [];
    const service = createPromotionsService({
        create: async (promo) => {
            calls.push(promo);
            return { insertId: 99 };
        }
    });

    const result = await service.create({
        code: "summer15",
        discount_type: "percent",
        discount_value: 15,
        min_order_amount: 2_000_000,
        max_uses: 100,
        start_date: "2026-07-10",
        end_date: "2026-08-20",
        description: "Khuyến mãi hè kính mát",
        is_active: 1
    });

    assert.equal(result.id, 99);
    assert.equal(result.code, "SUMMER15");
    assert.equal(calls[0].code, "SUMMER15");
    assert.equal(calls[0].discount_percent, 15);
});

test("buildDefaultCreateDraft returns dated window", () => {
    const draft = buildDefaultCreateDraft(now);
    assert.equal(draft.start_date, "2026-07-10");
    assert.equal(draft.end_date, "2026-08-09");
    assert.equal(draft.min_order_amount, POS_PROMO_POLICY.catalogMinPriceBand);
});

test("getPolicy exposes templates for admin UI", () => {
    const service = createPromotionsService({});
    const policy = service.getPolicy();
    assert.ok(Array.isArray(policy.templates));
    assert.ok(policy.templates.length >= 3);
    assert.ok(policy.notes.length >= 3);
});
