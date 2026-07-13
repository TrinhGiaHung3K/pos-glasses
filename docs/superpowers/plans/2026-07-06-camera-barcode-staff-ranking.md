# Camera Barcode And Staff Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add camera barcode scanning and staff ranking with progress-based discount caps.

**Architecture:** Add a focused staff performance module with pure level calculation helpers, repository SQL over users/orders, staff/admin API routes, and checkout discount enforcement. Extend the POS frontend with a ZXing camera modal and rank progress card, and extend the dashboard with an admin leaderboard.

**Tech Stack:** Node.js, Express, MySQL, static HTML/CSS/JS, Node test runner, `@zxing/browser`, existing `JsBarcode`.

---

## File Structure

- Create `src/modules/staffPerformance/levels.js`: pure ranking thresholds and progress helpers.
- Create `src/modules/staffPerformance/repository.js`: SQL for one user and all users.
- Create `src/modules/staffPerformance/service.js`: maps raw metrics to rank view models.
- Create `src/modules/staffPerformance/controller.js`: route handlers.
- Create `src/modules/staffPerformance/routes.js`: staff and admin routers.
- Modify `src/app.js`: wire repository, service, routers, and `/vendor/zxing-browser`.
- Modify `src/modules/orders/service.js`: enforce staff manual discount cap.
- Modify `src/modules/orders/repository.js`: expose staff performance lookup for checkout.
- Modify `frontend/orders.html`: add camera scan modal, camera scanner JS, staff rank card, and discount warnings.
- Modify `frontend/dashboard.html`: add admin staff performance leaderboard.
- Modify tests under `tests/modules`, `tests/frontend`, and `tests/app.test.js`.

## Task 1: Failing Contracts

- [ ] Add failing tests for staff level calculation, checkout discount cap, staff performance API routes, camera scanner UI hooks, and dashboard leaderboard hooks.
- [ ] Run focused tests.
- [ ] Expected: fail because module, dependency, routes, and frontend hooks do not exist.

## Task 2: Library And Vendor Route

- [ ] Run `npm install @zxing/browser`.
- [ ] Expose `/vendor/zxing-browser` from `node_modules/@zxing/browser`.
- [ ] Run focused frontend tests.
- [ ] Expected: frontend tests still fail only on missing page hooks.

## Task 3: Staff Performance Backend

- [ ] Implement `levels.js` pure helpers for NULL, Bronze, Silver, Gold, Platinum.
- [ ] Implement repository/service/controller/routes.
- [ ] Wire routes in `src/app.js`.
- [ ] Run staff performance tests.
- [ ] Expected: rank helper and route tests pass.

## Task 4: Checkout Discount Cap

- [ ] Use staff performance lookup in checkout.
- [ ] Reject manual percent or amount discounts that exceed rank cap.
- [ ] Keep coupon discounts separate.
- [ ] Run checkout service tests.
- [ ] Expected: checkout tests pass.

## Task 5: POS Frontend

- [ ] Load ZXing browser script in `orders.html`.
- [ ] Add camera scan button/modal/video/status.
- [ ] Decode a camera barcode into `memberBarcode` and call existing member lookup.
- [ ] Load `/api/staff/performance/me` and render rank progress.
- [ ] Warn when manual discount exceeds the staff allowance.
- [ ] Run frontend contract tests.
- [ ] Expected: frontend tests pass.

## Task 6: Dashboard Leaderboard

- [ ] Add admin-only staff ranking section to `dashboard.html`.
- [ ] Load `/api/admin/staff-performance` for admins.
- [ ] Render progress bars and remaining targets.
- [ ] Run frontend contract tests.
- [ ] Expected: dashboard hooks are present.

## Task 7: Final Verification

- [ ] Run `npm test`.
- [ ] Smoke static endpoints for `orders.html`, `dashboard.html`, and `/vendor/zxing-browser/umd/zxing-browser.min.js`.
- [ ] Confirm public QR files were not modified.
