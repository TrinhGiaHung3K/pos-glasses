function routeModel(message, config, role) {
    const text = String(message || "").toLowerCase();
    const complex = role === "admin" && /(phân tích|xu hướng|so sánh|doanh thu|lợi nhuận|bất thường|tại sao|vì sao)/i.test(text);
    return complex ? config.analysisModel : config.defaultModel;
}

module.exports = { routeModel };
