# Phone Barcode Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace browser camera customer barcode scanning with Barcode to PC phone scanning on the POS screen.

**Architecture:** Keep the existing member barcode lookup and keyboard-wedge flow. Remove ZXing camera code and dependency, then add a phone scanner mode that focuses the member input and waits for Barcode to PC to type the scanned code into the page.

**Tech Stack:** Node.js, Express, static HTML/CSS/JS, Phosphor icons, Bootstrap styles, Node test runner.

---

## File Structure

- Modify `tests/frontend/orders.page.test.js`: update contracts from camera scanning to phone scanner mode.
- Modify `tests/frontend-components.test.js`: remove ZXing dependency expectations and preserve dashboard ranking checks.
- Modify `frontend/orders.html`: remove camera modal/script/state/functions, add phone scanner UI and guide state.
- Modify `src/app.js`: remove `/vendor/zxing-browser` static route.
- Modify `package.json` and `package-lock.json`: remove `@zxing/browser`.

## Task 1: Failing Phone Scanner Contracts

- [ ] **Step 1: Update `tests/frontend/orders.page.test.js` camera test**

Replace the camera scanner test with a phone scanner contract:

```js
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
```

- [ ] **Step 2: Update `tests/frontend-components.test.js` dependency contract**

Replace the camera dependency test with:

```js
test("phone barcode scanner mode removes camera dependency and keeps staff ranking hooks", () => {
    const packageJson = JSON.parse(read("package.json"));
    const app = read("src/app.js");
    const orders = read("frontend/orders.html");
    const dashboard = read("frontend/dashboard.html");

    assert.equal(packageJson.dependencies["@zxing/browser"], undefined);
    assert.doesNotMatch(app, /\/vendor\/zxing-browser/);
    assert.match(orders, /id="memberPhoneScanButton"/);
    assert.match(orders, /Barcode to PC/);
    assert.match(app, /staffPerformance/);
    assert.match(dashboard, /staffPerformanceLeaderboard/);
    assert.match(dashboard, /loadStaffPerformanceLeaderboard/);
    assert.match(dashboard, /api\/admin\/staff-performance/);
    assert.match(dashboard, /staff-performance-progress/);
});
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
npm test -- tests/frontend/orders.page.test.js tests/frontend-components.test.js
```

Expected: fail because `orders.html`, `src/app.js`, and `package.json` still expose camera/ZXing.

## Task 2: Remove Camera Dependency

- [ ] **Step 1: Remove `@zxing/browser`**

Run:

```bash
npm uninstall @zxing/browser
```

- [ ] **Step 2: Remove vendor route from `src/app.js`**

Delete:

```js
app.use("/vendor/zxing-browser", express.static(path.join(__dirname, "..", "node_modules", "@zxing", "browser")));
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
npm test -- tests/frontend/orders.page.test.js tests/frontend-components.test.js
```

Expected: still fail on missing phone scanner UI and remaining camera markup.

## Task 3: POS Phone Scanner UI

- [ ] **Step 1: Remove camera CSS, modal, script, state, and functions from `frontend/orders.html`**

Remove selectors and code containing:

```text
camera-scan-overlay
camera-scan-dialog
camera-scan-frame
cameraBarcodeModal
cameraBarcodeVideo
memberCameraScanButton
setCameraBarcodeStatus
openCameraBarcodeScanner
closeCameraBarcodeScanner
ZXingBrowser
decodeFromConstraints
cameraReader
cameraControls
```

- [ ] **Step 2: Add phone scanner guide CSS**

Add compact guide styles near the customer bar styles:

```css
.pos-phone-scan-guide {
    display: none;
    gap: 8px;
    padding: 8px 10px;
    border: 1px dashed rgba(15, 118, 110, 0.32);
    border-radius: var(--radius-xs);
    background: rgba(240, 253, 250, 0.72);
    color: var(--text-secondary);
    font-size: 12px;
    line-height: 1.35;
}

.pos-phone-scan-guide.is-open {
    display: grid;
}

.pos-phone-scan-guide strong {
    color: var(--text-primary);
}
```

- [ ] **Step 3: Replace the camera button with a phone button**

Use:

```html
<button class="btn btn-secondary btn-sm" id="memberPhoneScanButton" type="button" onclick="startPhoneBarcodeScan()" title="Quet bang dien thoai">
    <i class="ph ph-device-mobile-camera"></i>
</button>
```

- [ ] **Step 4: Add guide markup below member status**

Use:

```html
<div class="pos-phone-scan-guide" id="phoneScannerGuide">
    <div><strong>Barcode to PC</strong> dang cho ma tu dien thoai.</div>
    <div>Mo ung dung tren dien thoai, ket noi voi may POS, roi quet barcode khach hang.</div>
</div>
```

- [ ] **Step 5: Add phone scanner functions**

Use:

```js
function renderPhoneScannerGuide(isOpen) {
    const guide = document.getElementById("phoneScannerGuide");
    guide.classList.toggle("is-open", Boolean(isOpen));
}

function startPhoneBarcodeScan() {
    startMemberBarcodeScan();
    renderPhoneScannerGuide(true);
    showToast("Dang cho ma tu Barcode to PC", "info");
}
```

- [ ] **Step 6: Close the guide when customer state changes**

Call `renderPhoneScannerGuide(false)` in `setSelectedCustomer()` and `clearSelectedCustomer()`.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```bash
npm test -- tests/frontend/orders.page.test.js tests/frontend-components.test.js
```

Expected: pass.

## Task 4: Final Verification

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Static scan for removed camera hooks**

Run:

```bash
rg -n --glob "!node_modules/**" "zxing-browser|ZXingBrowser|cameraBarcode|memberCameraScanButton|openCameraBarcodeScanner|decodeFromConstraints" .
```

Expected: no production references. Old docs may still mention the previous camera feature.

- [ ] **Step 3: Static scan for phone scanner hooks**

Run:

```bash
rg -n --glob "!node_modules/**" "memberPhoneScanButton|startPhoneBarcodeScan|Barcode to PC|phoneScannerGuide" frontend tests docs
```

Expected: `frontend/orders.html`, updated tests, and this spec/plan mention the phone scanner hooks.
