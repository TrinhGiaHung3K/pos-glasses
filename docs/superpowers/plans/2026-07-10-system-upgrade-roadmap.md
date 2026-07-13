# POS Glasses — Lộ trình nâng cấp hệ thống toàn diện

**Ngày:** 2026-07-10  
**Loại tài liệu:** System upgrade roadmap (phân tích + plan triển khai)  
**Phạm vi:** Toàn hệ thống backend, frontend, dữ liệu, vận hành, UX/UI  
**Nguyên tắc:** Ưu tiên giá trị vận hành cửa hàng kính → an toàn dữ liệu → mở rộng domain → tối ưu trải nghiệm

---

## 1. Bối cảnh & hiện trạng hệ thống

### 1.1. Kiến trúc hiện tại

```
Browser (MPA HTML)
  └── frontend/*.html + assets/js|css
        └── fetch JWT → Express API
              └── route → controller → service → repository → MySQL pool
```

| Lớp | Trạng thái | Ghi chú |
|-----|------------|---------|
| Backend modules | ✅ Ổn định | auth, products, customers, orders, promotions, dashboard, staffPerformance, tables, tableOrders |
| Schema bootstrap | ⚠️ Một phần | `checkoutSchema`, `customerSchema` tự migrate; còn lại phụ thuộc dump SQL |
| Auth / RBAC | ⚠️ Cơ bản | JWT + `admin`/`staff`; đăng ký public tạo staff; JWT secret mặc định hardcode |
| POS checkout | ✅ Tốt | Transaction + `FOR UPDATE`, coupon, manual discount theo hạng NV |
| Membership | ✅ Tốt | EAN-13, tier/status, quét barcode/phone |
| QR two-lane | ✅ Cơ bản | Public order → staff confirm/cancel |
| Inventory | ⚠️ UI-only | Xem tồn, chưa sổ nhập/xuất/điều chỉnh |
| Reports | ⚠️ Client-side | Load toàn bộ orders, Chart.js local |
| Dashboard | ⚠️ Tối giản | 4 chỉ số COUNT/SUM toàn thời gian |
| Promotions | ⚠️ Read-only | Chỉ `GET /promotions/:code`, không CRUD, không check date usage |
| Tests | ✅ Khá | ~22 file `node:test` cho core paths |

### 1.2. Mô hình nghiệp vụ đã có

1. **Lane A — Quầy POS** (`orders.html`): quét SP/SKU, quét hội viên, coupon, giảm tay, cash/card/CK, in HĐ.
2. **Lane B — Bàn QR** (`qr/table.html` → `staff/qr-orders.html`): khách gửi yêu cầu → NV confirm → trừ kho + tạo order.
3. **Catalog & kho**: products CRUD, image pipeline, inventory overview.
4. **Hội viên**: đăng ký, thẻ EAN-13, tier standard/silver/gold (chưa auto-upgrade theo chi tiêu).
5. **Nhân viên**: ranking Bronze→Platinum theo đơn hội viên + doanh thu; cap % giảm giá.
6. **Báo cáo / HĐ**: invoices list + detail print, reports filter/export CSV client-side.

### 1.3. Điểm mạnh cần giữ

- Module backend tách rõ (DI qua `createApp`).
- Checkout atomic, khóa tồn `FOR UPDATE`.
- Design system dùng chung (menu, toast, modal, format VND, SKU, productImage).
- Domain kính đã có: brand catalog, member barcode, staff discount ladder, QR tư vấn bàn.
- Test regression đã cover checkout, member code, schema bootstrap.

### 1.4. Khoảng trống chiến lược (gap analysis)

