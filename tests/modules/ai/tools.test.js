const assert = require("node:assert/strict");
const test = require("node:test");
const { createAiTools, normalizeSort } = require("../../../src/modules/ai/tools");

test("sales tool is admin-only", async () => {
    const tools = createAiTools({ dashboard: { getSummary: async () => ({ revenue: 10 }) } });
    await assert.rejects(
        () => tools.execute("get_sales_summary", { range: "7d" }, { role: "staff" }),
        { status: 403 }
    );
    assert.deepEqual(
        await tools.execute("get_sales_summary", { range: "7d" }, { role: "admin" }),
        { revenue: 10 }
    );
});

test("product tool returns allowlisted commercial fields and forwards sort/price filters", async () => {
    const calls = [];
    const tools = createAiTools({
        products: {
            list: async (query) => {
                calls.push(query);
                return [
                    {
                        id: 1,
                        name: "Police VPLD94",
                        brand: "Police",
                        sku: "PL004",
                        price: 1690000,
                        cost_price: 900000,
                        quantity: 14
                    }
                ];
            }
        }
    });

    const result = await tools.execute(
        "search_products",
        { sort_by: "price_asc", limit: 5, in_stock: true },
        { role: "staff" }
    );

    assert.equal(result[0].price, 1690000);
    assert.equal(result[0].sku, "PL004");
    assert.equal("cost_price" in result[0], false);
    assert.equal(calls[0].sort, "price_asc");
    assert.equal(calls[0].in_stock, "1");
    assert.equal(calls[0].limit, 5);
    assert.equal(calls[0].page, 1);
});

test("normalizeSort maps ranking aliases", () => {
    assert.equal(normalizeSort("price_asc"), "price_asc");
    assert.equal(normalizeSort("cheapest"), "price_asc");
    assert.equal(normalizeSort("price_desc"), "price_desc");
    assert.equal(normalizeSort("unknown"), "id_desc");
});

test("price ranking defaults to higher limit and price_asc sort", async () => {
    const calls = [];
    const tools = createAiTools({
        products: {
            list: async (query) => {
                calls.push(query);
                return [];
            }
        }
    });

    await tools.execute("search_products", { sort_by: "price_asc" }, { role: "admin" });
    assert.equal(calls[0].sort, "price_asc");
    assert.equal(calls[0].limit, 8);
});
