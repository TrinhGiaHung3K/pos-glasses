# Minimal Mega Rail Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dense shared sidebar with a restrained mega rail that keeps every destination and permission rule intact.

**Architecture:** `components.js` remains the sole menu renderer and event owner. It will emit simplified group triggers and a light two-column flyout, while `layout.css` supplies all desktop, tablet, and mobile layout behavior. Tests remain DOM-string tests in Node's built-in test runner.

**Tech Stack:** Vanilla JavaScript, CSS, Node.js `node:test`.

---

## File structure

- Modify `frontend/assets/js/components.js`: simplify menu markup and make one click-controlled flyout the active menu state.
- Modify `frontend/assets/css/layout.css`: apply the minimal rail visual system and responsive panel placement.
- Modify `tests/frontend/menu.component.test.js`: cover the lean markup, active state, and role visibility.

### Task 1: Lock the minimal menu contract with tests

**Files:**
- Modify: `tests/frontend/menu.component.test.js`

- [ ] **Step 1: Replace the legacy panel assertions with the lean mega rail assertions**

```js
assert.match(html, /class="pos-mega-trigger"/);
assert.match(html, /class="pos-mega-panel"/);
assert.match(html, /class="pos-mega-grid"/);
assert.match(html, /class="pos-mega-tile"/);
assert.doesNotMatch(html, /pos-mega-trigger-meta/);
assert.doesNotMatch(html, /pos-mega-panel-head/);
assert.doesNotMatch(html, /pos-mega-tile-hint/);
assert.doesNotMatch(html, /pos-mega-tile-arrow/);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test tests/frontend/menu.component.test.js`

Expected: FAIL because the existing renderer still outputs metadata, a panel header, item hints, and item arrows.

- [ ] **Step 3: Add a role and active-state regression assertion**

```js
assert.match(staffHtml, /data-mega-group="catalog"/);
assert.doesNotMatch(staffHtml, /data-mega-group="system"/);
assert.match(adminHtml, /data-mega-group="system"/);
assert.match(adminHtml, /pos-mega-tile is-active[\s\S]*>Người dùng</);
```

- [ ] **Step 4: Defer the focused pass until Task 2 supplies the implementation**

Run: `node --test tests/frontend/menu.component.test.js`

Expected: PASS after Task 2.

### Task 2: Simplify menu markup and make panel state deterministic

**Files:**
- Modify: `frontend/assets/js/components.js:119-487`
- Test: `tests/frontend/menu.component.test.js`

- [ ] **Step 1: Replace tile markup with an icon-and-label link**

```js
function buildMegaTileHtml(item, active) {
    const activeClass = item.key === active ? " is-active" : "";
    return `
        <a href="${item.href}" class="pos-mega-tile${activeClass}" data-menu-key="${item.key}">
            <span class="pos-mega-tile-icon"><i class="ph ${item.icon}" aria-hidden="true"></i></span>
            <span class="pos-mega-tile-title">${escapeHtml(item.label)}</span>
        </a>`;
}
```

- [ ] **Step 2: Replace group markup with one trigger and one panel**

```js
const panelId = `megaPanel_${group.id}`;
return `
    <div class="pos-mega-group${openClass}${activeClass}" data-mega-group="${group.id}">
        <button type="button" class="pos-mega-trigger" data-mega-trigger="${group.id}"
            aria-expanded="${isOpen || hasActive ? "true" : "false"}" aria-controls="${panelId}">
            <span class="nav-icon"><i class="ph ${group.icon}" aria-hidden="true"></i></span>
            <span class="nav-label">${escapeHtml(group.label)}</span>
            <i class="ph ph-caret-right pos-mega-caret" aria-hidden="true"></i>
        </button>
        <div class="pos-mega-panel" id="${panelId}" data-mega-panel="${group.id}" role="region"
            aria-label="${escapeHtml(group.label)}"><div class="pos-mega-grid">${tiles}</div></div>
    </div>`;
```

- [ ] **Step 3: Replace multi-group session state and hover handling with click-only flyout state**

```js
root.querySelectorAll("[data-mega-trigger]").forEach((trigger) => {
    trigger.addEventListener("click", () => {
        const groupEl = trigger.closest(".pos-mega-group");
        const willOpen = !groupEl.classList.contains("is-flyout");
        root.querySelectorAll(".pos-mega-group").forEach((group) => {
            setGroupOpen(group, group === groupEl && willOpen);
            group.classList.toggle("is-flyout", group === groupEl && willOpen);
        });
    });
});
```

Also attach document click and `Escape` handlers that close `.is-flyout` groups only when focus/click is outside the group, and close all flyouts on viewport resize.

- [ ] **Step 4: Run the focused menu test**

Run: `node --test tests/frontend/menu.component.test.js`

Expected: PASS.

### Task 3: Apply the restrained mega rail visual system

**Files:**
- Modify: `frontend/assets/css/layout.css:13-525`

- [ ] **Step 1: Replace the gradient rail and heavy active treatment with flat surfaces**

```css
.pos-sidebar { background: var(--bg-sidebar); width: 232px; }
.pos-nav-item.active,
.pos-mega-group.is-active-group > .pos-mega-trigger {
    background: rgba(45, 212, 191, 0.12);
    box-shadow: inset 2px 0 0 #5eead4;
    color: #ffffff;
}
```

- [ ] **Step 2: Remove styles only used by deleted markup**

Delete styles for `.pos-mega-trigger-copy`, `.pos-mega-trigger-meta`, `.pos-mega-inline`, `.pos-nav-item--child`, `.pos-mega-panel-inner`, `.pos-mega-panel-head`, `.pos-mega-panel-kicker`, `.pos-mega-panel-blurb`, `.pos-mega-panel-count`, `.pos-mega-tile-copy`, `.pos-mega-tile-hint`, and `.pos-mega-tile-arrow`.

- [ ] **Step 3: Add compact panel and tile styles**

```css
.pos-mega-panel { padding: 10px; }
.pos-mega-grid { display: grid; gap: 6px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.pos-mega-tile { align-items: center; border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); display: flex; gap: 9px; min-height: 46px; padding: 8px 10px; }
.pos-mega-tile:hover, .pos-mega-tile.is-active { background: var(--accent-light); border-color: rgba(15, 118, 110, .25); }
```

- [ ] **Step 4: Preserve responsive behavior**

Keep the 991px rail collapse and 720px bottom bar. Update their selectors to hide `.pos-mega-trigger .nav-label` instead of removed wrapper elements; position a mobile panel above the bottom bar and preserve a two-column grid until the available width demands one column.

### Task 4: Verify behavior and repository state

**Files:**
- Verify: `tests/frontend/menu.component.test.js`, `tests/frontend-components.test.js`, `frontend/assets/js/components.js`, `frontend/assets/css/layout.css`

- [ ] **Step 1: Run all automated tests**

Run: `npm test`

Expected: PASS with no failing `node:test` suites.

- [ ] **Step 2: Perform static visual-contract checks**

Run: `rg -n "pos-mega-trigger-meta|pos-mega-panel-head|pos-mega-tile-hint|pos-mega-tile-arrow" frontend/assets/js/components.js frontend/assets/css/layout.css`

Expected: no matches.

- [ ] **Step 3: Check working tree and commit if Git metadata is available**

Run: `git status --short`

Expected: The current directory reports that it is not a Git repository, so no commit is possible. Do not initialize a repository or alter version-control state.