| # | Gap | Ảnh hưởng | Mức độ |
|---|-----|-----------|--------|
| G1 | Không hủy/hoàn/đổi trả (void/refund/return) | Sai sổ, không sửa được lỗi thu ngân | 🔴 Cao |
| G2 | Không sổ kho (stock movement) | Không audit nhập hàng / kiểm kê | 🔴 Cao |
| G3 | Không giá vốn / lợi nhuận | Báo cáo doanh thu ≠ lợi nhuận | 🔴 Cao |
| G4 | Promotion chỉ lookup, không quản trị & validate ngày/hạn mức | Lạm dụng mã, không campaign | 🟠 TB-Cao |
| G5 | Membership tier tĩnh, không điểm/loyalty | Tier chỉ mang tính gán tay | 🟠 TB |
| G6 | Thiếu domain kính: đơn kính / độ cận / biến thể màu-size | POS generic, chưa “optic shop” | 🟠 TB |
| G7 | API list không phân trang/lọc server | Chậm khi data lớn; report load all | 🟠 TB |
| G8 | Security: register public, JWT secret default, không rate-limit, không audit log | Rủi ro vận hành | 🔴 Cao |
| G9 | Dashboard/analytics nông | Quản lý không ra quyết định nhanh | 🟡 TB |
| G10 | Frontend monolithe inline (~50–100KB/page) | Khó maintain, duplicate logic barcode | 🟡 TB |
| G11 | QR realtime kém (poll), thanh toán CK tĩnh | UX staff/khách | 🟡 TB |
| G12 | Không multi-branch / ca làm việc / soft-delete | Scale 1 cửa hàng | 🟢 Thấp–TB |
| G13 | Legacy `POST /orders` + `/order-details` song song checkout | Hai đường tạo đơn, rủi ro không nhất quán | 🟠 TB |
| G14 | Categories hardcode, không API CRUD | Không mở rộng danh mục | 🟢 Thấp |

---

## 2. Tầm nhìn nâng cấp (target architecture)

### 2.1. Mục tiêu 90 ngày

Biến POS Glasses từ **“POS bán kính + hội viên + QR bàn”** thành **hệ vận hành cửa hàng kính hoàn chỉnh**:

1. Sổ quỹ / sổ kho có kiểm soát (nhập–xuất–hoàn–điều chỉnh).
2. POS chắc chắn hơn (hold cart, void, shortcut, offline-tolerant).
3. Loyalty & promotion thực sự gắn với doanh thu.
4. Domain kính (biến thể + optional đơn kính).
5. An ninh & quan sát vận hành (audit, harden auth, metrics).
6. UI/UX terminal-first thống nhất, giảm JS inline trùng lặp.

### 2.2. Nguyên tắc thiết kế

| Nguyên tắc | Áp dụng |
|------------|---------|
| **Correctness first** | Mọi thay đổi tồn/tiền qua transaction + ledger |
| **Backward compatible API** | Giữ route cũ; thêm `/api/v1/...` khi cần |
| **Small vertical slices** | Mỗi feature: schema → service → API → UI → test |
| **Domain events nhẹ** | `StockMoved`, `OrderVoided`, `TierChanged` (có thể log table trước, bus sau) |
| **No big-bang SPA** | Giữ MPA; trích module JS dần; không rewrite React trừ khi Phase 4+ |
| **YAGNI có kiểm soát** | Multi-branch / e-commerce sau khi core retail ổn |

### 2.3. Kiến trúc mục tiêu (logical)

