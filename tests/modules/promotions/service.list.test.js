const assert = require("node:assert/strict");
const test = require("node:test");
const { createPromotionsService } = require("../../../src/modules/promotions/service");

function sampleRows() {
    return [
        {
            id: 1,
            code: "SALE10",
            discount_type: "percent",
            discount_percent: 10,
            discount_value: 10,
            min_order_amount: 0,
            max_uses: 100,
            used_count: 5,
            is_active: 1,
            description: "Giảm 10%",
            start_date: "2026-01-01",
            end_date: "2026-12-31"
        },
        {
            id: 2,
            code: "OLD20",
            discount_type: "percent",
            discount_percent: 20,
            discount_value: 20,
            min_order_amount: 0,
            max_uses: null,
            used_count: 0,
            is_active: 1,
            description: "Hết hạn",
            start_date: "2025-01-01",
            end_date: "2025-06-01"
        },
        {
            id: 3,
            code: "OFF",
            discount_type: "amount",
            discount_percent: 0,
            discount_value: 100000,
            min_order_amount: 500000,
            max_uses: 10,
            used_count: 10,
            is_active: 0,
            description: "Tắt",
            start_date: null,
            end_date: null
        }
    ];
}

test("list returns items + summary with lifecycle", async () => {
    const service = createPromotionsService({
        findAll: async () => sampleRows()
    });

    const result = await service.list();
    assert.equal(result.items.length, 3);
    assert.equal(result.summary.total, 3);
    assert.ok(result.summary.live >= 1);
    assert.ok(result.summary.expired >= 1);
    assert.ok(result.summary.disabled >= 1);

    const sale = result.items.find((item) => item.code === "SALE10");
    assert.equal(sale.lifecycle, "live");
    assert.equal(sale.remaining_uses, 95);
});

test("list filters by lifecycle and type", async () => {
    const service = createPromotionsService({
        findAll: async () => sampleRows()
    });

    const expired = await service.list({ lifecycle: "expired" });
    assert.ok(expired.items.every((item) => item.lifecycle === "expired"));

    const amount = await service.list({ discount_type: "amount" });
    assert.ok(amount.items.every((item) => item.discount_type === "amount"));
});

test("findByCode rejects expired codes", async () => {
    const service = createPromotionsService({
        findByCode: async () => [sampleRows()[1]]
    });

    await assert.rejects(
        () => service.findByCode("OLD20", { subtotal: 1000000 }),
        { status: 400 }
    );
});

test("findByCode accepts live percent code", async () => {
    const service = createPromotionsService({
        findByCode: async () => [sampleRows()[0]]
    });

    const result = await service.findByCode("SALE10", { subtotal: 1000000 });
    assert.equal(result[0].code, "SALE10");
    assert.equal(result[0].estimated_discount, 100000);
});
