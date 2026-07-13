# Controlled Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor POS Glasses into a modular Express backend and shared static frontend assets while keeping the current HTML pages and API routes.

**Architecture:** Express setup lives in `src/app.js`, server boot in `src/server.js`, config in `src/config`, DB pool in `src/db`, middleware in `src/middleware`, and feature code in `src/modules`. Frontend pages stay in `frontend` and use shared `frontend/assets` helpers.

**Tech Stack:** Node.js CommonJS, Express 5, mysql2/promise, cors, dotenv, node:test.

---

### Task 1: Project Configuration And Test Harness

**Files:**
- Modify: `package.json`
- Create: `.gitignore`
- Create: `.env`
- Create: `.env.example`
- Create: `tests/config/env.test.js`
- Create: `src/config/env.js`

- [ ] Add scripts for `start`, `dev`, and `test`.
- [ ] Add `dotenv`.
- [ ] Write tests for DB environment parsing.
- [ ] Implement `src/config/env.js`.
- [ ] Verify with `npm test -- tests/config/env.test.js`.

### Task 2: Backend App Shell

**Files:**
- Create: `src/app.js`
- Create: `src/server.js`
- Create: `src/db/pool.js`
- Create: `src/middleware/asyncHandler.js`
- Create: `src/middleware/httpError.js`
- Create: `src/middleware/errorHandler.js`
- Create: `src/middleware/notFoundHandler.js`
- Replace: `server.js`
- Create: `tests/app.test.js`

- [ ] Write tests for health route and `/latest-orders` route wiring.
- [ ] Implement Express app composition.
- [ ] Implement DB pool and startup.
- [ ] Keep root `server.js` as a compatibility entrypoint.
- [ ] Verify app tests.

### Task 3: Feature Modules

**Files:**
- Create: `src/modules/auth/*`
- Create: `src/modules/products/*`
- Create: `src/modules/customers/*`
- Create: `src/modules/orders/*`
- Create: `src/modules/promotions/*`
- Create: `src/modules/dashboard/*`
- Create: `tests/modules/orders/orderDetails.service.test.js`

- [ ] Write order detail transaction tests.
- [ ] Move SQL into repositories.
- [ ] Move request handlers into controllers.
- [ ] Move business rules into services.
- [ ] Verify route compatibility.

### Task 4: Shared Frontend Assets

**Files:**
- Create: `frontend/assets/js/api.js`
- Create: `frontend/assets/js/auth.js`
- Create: `frontend/assets/js/format.js`
- Create: `frontend/assets/js/ui.js`
- Create: `frontend/assets/css/base.css`
- Create: `frontend/assets/css/layout.css`
- Create: `frontend/assets/css/components.css`
- Modify: `frontend/*.html`

- [ ] Add shared helpers.
- [ ] Replace hard-coded API URLs with `apiRequest`.
- [ ] Remove invalid markdown fences.
- [ ] Fix missing frontend functions and broken HTML around known pages.
- [ ] Preserve existing page URLs.

### Task 5: Verification

**Files:**
- All changed files

- [ ] Run `npm test`.
- [ ] Run `node --check server.js`.
- [ ] Run `node --check src/server.js`.
- [ ] Run `node --check src/app.js`.
- [ ] Start server briefly and verify `/`, `/dashboard`, and `/latest-orders` respond if MySQL is reachable.
