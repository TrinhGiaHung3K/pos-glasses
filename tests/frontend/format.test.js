const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const rootDir = path.resolve(__dirname, "../..");
const formatPath = path.join(rootDir, "frontend/assets/js/format.js");

function loadFormatHelpers() {
    const code = fs.readFileSync(formatPath, "utf8");
    const window = {};
    vm.runInNewContext(code, { window });
    return window;
}

test("formatCurrencyInputValue groups VND digits without a space before the currency suffix", () => {
    const window = loadFormatHelpers();

    assert.equal(window.formatCurrencyInputValue("2800000"), "2.800.000đ");
    assert.equal(window.formatCurrencyInputValue("abc001200"), "1.200đ");
    assert.equal(window.formatCurrencyInputValue(""), "");
});

test("parseCurrencyInputValue converts formatted VND text back to a number", () => {
    const window = loadFormatHelpers();

    assert.equal(window.parseCurrencyInputValue("2.800.000đ"), 2800000);
    assert.equal(window.parseCurrencyInputValue(" 120.000 "), 120000);
    assert.equal(window.parseCurrencyInputValue(""), 0);
});

test("parseCurrencyInputValue keeps MySQL DECIMAL strings from becoming inflated integers", () => {
    const window = loadFormatHelpers();

    assert.equal(window.parseCurrencyInputValue("2890000.00"), 2890000);
    assert.equal(window.parseCurrencyInputValue("2890000.5"), 2890001);
    assert.equal(window.parseCurrencyInputValue(2890000), 2890000);
    assert.equal(window.formatCurrencyInputValue("2890000.00"), "2.890.000đ");
    assert.equal(window.parseCurrencyInputValue(window.formatCurrencyInputValue("2890000.00")), 2890000);
});

test("formatCurrencyInputEdit keeps the caret before the VND suffix so backspace deletes digits", () => {
    const window = loadFormatHelpers();

    const result = window.formatCurrencyInputEdit("2.800.000", "2.800.000".length);

    assert.equal(result.value, "2.800.000đ");
    assert.equal(result.selectionStart, "2.800.000".length);
    assert.equal(result.selectionEnd, "2.800.000".length);
});

test("formatCurrencyInputEdit keeps caret near the edited digit after regrouping", () => {
    const window = loadFormatHelpers();

    const result = window.formatCurrencyInputEdit("2800000", 3);

    assert.equal(result.value, "2.800.000đ");
    assert.equal(result.selectionStart, 4);
    assert.equal(result.selectionEnd, 4);
});

test("formatCurrencyInputValue formats millions with vi-VN thousand dots", () => {
    const window = loadFormatHelpers();
    assert.equal(window.formatCurrencyInputValue(3000000), "3.000.000đ");
    assert.equal(window.formatCurrencyInputValue("3000000"), "3.000.000đ");
    assert.equal(window.parseCurrencyInputValue("3.000.000đ"), 3000000);
});

test("money input auto-bind exports are available", () => {
    const window = loadFormatHelpers();
    assert.equal(typeof window.attachMoneyInput, "function");
    assert.equal(typeof window.enhanceMoneyInputs, "function");
    assert.equal(typeof window.getMoneyInputValue, "function");
    assert.equal(typeof window.setMoneyInputValue, "function");
    assert.equal(typeof window.isMoneyInput, "function");
});

test("isMoneyInput detects explicit data-money and price name heuristics", () => {
    const window = loadFormatHelpers();

    function makeInput(props = {}) {
        const el = {
            tagName: "INPUT",
            name: props.name || "",
            id: props.id || "",
            className: "",
            dataset: { ...(props.dataset || {}) },
            attributes: {},
            type: "text",
            value: "",
            classList: {
                _set: new Set(props.className ? props.className.split(/\s+/) : []),
                add(c) { this._set.add(c); },
                contains(c) { return this._set.has(c); }
            },
            setAttribute(k, v) {
                this.attributes[k] = String(v);
                if (k === "data-money") this.dataset.money = String(v);
            },
            getAttribute(k) {
                if (k === "name") return this.name || null;
                if (k === "id") return this.id || null;
                return this.attributes[k] ?? null;
            },
            matches(selector) {
                const parts = String(selector).split(",").map((s) => s.trim());
                return parts.some((part) => {
                    if (part.includes("[data-money]") && this.dataset.money
                        && this.dataset.money !== "false" && this.dataset.money !== "0") {
                        return true;
                    }
                    if (part.includes(".pos-money-input") && this.classList.contains("pos-money-input")) {
                        return true;
                    }
                    if (part.includes(".js-money-input") && this.classList.contains("js-money-input")) {
                        return true;
                    }
                    return false;
                });
            }
        };
        if (props.dataMoney != null) {
            el.dataset.money = props.dataMoney;
            el.attributes["data-money"] = props.dataMoney;
        }
        return el;
    }

    assert.equal(window.isMoneyInput(makeInput({ dataMoney: "vnd" })), true);
    assert.equal(window.isMoneyInput(makeInput({ name: "price" })), true);
    assert.equal(window.isMoneyInput(makeInput({ id: "amountPaid" })), true);
    assert.equal(window.isMoneyInput(makeInput({ name: "quantity" })), false);
    assert.equal(window.isMoneyInput(makeInput({ name: "price", dataMoney: "false" })), false);
});
