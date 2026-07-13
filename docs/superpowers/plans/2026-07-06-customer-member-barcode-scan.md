# Customer Member Barcode Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build barcode generation and POS-style customer member scanning for the staff/admin system.

**Architecture:** Keep the existing `member_code` backend and add a browser barcode renderer with `JsBarcode`. The POS scan flow stays on `orders.html`, using keyboard-wedge scanner behavior: focus, normalize, auto-submit on scanner terminator, then attach the found customer to checkout.

**Tech Stack:** Node.js, Express static vendor routes, static HTML/CSS/JS, Node test runner, `JsBarcode` with `CODE128`.

---

## File Structure

- Modify `package.json` and `package-lock.json`: add `jsbarcode`.
- Modify `src/app.js`: expose `node_modules/jsbarcode/dist` under `/vendor/jsbarcode`.
- Modify `tests/frontend-components.test.js`: add dependency and customer barcode UI contracts.
- Modify `tests/frontend/orders.page.test.js`: add POS scan-mode contract.
- Modify `frontend/orders.html`: add scan button, scan state styles, auto-submit logic, and stronger barcode normalization.
- Modify `frontend/customers.html`: load `JsBarcode`, render SVG barcode cells, add member-card modal and print action.

## Task 1: Failing Barcode Contracts

- [ ] Add tests that assert `package.json` includes `jsbarcode`, `src/app.js` exposes `/vendor/jsbarcode`, `orders.html` includes scan-mode functions, and `customers.html` includes barcode rendering hooks.
- [ ] Run `npm test -- tests/frontend-components.test.js tests/frontend/orders.page.test.js`.
- [ ] Expected result: fail because `jsbarcode`, vendor route, scan mode, and customer barcode rendering are not implemented yet.

## Task 2: Add Barcode Library

- [ ] Run `npm install jsbarcode`.
- [ ] Update `src/app.js` to serve `/vendor/jsbarcode` from `node_modules/jsbarcode/dist`.
- [ ] Run the focused tests again.
- [ ] Expected result: still fail only on missing frontend hooks.

## Task 3: POS Customer Scan Mode

- [ ] Update `frontend/orders.html` member scan card with a dedicated scan button.
- [ ] Add `normalizeMemberBarcodeInput`, `startMemberBarcodeScan`, `stopMemberBarcodeScan`, and scan terminator handling for `Enter` and `Tab`.
- [ ] Keep fallback lookup behavior from `/api/staff/customers/member/:memberCode` to `/customers/member/:memberCode`.
- [ ] Run `npm test -- tests/frontend/orders.page.test.js`.
- [ ] Expected result: pass.

## Task 4: Customer Barcode Rendering

- [ ] Update `frontend/customers.html` to load `/vendor/jsbarcode/JsBarcode.all.min.js`.
- [ ] Add barcode SVG placeholders to each customer row.
- [ ] Add `renderCustomerBarcodes`, `renderBarcodeSvg`, `openMemberCard`, and `printMemberCard`.
- [ ] Run `npm test -- tests/frontend-components.test.js`.
- [ ] Expected result: pass.

## Task 5: Final Verification

- [ ] Run `npm test`.
- [ ] Run HTTP smoke checks against the local app for `/customers.html`, `/orders.html`, and `/vendor/jsbarcode/JsBarcode.all.min.js`.
- [ ] Confirm the public QR page was not edited.
