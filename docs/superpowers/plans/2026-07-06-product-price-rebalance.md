# Product Price Rebalance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebalance product catalog prices while preserving invoice price snapshots.

**Architecture:** Use a SQL migration for live databases and update the seed dump for fresh installs. Add a Node test that reads SQL files directly and checks representative price anchors and historical snapshot preservation.

**Tech Stack:** MySQL SQL scripts, Node test runner, static SQL dump.

---

## Task 1: Failing Price Contract

- [ ] Add `tests/product-price-rebalance.test.js`.
- [ ] Assert migration file `scripts/2026-07-06-product-price-rebalance.sql` exists and contains representative new prices.
- [ ] Assert `scripts/Dump20260704.sql` contains the same representative product prices.
- [ ] Assert old `order_details.price` snapshots remain unchanged.
- [ ] Run `npm test -- tests/product-price-rebalance.test.js`.
- [ ] Expected: fail because the migration and dump prices are not updated yet.

## Task 2: Migration Script

- [ ] Create `scripts/2026-07-06-product-price-rebalance.sql`.
- [ ] Update all current product prices by SKU using a single `UPDATE products SET price = CASE sku ... END WHERE sku IN (...)`.
- [ ] Keep the script idempotent.
- [ ] Run the focused test.
- [ ] Expected: fail until the dump is updated.

## Task 3: Seed Dump Update

- [ ] Update only `products.price` values in `scripts/Dump20260704.sql`.
- [ ] Do not change `order_details` or `orders` totals.
- [ ] Run the focused test.
- [ ] Expected: pass.

## Task 4: Final Verification

- [ ] Run `npm test`.
- [ ] Confirm no changes to public QR frontend files.
