# Phân tích toàn hệ thống và kế hoạch nâng cấp POS Glasses

**Ngày:** 2026-07-15  
**Phạm vi:** Express 5 + MySQL + frontend HTML/CSS/JavaScript đa trang  
**Mục tiêu:** ổn định luồng bán hàng và SePay, tăng bảo mật, chuyển ảnh sang Cloudinary, giảm giá catalog cho đợt quét POS, và hướng dẫn người dùng lần đầu.

## 1. Tóm tắt điều hành

Hệ thống đã có nền nghiệp vụ khá đầy đủ: checkout có transaction, stock ledger, void/refund, promotion, loyalty, ca làm việc, supplier/PO, bảo hành, đơn kính, QR bàn, QR sản phẩm, audit, AI và payment intent. Backend đã chia theo 21 domain; frontend có 22 trang; repository hiện có 55 file test.

Các lỗi ưu tiên cao được phát hiện:

1. `/` trả JSON `API Running`, không điều hướng vào ứng dụng.
2. JWT được trả cho JavaScript và lưu trong `localStorage`, tăng thiệt hại nếu có XSS.
3. SePay BIDV gửi tài khoản chính ở `accountNumber` và VA ở `subAccount`, nhưng code chỉ so sánh `accountNumber`; giao dịch thật vì vậy bị `account_mismatch`.
4. HMAC SePay được tính trên `raw_body`, trong khi chuẩn hiện tại là `{timestamp}.{raw_body}` và cần kiểm tra replay ±5 phút.
5. UI chỉ dựa vào event SSE. Nếu webhook hoàn tất trước khi SSE kết nối hoặc SSE bị ngắt, trang không tự phục hồi trạng thái.
6. TTL 10 phút ngắn đối với thao tác quét/chuyển tiền tại quầy; giao dịch đến trễ bị ghi `unmatched` và không liên kết để đối soát.
7. Ảnh sản phẩm lưu trên disk của ứng dụng; disk PaaS có thể mất sau deploy/restart.
8. Frontend còn rất lớn: `products.html` 3.219 dòng, `orders.html` 2.337 dòng, `customers.html` 2.223 dòng. Điều này làm tăng rủi ro XSS/regression và khó kiểm thử.
9. Migration runner bỏ luôn statement nếu file SQL bắt đầu bằng comment.
10. Production có thể tiếp tục mở HTTP server khi DB/migration lỗi, khiến ứng dụng ở trạng thái nửa sống.

## 2. Kiến trúc hiện tại

```text
Browser MPA (22 trang HTML + shared JS/CSS)
        |
        | Bearer JWT cũ / HttpOnly cookie mới
        v
Express 5
  ├─ public: auth, QR bàn, QR sản phẩm, SePay webhook
  ├─ staff/admin: catalog read, POS, customer, order, stock, shift...
  └─ admin: user, audit, table, promotion, payment ops
        |
        v
Service layer (21 domain)
        |
        v
Repository layer + mysql2
        |
        v
MySQL: orders, stock ledger, payment intent/transaction, audit...

External:
  SePay -> /api/webhooks/payments/sepay
  Cloudinary <- product image upload
  Gemini <- AI gateway (feature flag)
```

### Điểm mạnh

- SQL phần lớn dùng parameter binding.
- Checkout, reserve/finalize, stock movement và refund đã có transaction/ràng buộc nghiệp vụ.
- Có RBAC admin/staff, rate limit login, audit và production JWT fail-fast.
- Payment đã có intent, transaction, webhook delivery và dedup key.
- Có fake provider nên test payment không cần chuyển tiền thật.
- Có pagination/filter và shared frontend helpers.

### Nợ kỹ thuật còn lại