```
┌─────────────────────────────────────────────────────────────┐
│ Presentation: MPA + shared components + page modules        │
├─────────────────────────────────────────────────────────────┤
│ API Gateway layer: auth, RBAC, rate-limit, request-id       │
├───────────────┬─────────────────┬───────────────────────────┤
│ Sales         │ Inventory       │ CRM / Loyalty             │
│ checkout      │ stock ledger    │ members, tiers, points    │
│ void/refund   │ GRN / adjust    │ promotions engine         │
│ hold carts    │ low-stock alert │                           │
├───────────────┼─────────────────┼───────────────────────────┤
│ Optic domain  │ Ops / Admin     │ Analytics                 │
│ variants      │ users, shifts   │ dashboard queries         │
│ Rx (optional) │ audit log       │ server-side reports       │
├───────────────┴─────────────────┴───────────────────────────┤
│ Data: MySQL + migrations versioned + optional Redis later   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Ma trận ưu tiên & phụ thuộc

### 3.1. Ưu tiên (MoSCoW × effort)

| ID | Tính năng | Must/Should | Effort | Phụ thuộc | Sprint gợi ý |
|----|-----------|-------------|--------|-----------|--------------|
| P0-1 | Harden security (JWT, register, rate-limit) | Must | S | — | S1 |
| P0-2 | Fix promotion date validation + usage safety | Must | S | — | S1 |
| P0-3 | Pagination + filter server-side (orders/products) | Must | M | — | S1–S2 |
| P0-4 | Audit log tối thiểu (ai làm gì) | Must | M | P0-1 | S2 |
| P0-5 | Unifier path tạo đơn (deprecate legacy order+detail) | Should | M | — | S2 |
| P1-1 | Void / refund order + hoàn kho | Must | L | P0-4 | S2–S3 |
| P1-2 | Stock ledger (nhập/xuất/điều chỉnh) | Must | L | P1-1 song song schema | S2–S4 |
| P1-3 | Giá vốn + báo cáo lãi gộp | Should | M | P1-2 | S4 |
| P1-4 | Promotion admin CRUD + rule engine v1 | Should | M | P0-2 | S3–S4 |
| P1-5 | Dashboard analytics thật (ngày/tuần/tháng) | Should | M | P0-3 | S3 |
| P1-6 | POS hold cart + keyboard shortcuts | Should | M | — | S3 |
| P2-1 | Loyalty points + auto tier | Should | L | P1-1 | S5–S6 |
| P2-2 | Product variants (màu/size) | Should | L | P1-2 | S5–S6 |
| P2-3 | Realtime QR orders (SSE) | Could | M | — | S5 |
| P2-4 | In barcode SP + thẻ TV đồng bộ | Could | S | — | S4–S5 |
| P2-5 | Categories CRUD + brand taxonomy | Could | S | — | S4 |
| P3-1 | Đơn kính / Rx profile (optic) | Could | L | P2-2 | S7+ |
| P3-2 | Ca làm việc (shift open/close) | Could | M | P0-4 | S6–S7 |
| P3-3 | Multi-branch / multi-warehouse | Won't (gần) | XL | P1-2 | Backlog |
| P3-4 | Frontend module extraction / build step | Should (tech) | L | — | Song song S2–S8 |
| P3-5 | Payment gateway (QR động) | Could | XL | — | Backlog |

**Effort:** S ≤ 2 ngày · M 3–7 ngày · L 1–2 tuần · XL > 2 tuần

### 3.2. Graph phụ thuộc (tóm tắt)

```
P0 Security ──────────────┐
P0 Pagination ─────► Dashboard / Reports server
P0 Promo fix ──────► Promo admin ──► Loyalty rules
P0 Audit ──────────► Void/Refund ──► Stock ledger integrity
Stock ledger ──────► Cost/Profit ──► Advanced reports
Variants ──────────► Optic Rx (optional)
```

---

## 4. Lộ trình theo phase (chi tiết bước nhỏ)

> Mỗi bước nhỏ = 1 PR có thể review/test độc lập.  
> **Làm trước** = Phase 0–1. **Song song** xem mục 5.

---

### Phase 0 — Nền tảng ổn định & an toàn (1–2 tuần)

Mục tiêu: giảm rủi ro trước khi thêm feature lớn.

#### Bước 0.1 — Security hardening ✅ (2026-07-10)
- [x] Bắt buộc `JWT_SECRET` trong production (fail-fast nếu default).
- [x] Tắt `POST /register` mặc định (`ALLOW_PUBLIC_REGISTER=true` để bật lại).
- [x] Rate-limit login (IP + username).
- [x] Security headers + CORS (`CORS_ORIGINS`).
- [x] Auto-hash plain password khi login thành công (legacy seed).
- [x] UI `users.html`: list / create / disable.

#### Bước 0.2 — Promotion correctness ✅ (Phase 1 + policy)
- [x] Validate date / active / min_order / max_uses khi redeem.
- [x] Uppercase code + policy POS Glasses khi tạo mã.

#### Bước 0.3 — List API pagination & filter ✅
- [x] `GET /products?q=&category_id=&in_stock=&page=&limit=`
- [x] `GET /orders?...&page=&limit=`
- [x] `GET /customers?q=&tier=&status=&page=&limit=`
- [x] Không có page/limit → response mảng legacy (compat).

#### Bước 0.4 — Audit log tối thiểu ✅
- [x] Bảng `audit_logs` (Phase 1 schema) + `GET /api/admin/audit-logs`.
- [x] Ghi login success/fail, product CUD, checkout/void/refund.
- [x] UI `audit.html`.

#### Bước 0.5 — Deprecate legacy order path ✅
- [x] `POST /orders` + `/order-details` gửi header Deprecation + Sunset + Link successor.
- [x] Frontend POS dùng `/api/staff/pos/checkout`.

#### Bước 0.6 — Tech hygiene ✅
- [x] `frontend/assets/js/memberCode.js` shared helpers.
- [x] Migration runner `scripts/migrations` + `schema_migrations`.
- [x] `X-Request-Id` middleware + log HTTP có request id; `GET /health`.

**Definition of Done Phase 0:** production secret enforced, promo date-safe, lists paginated, audit có, public register off. ✅

---

### Phase 1 — Vận hành bán hàng & kho “đúng sổ” (3–5 tuần)

Mục tiêu: cửa hàng chạy được cả ngày mà không sợ sai tồn / sai tiền.

#### Bước 1.1 — Void / Refund order ✅ (2026-07-10)
**Logic**
- [x] Trạng thái mở rộng: `completed | voided | refunded | partial_refund`.
- [x] `POST /api/staff/orders/:id/void` (trong ngày staff; admin mọi lúc).
- [x] `POST /api/staff/orders/:id/refund` (full/partial theo line items).
- [x] Transaction: hoàn tồn (`sale_void` / `return_in`) + audit.
- [x] Không xóa row order (immutable history).

**UI**
- [x] Invoices: nút Hủy / Hoàn tiền + lý do bắt buộc.
- [x] Invoice detail: actions void/refund.

**Test**
- [x] Void/refund service tests (double-void, partial, staff same-day).

#### Bước 1.2 — Stock ledger (sổ kho) ✅ (2026-07-10)
**Schema**
```
stock_movements(
  id, product_id, type, qty, unit_cost,
  ref_type, ref_id, note, created_by, created_at
)
-- type: sale | sale_void | purchase_in | adjust_in | adjust_out | return_in
```
- [x] `applyMovementOnConnection` single writer trong TX.
- [x] Checkout / void / refund / table confirm ghi ledger.
- [x] API: purchase-in, adjust, movements, summary, low.

**UI Inventory**
- [x] Nhập hàng / Điều chỉnh / Lịch sử trên `inventory.html`.

#### Bước 1.3 — Giá vốn & lợi nhuận ✅ (2026-07-10)
- [x] `products.cost_price` + snapshot `order_details.cost_price`.
- [x] Dashboard: gross_profit, margin_percent theo kỳ.

#### Bước 1.4 — Promotion admin v1 ✅ (2026-07-10)
**API**
- [x] CRUD `/api/admin/promotions`
- [x] Fields: type percent|amount, value, min_order, max_uses, used_count, start/end, active.
- [x] Checkout: validate date/min/max_uses + atomic used_count.

**UI**
- [x] `promotions.html` (admin).

#### Bước 1.5 — Dashboard analytics ✅ (2026-07-10)
**API** `GET /dashboard?range=today|7d|30d|custom`
- [x] revenue, order_count, aov, new_members, low_stock, pending QR
- [x] series theo ngày; top products; top staff; delta kỳ trước

**UI dashboard.html**
- [x] Chọn kỳ + card lãi gộp / margin / QR chờ.

#### Bước 1.6 — POS terminal UX ✅ (2026-07-10)
- [x] Hold cart localStorage + restore.
- [x] Keyboard: F2 search, F4 pay, F8 hold, Esc clear, +/- qty.
- [x] Idempotency-Key checkout.
- [x] After pay: beep + focus search + chuyển in HĐ.

#### Bước 1.7 — Invoice / payment polish ✅ (một phần)
- [x] Bank transfer content `PG{orderId}` trong response checkout.
- [x] Status voided/refunded/partial_refund trên invoices.
- [ ] (Còn lại) filter payment_method server-side trên UI filter chips — backlog nhỏ.

**Definition of Done Phase 1:** void/refund an toàn, mọi tồn có ledger, promo quản trị được, dashboard ra số theo thời gian, POS hold + shortcut. ✅

---

### Phase 2 — CRM, catalog sâu, realtime (3–4 tuần)

#### Bước 2.1 — Loyalty points + auto tier ✅
**Logic**
- [x] `points_balance`, `lifetime_spend`, `points_ledger`
- [x] Earn: 1 điểm / 100.000đ net total
- [x] Redeem: 1 điểm = 1.000đ, max 20% subtotal
- [x] Auto tier: standard / silver (10tr) / gold (30tr) lifetime_spend
- [x] Void reverse earn + restore redeem (cùng TX)

**UI**
- [x] POS: hiển thị điểm + ô đổi điểm + Max

#### Bước 2.2 — Product variants ✅ (API)
- [x] `product_variants` + `order_details.variant_id`
- [x] Checkout nhận `variant_id`, trừ tồn variant + product ledger
- [x] API CRUD `/api/staff/products/:id/variants`

#### Bước 2.3 — Categories & brand ✅
- [x] Categories list/CRUD admin
- [x] `products.brand` + filter list + backfill từ tên

#### Bước 2.4 — QR lane realtime ✅
- [x] SSE `/api/staff/table-orders/stream?token=`
- [x] Staff QR page toast + reload on events

#### Bước 2.5 — Barcode printing ✅
- [x] `print-labels.html` batch JsBarcode CODE128

#### Bước 2.6 — Customer 360 ✅ (API)
- [x] `GET /customers/:id/summary` — orders, top products, points ledger, tier progress
- [x] `care_of_user_id` column (schema)

**Definition of Done Phase 2:** loyalty E2E, variants API, QR SSE, in tem. ✅

---

### Phase 3 — Domain kính & vận hành nâng cao (4+ tuần / backlog có chọn lọc)

#### Bước 3.1 — Hồ sơ thị lực / đơn kính (Rx) ✅ (API 2026-07-10)
- [x] `customer_prescriptions`: OD/OS SPH/CYL/AXIS, PD, add, ngày đo, bác sĩ/cơ sở.
- [x] API CRUD `/api/staff/customers/:id/prescriptions`, `/api/staff/prescriptions/:id`
- [x] `order_details.prescription_id` column (gắn line khi mở rộng POS)
- [ ] UI form Rx đầy đủ trên POS (backlog polish)

#### Bước 3.2 — Dịch vụ gắn kính / bảo hành ✅ (2026-07-10)
- [x] `order_details.line_type` (`product` | `service` default product)
- [x] `warranties` + tra cứu serial + đăng ký BH
- [x] UI `warranties.html`

#### Bước 3.3 — Ca làm việc (shift) ✅ (2026-07-10)
- [x] Mở ca (tiền đầu ca) → đóng ca (tiền đếm, chênh lệch expected vs counted)
- [x] Checkout gắn `orders.shift_id` + cộng sales theo method
- [x] UI `shifts.html` + badge ca trên POS

#### Bước 3.4 — Nhà cung cấp & PO ✅ (2026-07-10)
- [x] `suppliers`, `purchase_orders`, `purchase_order_items`
- [x] Receive PO → `purchase_in` ledger
- [x] UI `suppliers.html`

#### Bước 3.5 — Multi-branch (chỉ khi có nhu cầu thật)
- `stores`, stock per store, user.store_id, báo cáo theo chi nhánh.
- **Không làm sớm** — phụ thuộc ledger sạch. (backlog)

#### Bước 3.6 — Platform tech (song song dài hạn)
- [x] Health endpoint `/health` (db ping) — đã có từ Phase 0
- [ ] Tách page scripts → ES modules + optional Vite build
- [ ] OpenAPI spec generate từ routes
- [ ] Optional Redis cache dashboard

**Definition of Done Phase 3 (core):** shifts E2E, warranties lookup, suppliers/PO → stock, Rx API. ✅

---

## 5. Các hướng triển khai song song (parallel tracks)

Có thể chạy **3–4 track** độc lập nếu có ≥2 dev hoặc agent song song. Ràng buộc chỉ ở merge schema.

```
        Phase 0 complete
               │
     ┌─────────┼─────────┬──────────────┐
     ▼         ▼         ▼              ▼
 Track A    Track B   Track C        Track D
 Sales      Inventory CRM/Promo      Platform/UX
 void       ledger    promo CRUD     security leftover
 hold cart  cost      loyalty        JS extract
 dash API   inv UI    tier auto      SSE QR
 invoices   lowstock  member 360     print suite
