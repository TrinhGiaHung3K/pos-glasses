# Phone Barcode Scanner Design

## Goal

Replace browser camera barcode scanning on the POS screen with a phone-scanner workflow based on Barcode to PC. Staff will use the Barcode to PC mobile app to scan a customer member barcode, send it to the focused POS input as keyboard text, and let the existing member lookup confirm the customer.

## Decision

Use Barcode to PC as the external phone scanning app for the first complete implementation.

This matches the current POS architecture because `frontend/orders.html` already supports keyboard-wedge barcode input: focus the `memberBarcode` field, normalize the scanned value, submit on `Enter` or `Tab`, then call the existing customer member lookup endpoint. Barcode to PC sends scanned values to the computer as keystrokes, so the system does not need a custom mobile app, webhook, or camera permission flow.

## Scope

- Remove the desktop browser camera scan button, modal, video preview, ZXing script, ZXing vendor route, and `@zxing/browser` dependency.
- Keep the existing USB or hardware scanner flow.
- Add a phone scanner mode on `orders.html` that focuses the member barcode input and clearly tells staff to scan from Barcode to PC.
- Use existing endpoints:
  - primary: `/api/staff/customers/member/:memberCode`
  - fallback after `403`: `/customers/member/:memberCode`
- Keep generated customer CODE128 barcodes in `customers.html`.
- Keep staff performance ranking behavior unchanged.

## UX

The customer panel becomes a compact scanner station:

1. Staff clicks the phone scanner button.
2. POS marks the panel as waiting for phone input and focuses `memberBarcode`.
3. Staff scans the customer's membership barcode in Barcode to PC.
4. The app types the barcode into the POS input.
5. If Barcode to PC sends `Enter` or `Tab`, POS verifies automatically. Staff can also press the verify button.
6. POS shows the confirmed member or an inline error.

The UI must avoid camera language. The visible copy should say that the phone app sends the scan as keyboard input.

## Error Handling

- Empty input: clear customer and show "Vui long quet ma khach hang".
- Unknown barcode: keep input value visible, clear selected customer, and show the backend error.
- Phone app not connected: no special API state is needed. The POS remains in waiting mode with the input focused and manual entry still available.

## Testing

Add or update frontend contract tests to verify:

- Camera scan UI and ZXing hooks are absent from `orders.html`.
- `src/app.js` no longer exposes `/vendor/zxing-browser`.
- `package.json` no longer declares `@zxing/browser`.
- `orders.html` exposes a phone scanner button and phone scan mode functions.
- Existing member lookup fallback, generated customer barcodes, and staff performance hooks remain intact.

## Out of Scope

- Custom mobile app development.
- Orca Scan webhook/API integration.
- Session pairing between POS and a cloud scanner account.
- Database schema changes.
