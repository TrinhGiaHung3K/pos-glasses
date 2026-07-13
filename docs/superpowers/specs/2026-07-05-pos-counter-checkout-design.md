# POS Counter Checkout Design

## Goal

Rebuild the selling flow into a counter-style POS checkout for an eyewear store. The POS screen should let staff sell quickly from one workspace: select products, maintain a cart, optionally attach a customer, apply discounts, take payment, create the invoice, reduce stock, and print the receipt.

This replaces the table-order workflow as the main selling path. Existing QR/table schema and modules remain in the codebase for data safety, but they are removed from the default navigation and login landing flow.

## Approved Decisions

- Use the current Node.js, Express, MySQL, static HTML/CSS/JS stack.
- Build the core flow around one atomic checkout request.
- Replace the current two-step order workflow on `orders.html`.
- Hide table/QR ordering from the active POS workflow.
- Keep `store_tables`, `table_orders`, and `table_order_items` in the database for now.
- Default customer is walk-in customer, represented by nullable `orders.customer_id`.
- Allow selecting an existing customer when staff need warranty or customer-care tracking.
- Keep coupon lookup and add manual discount by percentage or fixed VND amount.
- Record payment method, amount paid, and change amount.
- Backend recalculates prices and totals. Frontend totals are display-only.

## Scope

In scope:

- A POS checkout screen on `frontend/orders.html`.
- A protected staff/admin checkout API.
- Transactional order creation, order details insertion, and stock reduction.
- Payment summary fields on orders.
- Discount validation and calculation in the backend.
- Navigation and landing updates so staff start at the POS checkout flow.
- Tests for checkout calculations, validation, transaction behavior, and auth.
- Idempotent SQL migration plus updates to the database dump.

Out of scope:

- Dropping QR/table tables.
- Online payment integrations.
- Sales shifts, cash drawers, refunds, exchanges, and split payments.
- Barcode scanner hardware integration beyond supporting fast search by SKU/name.
- Full customer creation redesign outside a small POS-friendly shortcut if feasible.

## Route Architecture

The POS checkout route should be protected by the existing JWT middleware and `admin`/`staff` role checks.

Preferred endpoint:

- `POST /api/staff/pos/checkout`

Acceptable local alternative:

- `POST /orders/checkout` if keeping the implementation inside the existing orders module is simpler for this pass.

The implementation should preserve existing legacy endpoints during transition:

- `POST /orders`
- `POST /order-details`
- `GET /orders`
- `GET /orders/:id`
- `GET /latest-orders`

The new POS screen must use the new checkout endpoint instead of creating an order header and then adding order details one line at a time.

## Data Model

`orders` remains the official invoice table.

Required order behavior:

- `customer_id` is nullable for walk-in customers.
- `source` should be `pos` for counter sales.
- `status` should be `completed` after successful checkout.
- `total_amount` stores the final payable total.
- `coupon_code` and `discount_percent` remain for compatibility.

Add or standardize these POS fields on `orders`:

- `subtotal_amount decimal(12,2) NOT NULL DEFAULT 0`
- `discount_amount decimal(12,2) NOT NULL DEFAULT 0`
- `manual_discount_type varchar(20) DEFAULT NULL`
- `manual_discount_value decimal(12,2) NOT NULL DEFAULT 0`
- `payment_method varchar(30) NOT NULL DEFAULT 'cash'`
- `amount_paid decimal(12,2) NOT NULL DEFAULT 0`
- `change_amount decimal(12,2) NOT NULL DEFAULT 0`

Allowed payment methods for this pass:

- `cash`
- `bank_transfer`
- `card`

`mixed` is intentionally deferred until split payment is designed.

Allowed manual discount types:

- `percent`
- `amount`
- `null` when no manual discount is applied.

The QR/table columns currently on `orders` may stay nullable:

- `table_id`
- `table_order_id`

Counter POS orders should not set table fields.

## Checkout Payload

The frontend sends one checkout request:

```json
{
  "customer_id": null,
  "items": [
    {
      "product_id": 7,
      "quantity": 2
    }
  ],
  "coupon_code": "CODE30",
  "manual_discount": {
    "type": "amount",
    "value": 50000
  },
  "payment": {
    "method": "cash",
    "amount_paid": 6500000
  }
}
```

The backend obtains `user_id` from `req.user.id`; it must not trust a user id from the request body.

## Checkout Transaction

The service handles checkout in one transaction:

