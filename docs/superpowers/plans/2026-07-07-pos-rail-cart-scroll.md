# POS Rail Cart Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the POS checkout rail use a bounded cart-list scroll area, keep checkout visible, and keep product-card `Thêm` buttons visible.

**Architecture:** Keep the static HTML and vanilla JavaScript architecture. Add CSS contract tests, then adjust only the POS component/page CSS for scroll ownership, compact footer spacing, and product-card height.

**Tech Stack:** Static HTML, CSS, Bootstrap classes already present, Node test runner.

---

## File Structure

- Modify `tests/frontend/orders.page.test.js`: add CSS regression checks for right-rail scroll ownership, reserved checkout action row, and product grid action visibility.
- Modify `frontend/assets/css/components.css`: make `.pos-checkout-rail-body` the only scroll area for cart lines, remove footer scrolling, reserve checkout action space, and reduce product card row height.
- Modify `frontend/orders.html`: move the checkout button into a dedicated bottom rail action row and compact page-local payment controls.

### Task 1: Regression Tests

**Files:**
- Modify: `tests/frontend/orders.page.test.js`
- Test: `npm test -- tests/frontend/orders.page.test.js`

- [ ] **Step 1: Add tests**

Add assertions that:

```js
const railBodyRule = readCssRule(css, ".pos-checkout-rail-body");
const railFooterRule = readCssRule(css, ".pos-checkout-rail-footer");
const railActionRule = readCssRule(css, ".pos-checkout-rail-action");
const productGridRule = readCssRule(css, ".pos-product-grid");
const productBodyRule = readCssRule(css, ".pos-product-body");

assert.match(railBodyRule, /flex:\s*0\s+0\s+auto;/);
assert.match(railBodyRule, /max-height:\s*clamp\(/);
assert.match(railBodyRule, /overflow-y:\s*auto;/);
assert.match(railFooterRule, /flex-shrink:\s*0;/);
assert.match(railFooterRule, /overflow:\s*visible;/);
assert.doesNotMatch(railFooterRule, /overflow-y:\s*auto;/);
assert.match(railActionRule, /flex-shrink:\s*0;/);
assert.match(railActionRule, /padding:\s*\d+px\s+14px\s+\d+px;/);
assert.doesNotMatch(railActionRule, /overflow-y:\s*auto;/);
assert.match(productGridRule, /grid-auto-rows:\s*minmax\(\s*286px,\s*auto\s*\);/);
assert.match(productGridRule, /padding-bottom:\s*24px;/);
assert.match(productBodyRule, /padding:\s*10px\s+12px;/);
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- tests/frontend/orders.page.test.js
```

Expected: FAIL because the current checkout button still lives inside the footer and there is no reserved action row.

### Task 2: CSS Fix

**Files:**
- Modify: `frontend/assets/css/components.css`
- Modify: `frontend/orders.html`
- Test: `npm test -- tests/frontend/orders.page.test.js`

- [ ] **Step 1: Implement CSS changes**

Change rail and product CSS so:

```css
.pos-checkout-rail-body {
    flex: 0 0 auto;
    max-height: clamp(82px, 12vh, 108px);
    min-height: 76px;
    overflow-y: auto;
}

.pos-checkout-rail-footer {
    flex-shrink: 0;
    overflow: visible;
}

.pos-checkout-rail-action {
    flex-shrink: 0;
    padding: 7px 14px 12px;
}

.pos-product-grid {
    grid-auto-rows: minmax(286px, auto);
    padding-bottom: 24px;
}

.pos-product-body {
    padding: 10px 12px;
}
```

Move `#checkoutButton` from inside `.pos-checkout-rail-footer` into a new `.pos-checkout-rail-action` sibling after the footer. Also compact page-local payment controls in `orders.html`.

- [ ] **Step 2: Verify GREEN**

Run:

```bash
npm test -- tests/frontend/orders.page.test.js
```

Expected: PASS.

### Task 3: Final Verification

**Files:**
- Verify: all changed files.

- [ ] **Step 1: Run full tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run brace smoke check**

Run:

```bash
node -e "for (const f of ['frontend/assets/css/base.css','frontend/assets/css/layout.css','frontend/assets/css/components.css','frontend/orders.html']) { const s=require('fs').readFileSync(f,'utf8'); if ((s.match(/{/g)||[]).length !== (s.match(/}/g)||[]).length) throw new Error(f); } console.log('brace-check ok');"
```

Expected: `brace-check ok`.
