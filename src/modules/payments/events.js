const { EventEmitter } = require("node:events");
const hub = new EventEmitter();
hub.setMaxListeners(100);

function publishPaymentEvent(event) {
    hub.emit("payment", { at: new Date().toISOString(), ...event });
}

function subscribePaymentEvents(listener) {
    hub.on("payment", listener);
    return () => hub.off("payment", listener);
}

module.exports = { publishPaymentEvent, subscribePaymentEvents };