- Validation request rải rác trong service, chưa có schema thống nhất.
- Nhiều script/style inline buộc CSP phải tạm cho phép `'unsafe-inline'`.
- Rate limiter và payment event hub chỉ nằm trong memory một process.
- JWT chưa có `token_version`/revoke toàn hệ thống; cookie mới giảm lộ token nhưng chưa giải quyết stolen-token hoàn toàn.
- Raw webhook JSON chưa có retention/redaction job.
- Chưa có outbox/job queue, metrics payment, cảnh báo webhook im lặng và quy trình manual reconciliation hoàn chỉnh.
- Upload hiện vẫn đi qua base64 JSON và memory server; Cloudinary đã loại bỏ disk production nhưng chưa tối ưu direct signed upload.
- Tour hoàn thành lưu theo browser; chưa đồng bộ giữa các máy POS.
- Chưa có OpenAPI, CI bắt buộc, test DB disposable và backup-restore drill định kỳ.

## 3. Chẩn đoán SePay dựa trên dữ liệu thật

Kiểm tra read-only các bảng production cho thấy:

- Webhook thật đã vào server, `signature_valid=1`.
- Một giao dịch 2.900đ đúng mã bị `account_mismatch`.
- Payload BIDV chứa `accountNumber` là tài khoản VA ngân hàng dạng dài và `subAccount` là mã VA đã cấu hình cho POS.
- Một giao dịch khác đến sau khi intent 10 phút hết hạn và nội dung qua trung gian không còn mã POS, nên không thể tự match an toàn.
- Không có bằng chứng cho thấy tiền chưa vào; lỗi là ở quy tắc đối soát và cơ chế cập nhật trạng thái website.

Luồng đúng sau nâng cấp:

```text
SePay webhook
  -> xác thực API Key hoặc HMAC(timestamp.raw_body)
  -> deduplicate bằng SePay transaction id
  -> match accountNumber HOẶC subAccount
  -> match mã chuyển khoản + exact amount
  -> pending còn hạn: finalize order / mark test paid
  -> hết hạn: link transaction với intent, gắn late_payment để admin đối soát
  -> publish SSE

POS browser
  -> mở SSE và nhận trạng thái DB ngay khi kết nối
  -> song song poll GET intent mỗi 3 giây
  -> chỉ clear cart/in hóa đơn khi status=paid
```

Tài liệu chuẩn dùng để đối chiếu:

