# Orders Layout Bugfix Design

## Summary

Fix the broken `frontend/orders.html` POS product grid shown in the screenshot. Product tiles must no longer visually overlap, product photos must stay inside their cards, and the checkout rail must keep a stable scrollable layout.

## Root Cause

The current POS product tile CSS allows visible overflow and uses `object-fit: cover` for glasses photos. The image files have varied aspect ratios and lots of white background, so cover-cropping plus visible overflow makes the grid look stacked and broken. The terminal layout also relies on fixed viewport height, so unstable tile geometry is highly visible.

## Approach

Keep the existing static HTML, API calls, and checkout behavior. Fix the shared POS component CSS by making product tiles self-contained, giving image wells a stable aspect ratio, changing glasses images to `object-fit: contain`, and preserving predictable scroll behavior in the product grid and checkout rail.

## Scope

In scope:

- `frontend/assets/css/components.css`
- `tests/frontend/orders.page.test.js`
- Browser or static verification of `frontend/orders.html`

Out of scope:

- Backend APIs
- Product data
- Checkout, discount, barcode, and customer logic
- Broader POS redesign

## Verification

- Add a focused regression test that checks the POS product tile CSS contract.
- Run the focused frontend orders test.
- Run the full Node test suite if the environment allows it.
- Use a browser/headless screenshot when possible to confirm the grid is not visually stacked.
