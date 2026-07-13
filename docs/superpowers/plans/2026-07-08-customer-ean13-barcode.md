# Customer EAN-13 Barcode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert customer member barcodes to numeric EAN-13 codes and make Barcode to PC scanning smoother and more accurate.

**Architecture:** Keep the existing `member_code` column and lookup routes. Move barcode generation and validation into the customer service, backfill existing database rows during startup schema maintenance, and enhance the static POS input to auto-submit scanner-like input.

**Tech Stack:** Node.js, Express, MySQL, static HTML/JS, JsBarcode, Node test runner.

---

## File Structure

- Modify `src/modules/customers/service.js`: add EAN-13 generation, validation, and stricter normalization.
- Modify `src/db/customerSchema.js`: backfill missing or non-EAN-13 customer codes to generated EAN-13 values.
- Modify `frontend/customers.html`: render `EAN13` barcodes and use numeric fallback display.
- Modify `frontend/orders.html`: add input/debounce scanner handling and digit-only normalization.
- Modify `tests/modules/customers/customers.service.test.js`: assert EAN-13 generation, normalization, and malformed-code rejection.
- Modify `tests/db/customerSchema.test.js`: assert EAN-13 backfill SQL.
- Modify `tests/frontend-components.test.js`: assert customer admin renders EAN-13 barcodes.
- Modify `tests/frontend/orders.page.test.js`: assert Barcode to PC debounce/input hooks.

## Task 1: Backend EAN-13 Contracts

- [ ] Add failing customer service tests that expect `generateMemberCode(42)` to return `2900000000421`, create to assign that value, lookup to normalize full-width digits, and malformed 13-digit codes to reject with status `400`.
- [ ] Run `npm test -- tests/modules/customers/customers.service.test.js` and confirm the new tests fail because the service still emits `CUS00000042`.
- [ ] Implement EAN-13 helpers in `src/modules/customers/service.js`.
- [ ] Re-run `npm test -- tests/modules/customers/customers.service.test.js` and confirm it passes.

## Task 2: Schema Backfill

- [ ] Update `tests/db/customerSchema.test.js` so the backfill assertion expects an EAN-13 expression with prefix `29` and a check digit.
- [ ] Run `npm test -- tests/db/customerSchema.test.js` and confirm it fails against the legacy `CONCAT('CUS', ...)` SQL.
- [ ] Update `src/db/customerSchema.js` backfill SQL so blank, legacy, or malformed values become valid EAN-13 codes derived from `id`.
- [ ] Re-run `npm test -- tests/db/customerSchema.test.js`.

## Task 3: Customer Barcode Rendering

- [ ] Update frontend component tests to require `format: "EAN13"` and reject the old `format: "CODE128"` contract.
- [ ] Run `npm test -- tests/frontend-components.test.js` and confirm the test fails.
- [ ] Update `frontend/customers.html` fallback member code generation and `JsBarcode` format.
- [ ] Re-run `npm test -- tests/frontend-components.test.js`.

## Task 4: POS Scanner Smoothing

- [ ] Update `tests/frontend/orders.page.test.js` to require `handleMemberBarcodeInput`, `queueMemberBarcodeVerification`, and `memberBarcodeScanTimer`.
- [ ] Run `npm test -- tests/frontend/orders.page.test.js` and confirm it fails.
- [ ] Update `frontend/orders.html` so Barcode to PC input is digit-normalized and auto-verifies after `Enter`, `Tab`, paste/input, or a short 13-digit debounce.
- [ ] Re-run `npm test -- tests/frontend/orders.page.test.js`.

## Task 5: Final Verification

- [ ] Run `npm test`.
- [ ] Run `rg -n --glob "!node_modules/**" "CUS000000|CODE128|format:\\s*\"CODE128\"" src frontend tests`.
- [ ] Start the local server and smoke-check `/customers.html`, `/orders.html`, and `/vendor/jsbarcode/JsBarcode.all.min.js`.
