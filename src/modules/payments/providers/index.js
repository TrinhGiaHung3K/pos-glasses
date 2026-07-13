const { createFakePaymentProvider } = require("./fake");
const { createSePayProvider } = require("./sepay");

function createPaymentProvider(config = {}) {
    if (config.provider === "sepay") return createSePayProvider(config);
    return createFakePaymentProvider(config);
}

module.exports = { createPaymentProvider };
