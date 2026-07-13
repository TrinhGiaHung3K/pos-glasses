/**
 * Smoke test for the inline markdown renderer in aiAssistant.js.
 * Extracts renderMarkdown without running the full IIFE.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function loadRenderMarkdown() {
    const src = fs.readFileSync(
        path.join(__dirname, "../../frontend/assets/js/aiAssistant.js"),
        "utf8"
    );
    const start = src.indexOf("function renderMarkdown");
    const end = src.indexOf("function setBubbleContent");
    assert.ok(start > 0 && end > start, "renderMarkdown block not found");
    const fnSrc = src.slice(start, end);
    const escapeHtml = (value) => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    // eslint-disable-next-line no-new-func
    return new Function("escapeHtml", `${fnSrc}\nreturn renderMarkdown;`)(escapeHtml);
}

test("markdown renders bold, lists, code, and escapes HTML", () => {
    const renderMarkdown = loadRenderMarkdown();

    const bold = renderMarkdown("**Police** and `PL004`");
    assert.match(bold, /<strong>Police<\/strong>/);
    assert.match(bold, /<code>PL004<\/code>/);

    const list = renderMarkdown("- one\n- two");
    assert.match(list, /<ul>/);
    assert.match(list, /<li>one<\/li>/);

    const ordered = renderMarkdown("1. A\n2. B");
    assert.match(ordered, /<ol>/);

    const heading = renderMarkdown("### Title\n\nBody");
    assert.match(heading, /<h3>Title<\/h3>/);
    assert.match(heading, /<p>Body<\/p>/);

    const link = renderMarkdown("[site](https://example.com)");
    assert.match(link, /href="https:\/\/example.com"/);
    assert.match(link, /rel="noopener noreferrer"/);

    const xss = renderMarkdown("Hi <script>alert(1)</script>");
    assert.equal(xss.includes("<script"), false);
    assert.match(xss, /&lt;script&gt;/);

    const fence = renderMarkdown("```js\nconst x = 1;\n```");
    assert.match(fence, /<pre><code class="language-js">/);
    assert.match(fence, /const x = 1;/);
});
