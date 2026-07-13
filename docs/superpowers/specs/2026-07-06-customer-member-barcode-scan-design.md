# Customer Member Barcode Scan Design

## Goal

Add a POS-style customer barcode workflow so staff can identify customers and attach the correct member profile to a checkout by scanning a membership barcode.

## Scope

- Generate member barcodes for customer records in the staff/admin customer screen.
- Add a clear scan action on the POS sales screen.
- Treat barcode scanner input like a real retail POS keyboard-wedge scanner: focus an input, accept the scanned value, normalize it, and submit automatically on `Enter` or `Tab`.
- Keep the existing `member_code` data model and lookup endpoints.
- Do not change the public table QR ordering page.

## Barcode Library

Use `JsBarcode` with `CODE128`.

`JsBarcode` is a better fit than `bwip-js` here because the system only needs readable customer membership barcodes in the browser. `CODE128` supports the current alphanumeric member format such as `CUS00000042`, and `JsBarcode` is lightweight enough for static HTML pages.

## Data Flow

1. New customers keep receiving deterministic member codes through the existing service: `CUS` plus an 8-digit padded customer id.
2. `customers.html` renders each `member_code` as text and as an SVG barcode.
3. Staff can open a print-friendly member card modal from the customer list.
4. On `orders.html`, staff click the scan button, the member barcode input is focused, and the UI enters scan mode.
5. Scanner input is normalized with uppercase, trim, and whitespace removal.
6. On `Enter` or `Tab`, the POS calls `/api/staff/customers/member/:memberCode`.
7. If the staff route is forbidden in an older session, the existing fallback route `/customers/member/:memberCode` remains available.
8. A found customer is attached to the checkout by setting the hidden customer id and rendering member status.
9. A missing or empty barcode clears the selected customer and shows an actionable error.

## UI Behavior

`orders.html` gets a primary scan button in the member panel. It does not use camera scanning because POS barcode scanners normally behave as keyboards, and this system is optimized for a retail counter. The button focuses the barcode input, selects any previous value, and marks the panel as actively scanning.

`customers.html` gets generated barcode SVGs in the customer table and a member-card modal. The modal includes name, phone, member code, barcode, and a print action.

## Testing

Add frontend contract tests that fail until:

- `jsbarcode` is declared as a dependency.
- the Express app exposes `/vendor/jsbarcode`.
- `orders.html` contains scan-mode functions and auto-submit behavior.
- `customers.html` loads `JsBarcode`, renders barcode SVG placeholders, and exposes a print/view action.

Keep existing customer service tests for normalization and unknown-code behavior.

## Out Of Scope

- Camera barcode scanning.
- New database tables.
- Loyalty points or member tiers.
- Public QR ordering changes.
