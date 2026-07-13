/**
 * POS Glasses — currency display + money input system.
 *
 * Display: formatCurrency(3000000) -> "3.000.000 đ"
 * Input live: 3000000 typing -> "3.000.000đ" (vi-VN thousand dots)
 *
 * Auto-bind any money field via:
 *   - data-money / data-currency / class pos-money-input | js-money-input
 *   - id/name heuristics (price, amount_paid, cost_price, unit_cost, min_order_amount, …)
 *   - form modal field type: "money"
 *
 * Future fields: add data-money (or name/id matching) — MutationObserver binds automatically.
 */
(function attachFormatHelpers(window, document) {
    const MAX_CURRENCY_INTEGER = 9999999999;
    const BOUND_ATTR = "data-money-bound";

    /** Selector for explicit opt-in money inputs. */
    const MONEY_EXPLICIT_SELECTOR = [
        "input[data-money]:not([data-money='false']):not([data-money='0'])",
        "input[data-currency]:not([data-currency='false'])",
        "input.pos-money-input",
        "input.js-money-input"
    ].join(",");

    /**
     * id/name tokens that indicate a VND money field.
     * Avoid quantity, phone, percent, codes.
     */
    const MONEY_KEY_RE = /(^|_)(price|cost_price|unit_cost|unitcost|amount_paid|amountpaid|min_order_amount|minorder|stockunitcost|productformprice|quicksaleamountpaid|discount_amount)(_|$)|^(price|cost|amountpaid|amount_paid|unit_cost|stockunitcost|productformprice|quicksaleamountpaid)$/i;
    const MONEY_KEY_EXCLUDE_RE = /(quantity|qty|percent|phone|code|sku|barcode|member|search|email|user|pass|note|name|id$)/i;

    function formatCurrency(value) {
        return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
    }

    function currencyDigits(value) {
        return String(value ?? "").replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
    }

    /**
     * Convert API/DB numbers and UI-formatted money strings into whole dong.
     * Critical: "2890000.00" from MySQL must become 2890000, NOT 289000000.
     * Do NOT treat Vietnamese thousand grouping "120.000" as a JS decimal.
     */
    function toCurrencyInteger(value) {
        if (value == null || value === "") {
            return 0;
        }

        if (typeof value === "number" && Number.isFinite(value)) {
            return clampCurrencyInteger(Math.round(value));
        }

        if (typeof value === "bigint") {
            return clampCurrencyInteger(Number(value));
        }

        const raw = String(value).trim();
        if (!raw) {
            return 0;
        }

        if (/^-?\d+$/.test(raw)) {
            return clampCurrencyInteger(Number(raw));
        }

        // DB / plain decimal with 1-2 fractional digits only
        if (/^-?\d+\.\d{1,2}$/.test(raw)) {
            return clampCurrencyInteger(Math.round(Number(raw)));
        }

        const digits = currencyDigits(raw);
        return digits ? clampCurrencyInteger(Number(digits)) : 0;
    }

    function clampCurrencyInteger(amount) {
        if (!Number.isFinite(amount) || amount < 0) {
            return 0;
        }

        if (amount > MAX_CURRENCY_INTEGER) {
            return MAX_CURRENCY_INTEGER;
        }

        return Math.trunc(amount);
    }

    function formatCurrencyInputValue(value) {
        if (value === "" || value == null) {
            return "";
        }

        const amount = toCurrencyInteger(value);
        if (!amount) {
            const raw = String(value);
            const hasDigit = /\d/.test(raw);
            return hasDigit ? "0đ" : "";
        }

        return `${amount.toLocaleString("vi-VN")}đ`;
    }

    function countDigits(value) {
        return String(value ?? "").replace(/[^\d]/g, "").length;
    }

    function caretAfterDigitCount(formattedValue, digitCount) {
        if (digitCount <= 0) {
            return 0;
        }

        let seenDigits = 0;
        for (let index = 0; index < formattedValue.length; index += 1) {
            if (/\d/.test(formattedValue[index])) {
                seenDigits += 1;
            }

            if (seenDigits >= digitCount) {
                return index + 1;
            }
        }

        return Math.max(0, formattedValue.length - 1);
    }

    function formatCurrencyInputEdit(value, selectionStart = String(value ?? "").length) {
        const rawValue = String(value ?? "");
        const digits = currencyDigits(rawValue);
        const amount = digits ? clampCurrencyInteger(Number(digits)) : 0;
        const formattedValue = amount
            ? `${amount.toLocaleString("vi-VN")}đ`
            : digits
                ? "0đ"
                : "";

        if (!formattedValue) {
            return {
                value: "",
                selectionStart: 0,
                selectionEnd: 0
            };
        }

        const digitsBeforeCaret = Math.min(
            countDigits(rawValue.slice(0, Math.max(0, selectionStart))),
            String(amount || 0).length
        );
        const nextCaret = caretAfterDigitCount(formattedValue, digitsBeforeCaret);

        return {
            value: formattedValue,
            selectionStart: nextCaret,
            selectionEnd: nextCaret
        };
    }

    function parseCurrencyInputValue(value) {
        return toCurrencyInteger(value);
    }

    function formatDate(value) {
        if (!value) {
            return "";
        }

        return new Date(value).toLocaleString("vi-VN");
    }

    // ── Money input auto-bind ──────────────────────────────────────

    function inputMoneyKey(input) {
        return [input.id, input.name, input.getAttribute("name"), input.getAttribute("id")]
            .filter(Boolean)
            .join("|");
    }

    function isMoneyInput(input) {
        if (!input || input.tagName !== "INPUT") {
            return false;
        }

        if (input.matches(MONEY_EXPLICIT_SELECTOR)) {
            return true;
        }

        if (input.dataset.money === "false" || input.dataset.money === "0") {
            return false;
        }

        const key = inputMoneyKey(input);
        if (!key) {
            return false;
        }

        if (MONEY_KEY_EXCLUDE_RE.test(key) && !/price|amount|cost|min_order/i.test(key)) {
            return false;
        }

        return MONEY_KEY_RE.test(key.replace(/\|/g, "_"));
    }

    function prepareMoneyInputElement(input) {
        if (input.type === "number" || input.type === "tel") {
            input.type = "text";
        }
        input.setAttribute("inputmode", "numeric");
        input.setAttribute("autocomplete", "off");
        input.classList.add("pos-money-input");
        if (!input.dataset.money || input.dataset.money === "false") {
            input.dataset.money = "vnd";
        }
        if (input.placeholder === "" || input.placeholder == null) {
            input.placeholder = "0đ";
        }
    }

    function applyMoneyFormatToInput(input, selectionStart) {
        const caret = selectionStart != null
            ? selectionStart
            : (input.selectionStart ?? input.value.length);
        const next = formatCurrencyInputEdit(input.value, caret);
        if (input.value !== next.value) {
            input.value = next.value;
        }
        try {
            input.setSelectionRange(next.selectionStart, next.selectionEnd);
        } catch {
            // some input types may not support selection
        }
        return parseCurrencyInputValue(input.value);
    }

    function isMoneyBindingActive(input) {
        if (!input || input.getAttribute(BOUND_ATTR) !== "1") {
            return false;
        }
        // Allow temporary disable (e.g. manual discount % mode on POS)
        if (input.dataset.money === "false" || input.dataset.money === "0") {
            return false;
        }
        return true;
    }

    function onMoneyInputEvent(event) {
        const input = event.target;
        if (!isMoneyBindingActive(input)) {
            return;
        }
        const amount = applyMoneyFormatToInput(input, input.selectionStart);
        input.dispatchEvent(new CustomEvent("moneychange", {
            bubbles: true,
            detail: { amount, formatted: input.value }
        }));
    }

    function onMoneyBlurEvent(event) {
        const input = event.target;
        if (!isMoneyBindingActive(input)) {
            return;
        }
        // Normalize empty / trailing junk on blur
        if (!input.value || !/\d/.test(input.value)) {
            input.value = "";
            return;
        }
        input.value = formatCurrencyInputValue(input.value);
    }

    function onMoneyPasteEvent(event) {
        const input = event.target;
        if (!isMoneyBindingActive(input)) {
            return;
        }
        // Let paste land then format on next frame / input event
        requestAnimationFrame(() => {
            applyMoneyFormatToInput(input, input.value.length);
            input.dispatchEvent(new CustomEvent("moneychange", {
                bubbles: true,
                detail: {
                    amount: parseCurrencyInputValue(input.value),
                    formatted: input.value
                }
            }));
        });
    }

    /**
     * Bind live VND grouping to an input (idempotent).
     * @returns {HTMLInputElement|null}
     */
    function attachMoneyInput(input) {
        if (!input || input.tagName !== "INPUT") {
            return null;
        }
        if (input.getAttribute(BOUND_ATTR) === "1") {
            return input;
        }
        if (input.disabled || input.readOnly) {
            // Still mark for read formatting if it has a value
            prepareMoneyInputElement(input);
            if (input.value) {
                input.value = formatCurrencyInputValue(input.value);
            }
            input.setAttribute(BOUND_ATTR, "1");
            return input;
        }

        prepareMoneyInputElement(input);
        if (input.value) {
            input.value = formatCurrencyInputValue(input.value);
        }

        input.setAttribute(BOUND_ATTR, "1");
        // Capture phase so formatting runs before page oninput handlers
        input.addEventListener("input", onMoneyInputEvent, true);
        input.addEventListener("blur", onMoneyBlurEvent, true);
        input.addEventListener("paste", onMoneyPasteEvent, true);
        return input;
    }

    /**
     * Scan root for money inputs and bind them.
     * @param {ParentNode} [root=document]
     * @returns {number} count of newly/already bound fields
     */
    function enhanceMoneyInputs(root) {
        const scope = root && root.querySelectorAll ? root : document;
        let count = 0;

        scope.querySelectorAll("input").forEach((input) => {
            if (isMoneyInput(input)) {
                attachMoneyInput(input);
                count += 1;
            }
        });

        // Explicit selector catch-all (covers cases where name heuristics miss)
        if (scope.querySelectorAll) {
            scope.querySelectorAll(MONEY_EXPLICIT_SELECTOR).forEach((input) => {
                attachMoneyInput(input);
                count += 1;
            });
        }

        return count;
    }

    function getMoneyInputValue(inputOrId) {
        const input = typeof inputOrId === "string"
            ? document.getElementById(inputOrId)
            : inputOrId;
        if (!input) {
            return 0;
        }
        return parseCurrencyInputValue(input.value);
    }

    function setMoneyInputValue(inputOrId, amount) {
        const input = typeof inputOrId === "string"
            ? document.getElementById(inputOrId)
            : inputOrId;
        if (!input) {
            return;
        }
        attachMoneyInput(input);
        if (amount === "" || amount == null) {
            input.value = "";
            return;
        }
        input.value = formatCurrencyInputValue(amount);
    }

    let moneyObserver = null;

    function startMoneyInputObserver() {
        if (moneyObserver || !document.body) {
            return;
        }

        moneyObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type !== "childList") {
                    continue;
                }
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType !== 1) {
                        return;
                    }
                    if (node.matches && node.matches("input") && isMoneyInput(node)) {
                        attachMoneyInput(node);
                    }
                    if (node.querySelectorAll) {
                        enhanceMoneyInputs(node);
                    }
                });
            }
        });

        moneyObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function initMoneyInputs() {
        if (!document || !document.querySelectorAll) {
            return;
        }
        enhanceMoneyInputs(document);
        startMoneyInputObserver();
    }

    if (document && document.addEventListener) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", initMoneyInputs);
        } else {
            initMoneyInputs();
        }
    }

    window.formatCurrency = formatCurrency;
    window.formatCurrencyInputValue = formatCurrencyInputValue;
    window.formatCurrencyInputEdit = formatCurrencyInputEdit;
    window.parseCurrencyInputValue = parseCurrencyInputValue;
    window.toCurrencyInteger = toCurrencyInteger;
    window.formatDate = formatDate;
    window.attachMoneyInput = attachMoneyInput;
    window.enhanceMoneyInputs = enhanceMoneyInputs;
    window.getMoneyInputValue = getMoneyInputValue;
    window.setMoneyInputValue = setMoneyInputValue;
    window.isMoneyInput = isMoneyInput;
    window.initMoneyInputs = initMoneyInputs;
})(window, typeof document !== "undefined" ? document : null);
