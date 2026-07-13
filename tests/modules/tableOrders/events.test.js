const assert = require("node:assert/strict");
const test = require("node:test");
const {
    publishTableOrderEvent,
    subscribeTableOrderEvents
} = require("../../../src/modules/tableOrders/events");

test("table order events publish to subscribers", () => {
    const seen = [];
    const unsub = subscribeTableOrderEvents((ev) => seen.push(ev));
    publishTableOrderEvent({ type: "created", id: 42 });
    unsub();
    publishTableOrderEvent({ type: "created", id: 99 });

    assert.equal(seen.length, 1);
    assert.equal(seen[0].type, "created");
    assert.equal(seen[0].id, 42);
    assert.ok(seen[0].at);
});
