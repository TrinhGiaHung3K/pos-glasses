# POS GLASSES Logo Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the approved Optic Bridge logo consistently in all staff, admin, authentication, public QR, and printable-receipt brand surfaces.

**Architecture:** Keep the existing asset as the only logo source. Use the shared component menu for all authenticated pages, local image holders for the two auth pages and public QR page, and a print-safe holder in the invoice template. Static tests guard every placement.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Node built-in test runner.

---

### Task 1: Guard the rollout with a failing static test

**Files:**
- Modify: `tests/frontend-components.test.js`
- Test: `tests/frontend-components.test.js`

- [ ] **Step 1: Add the static logo-rollout test**

Add this test after the shared-menu test:

```js
test("Optic Bridge logo is used across all brand surfaces", () => {
    const menu = read("frontend/assets/js/components.js");
    const layout = read("frontend/assets/css/layout.css");
    const login = read("frontend/login.html");
    const register = read("frontend/register.html");
    const qr = read("frontend/qr/table.html");
    const qrCss = read("frontend/assets/css/qr.css");
    const invoice = read("frontend/invoice_detail.html");

    assert.match(menu, /class="pos-logo-image"[\s\S]*src="\/assets\/images\/pos-glasses-optic-bridge-logo\.png"/);
    assert.doesNotMatch(menu, /ph-sunglasses/);
    assert.match(layout, /\.pos-logo-image/);
    assert.match(login, /class="auth-logo-image"[\s\S]*src="\/assets\/images\/pos-glasses-optic-bridge-logo\.png"/);
    assert.match(register, /class="auth-logo-image"[\s\S]*src="\/assets\/images\/pos-glasses-optic-bridge-logo\.png"/);
    assert.match(qr, /class="qr-brand-logo"[\s\S]*src="\.\.\/assets\/images\/pos-glasses-optic-bridge-logo\.png"/);
    assert.match(qrCss, /\.qr-brand-logo/);
    assert.match(invoice, /class="receipt-store-logo"[\s\S]*src="\/assets\/images\/pos-glasses-optic-bridge-logo\.png"/);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/frontend-components.test.js`

Expected: FAIL because the existing pages still contain temporary Phosphor emblems and do not reference the Optic Bridge asset.

### Task 2: Apply the logo to shared authenticated navigation

**Files:**
- Modify: `frontend/assets/js/components.js`
- Modify: `frontend/assets/css/layout.css`

- [ ] **Step 1: Replace the sidebar logo markup**

Replace the `.pos-logo-icon` and `h2` markup in `buildAppMenuHtml` with:

```html
<div class="pos-logo">
    <img
        class="pos-logo-image"
        src="/assets/images/pos-glasses-optic-bridge-logo.png"
        alt="POS GLASSES"
    >
</div>
```

- [ ] **Step 2: Replace the obsolete sidebar icon rules**

Replace `.pos-logo-icon` and `.pos-logo h2` rules with a `.pos-logo-image` holder that is 184 × 50 px, uses `display: block`, `object-fit: cover`, `object-position: center`, and keeps the logo visible when the sidebar is collapsed.

- [ ] **Step 3: Run the focused test**

Run: `node --test tests/frontend-components.test.js`

Expected: The new test still fails only on the auth, QR, and receipt surfaces.

### Task 3: Apply the logo to authentication and public QR pages

**Files:**
- Modify: `frontend/login.html`
- Modify: `frontend/register.html`
- Modify: `frontend/qr/table.html`
- Modify: `frontend/assets/css/qr.css`

- [ ] **Step 1: Replace both auth emblems**

In `login.html` and `register.html`, replace the `.logo-emblem` block with:

```html
<img
    class="auth-logo-image"
    src="/assets/images/pos-glasses-optic-bridge-logo.png"
    alt="POS GLASSES"
>
```

Replace each `.logo-emblem` style with `.auth-logo-image` sized at 216 × 64 px and using centred `object-fit: cover` cropping.

- [ ] **Step 2: Add the public QR logo**

Replace the QR kicker with:

```html
<img
    class="qr-brand-logo"
    src="../assets/images/pos-glasses-optic-bridge-logo.png"
    alt="POS GLASSES"
>
```

Add `.qr-brand-logo` to `frontend/assets/css/qr.css`, using a 176 × 52 px centred crop and a small bottom margin. Preserve the QR title, subtitle, token handling, product list, and cart behavior unchanged.

- [ ] **Step 3: Run the focused test**

Run: `node --test tests/frontend-components.test.js`

Expected: The new test still fails only on the printable receipt placement.

### Task 4: Add a print-safe receipt logo and verify

**Files:**
- Modify: `frontend/invoice_detail.html`
- Test: `tests/frontend-components.test.js`

- [ ] **Step 1: Add the receipt image before the configurable store name**

Insert this image immediately before `#storeName` without changing the `id` or store configuration logic:

```html
<img
    class="receipt-store-logo"
    src="/assets/images/pos-glasses-optic-bridge-logo.png"
    alt="POS GLASSES"
>
```

- [ ] **Step 2: Add print-safe logo styling**

Add `.receipt-store-logo` CSS with 132 × 38 px dimensions, centred `object-fit: cover`, `object-position: center`, `display: block`, and `margin: 0 auto 2px`. Add a compact-print rule that reduces it to 112 × 32 px.

- [ ] **Step 3: Run the focused test to verify it passes**

Run: `node --test tests/frontend-components.test.js`

Expected: PASS with the Optic Bridge test and all existing frontend component tests.

- [ ] **Step 4: Run the complete test suite**

Run: `npm test`

Expected: PASS with 100 existing tests plus the new logo-rollout test.

- [ ] **Step 5: Record the workspace state**

This workspace is not a Git repository, so do not attempt a commit. Report the modified files and verification output instead.

## Plan Self-Review

- Spec coverage: shared internal navigation, auth, public QR, receipt, accessibility alt text, cropping, and static regression coverage each have an implementation task.
- Placeholder scan: no incomplete instructions or undefined files remain.
- Consistency: every change references the same final image path and preserves existing user flows.
