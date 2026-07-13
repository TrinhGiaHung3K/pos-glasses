# POS Terminal First Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the staff/admin frontend around a bright retail POS terminal experience, with `orders.html` as the flagship selling screen.

**Architecture:** Keep the static HTML and vanilla JavaScript architecture. Move the new visual language into shared CSS tokens and components first, then refactor `orders.html`, then align the remaining staff/admin pages with the same shell and components.

**Tech Stack:** Static HTML, vanilla JavaScript, Bootstrap 5 classes already present, local Phosphor icons, Node test runner.

---

## File Structure

- Modify `frontend/assets/css/base.css`: POS retail color tokens, font stack, body defaults, number utility classes.
- Modify `frontend/assets/css/layout.css`: responsive shell, sidebar, topbar, touch-friendly spacing.
- Modify `frontend/assets/css/components.css`: buttons, forms, tables, cards, POS product tiles, checkout rail, money panels, states.
- Modify `frontend/assets/js/components.js`: shared navigation grouping and role-safe menu rendering.
- Modify `frontend/orders.html`: primary POS terminal layout and scan/touch behavior.
- Modify staff/admin HTML pages: remove SaaS/dashboard feel and align with shared classes.
- Add `tests/frontend-components.test.js`: focused assertions for shared navigation source.
- Modify `.gitignore`: ignore `.superpowers/` companion scratch files.

## Task 1: Shared Navigation Test

**Files:**
- Create: `tests/frontend-components.test.js`
- Test: `npm test -- tests/frontend-components.test.js`

- [ ] **Step 1: Write the failing test**

```js
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const test = require("node:test");

const source = readFileSync("frontend/assets/js/components.js", "utf8");

test("staff menu keeps POS selling first and excludes customer QR page", () => {
  assert.match(source, /key:\s*"orders"[\s\S]*label:\s*"Bán hàng"/);
  assert.match(source, /key:\s*"products"[\s\S]*label:\s*"Sản phẩm"/);
  assert.match(source, /key:\s*"qr-orders"[\s\S]*label:\s*"Yêu cầu QR"/);
  assert.doesNotMatch(source, /href:\s*"\/qr\/table\.html"/);
});
```

- [ ] **Step 2: Run test to verify the current menu contract**

Run: `npm test -- tests/frontend-components.test.js`

Expected before implementation: PASS or a narrow failure if labels are changed during planning. If it passes, keep it as a safety test before visual edits.

## Task 2: POS Design Tokens

**Files:**
- Modify: `frontend/assets/css/base.css`
- Modify: `frontend/assets/css/components.css`

- [ ] **Step 1: Update root tokens**

Replace the SaaS indigo-heavy token set with bright retail POS tokens:

```css
:root {
    --bg-primary: #f3f6f8;
    --bg-surface: #ffffff;
    --bg-sidebar: #10201d;
    --bg-sidebar-hover: rgba(255, 255, 255, 0.07);
    --bg-elevated: #ffffff;
    --bg-muted: #eaf0f2;
    --text-primary: #14201f;
    --text-secondary: #465957;
    --text-muted: #758582;
    --text-inverse: #ffffff;
    --accent-color: #0f766e;
    --accent-light: #e5f5f2;
    --accent-hover: #0b5f59;
    --accent-glow: rgba(15, 118, 110, 0.18);
    --accent-subtle: rgba(15, 118, 110, 0.08);
}
```

- [ ] **Step 2: Add POS utility classes**

Add utility classes for money, SKU, and operational values:

