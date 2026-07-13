# Product Price Rebalance Design

## Goal

Rebalance the current product catalog prices so the optical POS has more realistic retail pricing by brand tier, while preserving historical invoice snapshots.

## Decision

Update only the active catalog price in `products.price`.

Do not rewrite `orders`, `order_details`, `table_orders`, or `table_order_items` historical price snapshots. Existing invoices should continue to represent the price at the time of sale.

## Pricing Logic

The new catalog uses a clearer price ladder:

- Entry/value brands: Police around 1.69M to 2.19M VND.
- Mainstream sunglasses: RayBan around 2.49M to 2.99M VND.
- Sport performance: Oakley around 2.89M to 4.89M VND.
- Mid-premium optical/fashion: Persol and Moscot around 3.69M to 4.89M VND.
- Contemporary premium: Gentle Monster around 5.49M to 5.99M VND.
- Luxury brands: Prada, Versace, Gucci, Tom Ford, and Dior around 5.99M to 9.49M VND.

Prices end with `90,000` where possible to look like real retail shelf pricing.

## Files

- Add a migration script under `scripts/`.
- Update `scripts/Dump20260704.sql` product seed prices for new database installs.
- Add a focused test that verifies migration anchors, dump anchors, and that historical order detail snapshots are unchanged.

## Out Of Scope

- Recalculating old invoices.
- Changing product names, SKUs, categories, images, or stock.
- Adding price history tables.
