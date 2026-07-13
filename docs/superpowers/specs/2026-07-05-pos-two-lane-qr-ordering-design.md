# POS Two-Lane QR Ordering Design

## Goal

Rebuild POS Glasses into a two-lane POS system:

- Internal POS lane for admin and staff.
- Public QR lane for customers at fixed tables.

The customer QR lane is mobile-first. Customers scan a table QR, choose products, and send a request. Staff confirm the exact request before inventory is reduced and an official invoice is created.

## Approved Decisions

- Keep the current Node.js, Express, MySQL, static HTML/CSS/JS stack.
- Split internal and public route surfaces.
- Use `admin` and `staff` roles.
- Use fixed tables with stable QR tokens.
- QR customers do not log in and do not enter personal details.
- QR customers only send order requests.
- Staff confirm the request exactly as submitted. Staff cannot edit requested line items before confirmation.
- Payment remains offline/manual. Staff review the table total and print the invoice after confirmation.
- Backend must update the existing database structure through SQL schema changes and application code.

## Route Architecture

Internal pages:

- `/admin/dashboard.html`
- `/admin/products.html`
- `/admin/tables.html`
- `/admin/staff.html`
- `/staff/orders.html`
- `/staff/qr-orders.html`
- `/staff/invoices.html`

Public QR pages:

- `/qr/table.html?token=<qr_token>`

Internal APIs:

- `/api/admin/*` requires JWT and `admin`.
- `/api/staff/*` requires JWT and either `admin` or `staff`.

Public APIs:

- `/api/public/tables/:token/menu`
- `/api/public/table-orders`

Legacy APIs may stay available during the transition so current pages continue to work while new pages are added.

## Data Model

Existing tables remain, with these changes:

- `users.role` is restricted by application validation to `admin` or `staff`.
- `orders.customer_id` remains nullable for QR orders.
- `orders` gains `source`, `table_id`, `table_order_id`, and `status`.

New tables:

- `store_tables`: fixed POS tables with stable QR tokens.
- `table_orders`: public QR order requests by table.
- `table_order_items`: product lines submitted by the customer.

`table_order_items` stores product name and price snapshots so staff see the request exactly as the customer submitted it, even if the product changes later.

## QR Order Flow

1. Customer opens `/qr/table.html?token=<qr_token>`.
2. Frontend calls `/api/public/tables/:token/menu`.
3. Backend returns active table info and in-stock products.
4. Customer adds products to cart and submits.
5. Backend validates the table token and product quantities, stores a `pending` table order, but does not reduce stock.
6. Staff opens the QR order queue.
7. Staff confirms a pending request.
8. Backend starts a transaction, checks stock, creates `orders` and `order_details`, reduces stock, marks the table request `confirmed`, and links it to the official order.
9. Staff prints the invoice from the confirmed order.

If stock is insufficient during staff confirmation, backend leaves the request unconfirmed and returns a clear error.

## UI Direction

QR customer UI:

- Mobile-first single-column layout.
- Large product cards with image, name, price, stock state, and stepper controls.
- Sticky bottom cart summary with submit CTA.
- Clear empty, loading, submitted, and error states.
- No admin sidebar, no login redirect, no dashboard text.

Internal UI:

- Minimal modern POS dashboard.
- Admin/staff route separation.
- Staff queue highlights pending table orders.
- Admin table management exposes table code, active state, QR token, and QR URL.

Visual system:

- Light theme by default.
- High contrast text.
- One restrained accent color.
- Phosphor icons already available in the project.
- Stable tap targets for mobile.

## Backend Responsibilities

- Add role middleware for `admin` and `staff` routes.
- Add public routes that do not use JWT.
- Add repositories, services, controllers, and routes for tables and table orders.
- Keep order confirmation transactional.
- Keep business rules in services and SQL in repositories.
- Update `scripts/Dump20260704.sql`.
- Add an idempotent migration script for existing databases.

## Testing

Use Node's built-in `node:test`.

Required coverage:

- Role middleware allows and blocks expected roles.
- Public menu returns table and products without auth.
- Public table order creation stores pending orders without reducing stock.
- Staff confirmation checks stock, creates official orders, reduces inventory, and marks the table order confirmed in one transaction.
- Staff confirmation fails clearly when stock is insufficient.

## Scope Boundaries

- No online payment integration.
- No customer profile collection in QR flow.
- No React/Vite migration.
- No staff editing of QR request line items before confirmation.
- No real QR image generation library is required in this pass; table pages expose QR URLs that can be copied or encoded externally.

## Self Review

- No placeholders remain.
- The design reflects the user-approved choices.
- The route split, data model, QR flow, backend work, UI direction, and tests are explicit.
- The scope is large but cohesive because schema, API, and UI must land together for QR ordering to work end to end.