```css
.pos-money,
.pos-numeric {
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
}

.pos-code {
    font-family: "Roboto Mono", "Cascadia Mono", "Consolas", monospace;
    font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: Run CSS syntax smoke check**

Run: `node -e "for (const f of ['frontend/assets/css/base.css','frontend/assets/css/components.css']) { const s=require('fs').readFileSync(f,'utf8'); if ((s.match(/{/g)||[]).length !== (s.match(/}/g)||[]).length) throw new Error(f); }"`

Expected: exit code 0.

## Task 3: POS Shell

**Files:**
- Modify: `frontend/assets/css/layout.css`
- Modify: `frontend/assets/js/components.js`

- [ ] **Step 1: Update shell density**

Make sidebar and topbar more like a POS terminal shell:

```css
.pos-sidebar {
    width: 244px;
    background: linear-gradient(180deg, var(--bg-sidebar) 0%, #172d29 100%);
    padding: 18px 12px 16px;
}

.pos-main {
    margin-left: 244px;
}

.pos-topbar {
    min-height: 64px;
    height: auto;
    padding: 10px 24px;
}
```

- [ ] **Step 2: Put selling actions first in the menu**

Keep `orders` prominent and preserve existing role filtering. Do not add a link to the customer QR page.

- [ ] **Step 3: Run navigation test**

Run: `npm test -- tests/frontend-components.test.js`

Expected: PASS.

## Task 4: Orders POS Terminal

**Files:**
- Modify: `frontend/orders.html`

- [ ] **Step 1: Refactor the layout**

Use a three-zone desktop layout:

```html
<section class="pos-content pos-terminal-content">
  <div class="pos-terminal-grid">
    <section class="pos-sell-zone">scan/search, filters, product grid</section>
    <aside class="pos-checkout-rail">member, cart, discounts, payment</aside>
  </div>
</section>
```

- [ ] **Step 2: Make search and barcode equal**

The main input placeholder should read `Quét SKU, barcode hoặc tìm tên kính`. Pressing Enter should attempt exact SKU/name match first and add that product when unique.

```js
function handleProductSearchKey(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addFirstMatchedProduct();
}
```

- [ ] **Step 3: Redesign product tile markup**

Each product tile must expose image, product name, SKU, stock, price, and one large add button.

- [ ] **Step 4: Redesign checkout rail**

Show total due, amount paid, and change with the strongest hierarchy. Keep coupon and manual discount available below cart lines.

- [ ] **Step 5: Run smoke tests**

Run: `npm test -- tests/frontend-components.test.js`

Expected: PASS.

## Task 5: Admin Page Alignment

**Files:**
- Modify: `frontend/dashboard.html`
- Modify: `frontend/products.html`
- Modify: `frontend/customers.html`
- Modify: `frontend/invoices.html`
- Modify: `frontend/invoice_detail.html`
- Modify: `frontend/inventory.html`
- Modify: `frontend/reports.html`
- Modify: `frontend/login.html`
- Modify: `frontend/register.html`
- Modify: `frontend/staff/qr-orders.html`
- Modify: `frontend/admin/tables.html`

- [ ] **Step 1: Replace SaaS language where visible**

Use direct POS copy: `Bán hàng`, `Ca bán`, `Tồn kho`, `Hóa đơn`, `Khách hàng`, `Báo cáo`.

- [ ] **Step 2: Align page containers**

Keep existing data and API functions. Add shared classes such as `pos-page-intro`, `pos-metric-grid`, `pos-data-panel`, and `pos-action-row` where useful.

- [ ] **Step 3: Preserve QR customer page**

Run: `git diff -- frontend/qr/table.html frontend/assets/css/qr.css` if git exists. In this workspace there is no git repository, so use file timestamps and content scan instead.

## Task 6: Verification

**Files:**
- Verify all changed frontend files.

- [ ] **Step 1: Run tests**

Run: `npm test`

Expected: all Node tests pass.

- [ ] **Step 2: Scan for disallowed dash characters**

Run: `rg "\\x{2014}|\\x{2013}" frontend docs/superpowers/specs/2026-07-06-pos-terminal-first-redesign-design.md docs/superpowers/plans/2026-07-06-pos-terminal-first-redesign.md`

Expected: no matches in frontend user-facing files. If docs contain none, command exits 1 with no output.

- [ ] **Step 3: Start local server**

Run: `npm start`

Expected: server listens and static pages load. Verify `orders.html` at the printed local URL.

## Self Review

Spec coverage:

- Bright retail POS design: Tasks 2, 3, 4, 5.
- `orders.html` flagship scan/touch workflow: Task 4.
- Staff/admin pages only: Task 5.
- QR customer page excluded: Task 5 and Task 6.
- Shared static architecture preserved: Tasks 2 and 3.

Placeholder scan: no `TBD`, `TODO`, or unspecified implementation steps remain.

Type consistency: file paths, function names, and page names match the current static frontend.
