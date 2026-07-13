const fs = require("node:fs");
const path = require("node:path");

const knowledgePath = path.join(__dirname, "knowledge", "pos-policies.md");

function tokenize(value) {
    return new Set(String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]{2,}/g) || []);
}

function createLocalRag() {
    const source = fs.readFileSync(knowledgePath, "utf8");
    const chunks = source.split(/\n(?=## )/).map((text, index) => ({ id: `pos-policies-v1-${index + 1}`, text, tokens: tokenize(text) }));
    return {
        retrieve(query, limit = 3) {
            const queryTokens = tokenize(query);
            return chunks.map((chunk) => ({
                ...chunk,
                score: [...queryTokens].reduce((score, token) => score + (chunk.tokens.has(token) ? 1 : 0), 0)
            })).filter((chunk) => chunk.score > 0).sort((a, b) => b.score - a.score).slice(0, limit)
                .map(({ id, text, score }) => ({ id, text, score }));
        }
    };
}

module.exports = { createLocalRag, tokenize };