1. Validate the user, payload shape, item list, quantities, discount fields, and payment method.
2. Normalize duplicate product lines by summing quantities.
3. Open a transaction.
4. Load requested products with `SELECT ... FOR UPDATE`.
5. Reject missing products and insufficient stock.
6. Recalculate item prices from the database.
7. Compute `subtotal_amount`.
8. Validate coupon if present using the existing promotions rules.
9. Compute coupon discount.
10. Compute manual discount by percent or fixed amount.
11. Reject discounts that make the payable total negative.
12. Compute `discount_amount` and `total_amount`.
13. For `cash`, require `amount_paid >= total_amount` and compute `change_amount`.
14. For `bank_transfer` and `card`, set `amount_paid` to at least `total_amount`; the UI may send the exact paid amount.
15. Insert the `orders` row.
16. Insert all `order_details` rows with price snapshots.
17. Reduce stock for all products.
18. Commit.
19. Return the created `order_id`, totals, payment summary, and receipt target.

If any step fails, rollback the entire transaction. The system must never leave an order header without all intended order details.

## Frontend POS UX

`frontend/orders.html` becomes the main POS checkout screen.

Main areas:

- Product search and selection.
- Product list/grid with image, name, SKU, price, and stock.
- Cart panel with quantity controls and remove buttons.
- Customer selector defaulting to walk-in customer.
- Coupon input and apply/check action.
- Manual discount controls for percent or VND amount.
- Payment method selector.
- Amount paid input and change preview.
- Primary checkout button.
- Success state with order id and print invoice action.

Important UX rules:

- Products with zero stock are visible but disabled or clearly unavailable.
- Clicking an in-stock product adds it to the cart or increments its quantity.
- Quantity controls cannot exceed visible stock on the client, but backend remains authoritative.
- Staff can complete a sale without selecting a customer.
- Frontend displays provisional totals, but success uses backend totals.
- After successful checkout, reset the cart and keep staff on the POS page.
- Provide a direct link to print/view the generated invoice.

Navigation updates:

- Staff login should land on `/orders.html`.
- Admin landing may remain dashboard-oriented, but POS checkout should be prominent.
- Remove or hide `/staff/qr-orders.html` and `/admin/tables.html` links from the primary POS navigation.

## Error Handling

Return clear, controlled messages for expected POS failures:

- Empty cart: `Vui lòng chọn ít nhất một sản phẩm`.
- Invalid product: `Sản phẩm không tồn tại`.
- Insufficient stock: include the product name when available.
- Invalid coupon: `Mã giảm giá không tồn tại hoặc đã hết hạn`.
- Invalid manual discount: `Giảm giá không hợp lệ`.
- Discount greater than subtotal: reject checkout instead of silently clamping to zero.
- Cash paid amount below total: `Tiền khách đưa chưa đủ`.
- Unauthorized checkout: existing auth errors apply.

Unexpected transaction failures should rollback and return the existing internal error shape.

## Testing

Use Node's built-in test runner.

Required coverage:

- Checkout rejects an empty cart.
- Checkout rejects invalid payment method.
- Checkout rejects manual discount greater than subtotal.
- Checkout rejects insufficient cash payment.
- Checkout calculates subtotal, coupon discount, manual discount, total, amount paid, and change.
- Checkout combines duplicate product lines.
- Checkout success creates one order, creates all order details, and reduces stock in one transaction.
- Checkout failure from insufficient stock does not insert an order or order details.
- Checkout uses `req.user.id`, not a body-supplied user id.
- Staff/admin can access checkout; unauthenticated requests cannot.

Existing QR/table tests may remain, but they are no longer the primary POS acceptance path.

## Migration

Add an idempotent migration script for the POS checkout fields on `orders`.

Also update `scripts/Dump20260704.sql` so fresh database imports include the POS fields.

The migration must not drop:

- `store_tables`
- `table_orders`
- `table_order_items`

The migration should preserve old order data by defaulting new numeric fields to `0` and payment method to `cash`.

## Implementation Notes

Keep repository/service/controller boundaries consistent with the current project:

- Routes bind URLs to controllers.
- Controllers parse request context and response shape.
- Services contain checkout business rules and calculations.
- Repositories contain SQL and transaction mechanics.

Prefer placing checkout in a focused POS module if it stays small and clear. If reuse with order queries is easier, it can live inside the existing orders module, but calculation helpers should remain testable without a database.

## Self Review

- No placeholders remain.
- The design matches the approved choices: POS counter checkout, hidden QR/table workflow, walk-in default customer, coupon plus manual discount, and payment recording.
- The backend is authoritative for price, discount, stock, and totals.
- The transaction boundaries prevent partial invoices.
- Scope is focused on POS checkout and avoids larger cashier features like shifts and refunds.