```

| Track | Owner gợi ý | Việc song song an toàn | Không merge trước khi |
|-------|-------------|------------------------|------------------------|
| **A — Sales/POS** | FE+BE orders | Hold cart, shortcuts, invoice print CSS, dashboard charts (mock ok) | Void cần audit (P0-4) |
| **B — Inventory** | BE stock | Schema movements, StockService, inventory UI forms | Checkout refactor gọi StockService cùng lúc void |
| **C — CRM/Promo** | BE customers/promo | Promo CRUD, points design, customer 360 read-only | Redeem điểm sau khi void ổn định |
| **D — Platform/UX** | FE shared | memberCode.js, security headers, migrations runner, SSE skeleton | Không đụng orders.repository transaction khi B đang refactor |

### 5.1. Lịch sprint gợi ý (8 sprint × ~1 tuần)

| Sprint | Focus chính | Song song |
|--------|-------------|-----------|
| S1 | P0.1 Security + P0.2 Promo date + P0.3 pagination start | D: extract memberCode.js |
| S2 | P0.4 Audit + P0.5 deprecate legacy + pagination UI | B: stock_movements schema draft |
| S3 | P1.1 Void/Refund + P1.6 Hold cart shortcuts | C: Promo admin CRUD |
| S4 | P1.2 Stock ledger wire-all + Inventory UI | A: Dashboard analytics API/UI |
| S5 | P1.3 Cost/profit + P1.7 invoice polish | C: Loyalty earn/redeem design+impl |
| S6 | P2.2 Variants v1 + P2.5 barcode print | D: SSE QR + categories CRUD |
| S7 | P2.1 Loyalty polish + Customer 360 | A: partial refund UX |
| S8 | Buffer / bugfix / Rx spike optional | Docs + performance pass |

---

## 6. Chi tiết gợi ý theo lớp (feature → logic → UI)

### 6.1. Backend logic cần nâng cấp

| Module | Nâng cấp | Ghi chú thiết kế |
|--------|----------|------------------|
| `orders` | void, refund, idempotency-key, list filter | Giữ immutable; status machine rõ |
| `products` | cost, variants, barcode field, soft-delete | Quantity chỉ qua StockService |
| **mới** `stock` | applyMovement, list, summary | Single writer pattern |
| `promotions` | CRUD, validate window, max_uses, min_order | Atomic use count trong checkout TX |
| `customers` | points, lifetime_spend, tier engine | Reverse on void |
| `dashboard` | range aggregates, series, tops | SQL aggregation, không load all FE |
| `auth` | admin user mgmt, disable user, password reset | Bỏ public register |
| **mới** `audit` | append-only log | Không update/delete |
| `tableOrders` | SSE/poll upgrade, expire stale pending | Timeout pending sau N giờ |
| `staffPerformance` | period filter, leaderboard cache | Có thể derive từ orders |

### 6.2. Frontend / UI cần nâng cấp

| Trang | Nâng cấp ưu tiên |
|-------|------------------|
| `orders.html` | Hold cart, shortcuts, idempotent pay, variant picker, điểm KH, lỗi coupon rõ |
| `inventory.html` | Nhập/điều chỉnh/lịch sử; bỏ chỉ “xem” |
| `invoices.html` / `invoice_detail.html` | Void/refund, filter status, print 80mm, watermark |
| `dashboard.html` | KPI theo kỳ, chart, low-stock, pending QR |
| `reports.html` | Server-side filter; lãi gộp; export CSV từ API |
| `customers.html` | 360 view, points, progress tier |
| **mới** `promotions.html` | Admin campaign |
| **mới** `users.html` / `audit.html` | Admin ops |
| `staff/qr-orders.html` | Realtime badge, sound, confirm batch |
| `qr/table.html` | Trạng thái đơn, UX mobile polish, empty/error |
| `products.html` | Variants, cost, barcode print, categories |
| Shared CSS | Tokens spacing, density “terminal”, print stylesheet |

### 6.3. UX patterns thống nhất (design system)

1. **Density modes:** POS = compact; admin list = comfortable.
2. **State machine UI:** loading / empty / error / success — dùng component chung (đã có mầm trong inventory).
3. **Destructive actions:** 2-step confirm + lý do (void, xóa SP còn tồn).
4. **Scan-first:** mọi input barcode normalize full-width digits (đã có pattern).
5. **Accessibility:** focus trap modal, aria cho KPI, contrast teal palette giữ.
6. **Performance perceived:** skeleton cards, optimistic cart qty, debounce search 150ms.

---

## 7. Mô hình dữ liệu mở rộng (tóm tắt)

```
users ──┬── orders ── order_details ── products ── variants?
        │      │              │
        │      ├── stock_movements ◄──┘
        │      ├── payments / refunds (optional split table)
        │      └── audit_logs
        │
