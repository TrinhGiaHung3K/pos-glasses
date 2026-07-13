# Controlled Refactor Design

## Goal

Refactor the existing POS Glasses project without changing the current HTML-page workflow. The refactor keeps the current API URLs and pages working while separating backend responsibilities, moving runtime configuration out of code, sharing frontend assets, and fixing known broken behavior.

## Current State

- `server.js` contains Express setup, routes, SQL, business logic, and server startup.
- `config/db.js` hard-codes MySQL credentials.
- Frontend pages contain duplicated inline CSS/JS and call `http://localhost:3000` directly.
- `dashboard.html` calls `/latest-orders`, but the backend does not define it.
- Some pages contain invalid markdown fences or malformed HTML.
- Order creation and order detail insertion are separate routes; the detail route must at least update stock in a transaction.

## Approved Approach

Use a controlled refactor:

- Keep the existing HTML pages and user-facing workflow.
- Keep existing API routes: `/login`, `/products`, `/customers`, `/orders`, `/order-details`, `/dashboard`, `/promotions/:code`.
- Add missing route `/latest-orders`.
- Split backend into `src/app.js`, `src/server.js`, shared config/db/middleware, and feature modules.
- Use `.env` for local MySQL configuration.
- Add Node's built-in test runner for core behavior.
- Move common frontend JS/CSS into `frontend/assets`.

## Backend Architecture

Request flow:

`request -> route -> controller -> service -> repository -> MySQL pool -> response`

Responsibilities:

- Routes bind HTTP endpoints to controller methods.
- Controllers parse request input and return HTTP responses.
- Services contain business rules such as authentication, promotion lookup, order detail creation, and stock validation.
- Repositories contain SQL only.
- Middleware handles async errors, 404 responses, and consistent error JSON.

## Frontend Architecture

Keep pages such as `dashboard.html`, `products.html`, `orders.html`, and `login.html`.

Add shared assets:

- `frontend/assets/js/api.js`: API base URL and request helpers.
- `frontend/assets/js/auth.js`: localStorage user helpers and redirects.
- `frontend/assets/js/format.js`: currency/date helpers.
- `frontend/assets/js/ui.js`: escaping and common DOM helpers.
- `frontend/assets/css/base.css`, `layout.css`, `components.css`: shared styles.

Page scripts may remain inline for this pass, but should use shared API/helper scripts.

## Data And Error Handling

- MySQL uses `mysql2/promise` pool instead of one shared callback connection.
- `.env` supplies `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `PORT`.
- Known 404 cases return `{ "message": "..." }`.
- Server errors return `{ "message": "Internal server error" }` unless a controlled error sets a status.
- `POST /order-details` checks stock and updates stock in one transaction.

## Testing

Use Node's built-in `node:test` and `assert`.

Core coverage:

- Environment defaults and parsing.
- Error helper behavior.
- Order detail service transaction behavior.
- App exposes `/latest-orders` through the routed architecture.

## Scope Boundaries

This refactor does not migrate to React/Vite, does not add JWT sessions, and does not redesign the UI. Password hashing is left as a future security task because the current seed data stores plaintext passwords.

## Self Review

- No placeholders remain.
- Scope is a single refactor pass, not a framework rewrite.
- Route compatibility is explicit.
- MySQL credentials are moved to `.env`, not hard-coded in source.
