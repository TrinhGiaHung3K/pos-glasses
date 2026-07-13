# POS Two-Lane QR Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build separate internal POS and public QR table-ordering flows on the current Express, MySQL, and static frontend stack.

**Architecture:** Add focused table and table-order modules beside the existing feature modules. Keep public QR APIs before JWT middleware, add role-gated internal APIs after JWT middleware, and confirm QR requests through a single transaction that creates the official order and reduces stock. Add mobile-first QR frontend pages and minimal internal staff/admin pages while preserving legacy routes during transition.

**Tech Stack:** Node.js CommonJS, Express 5, mysql2/promise, MySQL, static HTML/CSS/JS, Bootstrap vendor assets, Phosphor icons, Node's built-in test runner.

---

### Task 1: Schema And Migration

**Files:**
- Modify: `scripts/Dump20260704.sql`
- Create: `scripts/2026-07-05-pos-qr-migration.sql`

- [ ] Add `store_tables`, `table_orders`, and `table_order_items` to the dump.
- [ ] Add `source`, `table_id`, `table_order_id`, and `status` to `orders` in the dump.
- [ ] Add seed rows for tables `T01`, `T02`, and `T03`.
- [ ] Create an idempotent migration script that adds the same columns/tables to an existing database without dropping user data.

### Task 2: Auth And Role Boundaries

**Files:**
- Create: `src/middleware/requireRole.js`
- Modify: `src/app.js`
- Test: `tests/middleware/requireRole.test.js`

- [ ] Add failing tests for admin/staff role authorization.
- [ ] Implement `requireRole(...roles)`.
- [ ] Mount legacy, staff, admin, and public routes in a clear order.

### Task 3: Table Management Backend

**Files:**
- Create: `src/modules/tables/repository.js`
- Create: `src/modules/tables/service.js`
- Create: `src/modules/tables/controller.js`
- Create: `src/modules/tables/routes.js`
- Modify: `src/app.js`
- Test: `tests/modules/tables/tables.service.test.js`

- [ ] Add tests for active table lookup by token and admin table creation validation.
- [ ] Implement table repository, service, controller, and routes.
- [ ] Expose admin table management routes and public table menu route.

### Task 4: QR Table Order Backend

**Files:**
- Create: `src/modules/tableOrders/repository.js`
- Create: `src/modules/tableOrders/service.js`
- Create: `src/modules/tableOrders/controller.js`
- Create: `src/modules/tableOrders/routes.js`
- Modify: `src/app.js`
- Test: `tests/modules/tableOrders/tableOrders.service.test.js`

- [ ] Add tests proving public order creation stores a pending request without stock updates.
- [ ] Add tests proving staff confirmation creates official order details and reduces stock transactionally.
- [ ] Add tests for insufficient stock during confirmation.
- [ ] Implement public create, staff list, staff confirm, and staff cancel behavior.

### Task 5: Existing Order Compatibility

**Files:**
- Modify: `src/modules/orders/repository.js`
- Modify: `src/modules/orders/service.js`
- Modify: `src/modules/orders/controller.js`
- Test: `tests/modules/orders/orders.repository.test.js`

- [ ] Update order queries to tolerate nullable customers and QR table metadata.
- [ ] Keep legacy `/orders` and `/latest-orders` consumers working.
- [ ] Return source/status/table fields for staff views.

### Task 6: Frontend Shared Routing And Styling

**Files:**
- Modify: `frontend/assets/js/api.js`
- Modify: `frontend/assets/js/auth.js`
- Modify: `frontend/assets/css/base.css`
- Modify: `frontend/assets/css/layout.css`
- Modify: `frontend/assets/css/components.css`
- Create: `frontend/assets/css/qr.css`

- [ ] Add API helpers that can call public routes without auth redirect.
- [ ] Add role-aware auth helpers for internal pages.
- [ ] Add minimal modern POS and QR design tokens.
- [ ] Add mobile-first QR layout components and stable bottom action bar styles.

### Task 7: Public QR Frontend

**Files:**
- Create: `frontend/qr/table.html`

- [ ] Build mobile-first QR menu page.
- [ ] Load table and product data from `/api/public/tables/:token/menu`.
- [ ] Implement product quantity steppers, cart summary, and submit state.
- [ ] Submit to `/api/public/table-orders`.
- [ ] Show loading, empty, error, and submitted states.

### Task 8: Internal Staff/Admin Frontend

**Files:**
- Create: `frontend/staff/qr-orders.html`
- Create: `frontend/admin/tables.html`
- Modify: `frontend/login.html`

- [ ] Add staff queue for pending QR requests.
- [ ] Add confirm and cancel actions.
- [ ] Add admin table list with QR URLs.
- [ ] Redirect authenticated users to an appropriate internal landing page by role.

### Task 9: Verification

**Files:**
- All changed files

- [ ] Run focused tests for new middleware and services.
- [ ] Run `npm test`.
- [ ] Run `node --check` for changed backend files.
- [ ] Start the server and verify public QR and staff endpoints respond when MySQL is reachable.

## Self Review

- The plan covers all approved spec sections.
- No implementation step depends on a framework migration.
- Tests are tied to backend behavior with the highest risk.
- UI work is scoped to static assets and new HTML entry points.
- Git commit steps are omitted because this workspace is not a git repository.
