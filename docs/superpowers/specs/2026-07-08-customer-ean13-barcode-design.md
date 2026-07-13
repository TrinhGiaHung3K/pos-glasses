# Customer EAN-13 Member Barcode Design

## Goal

Replace the current alphanumeric customer member barcode with a retail-style numeric EAN-13 barcode that works reliably with Barcode to PC and checkout scanners.

## Decision

Use an internal EAN-13 code for every customer. The code is 13 digits, starts with the internal-use prefix `29`, stores the customer id in the next 10 digits, and ends with the standard EAN-13 check digit.

Example: customer id `42` becomes `2900000000421`.

This gives the POS a numeric-only barcode like common retail member apps, avoids keyboard-layout issues from letters, and lets the scanner/backend reject malformed scans before lookup.

## Scope

- Generate the new barcode when a customer is created.
- Backfill existing customer records from `CUS00000042` style values to the new EAN-13 format.
- Render customer barcodes as `EAN13` in `frontend/customers.html`.
- Normalize Barcode to PC input on the POS screen by keeping digits only, accepting full-width digits, and auto-verifying after scan terminators or a short scanner debounce.
- Convert all active behavior to the new code format; old `CUS...` values are not preserved as the operating barcode format.

## Data Flow

1. `createCustomersService.create()` inserts the customer, then assigns `generateMemberCode(insertId)`.
2. `generateMemberCode(id)` builds a 12-digit EAN-13 body from `29` plus the 10-digit padded id and appends the EAN-13 check digit.
3. Startup schema maintenance backfills blank, legacy, or malformed `member_code` values to the new EAN-13 code.
4. `customers.html` displays the numeric code and renders it with `JsBarcode` using `format: "EAN13"`.
5. `orders.html` focuses the member input for Barcode to PC. Input is normalized to digits, then verified on `Enter`, `Tab`, input paste, or scanner-like debounce once the value reaches 13 digits.
6. Customer lookup remains on `/api/staff/customers/member/:memberCode` with the existing `/customers/member/:memberCode` fallback after `403`.

## Error Handling

- Empty scan clears the selected customer.
- Non-digit or short scans are normalized and left visible until complete.
- Malformed 13-digit scans fail before database lookup with a clear invalid barcode message.
- Unknown valid EAN-13 scans return the existing not-found message.

## Testing

Tests must cover:

- EAN-13 generation and check digit validation.
- Service lookup normalization for spaces/full-width digits.
- Rejection of malformed member barcodes.
- Schema backfill SQL changing legacy values to the new format.
- `customers.html` rendering `EAN13` instead of `CODE128`.
- `orders.html` scanner debounce/input handling for Barcode to PC.
