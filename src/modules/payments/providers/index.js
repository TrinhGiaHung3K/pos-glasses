const { createFakePaymentProvider } = require("./fake");
const { createSePayProvider } = require("./sepay");

function createPaymentProvider(config = {}) {
    if (config.provider === "sepay") return createSePayProvider(config);
    if (config.provider === "fake") return createFakePaymentProvider(config);
    throw new Error(`Payment provider không được hỗ trợ: ${config.provider || "(trống)"}`);
}

module.exports = { createPaymentProvider };
