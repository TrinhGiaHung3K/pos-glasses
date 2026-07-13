# POS Rail Cart Scroll Design

## Summary

Refine `frontend/orders.html` so the checkout rail is easier to use when the cart has many products, and the product grid no longer hides the bottom of the `Thêm` button.

## User-Approved Direction

- The product list inside the right checkout rail gets a fixed bounded area.
- When cart products exceed that area, only that cart list scrolls.
- The payment footer remains compact and does not create a second scrollbar.
- Product cards on the left are shorter and stable so the `Thêm` button is visible within the product grid.
- The checkout button gets its own reserved action row at the bottom of the rail so it remains visible even when cart and payment content are full.

## Root Cause

The checkout rail currently lets both the cart body and footer compete for a fixed-height rail. With many cart lines, the footer content can exceed the remaining space and the rail clips the bottom, hiding the `Thanh toán` button. The product grid also uses tall card rows with limited bottom padding, so viewport clipping can cut through the `Thêm` button at the bottom of the visible grid.

## Scope

In scope:

- `frontend/assets/css/components.css`
- `frontend/orders.html` page-local checkout button/payment spacing CSS
- `tests/frontend/orders.page.test.js`

Out of scope:

- Checkout API and cart behavior
- Product data rendering logic
- Customer/member barcode logic
- Backend routes and database schema

## Verification

- Add focused regression tests for rail scroll ownership and visible product action space.
- Add a regression test that requires a dedicated checkout action row with no scroll ownership.
- Run `npm test -- tests/frontend/orders.page.test.js`.
- Run `npm test`.
- Run a CSS/HTML brace smoke check.
- Generate a local Edge headless preview screenshot for visual sanity.