customers ── points_ledger
         └── prescriptions? 

promotions (richer)
stock_movements
pos_holds?
shifts?
suppliers? → purchase_orders?
```

**Quy tắc vàng:**  
`products.quantity` là **cache** của `SUM(stock_movements)` (hoặc được cập nhật atomic cùng movement). Không `UPDATE quantity` rời rạc ngoài StockService.

---

## 8. Non-functional requirements (NFR)

| Hạng mục | Mục tiêu |
|----------|----------|
| Checkout latency | p95 < 300ms local LAN |
| Concurrent POS | 5–10 thu ngân, stock lock đúng |
| Data integrity | 0 âm kho; 0 double charge (idempotency) |
| Security | No default JWT; no open register; audit critical actions |
| Observability | request-id, error log, `/health` |
| Backup | daily mysqldump script documented |
| Test | mỗi feature Phase 0–1 có unit service + ≥1 integration path |
| A11y / Print | HĐ in được Chrome 80mm |

---

## 9. Rủi ro & mitigation

| Rủi ro | Mitigation |
|--------|------------|
| Refactor stock làm gãy checkout | Feature flag; dual-write quantity+movement; test checkout.repository |
| Void sai hoàn kho | Chỉ completed→void; movement type `sale_void`; test double void |
| FE monolithe khó review | Track D extract modules trước khi feature lớn |
| Scope creep optic Rx | Rx là Phase 3 optional, không block retail core |
| Migration production | `schema_migrations` + script idempotent; backup trước migrate |
| Promo max_uses race | Increment trong cùng TX checkout |

---

## 10. Tiêu chí chọn “làm trước” (decision checklist)

Làm **ngay** nếu:

1. Ảnh hưởng tiền hoặc tồn (void, stock, promo date).  
2. Rủi ro bảo mật production.  
3. Mở khóa nhiều feature sau (audit, pagination, StockService).

Hoãn nếu:

1. Multi-branch / payment gateway / SPA rewrite.  
2. Rx optic khi shop chưa đo mắt in-house.  
3. Microservices / Redis khi single MySQL còn đủ.

---

## 11. Backlog chi tiết (checklist triển khai)

### Wave A — Foundation (trước mọi thứ)
- [ ] A1. JWT secret production fail-fast  
- [ ] A2. Khóa public register + admin create user  
- [ ] A3. Rate limit login  
- [ ] A4. Promotion date validation  
- [ ] A5. Pagination products/orders/customers  
- [ ] A6. Audit log table + middleware helper  
- [ ] A7. Migration runner  
- [ ] A8. Extract `memberCode.js` / shared scan utils  

### Wave B — Money & stock integrity
- [ ] B1. Order status machine + void API  
- [ ] B2. Refund full/partial API  
- [ ] B3. Invoices UI void/refund  
- [ ] B4. `stock_movements` + StockService  
- [ ] B5. Wire checkout / table confirm / void → StockService  
- [ ] B6. Inventory nhập & điều chỉnh UI  
- [ ] B7. `cost_price` + profit reports  
- [ ] B8. Idempotency-key checkout  

### Wave C — Growth features
- [ ] C1. Promotions admin CRUD + max_uses  
- [ ] C2. Dashboard range API + UI  
- [ ] C3. POS hold cart + shortcuts  
- [ ] C4. Loyalty points earn/redeem  
- [ ] C5. Auto membership tier  
- [ ] C6. Customer 360  
- [ ] C7. Variants  
- [ ] C8. Categories/brand CRUD  
- [ ] C9. SSE QR orders  
- [ ] C10. Barcode/label print  

### Wave D — Advanced / later
- [ ] D1. Shift open/close  
- [ ] D2. Suppliers + PO  
- [ ] D3. Prescriptions module  
- [ ] D4. Warranty tracking  
- [ ] D5. VietQR dynamic  
- [ ] D6. Multi-store  
- [ ] D7. Optional Vite/ESM build  
- [ ] D8. OpenAPI + health/backup automation  

---

## 12. Đề xuất 3 cách tiếp cận (chọn hướng vận hành)

| Cách | Mô tả | Ưu | Nhược | Khuyến nghị |
|------|-------|----|-------|-------------|
| **A. Vertical slices theo phase 0→1→2** | Làm đúng thứ tự foundation → integrity → growth | Ít rủi ro, dễ DoD | Chậm “feature show” | ⭐ **Recommended** |
| **B. Big feature parallel** | 4 track A/B/C/D chạy full ngay | Nhanh nếu nhiều người | Conflict schema/TX cao | Chỉ khi ≥2 dev + lead merge |
| **C. UI-first polish** | Redesign nhiều page trước logic | Đẹp sớm | Nợ kỹ thuật tồn/tiền vẫn còn | Không nên ưu tiên |

**Khuyến nghị:** Cách **A**, với Track D (platform) **luôn song song nhẹ** (extract JS, security) để không block.

---

## 13. Metric thành công sau nâng cấp

| Metric | Baseline (ước) | Target |
|--------|----------------|--------|
| Checkout lỗi tồn race | Có thể xảy ra path legacy | 0 với StockService + FOR UPDATE |
| Thời gian void đơn sai | Không làm được / sửa tay DB | < 30s trên UI |
| Audit coverage critical actions | ~0% | 100% void/stock/user |
| Report load time 10k orders | Chậm (full fetch) | < 1s API aggregate |
| % đơn gắn hội viên | Theo vận hành | + đo được & tăng qua loyalty |
| Maintainability page JS | 50–100KB inline | Shared modules, page ≤ orchestration |

---

## 14. Tài liệu liên quan trong repo

| File | Nội dung |
|------|----------|
| `docs/superpowers/specs/2026-07-05-controlled-refactor-design.md` | Tách module backend ban đầu |
| `docs/superpowers/specs/2026-07-05-pos-counter-checkout-design.md` | Checkout quầy |
| `docs/superpowers/specs/2026-07-05-pos-two-lane-qr-ordering-design.md` | QR hai làn |
| `docs/superpowers/specs/2026-07-06-customer-member-barcode-scan-design.md` | Quét hội viên |
| `docs/superpowers/specs/2026-07-06-camera-barcode-staff-ranking-design.md` | Camera + ranking NV |
| `docs/bao-cao-cai-tien-frontend.md` | Các cải tiến FE đã làm |
| `scripts/Dump20260704.sql` | Schema baseline |

---

## 15. Bước tiếp theo ngay sau khi duyệt plan

1. **Chọn Wave A items** (S1) để viết design spec chi tiết đầu tiên — đề xuất:  
   `security-hardening` + `promotion-date-validation` + `list-pagination` (gói nhỏ, ship nhanh).  
2. Spec → plan task-level (`writing-plans`) → implement từng PR.  
3. Song song Track D: extract `memberCode.js`, migration runner.  
4. Sau Wave A: kickoff **Void + StockService** (trái tim Phase 1).

---

## 16. Tóm tắt điều hành (1 trang)

**POS Glasses đã có nền tốt:** modular API, checkout atomic, hội viên EAN-13, QR bàn, ranking NV, UI design system.

**Thiếu để “vận hành thật”:** void/refund, sổ kho, giá vốn, promo admin, dashboard theo thời gian, harden security, pagination.

**Làm trước (2 tuần):** security + promo date + pagination + audit + extract shared JS.

**Làm tiếp (1 tháng):** void/refund + stock ledger + cost/profit + promo CRUD + dashboard + POS hold/shortcuts.

**Làm sau:** loyalty, variants, realtime QR, optic Rx, shift, multi-branch.

**Song song an toàn:** Platform/UX extract modules luôn; CRM promo UI song song sales void; inventory schema draft sớm nhưng wire checkout cẩn thận.

---

*Tài liệu này là roadmap định hướng, không phải implementation plan task-level cho một PR đơn lẻ. Mỗi gói Wave nên có spec riêng trước khi code.*
