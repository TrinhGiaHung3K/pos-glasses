# POS Terminal First Redesign Design

## Summary

Redesign the staff and admin frontend so the system feels like a real retail POS for an optical store. The customer QR ordering surface is out of scope. The most important screen is `frontend/orders.html`, which must support scan-first and touch-first selling equally well.

## Scope

In scope:

- `frontend/orders.html`
- `frontend/products.html`
- `frontend/customers.html`
- `frontend/invoices.html`
- `frontend/invoice_detail.html`
- `frontend/inventory.html`
- `frontend/reports.html`
- `frontend/dashboard.html`
- `frontend/login.html`
- `frontend/register.html`
- `frontend/staff/qr-orders.html`
- `frontend/admin/tables.html`
- Shared CSS and shared navigation components under `frontend/assets`

Out of scope:

- `frontend/qr/table.html`
- `frontend/assets/css/qr.css`
- Backend routes, database schema, checkout API contracts

## Design Read

This is a dense optical-store POS product for cashiers, staff, and admins. The design language should be bright, clean, and operational, similar to a modern retail cash register rather than a SaaS dashboard. It should work well on desktop, laptop, tablet, and mobile.

Design dials:

- Design variance: 4, predictable and operational
- Motion intensity: 2, tactile hover and press states only
- Visual density: 9, fast scanning and repeated daily use

## Brand System

Use a bright retail palette:

- Background: cool off-white and soft gray
- Surface: white with thin cool borders
- Primary accent: green/teal for checkout and active selling
- Neutral text: high contrast charcoal
- Warning and danger colors remain semantic

Typography stays sans-serif and readable. Product names, labels, and buttons use the app font. Money, SKU, quantity, and barcode-like values use monospace or tabular number treatment.

## Orders Screen

`orders.html` becomes the flagship POS terminal:

- A large scan/search control is always prominent.
- Product grid is touch-friendly with image, product name, SKU, stock, price, and add button.
- Barcode/SKU input and tile tapping both call the same add-to-cart behavior.
- Cart stays visible as a checkout rail on desktop and tablet landscape.
- Cart becomes a sticky/mobile checkout surface on narrow viewports.
- Total due, amount paid, and change are the largest values in the payment area.
- The checkout button is the strongest action on the screen.
- Member scanning stays in the checkout rail but becomes compact.
- Discounts stay available but should not dominate the default selling flow.

Important states:

- Empty product results
- Empty cart
- Out-of-stock product tile
- Guest customer
- Member customer
- Member scan error
- Invalid discount
- Cash and non-cash payment modes

## Admin Screens

Other staff/admin screens adopt the same POS shell and component language:

- Compact sidebar and topbar
- Clear page titles and quick actions
- Data-first cards and tables
- Larger touch targets for buttons and filters
- Consistent status badges
- Consistent loading, empty, error, toast, and modal styling

The admin screens should look related to `orders.html`, but they do not need to imitate the checkout rail.

## Architecture

Keep the static HTML architecture. Do not introduce a frontend framework.

Use shared CSS files as the design system:

- `frontend/assets/css/base.css`: tokens, typography, body, resets
- `frontend/assets/css/layout.css`: app shell, sidebar, topbar, responsive layout
- `frontend/assets/css/components.css`: cards, buttons, forms, tables, badges, toasts, modals, POS-specific components

Use `frontend/assets/js/components.js` for shared navigation markup and small shell behavior only. Preserve existing API calls and global functions.

## Testing

Verification must include:

- `npm test`
- static scan for invalid em dash characters in frontend HTML/CSS/JS
- static scan for accidental QR customer page changes
- browser/manual verification of `orders.html` responsive behavior if a local server can run

Because this is a static frontend redesign with little test coverage, add a focused Node test that verifies the shared menu contains the expected staff/admin entries and does not include the customer QR page.
