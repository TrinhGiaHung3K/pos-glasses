/**
 * POS Glasses — AI assistant floating chat.
 *
 * Visual language inspired by Meta Astryx Chat components:
 * ChatLayout, ChatMessage, ChatMessageBubble, ChatMessageMetadata,
 * ChatSystemMessage, ChatComposer, ChatSendButton.
 * @see https://astryx.atmeta.com/components/ChatMessage
 *
 * Vanilla DOM (no React). Brand tokens from base.css.
 */
(function initPosAiAssistant(window, document) {
    const user = typeof window.getCurrentUser === "function" ? window.getCurrentUser() : null;
    if (!user || typeof window.apiRequest !== "function") return;

    const ROLE_LABEL = user.role === "admin" ? "Admin" : "NV";
    const USER_INITIAL = String(user.username || "U").trim().charAt(0).toUpperCase() || "U";
    const WELCOME =
        user.role === "admin"
            ? "Tôi có thể tìm sản phẩm, giải thích quy trình và phân tích doanh thu."
            : "Tôi có thể tìm sản phẩm và giải thích quy trình bán hàng.";

    /* ─── Icons (inline SVG so FAB works without Phosphor on every host page) ─── */
    const ICONS = {
        sparkle: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.4 4.2L18 8.6l-4.2 1.4L12 14l-1.4-4-4.2-1.4 4.2-1.4L12 3z"/><path d="M5 14l.7 2.1L8 17l-2.3.7L5 20l-.7-2.3L2 17l2.3-.9L5 14z"/><path d="M18 13l.6 1.8 1.8.6-1.8.6L18 18l-.6-1.8L15.6 15.6l1.8-.6L18 13z"/></svg>',
        close: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
        send: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
        bot: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="7" width="14" height="11" rx="3"/><path d="M9 7V5a3 3 0 016 0v2"/><circle cx="9.5" cy="12.5" r="1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="12.5" r="1" fill="currentColor" stroke="none"/></svg>'
    };

    /* ─── Styles: Astryx Chat patterns × POS brand tokens ─── */
    const style = document.createElement("style");
    style.setAttribute("data-ai-assistant", "1");
    style.textContent = `
/* Design read: floating AI chat widget for POS staff.
   Astryx Chat-fluent layout · POS teal accent lock · density balanced. */

.ai-fab {
    position: fixed;
    right: 22px;
    bottom: 22px;
    z-index: 9000;
    width: 56px;
    height: 56px;
    border: 0;
    border-radius: 999px;
    display: grid;
    place-items: center;
    cursor: pointer;
    color: #fff;
    background: var(--accent-color, #0f766e);
    box-shadow:
        0 1px 2px rgba(20, 32, 31, 0.06),
        0 10px 28px -6px rgba(15, 118, 110, 0.42);
    transition:
        transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
        box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1),
        background-color 0.16s ease;
}
.ai-fab:hover {
    background: var(--accent-hover, #0b5f59);
    transform: translateY(-2px);
    box-shadow:
        0 4px 8px rgba(20, 32, 31, 0.08),
        0 16px 36px -8px rgba(15, 118, 110, 0.48);
}
.ai-fab:active { transform: scale(0.96); }
.ai-fab:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--accent-glow, rgba(15, 118, 110, 0.28)), 0 10px 28px -6px rgba(15, 118, 110, 0.42);
}
.ai-fab[aria-expanded="true"] {
    background: var(--bg-sidebar, #10201d);
    box-shadow: 0 8px 24px rgba(16, 32, 29, 0.28);
}
.ai-fab-label {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
}

/* ChatLayout shell */
.ai-panel {
    position: fixed;
    right: 22px;
    bottom: 90px;
    z-index: 9001;
    width: min(400px, calc(100vw - 28px));
    height: min(620px, calc(100vh - 120px));
    display: none;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg-surface, #fff);
    border: 1px solid var(--border-color, rgba(20, 32, 31, 0.1));
    border-radius: 20px;
    box-shadow:
        0 4px 8px -2px rgba(20, 32, 31, 0.06),
        0 28px 64px -12px rgba(20, 32, 31, 0.18);
    font-family: inherit;
    color: var(--text-primary, #14201f);
}
.ai-panel.open {
    display: flex;
    animation: ai-panel-in 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes ai-panel-in {
    from { opacity: 0; transform: translateY(12px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}

/* Header */
.ai-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-shrink: 0;
    padding: 14px 14px 14px 16px;
    border-bottom: 1px solid var(--border-color, rgba(20, 32, 31, 0.1));
    background:
        linear-gradient(180deg, rgba(229, 245, 242, 0.55), rgba(255, 255, 255, 0));
}
.ai-head-main {
    display: flex;
    align-items: center;
    gap: 11px;
    min-width: 0;
}
.ai-head-copy { min-width: 0; }
.ai-head-title {
    margin: 0;
    font-size: 14.5px;
    font-weight: 750;
    letter-spacing: -0.02em;
    line-height: 1.25;
    color: var(--text-primary, #14201f);
}
.ai-head-sub {
    margin: 2px 0 0;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted, #758582);
}
.ai-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--success-color, #16a34a);
    box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.16);
    flex-shrink: 0;
}
.ai-icon-btn {
    width: 34px;
    height: 34px;
    border: 0;
    border-radius: 10px;
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-secondary, #465957);
    background: transparent;
    transition: background-color 0.16s ease, color 0.16s ease, transform 0.12s ease;
}
.ai-icon-btn:hover {
    background: var(--bg-muted, #eaf0f2);
    color: var(--text-primary, #14201f);
}
.ai-icon-btn:active { transform: scale(0.96); }
.ai-icon-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--accent-glow, rgba(15, 118, 110, 0.28));
}

/* Avatars (Astryx Avatar-like) */
.ai-avatar {
    width: 32px;
    height: 32px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    font-size: 12.5px;
    font-weight: 800;
    letter-spacing: -0.02em;
}
.ai-avatar--bot {
    color: var(--accent-color, #0f766e);
    background: var(--accent-light, #e5f5f2);
    border: 1px solid rgba(15, 118, 110, 0.14);
}
.ai-avatar--user {
    color: #fff;
    background: var(--bg-sidebar, #10201d);
}
.ai-avatar--sm {
    width: 28px;
    height: 28px;
    font-size: 11.5px;
}

/* Message list (ChatMessageList: role=log) */
.ai-log {
    flex: 1;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding: 16px 14px 10px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    background:
        radial-gradient(ellipse 90% 50% at 50% 0%, rgba(15, 118, 110, 0.04), transparent 60%),
        var(--bg-primary, #f3f6f8);
    scrollbar-width: thin;
    scrollbar-color: rgba(15, 118, 110, 0.28) transparent;
}

/* ChatSystemMessage */
.ai-system {
    align-self: center;
    max-width: 92%;
    margin: 2px 0 4px;
    padding: 0 8px;
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.45;
    color: var(--text-muted, #758582);
}

/* ChatMessage row */
.ai-msg {
    display: flex;
    gap: 10px;
    max-width: 100%;
    animation: ai-msg-in 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes ai-msg-in {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
}
.ai-msg[data-sender="user"] {
    flex-direction: row-reverse;
}
.ai-msg-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    max-width: min(86%, 300px);
}
.ai-msg[data-sender="user"] .ai-msg-body {
    align-items: flex-end;
}
.ai-msg[data-sender="assistant"] .ai-msg-body {
    align-items: flex-start;
}
.ai-msg-name {
    padding: 0 4px;
    font-size: 11.5px;
    font-weight: 700;
    color: var(--text-muted, #758582);
    line-height: 1.2;
}
.ai-msg[data-sender="user"] .ai-msg-name {
    text-align: end;
}

/* ChatMessageBubble */
.ai-bubble {
    border-radius: 18px;
    padding: 10px 13px;
    font-size: 13.5px;
    line-height: 1.5;
    overflow-wrap: break-word;
    word-break: break-word;
}
.ai-bubble.ai-plain {
    white-space: pre-wrap;
}
.ai-msg[data-sender="assistant"] .ai-bubble {
    background: var(--bg-surface, #fff);
    color: var(--text-primary, #14201f);
    border: 1px solid var(--border-color, rgba(20, 32, 31, 0.1));
    border-bottom-left-radius: 6px;
    box-shadow: 0 1px 2px rgba(20, 32, 31, 0.04);
}
.ai-msg[data-sender="user"] .ai-bubble {
    background: var(--accent-color, #0f766e);
    color: #fff;
    border: 1px solid transparent;
    border-bottom-right-radius: 6px;
    box-shadow: 0 4px 12px -4px rgba(15, 118, 110, 0.35);
    white-space: pre-wrap;
}

/* Markdown inside assistant bubbles */
.ai-bubble.ai-md {
    white-space: normal;
}
.ai-bubble.ai-md > :first-child { margin-top: 0; }
.ai-bubble.ai-md > :last-child { margin-bottom: 0; }
.ai-bubble.ai-md p {
    margin: 0 0 0.55em;
}
.ai-bubble.ai-md p:last-child { margin-bottom: 0; }
.ai-bubble.ai-md h1,
.ai-bubble.ai-md h2,
.ai-bubble.ai-md h3,
.ai-bubble.ai-md h4 {
    margin: 0.55em 0 0.3em;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.25;
    color: inherit;
}
.ai-bubble.ai-md h1 { font-size: 1.12em; }
.ai-bubble.ai-md h2 { font-size: 1.06em; }
.ai-bubble.ai-md h3,
.ai-bubble.ai-md h4 { font-size: 1em; }
.ai-bubble.ai-md ul,
.ai-bubble.ai-md ol {
    margin: 0.35em 0 0.55em;
    padding-left: 1.25em;
}
.ai-bubble.ai-md li {
    margin: 0.2em 0;
    padding-left: 0.1em;
}
.ai-bubble.ai-md li > ul,
.ai-bubble.ai-md li > ol {
    margin: 0.15em 0;
}
.ai-bubble.ai-md strong { font-weight: 750; }
.ai-bubble.ai-md em { font-style: italic; }
.ai-bubble.ai-md a {
    color: var(--accent-color, #0f766e);
    font-weight: 650;
    text-decoration: underline;
    text-underline-offset: 2px;
}
.ai-bubble.ai-md code {
    font-family: "Roboto Mono", "Cascadia Mono", Consolas, monospace;
    font-size: 0.9em;
    padding: 0.1em 0.35em;
    border-radius: 5px;
    background: var(--bg-muted, #eaf0f2);
    color: var(--text-primary, #14201f);
}
.ai-bubble.ai-md pre {
    margin: 0.45em 0 0.6em;
    padding: 10px 12px;
    border-radius: 10px;
    overflow: auto;
    background: var(--bg-muted, #eaf0f2);
    border: 1px solid var(--border-color, rgba(20, 32, 31, 0.1));
    max-width: 100%;
}
.ai-bubble.ai-md pre code {
    padding: 0;
    background: transparent;
    font-size: 0.86em;
    white-space: pre;
}
.ai-bubble.ai-md blockquote {
    margin: 0.4em 0 0.55em;
    padding: 0.15em 0 0.15em 0.75em;
    border-left: 3px solid rgba(15, 118, 110, 0.35);
    color: var(--text-secondary, #465957);
}
.ai-bubble.ai-md hr {
    border: 0;
    border-top: 1px solid var(--border-color, rgba(20, 32, 31, 0.12));
    margin: 0.65em 0;
}
.ai-bubble.ai-md table {
    border-collapse: collapse;
    width: 100%;
    margin: 0.4em 0 0.55em;
    font-size: 0.92em;
}
.ai-bubble.ai-md th,
.ai-bubble.ai-md td {
    border: 1px solid var(--border-color, rgba(20, 32, 31, 0.12));
    padding: 4px 7px;
    text-align: left;
}
.ai-bubble.ai-md th {
    background: var(--bg-muted, #eaf0f2);
    font-weight: 750;
}

/* ChatMessageMetadata */
.ai-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 0 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted, #758582);
    line-height: 1.3;
}
.ai-msg[data-sender="user"] .ai-meta {
    flex-direction: row-reverse;
}
.ai-meta-dot {
    opacity: 0.45;
}

/* Typing / streaming wait */
.ai-bubble.is-waiting {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    color: var(--text-secondary, #465957);
}
.ai-typing {
    display: inline-flex;
    gap: 4px;
    align-items: center;
}
.ai-typing span {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--accent-color, #0f766e);
    opacity: 0.45;
    animation: ai-dot 1.2s ease-in-out infinite;
}
.ai-typing span:nth-child(2) { animation-delay: 0.15s; }
.ai-typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes ai-dot {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
    40% { transform: translateY(-3px); opacity: 1; }
}

/* Composer dock (ChatLayout frosted dock + ChatComposer) */
.ai-dock {
    flex-shrink: 0;
    padding: 10px 12px 12px;
    border-top: 1px solid var(--border-color, rgba(20, 32, 31, 0.1));
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.96));
    backdrop-filter: blur(14px) saturate(1.1);
    -webkit-backdrop-filter: blur(14px) saturate(1.1);
}
.ai-composer {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    align-items: end;
    padding: 8px 8px 8px 12px;
    border: 1px solid var(--border-color, rgba(20, 32, 31, 0.12));
    border-radius: 18px;
    background: var(--bg-surface, #fff);
    box-shadow: 0 1px 2px rgba(20, 32, 31, 0.04);
    transition: border-color 0.16s ease, box-shadow 0.16s ease;
}
.ai-composer:focus-within {
    border-color: var(--accent-color, #0f766e);
    box-shadow: 0 0 0 3px var(--accent-glow, rgba(15, 118, 110, 0.18));
}
.ai-composer textarea {
    width: 100%;
    min-height: 40px;
    max-height: 120px;
    resize: none;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--text-primary, #14201f);
    font: inherit;
    font-size: 13.5px;
    line-height: 1.45;
    padding: 8px 0;
    field-sizing: content;
}
.ai-composer textarea::placeholder {
    color: var(--text-muted, #758582);
}
.ai-composer textarea:disabled {
    opacity: 0.65;
    cursor: not-allowed;
}

/* ChatSendButton — circular primary */
.ai-send {
    width: 40px;
    height: 40px;
    border: 0;
    border-radius: 999px;
    display: grid;
    place-items: center;
    cursor: pointer;
    color: #fff;
    background: var(--accent-color, #0f766e);
    flex-shrink: 0;
    transition:
        background-color 0.16s ease,
        transform 0.12s ease,
        opacity 0.16s ease;
}
.ai-send:hover:not(:disabled) {
    background: var(--accent-hover, #0b5f59);
}
.ai-send:active:not(:disabled) {
    transform: scale(0.94);
}
.ai-send:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--accent-glow, rgba(15, 118, 110, 0.28));
}
.ai-send:disabled {
    opacity: 0.38;
    cursor: not-allowed;
}
.ai-hint {
    margin: 7px 4px 0;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted, #758582);
    text-align: center;
    line-height: 1.5;
}
/* All key labels (Enter / Shift) share the same white text on accent chips */
.ai-hint kbd {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 6px;
    border: 1px solid transparent;
    background: var(--accent-color, #0f766e);
    color: #ffffff !important;
    font-family: inherit;
    font-size: 10.5px;
    font-weight: 750;
    letter-spacing: 0.01em;
    line-height: 1.35;
    box-shadow: 0 1px 2px rgba(15, 118, 110, 0.2);
    -webkit-appearance: none;
    appearance: none;
}
.ai-hint-sep {
    margin: 0 0.35em;
    opacity: 0.55;
}

@media (prefers-reduced-motion: reduce) {
    .ai-fab,
    .ai-send,
    .ai-icon-btn { transition: none; }
    .ai-panel.open,
    .ai-msg { animation: none; }
    .ai-typing span { animation: none; opacity: 0.55; }
}
@media (prefers-reduced-transparency: reduce) {
    .ai-dock {
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        background: var(--bg-surface, #fff);
    }
}
@media (max-width: 480px) {
    .ai-fab { right: 14px; bottom: 14px; }
    .ai-panel {
        right: 10px;
        left: 10px;
        bottom: 78px;
        width: auto;
        height: min(70vh, 560px);
        border-radius: 16px;
    }
}
`;
    document.head.appendChild(style);

    /* ─── DOM shell ─── */
    const fab = document.createElement("button");
    fab.type = "button";
    fab.className = "ai-fab";
    fab.setAttribute("aria-label", "Mở trợ lý AI");
    fab.setAttribute("aria-expanded", "false");
    fab.setAttribute("aria-controls", "pos-ai-panel");
    fab.innerHTML = `${ICONS.sparkle}<span class="ai-fab-label">Trợ lý AI</span>`;

    const panel = document.createElement("section");
    panel.id = "pos-ai-panel";
    panel.className = "ai-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", "pos-ai-title");
    panel.innerHTML = `
        <header class="ai-head">
            <div class="ai-head-main">
                <div class="ai-avatar ai-avatar--bot" aria-hidden="true">${ICONS.bot}</div>
                <div class="ai-head-copy">
                    <h2 class="ai-head-title" id="pos-ai-title">Trợ lý POS Glasses</h2>
                    <p class="ai-head-sub"><span class="ai-status-dot" aria-hidden="true"></span> Sẵn sàng hỗ trợ</p>
                </div>
            </div>
            <button type="button" class="ai-icon-btn" data-ai-close aria-label="Đóng trợ lý AI">${ICONS.close}</button>
        </header>
        <div class="ai-log" data-ai-log role="log" aria-live="polite" aria-relevant="additions"></div>
        <div class="ai-dock">
            <form class="ai-composer" data-ai-form>
                <textarea
                    rows="1"
                    maxlength="2000"
                    placeholder="Hỏi về sản phẩm, tồn kho, quy trình…"
                    data-ai-input
                    enterkeyhint="send"
                    aria-label="Tin nhắn cho trợ lý AI"
                    aria-keyshortcuts="Enter"
                ></textarea>
                <button type="submit" class="ai-send" data-ai-send disabled aria-label="Gửi tin nhắn">${ICONS.send}</button>
            </form>
            <p class="ai-hint" data-ai-hint>
                <kbd>Enter</kbd> gửi
                <span class="ai-hint-sep" aria-hidden="true">·</span>
                <kbd>Shift</kbd>+<kbd>Enter</kbd> xuống dòng
            </p>
        </div>
    `;

    document.body.append(panel, fab);

    const log = panel.querySelector("[data-ai-log]");
    const form = panel.querySelector("[data-ai-form]");
    const input = panel.querySelector("[data-ai-input]");
    const sendBtn = panel.querySelector("[data-ai-send]");
    const closeBtn = panel.querySelector("[data-ai-close]");

    let busy = false;

    function escapeHtml(value) {
        if (typeof window.escapeHtml === "function") return window.escapeHtml(value);
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function formatTime(date = new Date()) {
        return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    }

    function scrollLog() {
        log.scrollTop = log.scrollHeight;
    }

    function syncSendEnabled() {
        sendBtn.disabled = busy || !input.value.trim();
    }

    function autoResize() {
        input.style.height = "auto";
        input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
    }

    /**
     * Safe markdown → HTML for assistant replies.
     * Escape first, then open a limited subset: headings, lists, bold/italic,
     * code, links (http/https only), blockquotes, hr, simple tables.
     */
    function renderMarkdown(source) {
        const raw = String(source ?? "").replace(/\r\n?/g, "\n");
        if (!raw.trim()) return "";

        const fences = [];
        let text = raw.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
            const i = fences.length;
            fences.push(
                `<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ""}>${escapeHtml(code.replace(/\n$/, ""))}</code></pre>`
            );
            return `\u0000FENCE${i}\u0000`;
        });

        text = escapeHtml(text);

        // Restore fenced blocks (already escaped)
        text = text.replace(/\u0000FENCE(\d+)\u0000/g, (_, i) => fences[Number(i)] || "");

        const lines = text.split("\n");
        const out = [];
        const paraBuf = [];
        let i = 0;

        function flushParagraph() {
            if (!paraBuf.length) return;
            const joined = paraBuf.join("\n").replace(/\n/g, "<br>");
            out.push(`<p>${formatInline(joined)}</p>`);
            paraBuf.length = 0;
        }

        function formatInline(s) {
            // Inline code first
            s = s.replace(/`([^`\n]+)`/g, (_, code) => `<code>${code}</code>`);
            // Bold **text** or __text__
            s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
            s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
            // Italic *text* or _text_
            s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
            s = s.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
            // Links [label](url) — http/https only
            s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, href) => {
                const safeHref = href.replace(/"/g, "");
                return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${label}</a>`;
            });
            return s;
        }

        while (i < lines.length) {
            const line = lines[i];

            // Already-injected fence blocks
            if (line.startsWith("<pre>")) {
                flushParagraph();
                out.push(line);
                i += 1;
                continue;
            }

            // Horizontal rule
            if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
                flushParagraph();
                out.push("<hr>");
                i += 1;
                continue;
            }

            // Headings
            const heading = line.match(/^\s*(#{1,4})\s+(.+)$/);
            if (heading) {
                flushParagraph();
                const level = heading[1].length;
                out.push(`<h${level}>${formatInline(heading[2].trim())}</h${level}>`);
                i += 1;
                continue;
            }

            // Blockquote
            if (/^\s*&gt;\s?/.test(line)) {
                flushParagraph();
                const quote = [];
                while (i < lines.length && /^\s*&gt;\s?/.test(lines[i])) {
                    quote.push(lines[i].replace(/^\s*&gt;\s?/, ""));
                    i += 1;
                }
                out.push(`<blockquote><p>${formatInline(quote.join("<br>"))}</p></blockquote>`);
                continue;
            }

            // Unordered list
            if (/^\s*[-*+]\s+/.test(line)) {
                flushParagraph();
                const items = [];
                while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
                    items.push(`<li>${formatInline(lines[i].replace(/^\s*[-*+]\s+/, ""))}</li>`);
                    i += 1;
                }
                out.push(`<ul>${items.join("")}</ul>`);
                continue;
            }

            // Ordered list
            if (/^\s*\d+\.\s+/.test(line)) {
                flushParagraph();
                const items = [];
                while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
                    items.push(`<li>${formatInline(lines[i].replace(/^\s*\d+\.\s+/, ""))}</li>`);
                    i += 1;
                }
                out.push(`<ol>${items.join("")}</ol>`);
                continue;
            }

            // Simple GFM table (header | --- | rows)
            if (
                line.includes("|")
                && i + 1 < lines.length
                && /^\s*\|?[\s:|-]+\|[\s:|-]+/.test(lines[i + 1])
            ) {
                flushParagraph();
                const parseRow = (row) => row
                    .replace(/^\s*\|/, "")
                    .replace(/\|\s*$/, "")
                    .split("|")
                    .map((c) => c.trim());
                const headers = parseRow(line);
                i += 2; // skip header + separator
                const rows = [];
                while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
                    rows.push(parseRow(lines[i]));
                    i += 1;
                }
                const thead = `<thead><tr>${headers.map((h) => `<th>${formatInline(h)}</th>`).join("")}</tr></thead>`;
                const tbody = `<tbody>${rows.map((r) =>
                    `<tr>${headers.map((_, idx) => `<td>${formatInline(r[idx] || "")}</td>`).join("")}</tr>`
                ).join("")}</tbody>`;
                out.push(`<table>${thead}${tbody}</table>`);
                continue;
            }

            // Blank line → paragraph break
            if (!line.trim()) {
                flushParagraph();
                i += 1;
                continue;
            }

            // Paragraph lines
            paraBuf.push(line);
            i += 1;
            while (
                i < lines.length
                && lines[i].trim()
                && !lines[i].startsWith("<pre>")
                && !/^\s*(#{1,4})\s+/.test(lines[i])
                && !/^\s*[-*+]\s+/.test(lines[i])
                && !/^\s*\d+\.\s+/.test(lines[i])
                && !/^\s*&gt;\s?/.test(lines[i])
                && !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])
            ) {
                if (
                    lines[i].includes("|")
                    && i + 1 < lines.length
                    && /^\s*\|?[\s:|-]+\|[\s:|-]+/.test(lines[i + 1])
                ) break;
                paraBuf.push(lines[i]);
                i += 1;
            }
            flushParagraph();
        }

        flushParagraph();
        return out.join("") || `<p>${formatInline(escapeHtml(raw))}</p>`;
    }

    function setBubbleContent(bubble, text, { markdown = false, waiting = false } = {}) {
        if (!bubble) return;
        bubble.classList.remove("is-waiting", "ai-md", "ai-plain");
        if (waiting) {
            bubble.classList.add("is-waiting", "ai-plain");
            bubble.innerHTML =
                `<span class="ai-typing" aria-hidden="true"><span></span><span></span><span></span></span>`
                + `<span data-ai-wait-label>${escapeHtml(text)}</span>`;
            return;
        }
        if (markdown) {
            bubble.classList.add("ai-md");
            bubble.innerHTML = renderMarkdown(text);
        } else {
            bubble.classList.add("ai-plain");
            bubble.textContent = text;
        }
    }

    /**
     * Append a ChatMessage-style row.
     * @param {"user"|"assistant"} sender
     * @param {string} text
     * @param {{ waiting?: boolean, meta?: string, name?: string, markdown?: boolean }} [opts]
     */
    function addMessage(sender, text, opts = {}) {
        const row = document.createElement("article");
        row.className = "ai-msg";
        row.dataset.sender = sender;

        const isUser = sender === "user";
        const useMarkdown = !isUser && !opts.waiting && opts.markdown !== false;
        const name = opts.name || (isUser ? (user.username || "Bạn") : "Trợ lý AI");
        const avatarHtml = isUser
            ? `<div class="ai-avatar ai-avatar--user ai-avatar--sm" aria-hidden="true">${escapeHtml(USER_INITIAL)}</div>`
            : `<div class="ai-avatar ai-avatar--bot ai-avatar--sm" aria-hidden="true">${ICONS.bot}</div>`;

        const bubbleClass = opts.waiting
            ? "ai-bubble is-waiting ai-plain"
            : useMarkdown
                ? "ai-bubble ai-md"
                : "ai-bubble ai-plain";

        const bodyHtml = opts.waiting
            ? `<span class="ai-typing" aria-hidden="true"><span></span><span></span><span></span></span><span data-ai-wait-label>${escapeHtml(text)}</span>`
            : useMarkdown
                ? renderMarkdown(text)
                : escapeHtml(text);

        const metaHtml = opts.meta
            ? `<div class="ai-meta"><span>${escapeHtml(formatTime())}</span><span class="ai-meta-dot" aria-hidden="true">·</span><span>${escapeHtml(opts.meta)}</span></div>`
            : opts.waiting
                ? ""
                : `<div class="ai-meta"><span>${escapeHtml(formatTime())}</span></div>`;

        row.innerHTML = `
            ${avatarHtml}
            <div class="ai-msg-body">
                <div class="ai-msg-name">${escapeHtml(name)}</div>
                <div class="${bubbleClass}" data-ai-bubble>${bodyHtml}</div>
                <div data-ai-meta-slot>${metaHtml}</div>
            </div>
        `;

        log.appendChild(row);
        scrollLog();
        return row;
    }

    function addSystem(text) {
        const el = document.createElement("div");
        el.className = "ai-system";
        el.setAttribute("role", "status");
        el.textContent = text;
        log.appendChild(el);
        scrollLog();
        return el;
    }

    function setOpen(open) {
        panel.classList.toggle("open", open);
        fab.setAttribute("aria-expanded", open ? "true" : "false");
        fab.setAttribute("aria-label", open ? "Đóng trợ lý AI" : "Mở trợ lý AI");
        if (open) {
            input.focus();
            scrollLog();
        }
    }

    /* Seed conversation */
    addSystem("Cuộc trò chuyện bắt đầu");
    addMessage("assistant", WELCOME, {
        name: "Trợ lý AI",
        meta: `Dành cho ${ROLE_LABEL}`
    });

    fab.addEventListener("click", () => {
        setOpen(!panel.classList.contains("open"));
    });
    closeBtn.addEventListener("click", () => setOpen(false));

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && panel.classList.contains("open")) {
            setOpen(false);
            fab.focus();
        }
    });

    input.addEventListener("input", () => {
        syncSendEnabled();
        autoResize();
    });

    /**
     * Enter = send, Shift+Enter = newline (default browser behavior).
     * Skip while IME is composing (Vietnamese Telex/VNI, etc.).
     */
    function isEnterKey(event) {
        return event.key === "Enter"
            || event.code === "Enter"
            || event.code === "NumpadEnter"
            || event.keyCode === 13;
    }

    function isComposingInput(event) {
        return Boolean(
            event.isComposing
            || event.keyCode === 229
            || (input && input.getAttribute("data-composing") === "1")
        );
    }

    function isSendEnter(event) {
        if (!isEnterKey(event)) return false;
        // Shift+Enter → newline; leave default behavior
        if (event.shiftKey) return false;
        if (event.altKey || event.ctrlKey || event.metaKey) return false;
        if (isComposingInput(event)) return false;
        return true;
    }

    function submitComposer() {
        if (busy) return;
        if (!String(input.value || "").trim()) return;
        // Prefer requestSubmit so the submit listener runs with native form semantics
        if (typeof form.requestSubmit === "function") {
            try {
                form.requestSubmit(sendBtn);
                return;
            } catch {
                /* fall through */
            }
        }
        form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    }

    input.addEventListener("compositionstart", () => {
        input.setAttribute("data-composing", "1");
    });
    input.addEventListener("compositionend", () => {
        input.removeAttribute("data-composing");
        syncSendEnabled();
    });

    // Capture phase so page-level handlers cannot swallow Enter first
    input.addEventListener("keydown", (event) => {
        if (!isEnterKey(event)) return;

        // Shift+Enter: allow newline, do not submit
        if (event.shiftKey) return;

        if (isComposingInput(event)) return;
        if (event.altKey || event.ctrlKey || event.metaKey) return;

        // Plain Enter → send
        event.preventDefault();
        event.stopPropagation();
        submitComposer();
    }, true);

    // Block bare Enter on keypress (legacy / some mobile WebViews)
    input.addEventListener("keypress", (event) => {
        if (!isSendEnter(event)) return;
        event.preventDefault();
    }, true);

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const message = input.value.trim();
        if (!message || busy) return;

        busy = true;
        syncSendEnabled();
        input.value = "";
        autoResize();

        addMessage("user", message, { name: user.username || "Bạn", markdown: false });
        const waiting = addMessage("assistant", "Đang tra cứu dữ liệu…", {
            waiting: true,
            name: "Trợ lý AI"
        });
        log.setAttribute("aria-busy", "true");

        const bubble = waiting.querySelector("[data-ai-bubble]");
        const metaSlot = waiting.querySelector("[data-ai-meta-slot]");

        try {
            const endpoint = user.role === "admin" ? "/api/admin/ai/chat" : "/api/staff/ai/chat";
            const result = await apiRequest(endpoint, { method: "POST", body: { message } });
            const answer = result.answer || "Không có câu trả lời.";

            setBubbleContent(bubble, answer, { markdown: true });

            const parts = [];
            if (result.model) parts.push(String(result.model));
            if (result.sources?.length) parts.push(`${result.sources.length} nguồn`);
            const metaText = parts.length ? parts.join(" · ") : null;

            metaSlot.innerHTML = metaText
                ? `<div class="ai-meta"><span>${escapeHtml(formatTime())}</span><span class="ai-meta-dot" aria-hidden="true">·</span><span>${escapeHtml(metaText)}</span></div>`
                : `<div class="ai-meta"><span>${escapeHtml(formatTime())}</span></div>`;
        } catch (error) {
            setBubbleContent(bubble, error.message || "AI hiện không sẵn sàng.", { markdown: false });
            bubble.classList.add("ai-plain");
            metaSlot.innerHTML = `<div class="ai-meta"><span>${escapeHtml(formatTime())}</span><span class="ai-meta-dot" aria-hidden="true">·</span><span>Lỗi</span></div>`;
        } finally {
            busy = false;
            log.removeAttribute("aria-busy");
            syncSendEnabled();
            scrollLog();
            input.focus();
        }
    });

    // Expose for smoke tests
    window.__posAiMarkdown = renderMarkdown;

    syncSendEnabled();
})(window, document);
