const { GoogleGenAI } = require("@google/genai");

function createGeminiGateway(config = {}) {
    const client = config.apiKey ? new GoogleGenAI({ apiKey: config.apiKey }) : null;

    function ensureClient() {
        if (!client) {
            throw Object.assign(new Error("Gemini API key chưa được cấu hình"), { status: 503 });
        }
        return client;
    }

    return {
        /**
         * Chat + optional function calling (assistant widget).
         */
        async generate({ model, message, systemInstruction, declarations, executeTool }) {
            const ai = ensureClient();
            const generationConfig = {
                systemInstruction,
                tools: declarations?.length ? [{ functionDeclarations: declarations }] : undefined,
                temperature: 0.2,
                maxOutputTokens: 2048
            };
            const first = await ai.models.generateContent({ model, contents: message, config: generationConfig });
            const calls = first.functionCalls || [];
            if (!calls.length || typeof executeTool !== "function") {
                return { text: first.text || "", toolNames: [], usage: first.usageMetadata || {} };
            }
            const functionResponses = [];
            for (const call of calls.slice(0, 4)) {
                const result = await executeTool(call.name, call.args || {});
                functionResponses.push({ functionResponse: { name: call.name, response: { result }, id: call.id } });
            }
            const contents = [
                { role: "user", parts: [{ text: message }] },
                first.candidates?.[0]?.content,
                { role: "user", parts: functionResponses }
            ].filter(Boolean);
            const final = await ai.models.generateContent({ model, contents, config: generationConfig });
            return {
                text: final.text || "",
                toolNames: calls.map((call) => call.name),
                usage: final.usageMetadata || first.usageMetadata || {}
            };
        },

        /**
         * Single-shot text generation (insights / structured analysis).
         * No tools — caller supplies grounded snapshot in the prompt.
         */
        async generateText({
            model,
            message,
            systemInstruction,
            temperature = 0.25,
            maxOutputTokens = 2048,
            json = false
        }) {
            const ai = ensureClient();
            const generationConfig = {
                systemInstruction,
                temperature,
                maxOutputTokens
            };
            if (json) {
                generationConfig.responseMimeType = "application/json";
            }
            const result = await ai.models.generateContent({
                model,
                contents: message,
                config: generationConfig
            });
            return {
                text: result.text || "",
                toolNames: [],
                usage: result.usageMetadata || {}
            };
        }
    };
}

module.exports = { createGeminiGateway };