- [SePay webhook authentication](https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc)
- [SePay webhook payload và `subAccount`](https://developer.sepay.vn/vi/sepay-webhooks/tich-hop-webhook)
- [SePay cấu hình mã thanh toán](https://developer.sepay.vn/vi/sepay-webhooks/cau-hinh-ma-thanh-toan)
- [SePay hỗ trợ BIDV qua VA](https://developer.sepay.vn/vi/sepay-webhooks/tai-khoan-ngan-hang)

## 4. Những hạng mục đã triển khai trong đợt này

### ROUTE-01 — Entry route

- `/` trả HTTP 302 tới `/login.html`.
- Trang login gọi `/api/auth/session` để kiểm tra cookie hiện tại.
- Admin đã đăng nhập đi tới `/dashboard.html`; staff đi tới `/orders.html`.

### SEC-01 — Session và trình duyệt

- Login phát cookie `HttpOnly`, `SameSite=Strict`, `Secure` ở production.
- JSON login không còn trả JWT cho code trình duyệt mới.
- Bearer JWT cũ vẫn được hỗ trợ trong giai đoạn chuyển tiếp.
- Mutation dùng cookie phải có nguồn cùng host; request cross-site bị chặn.
- Logout xóa cookie và local session marker.
- Cookie session kiểm tra lại user trong DB, nên tài khoản bị disable mất quyền ngay.

### SEC-02 — Header, CORS, body và RBAC

- Thêm CSP, HSTS production, COOP, CORP, `nosniff`, frame protection và referrer policy.
- Camera chỉ cho phép từ chính origin để chức năng barcode vẫn dùng được.
- Production CORS không còn reflect mọi origin nếu thiếu cấu hình.
- JSON mặc định giới hạn 256KB; chỉ route ảnh đã auth được nhận tối đa 10MB.
- Staff chỉ đọc catalog; create/update/delete/upload ảnh sản phẩm yêu cầu admin.
- Mật khẩu mới: 10–128 ký tự, ít nhất một chữ và một số; bcrypt cost 12.
- Chart.js chuyển từ CDN không pin version sang package self-hosted.

### PAY-01 — SePay correctness

- Hỗ trợ API Key và HMAC-SHA256 chuẩn có timestamp/replay window.
- Match cả `accountNumber` và `subAccount` sau khi chuẩn hóa định danh số.
- Dùng cả `code` và `content` để tìm intent.
- Giao dịch trễ được liên kết với intent dưới trạng thái `late_payment`, không tự hoàn tất đơn đã hết hạn.
- Webhook retry không dừng sớm chỉ vì delivery key đã tồn tại nếu transaction chưa được ghi.
- Public intent trả thêm `order_id` và persisted payment status.

### PAY-02 — Website tự cập nhật

- SSE gửi trạng thái đã lưu ngay khi browser kết nối, đóng race “webhook đến trước SSE”.
- Orders và payment-test poll mỗi 3 giây làm fallback.
- SSE không còn đưa JWT trong query string.
- TTL mặc định và cấu hình local tăng từ 10 lên 30 phút; late-match window 60 phút.

### PRICE-01 — Giá catalog demo POS

- Migration lưu `original_price` và `original_cost_price` trước khi thay đổi.
- Giá mới bằng `ROUND(price / 1000)`, tối thiểu 1.000đ; cost được scale cùng tỷ lệ để báo cáo không âm giả.
- Không sửa snapshot giá trong hóa đơn cũ.
- Có script restore giá gốc.

Lưu ý: đây là thay đổi catalog thật khi migration được deploy. Không chạy migration này trên môi trường bán hàng giá thật nếu mục tiêu chỉ là test; khi đó cần tách một staging DB hoặc dùng restore script sau kiểm thử.

### IMG-01 — Cloudinary

- Thêm Cloudinary Node SDK và adapter server-side signed upload.
- Ảnh client đã xử lý nền được upload vào folder `pos-glasses/products`.
- Database lưu HTTPS `secure_url` như đường dẫn ảnh hiện tại.
- Dev không có credential tiếp tục fallback local; khi Cloudinary đã bật nhưng upload lỗi, API trả 502 thay vì báo lưu thành công giả.

Tài liệu: [Cloudinary Node integration](https://cloudinary.com/documentation/node_integration), [Node upload](https://cloudinary.com/documentation/node_image_and_video_upload).

### TOUR-01 — Hướng dẫn lần đầu

- Self-host `@sjmc11/tourguidejs` (`tour.js` + CSS).
- Admin có tour dashboard 5 bước; staff có tour POS 6 bước.
- Trạng thái hoàn thành gắn với `user.id + role + tour version`.
- Nút “Hướng dẫn” trong menu cho phép chạy lại; từ trang khác sẽ chuyển về landing đúng role.

Tài liệu: [TourGuide JS](https://tourguidejs.com/docs/).

### OPS-01 — Migration và startup

- Migration runner không còn làm mất statement đứng sau SQL comment.
- Production fail startup nếu DB/migration không sẵn sàng.

## 5. Cấu hình cần thực hiện khi deploy

### 5.1. Render/application

1. Backup MySQL trước deploy.
2. Cấu hình tối thiểu:

```text
NODE_ENV=production
PUBLIC_APP_URL=https://<domain>
CORS_ORIGINS=https://<domain>
JWT_SECRET=<random >= 64 bytes>
SESSION_TTL_HOURS=24

PAYMENT_PROVIDER=sepay
PAYMENT_WEBHOOK_AUTH=api_key  # hiện tại; đổi hmac sau khi dashboard đổi cùng lúc
PAYMENT_WEBHOOK_API_KEY=<SePay API key>
PAYMENT_WEBHOOK_SECRET=<HMAC secret nếu dùng hmac>
PAYMENT_ACCOUNT_NUMBER=<BIDV VA/TKP dùng để tạo QR>
PAYMENT_BANK_CODE=BIDV
PAYMENT_INTENT_TTL_MINUTES=30
PAYMENT_LATE_MATCH_WINDOW_MINUTES=60
```

3. Không đặt secret trong Git hoặc log deploy.
4. Deploy staging trước, chạy smoke test, rồi production.

### 5.2. SePay dashboard

1. Webhook URL: `https://<domain>/api/webhooks/payments/sepay`.
2. Event: tiền vào.
3. Account: chọn đúng BIDV account và VA.
4. Request content type: JSON.
5. Auth bước đầu phải khớp `PAYMENT_WEBHOOK_AUTH`.
6. Bật retry và cảnh báo delivery error.
7. Cấu hình payment code prefix `PG`/`PGT`, hậu tố chữ+số phù hợp mã ứng dụng.
8. Bấm “Gửi thử”; sau đó quét QR bằng app ngân hàng thật, tránh ví trung gian có thể thay nội dung chuyển khoản.
9. Xác nhận transaction có `match_status=matched`, intent `paid`, UI tự chuyển hóa đơn trong tối đa 3–6 giây.

### 5.3. Cloudinary

1. Tạo product environment và API key riêng cho POS.
2. Đặt một trong hai dạng:

```text
CLOUDINARY_ENABLED=true
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
CLOUDINARY_PRODUCT_FOLDER=pos-glasses/products
```

hoặc ba biến `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

3. Upload một ảnh thử, kiểm tra URL `https://res.cloudinary.com/...` được lưu vào `products.image`.
4. Restart instance và xác nhận ảnh vẫn tồn tại.

## 6. Roadmap chi tiết

Ước lượng dùng đơn vị ngày kỹ sư; mỗi task nên là một PR/commit review độc lập.

### Phase 0 — Release an toàn cho thay đổi hiện tại (1–2 ngày)

#### REL-01 — Staging deploy (0,5 ngày)

1. Clone production DB sang staging đã ẩn PII hoặc dùng seed gần thật.
2. Set toàn bộ env, không dùng chung Cloudinary folder production.
3. Chạy migration, kiểm tra `schema_migrations` có file 2026-07-15.
4. Kiểm tra 56 sản phẩm có giá mới ở khoảng nghìn đồng và original price còn đủ.
5. Chạy smoke: root, login, dashboard, product image, cash checkout, bank intent.

**DoD:** health 200, không log secret, không lỗi CSP/CORS, restore giá chạy được trên bản clone.

#### REL-02 — SePay live verification (0,5 ngày)

1. Tạo test intent mới sau deploy.
2. Quét bằng app ngân hàng BIDV/ứng dụng ngân hàng khác hỗ trợ VietQR.
3. Theo dõi delivery log SePay và bảng payment.
4. Xác nhận `subAccount` match, amount exact, intent paid.
5. Ngắt SSE trong DevTools rồi kiểm tra polling vẫn cập nhật.

**DoD:** 5/5 giao dịch nhỏ liên tiếp paid tự động; retry cùng transaction không tạo bản ghi kép.

#### REL-03 — Production + rollback gate (0,5 ngày)

1. Backup DB có checksum.
2. Deploy trong khung ít giao dịch.
3. Theo dõi error rate 30 phút.
4. Nếu giá demo không được phép ở production, chạy restore trước khi mở quầy.
5. Nếu payment mismatch >0, giữ transaction để đối soát, rollback app nhưng không xóa payment rows.

### Phase 1 — Payment production-grade (4–6 ngày)

#### PAY-10 — Atomic payment state machine (1,5 ngày)

1. Định nghĩa transition hợp lệ cho intent/order.
2. Gộp claim intent, finalize order, stock movement, loyalty, shift và mark paid trong một DB transaction.
3. Dùng row lock `FOR UPDATE` trên intent/order.
4. Nếu side effect lỗi, rollback toàn bộ và giữ state retryable; không chuyển ngay sang ngõ cụt `needs_review`.
5. Test hai webhook chạy đồng thời.

**DoD:** không có trạng thái order paid nhưng intent processing, hoặc stock đã trừ hai lần.

#### PAY-11 — Reconciliation worker (1 ngày)

1. Tạo worker mỗi 1 phút lấy pending/late/unmatched theo batch.
2. Nếu SePay cung cấp query API phù hợp gói hiện tại, query transaction theo time/reference.
3. Re-run match idempotent.
4. Late payment của order đã release stock phải vào manual review, không auto sale.
5. Ghi số lần retry, last error, reconciled_at.

**DoD:** webhook bị tắt 5 phút vẫn có thể đối soát sau khi khôi phục.

#### PAY-12 — Admin reconciliation UI (1 ngày)

1. Filter `unmatched`, `account_mismatch`, `amount_mismatch`, `late_payment`, `needs_review`.
2. Hiển thị masked account, amount, time, content và candidate intent.
3. Action match thủ công chỉ admin, bắt buộc reason.
4. Recheck order/stock trước finalize.
5. Audit actor, before/after và transaction id.

**DoD:** giải quyết được payment ngoại lệ mà không sửa SQL tay.

#### PAY-13 — Realtime đa instance (0,5–1 ngày)

1. Thêm Redis pub/sub hoặc DB outbox.
2. Webhook instance publish; mọi web instance subscribe.
3. Giữ polling làm fallback.
4. Thêm metric active SSE/reconnect.

**DoD:** chạy 2 instance vẫn nhận paid realtime.

#### PAY-14 — Monitoring (0,5 ngày)

1. Metric: delivery count, auth fail, match ratio, webhook latency, pending age.
2. Alert khi 15 phút không có webhook trong giờ mở cửa hoặc match ratio giảm.
3. Dashboard p50/p95 từ bank transaction time tới intent paid.

### Phase 2 — Security hardening tiếp theo (5–8 ngày)

#### SEC-10 — Request schema (1,5 ngày)

1. Chọn Zod/Ajv.
2. Viết schema auth, product, checkout, payment webhook, admin actions.
3. Reject unknown field ở mutation quan trọng.
4. Chuẩn hóa error 400 và request id.
5. Fuzz test amount, quantity, ID, Unicode và oversized input.

#### SEC-11 — CSP không `unsafe-inline` (2 ngày)

1. Tách script inline từ 10 trang lớn thành page modules.
2. Tách style inline hoặc dùng nonce/hash tạm thời.
3. Chuyển CSP sang `script-src 'self'`.
4. Chạy report-only 1 ngày trước enforce.
5. Audit toàn bộ 246 vị trí DOM HTML injection; mọi dữ liệu động phải dùng `textContent` hoặc escape.

#### SEC-12 — Session lifecycle (1 ngày)

1. Thêm `users.token_version` và `password_changed_at`.
2. JWT chứa version; middleware so với DB/cache.
3. Logout-all, reset password và disable user tăng version.
4. TTL access token 15–30 phút; refresh rotation nếu cần ca dài.
5. Admin/MFA cho action tài chính và user management.

#### SEC-13 — Distributed abuse controls (0,5–1 ngày)

1. Chuyển rate limit login/public QR/webhook sang Redis.
2. Tách limit theo IP + username và progressive delay.
3. Webhook limit riêng không chặn retry hợp lệ.
4. Alert brute force và repeated invalid signature.

#### SEC-14 — Upload security (0,5 ngày)

1. Kiểm tra magic bytes bằng `file-type`/image decoder, không tin MIME data URL.
2. Re-encode ảnh bằng Sharp trước upload.
3. Giới hạn pixel dimensions để chống decompression bomb.
4. Chặn SVG/HTML và external fetch URL từ client.

#### SEC-15 — Data/secret governance (0,5–1 ngày)

1. Secret rotation runbook cho JWT, SePay, Cloudinary, Gemini và DB.
2. Raw webhook retention 90 ngày; redact account/description khi hết nhu cầu.
3. Backup encrypted hằng ngày; test restore hằng quý.
4. Phân quyền DB app user tối thiểu, không dùng root.

### Phase 3 — Cloudinary hoàn chỉnh (2–3 ngày)

#### IMG-10 — Asset metadata (0,5 ngày)

1. Thêm `image_provider`, `image_public_id`, `image_asset_id`, width/height.
2. Client gửi metadata upload cùng create/update product.
3. Backfill local assets hoặc đánh dấu `local`.

#### IMG-11 — Lifecycle (0,5–1 ngày)

1. Khi thay ảnh, lưu ảnh mới trước.
2. Commit DB update.
3. Queue xóa public_id cũ sau commit; retry nếu Cloudinary lỗi.
4. Soft-delete product không xóa ảnh ngay; retention 30 ngày.

#### IMG-12 — Delivery optimization (0,5 ngày)

1. Dùng transformation URL `f_auto,q_auto` và kích thước theo grid/detail.
2. Thêm responsive `srcset`.
3. Lazy load ngoài viewport.
4. Đo LCP và Cloudinary bandwidth.

#### IMG-13 — Direct signed upload (0,5 ngày)

1. Backend phát signature ngắn hạn theo admin session.
2. Browser upload trực tiếp Cloudinary.
3. Backend verify upload response/public_id trước lưu DB.
4. Loại bỏ base64 10MB khỏi Express.

### Phase 4 — Onboarding hoàn chỉnh (1–2 ngày)

#### TOUR-10 — Server-side progress (0,5 ngày)

1. Thêm `user_preferences` hoặc `onboarding_progress`.
2. Lưu tour version, completed_at, dismissed_at.
3. Đồng bộ giữa các máy POS.

#### TOUR-11 — Context tours (0,5 ngày)

1. Tour lần đầu chỉ giới thiệu điều hướng.
2. Tour theo tác vụ: mở ca, bán hàng, refund, nhập kho, tạo promotion.
3. Không tự chạy tour dài trong giờ checkout; người dùng chủ động mở từ Help.

#### TOUR-12 — Analytics và accessibility (0,5 ngày)

1. Event started/completed/dismissed/step_failed không chứa PII.
2. Keyboard/focus/ARIA test.
3. Respect `prefers-reduced-motion`.
4. Đo tỷ lệ hoàn thành theo role.

### Phase 5 — Frontend và maintainability (2–4 tuần)

#### FE-10 — Build pipeline (2 ngày)

1. Thêm Vite ở chế độ multi-page, giữ URL `.html` để rollout tương thích.
2. Bundle/pin dependencies, hash assets, source map private.
3. Dev server proxy API.
4. CSP production không phụ thuộc CDN.

#### FE-11 — Tách trang POS (3–4 ngày)

1. Tách state/cart/customer/payment/render thành modules.
2. Tạo payment waiting component dùng chung orders/products.
3. Unit test reducer/totals/format/polling.
4. Giữ E2E checkout cash + SePay.

#### FE-12 — Tách products/customers/dashboard (5–7 ngày)

1. Mỗi trang chỉ giữ orchestration.
2. Shared table, pagination, modal, form validation, empty/error state.
3. Loại event handler inline.
4. Accessibility audit WCAG AA cho modal/menu/tour.

#### FE-13 — Performance (1–2 ngày)

1. Server pagination bắt buộc cho danh sách lớn.
2. Debounce/cancel search cũ.
3. Virtualize grid nếu >500 SKU.
4. Target LCP <2,5s và interaction <200ms trên máy POS.

### Phase 6 — Quality, CI và vận hành (4–6 ngày)

#### QA-10 — Test command và CI (1 ngày)

1. Script test liệt kê toàn bộ 55 file hoặc dùng glob ổn định đa nền tảng.
2. Tách unit, repository, integration, frontend contract.
3. CI chạy Node LTS, `npm audit`, secret scan và test.
4. Không merge khi payment/security test fail.

#### QA-11 — Disposable MySQL integration (1–2 ngày)

1. Docker/Testcontainers MySQL đúng version production.
2. Chạy toàn bộ migration từ DB rỗng.
3. Test rollback/restore, unique constraints và concurrent webhook.
4. Không dùng production DB trong test.

#### QA-12 — E2E critical paths (1–2 ngày)

1. Playwright: root/login/role redirect.
2. Cash checkout, hold cart, bank QR fake webhook, polling recovery.
3. Cloudinary mock upload, product create/edit.
4. First-use tour admin/staff.

#### OPS-10 — API/observability (1 ngày)

1. OpenAPI cho public/staff/admin routes.
2. Structured logs có request id, không log auth/raw PII.
3. Error tracking và slow-query log.
4. SLO: checkout p95 <300ms LAN, payment update p95 <8s, error rate <1%.

## 7. Thứ tự sprint khuyến nghị

| Sprint | Mục tiêu | Task |
|---|---|---|
| S0 | Release bản hiện tại an toàn | REL-01..03 |
| S1 | Không bỏ sót tiền | PAY-10..12 |
| S2 | Multi-instance + monitoring | PAY-13..14, QA-11 payment |
| S3 | Validation/session/rate limit | SEC-10, SEC-12, SEC-13 |
| S4 | CSP/upload/data | SEC-11, SEC-14, SEC-15 |
| S5 | Cloudinary lifecycle + tour sync | IMG-10..13, TOUR-10..12 |
| S6–S7 | Frontend modularization | FE-10..13 |
| S8 | CI/E2E/OpenAPI/SLO | QA-10..12, OPS-10 |

## 8. Checklist nghiệm thu production

### Route/auth

- [ ] `/` -> `/login.html`.
- [ ] Cookie có HttpOnly, SameSite, Secure.
- [ ] Admin/staff vào đúng landing.
- [ ] Disable user làm cookie hiện tại mất hiệu lực.
- [ ] Cross-origin mutation trả 403.

### SePay

- [ ] Test Send trên dashboard trả 2xx.
- [ ] BIDV `subAccount` được match.
- [ ] HMAC/API key khớp env.
- [ ] Exact amount + code -> paid.
- [ ] Sai amount/account -> không paid.
- [ ] Duplicate -> một transaction.
- [ ] Tắt SSE -> polling vẫn paid.
- [ ] Late payment -> review, không auto sale.

### Giá demo

- [ ] Original price/cost đã backup.
- [ ] Catalog mới ở mức nghìn đồng.
- [ ] Hóa đơn lịch sử không đổi.
- [ ] Restore script đã thử trên staging.

### Cloudinary

- [ ] Credential chỉ ở secret store.
- [ ] Upload trả secure URL.
- [ ] Restart/deploy không mất ảnh.
- [ ] Staff không được upload/sửa catalog.

### Tour

- [ ] Admin thấy dashboard tour lần đầu.
- [ ] Staff thấy POS tour lần đầu.
- [ ] Refresh không tự chạy lại sau completion.
- [ ] Nút Hướng dẫn chạy lại được.

## 9. Quyết định kỹ thuật quan trọng

1. Webhook là nguồn xác nhận thanh toán; client redirect/ảnh chụp không phải bằng chứng.
2. Không tự match giao dịch thiếu mã chỉ dựa vào số tiền nếu có khả năng nhiều intent cùng amount.
3. Late payment không tự hoàn tất order đã release tồn kho.
4. Giá demo phải có original columns và restore; tốt nhất chạy trên staging riêng.
5. Cloudinary API secret chỉ dùng server-side.
6. Cookie HttpOnly là hướng chính; Bearer localStorage chỉ là compatibility tạm thời và phải loại bỏ sau migration.
7. Polling được giữ kể cả khi có SSE vì đây là lớp tự phục hồi đơn giản và đáng tin cậy.

