# Customer Member Card Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the temporary PG brand block on customer membership cards with the approved Optic Bridge logo in both preview and print output.

**Architecture:** Keep the existing customer-card builder and print-window template. Replace only their duplicated brand blocks with the same logo plate and asset, while preserving member data, barcode markup, CR80 dimensions, and print triggering.

**Tech Stack:** Static HTML/CSS, vanilla JavaScript template strings, Node built-in test runner.

---

### Task 1: Add a failing member-card logo test

**Files:**
- Modify: `tests/frontend-components.test.js`
- Test: `tests/frontend-components.test.js`

- [ ] **Step 1: Extend the existing customer barcode test**

Add these assertions to `customer admin exposes generated EAN-13 member barcodes`:

```js
    const logoRefs = source.match(/\/assets\/images\/pos-glasses-optic-bridge-logo\.png/g) || [];
    assert.equal(logoRefs.length, 2);
    assert.match(source, /class="pg-brand-logo-plate"/);
    assert.match(source, /class="pg-brand-logo"/);
    assert.match(source, /\.pg-brand-logo-plate/);
    assert.match(source, /\.pg-brand-logo/);
    assert.doesNotMatch(source, /\$\{STORE_BRAND\.mark\}/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/frontend-components.test.js`

Expected: FAIL because `customers.html` still renders `${STORE_BRAND.mark}` and has no member-card logo references.

### Task 2: Apply the logo to preview and print templates

**Files:**
- Modify: `frontend/customers.html`

- [ ] **Step 1: Replace the preview brand cluster**

Replace the temporary mark/name/tagline block inside `buildMemberCardHtml` with:

```html
<div class="pg-brand-logo-plate">
    <img
        class="pg-brand-logo"
        src="/assets/images/pos-glasses-optic-bridge-logo.png"
        alt="POS GLASSES"
    >
</div>
```

Keep the `Member` badge and all customer fields unchanged.

- [ ] **Step 2: Style the preview logo plate**

Replace `.pg-brand`, `.pg-brand-mark`, `.pg-brand-name`, and `.pg-brand-sub` with a 142 × 42 px warm-white `.pg-brand-logo-plate` and a 134 × 36 px `.pg-brand-logo`. Center the asset with `object-fit: cover` and `object-position: center`.

- [ ] **Step 3: Replace the print-template brand cluster**

Use the same image markup inside `printMemberCard`, before the existing `Member` badge. Remove the print template's temporary PG mark, name, and tagline.

- [ ] **Step 4: Style the print logo plate**

Define `.pg-brand-logo-plate` as 36 × 10 mm and `.pg-brand-logo` as 34 × 9 mm inside the print document CSS, with the same warm-white plate, centered crop, and rounded corners.

- [ ] **Step 5: Remove unused temporary brand config**

Keep `STORE_BRAND.name` for the print-window title, but remove the unused `mark` and `tagline` properties.

### Task 3: Verify the implementation

**Files:**
- Test: `tests/frontend-components.test.js`

- [ ] **Step 1: Run the focused test and verify GREEN**

Run: `node --test tests/frontend-components.test.js`

Expected: PASS, including the member-card logo assertions.

- [ ] **Step 2: Run the complete test suite**

Run: `npm test`

Expected: PASS with 101 existing tests and no failures.

- [ ] **Step 3: Check the final source contracts**

Run: `rg -n "pg-brand-logo|pos-glasses-optic-bridge-logo|STORE_BRAND.mark" frontend/customers.html`

Expected: two logo markup references and preview/print CSS rules; no `STORE_BRAND.mark` interpolation.

- [ ] **Step 4: Record the workspace state**

This workspace is not a Git repository, so do not attempt a commit. Report modified files and verification results.

## Plan Self-Review

- Spec coverage: preview, print HTML, contrast plate, accessibility text, barcode preservation, and both focused and full verification are covered.
- Placeholder scan: no incomplete instructions or undefined paths remain.
- Consistency: preview and print use the same asset and class names while preserving the CR80 card's existing data flow.
