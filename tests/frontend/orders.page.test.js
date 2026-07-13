const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "../..");
const ordersPath = path.join(rootDir, "frontend/orders.html");
const componentsCssPath = path.join(rootDir, "frontend/assets/css/components.css");

function readCssRule(css, selector) {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));

    assert.ok(match, `Missing CSS rule for ${selector}`);
    return match[1];
}

test("orders page retries barcode lookup on the legacy staff-allowed endpoint after a 403", () => {
    const html = fs.readFileSync(ordersPath, "utf8");

    assert.match(html, /api\/staff\/customers\/member/);
    assert.match(html, /customers\/member/);
    assert.match(html, /error\.status === 403/);
});

test("orders page provides POS member barcode scan mode", () => {
    const html = fs.readFileSync(ordersPath, "utf8");

    assert.match(html, /id="memberScanButton"/);
    assert.match(html, /startMemberBarcodeScan/);
    assert.match(html, /stopMemberBarcodeScan/);
    assert.match(html, /normalizeMemberBarcodeInput/);
    assert.match(html, /handleMemberBarcodeInput/);
    assert.match(html, /queueMemberBarcodeVerification/);
    assert.match(html, /memberBarcodeScanTimer/);
    assert.match(html, /setTimeout\(\(\) => verifyMemberBarcode\(\), 120\)/);
    assert.match(html, /event\.key === "Enter"[\s\S]*event\.key === "Tab"/);
    assert.match(html, /classList\.add\("is-scanning"\)/);
    assert.match(html, /select\(\)/);
    assert.doesNotMatch(html, /CUS\$\{/);
});

test("orders page uses phone barcode scanning instead of browser camera scanning", () => {
    const html = fs.readFileSync(ordersPath, "utf8");

    assert.match(html, /id="memberPhoneScanButton"/);
    assert.match(html, /startPhoneBarcodeScan/);
    assert.match(html, /renderPhoneScannerGuide/);
    assert.match(html, /Barcode to PC/);
    assert.match(html, /api\/staff\/performance\/me/);
    assert.match(html, /renderStaffPerformanceCard/);
    assert.match(html, /staff-rank-progress/);
    assert.doesNotMatch(html, /\/vendor\/zxing-browser/);
    assert.doesNotMatch(html, /id="memberCameraScanButton"/);
    assert.doesNotMatch(html, /id="cameraBarcodeVideo"/);
    assert.doesNotMatch(html, /openCameraBarcodeScanner/);
    assert.doesNotMatch(html, /ZXingBrowser/);
    assert.doesNotMatch(html, /decodeFromConstraints/);
});

test("orders page provides Barcode to PC QR pairing guide", () => {
    const html = fs.readFileSync(ordersPath, "utf8");
    const customerBarcodeRow = html.match(/<div class="pos-customer-bar-row">[\s\S]*?<\/div>/);

    assert.ok(customerBarcodeRow, "Missing customer barcode action row");
    assert.match(html, /<div class="pos-title-row">[\s\S]*id="memberPhonePairButton"/);
    assert.match(html, /id="memberPhonePairButton"/);
    assert.match(html, /Kết nối điện thoại/);
    assert.match(html, /id="phonePairModal"/);
    assert.match(html, /openPhonePairGuide/);
    assert.match(html, /closePhonePairGuide/);
    assert.match(html, /Barcode to PC Server/);
    assert.match(html, /Web POS không tự sinh QR pair/);
    assert.match(html, /Info/);
    assert.match(html, /Select server/);
    assert.match(html, /Sẵn sàng quét khách/);
    assert.doesNotMatch(customerBarcodeRow[0], /id="memberPhonePairButton"/);
    assert.doesNotMatch(html, /getUserMedia/);
});

test("orders page keeps POS product cards visually contained", () => {
    const css = fs.readFileSync(componentsCssPath, "utf8");
    const gridRule = readCssRule(css, ".pos-product-grid");
    const tileRule = readCssRule(css, ".pos-product-tile");
    const imageRule = readCssRule(css, ".pos-product-image");
    const imageElementRule = readCssRule(css, ".pos-product-image img");

    assert.match(gridRule, /align-items:\s*stretch;/);
    assert.match(gridRule, /grid-auto-rows:\s*minmax\(\s*\d+px,\s*(?:auto|\d+px)\s*\);/);
    assert.doesNotMatch(gridRule, /grid-auto-rows:\s*1fr;/);
    assert.match(tileRule, /height:\s*100%;/);
    assert.match(tileRule, /min-width:\s*0;/);
    assert.match(tileRule, /overflow:\s*hidden;/);
    assert.match(imageRule, /aspect-ratio:\s*5\s*\/\s*3;/);
    assert.match(imageRule, /width:\s*100%;/);
    assert.match(imageElementRule, /display:\s*block;/);
    assert.match(imageElementRule, /object-fit:\s*contain;/);
    assert.match(imageElementRule, /padding:\s*10px;/);
});

test("orders checkout button does not cover summary totals", () => {
    const html = fs.readFileSync(ordersPath, "utf8");
    const checkoutButtonRule = readCssRule(html, ".pos-checkout-btn");

    assert.doesNotMatch(checkoutButtonRule, /position:\s*sticky;/);
    assert.doesNotMatch(checkoutButtonRule, /bottom:\s*0;/);
});

test("orders checkout button has a reserved bottom rail action row", () => {
    const html = fs.readFileSync(ordersPath, "utf8");
    const css = fs.readFileSync(componentsCssPath, "utf8");
    const actionRule = readCssRule(css, ".pos-checkout-rail-action");

    assert.match(html, /<div class="pos-checkout-rail-action">\s*<button class="pos-checkout-btn" id="checkoutButton"/);
    assert.match(actionRule, /flex-shrink:\s*0;/);
    assert.match(actionRule, /padding:\s*\d+px\s+14px\s+\d+px;/);
    assert.match(actionRule, /background:\s*var\(--bg-surface\);/);
    assert.doesNotMatch(actionRule, /overflow-y:\s*auto;/);
});

test("orders checkout rail keeps the checkout action visible while payment controls can scroll", () => {
    const css = fs.readFileSync(componentsCssPath, "utf8");
    const railBodyRule = readCssRule(css, ".pos-checkout-rail-body");
    const railFooterRule = readCssRule(css, ".pos-checkout-rail-footer");
    const railActionRule = readCssRule(css, ".pos-checkout-rail-action");

    assert.match(railBodyRule, /flex:\s*0\s+1\s+auto;/);
    assert.match(railBodyRule, /max-height:\s*clamp\(\s*\d+px,\s*\d+vh,\s*\d+px\s*\);/);
    assert.match(railBodyRule, /min-height:\s*0;/);
    assert.match(railBodyRule, /overflow-y:\s*auto;/);
    assert.match(railFooterRule, /flex:\s*1\s+1\s+auto;/);
    assert.match(railFooterRule, /min-height:\s*0;/);
    assert.match(railFooterRule, /overflow-y:\s*auto;/);
    assert.match(railActionRule, /flex-shrink:\s*0;/);
    assert.doesNotMatch(railActionRule, /overflow-y:\s*auto;/);
});

test("orders product grid leaves action buttons visible at the viewport edge", () => {
    const css = fs.readFileSync(componentsCssPath, "utf8");
    const productGridRule = readCssRule(css, ".pos-product-grid");
    const productBodyRule = readCssRule(css, ".pos-product-body");
    const productImageRule = readCssRule(css, ".pos-product-image");

    assert.match(productGridRule, /grid-auto-rows:\s*minmax\(\s*286px,\s*(?:auto|286px)\s*\);/);
    assert.match(productGridRule, /padding-bottom:\s*24px;/);
    assert.match(productBodyRule, /gap:\s*6px;/);
    assert.match(productBodyRule, /padding:\s*10px\s+12px;/);
    assert.match(productBodyRule, /overflow:\s*hidden;/);
    assert.match(productImageRule, /aspect-ratio:\s*5\s*\/\s*3;/);

    const productBodyBtnRule = readCssRule(css, ".pos-product-body .btn");
    assert.match(productBodyBtnRule, /flex-shrink:\s*0;/);
    assert.match(productBodyBtnRule, /margin-top:\s*auto;/);

    const productNameRule = readCssRule(css, ".pos-product-name");
    assert.match(productNameRule, /line-clamp:\s*2;/);
    assert.match(productNameRule, /overflow:\s*hidden;/);
});

test("orders page resolves same-origin product QR URLs before adding to cart", () => {
    const html = fs.readFileSync(ordersPath, "utf8");
    assert.match(html, /function parseProductQrCode/);
    assert.match(html, /parsed\.origin !== window\.location\.origin/);
    assert.match(html, /\/api\/staff\/products\/by-qr\//);
    assert.match(html, /addToCart\(Number\(product\.id\)\)/);
});

test("bank transfer waiting overlay uses the shared visible modal state", () => {
    const html = fs.readFileSync(ordersPath, "utf8");
    assert.match(html, /overlay\.className = "modal-overlay"/);
    assert.match(html, /requestAnimationFrame\(\(\) => overlay\.classList\.add\("modal-visible"\)\)/);
    assert.doesNotMatch(html, /modal-overlay show/);
});

test("bank transfer waiting dialog has structured payment details and development simulation", () => {
    const html = fs.readFileSync(ordersPath, "utf8");

    assert.match(html, /class="modal-dialog payment-wait-dialog"/);
    assert.match(html, /class="payment-wait-code-box"/);
    assert.match(html, /id="paymentWaitingCountdown"/);
    assert.match(html, /id="paymentCopyButton"/);
    assert.match(html, /id="paymentSimulateButton"/);
    assert.match(html, /payment-intents\/\$\{encodeURIComponent\(intent\.public_id\)\}\/simulate/);
    assert.match(html, /Ẩn và tiếp tục chờ/);
});
