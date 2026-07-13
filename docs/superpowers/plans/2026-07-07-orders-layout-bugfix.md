# Orders Layout Bugfix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the `orders.html` POS product grid so product cards and checkout rail render cleanly across desktop and mobile widths.

**Architecture:** Keep the static HTML and vanilla JavaScript architecture. Add a focused Node regression test for the CSS contract, then fix the shared POS component CSS without changing checkout behavior.

**Tech Stack:** Static HTML, CSS, Bootstrap 5 classes already present, Node test runner.

---

## File Structure

- Modify `tests/frontend/orders.page.test.js`: add a CSS contract test for POS product tiles.
- Modify `frontend/assets/css/components.css`: constrain product tile overflow, stabilize the image well, and use contained image rendering.

### Task 1: Product Tile Regression Test

**Files:**
- Modify: `tests/frontend/orders.page.test.js`
- Test: `npm test -- tests/frontend/orders.page.test.js`

- [ ] **Step 1: Add the failing CSS contract test**

Add this test to `tests/frontend/orders.page.test.js`:

```js
test("orders page keeps POS product cards visually contained", () => {
    const css = fs.readFileSync(path.join(rootDir, "frontend/assets/css/components.css"), "utf8");

    assert.match(css, /\.pos-product-tile\s*\{[\s\S]*overflow:\s*hidden;/);
    assert.match(css, /\.pos-product-tile\s*\{[\s\S]*height:\s*100%;/);
    assert.match(css, /\.pos-product-image\s*\{[\s\S]*aspect-ratio:\s*4\s*\/\s*3;/);
    assert.match(css, /\.pos-product-image\s+img\s*\{[\s\S]*object-fit:\s*contain;/);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
npm test -- tests/frontend/orders.page.test.js
```

Expected: FAIL because `.pos-product-tile` currently allows visible overflow and `.pos-product-image img` uses `object-fit: cover`.

### Task 2: Stabilize POS Product Tiles

**Files:**
- Modify: `frontend/assets/css/components.css`
- Test: `npm test -- tests/frontend/orders.page.test.js`

- [ ] **Step 1: Update the product grid and tile CSS**

Change the POS product CSS so tiles are equal-height, clipped to their own card, and image wells have stable geometry:

```css
.pos-product-grid {
    align-content: start;
    align-items: stretch;
    display: grid;
    flex: 1 1 auto;
    gap: 12px;
    grid-auto-rows: minmax(306px, auto);
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-bottom: 8px;
    padding-right: 2px;
    scrollbar-gutter: stable;
}

.pos-product-tile {
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-xs);
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
}

.pos-product-image {
    align-items: center;
    aspect-ratio: 4 / 3;
    background: linear-gradient(180deg, #f7faf9, #edf2f2);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    flex-shrink: 0;
    justify-content: center;
    overflow: hidden;
    width: 100%;
}

.pos-product-image img {
    display: block;
    height: 100%;
    object-fit: contain;
    padding: 10px;
    width: 100%;
}
```

- [ ] **Step 2: Run the focused test and confirm it passes**

Run:

```bash
npm test -- tests/frontend/orders.page.test.js
```

Expected: PASS.

### Task 3: Verify No Regression

**Files:**
- Verify: all frontend tests and POS CSS syntax.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run CSS brace smoke check**

Run:

```bash
node -e "for (const f of ['frontend/assets/css/base.css','frontend/assets/css/layout.css','frontend/assets/css/components.css','frontend/orders.html']) { const s=require('fs').readFileSync(f,'utf8'); if ((s.match(/{/g)||[]).length !== (s.match(/}/g)||[]).length) throw new Error(f); }"
```

Expected: exit code 0.
