/**
 * In-process pub/sub for QR table-order realtime (SSE).
 * Single-node only — sufficient for POS LAN deploy.
 */

const { EventEmitter } = require("node:events");

const hub = new EventEmitter();
hub.setMaxListeners(100);

function publishTableOrderEvent(event) {
    hub.emit("table-order", {
        at: new Date().toISOString(),
        ...event
    });
}

function subscribeTableOrderEvents(listener) {
    hub.on("table-order", listener);
    return () => hub.off("table-order", listener);
}

module.exports = {
    publishTableOrderEvent,
    subscribeTableOrderEvents
};
