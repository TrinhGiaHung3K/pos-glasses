# Kế hoạch nâng cấp POS Glasses: xác minh chuyển khoản, AI và QR sản phẩm

**Ngày lập:** 2026-07-13  
**Phạm vi:** Node.js/Express + MySQL + frontend MPA hiện tại  
**Mục tiêu:** triển khai ba yêu cầu theo các lát cắt có thể kiểm thử, review và rollback độc lập.

**Trạng thái triển khai 2026-07-13:** các lát cắt payment, QR sản phẩm và AI foundation đã được triển khai. Runbook vận hành: `docs/upgrade-payment-ai-qr-runbook.md`.

---

## 1. Kết luận kiến trúc

### 1.1. Chuyển khoản 2.900đ

Không cập nhật giá bán thật từ khoảng 2.900.000đ xuống 2.900đ trên catalog production. Thay vào đó:

- Staging/dev có `PAYMENT_TEST_MODE=true` và `PAYMENT_TEST_AMOUNT=2900`.
- Tạo một **payment intent kiểm thử** hoặc SKU `TEST-TRANSFER-2900`, có cờ `is_test=1`.
- Intent test có thể nhận chuyển khoản thật 2.900đ để kiểm chứng webhook, nhưng không trừ tồn, không cộng doanh thu, không cộng điểm, không tăng lượt promotion và không ghi vào chỉ tiêu ca.
- Production mặc định tắt test mode; nếu cần smoke test thật, chỉ admin có quyền tạo intent test và mọi thao tác phải vào audit log.

Điều này khắc phục đúng nhu cầu thử 2.900đ mà không làm hỏng dữ liệu kinh doanh.

### 1.2. Dịch vụ xác minh chuyển khoản

Khuyến nghị làm PoC với **SePay Webhook** trước, giữ `PaymentProvider` adapter để có thể thay bằng Casso/payOS/VietQR sau này.

Lý do:

- SePay đẩy giao dịch ngân hàng về server qua webhook, có Test mode, retry, HMAC/API key, lọc theo tài khoản/mã thanh toán và hỗ trợ tài khoản cá nhân ở các ngân hàng/kiểu kết nối phù hợp.
- Casso là phương án dự phòng tốt cho tài khoản cá nhân/doanh nghiệp và có API/webhook, nhưng cần so sánh ngân hàng cụ thể, độ trễ, cơ chế ký webhook và chi phí ở PoC.
- payOS phù hợp luồng payment link/VietQR và webhook sau khi xác thực tổ chức, nhưng không phải mặc định tốt nhất nếu nhu cầu cốt lõi chỉ là theo dõi biến động vào một tài khoản cá nhân hiện có.
- Không để POS tự đăng nhập Internet Banking hoặc lưu mật khẩu/OTP ngân hàng. POS chỉ lưu secret của provider trong biến môi trường/secret manager.

Tài liệu đối chiếu:

- [SePay Webhook và yêu cầu tích hợp](https://developer.sepay.vn/vi/sepay-webhooks)
- [SePay Test mode](https://developer.sepay.vn/vi/tien-ich-khac/test-mode/tao-webhook)
- [Bảo mật webhook SePay](https://developer.sepay.vn/en/sepay-webhooks/bao-mat)
- [Danh sách ngân hàng/kiểu tài khoản SePay hỗ trợ](https://developer.sepay.vn/en/sepay-webhooks/tai-khoan-ngan-hang)
- [Casso và tự động xác nhận thanh toán](https://docs.casso.vn/)
- [payOS payment flow](https://payos.vn/docs/)
- [VietQR Check Transaction](https://api.vietqr.vn/vi/cac-dich-vu-api-khac/host-to-client/api-check-transaction)

### 1.3. AI và cách “train”

Không đặt mục tiêu fine-tune Gemini API ở giai đoạn này. Google hiện ghi rõ Gemini API/AI Studio không còn model hỗ trợ fine-tuning trực tiếp. “Train AI hiểu POS” sẽ gồm bốn lớp:

1. **System instruction theo vai trò:** nhân viên/admin, quy tắc nghiệp vụ, phạm vi được phép.
2. **RAG:** nạp tài liệu sản phẩm, quy trình bán hàng, bảo hành, promotion, loyalty, đơn kính và FAQ.
3. **Function calling:** lấy dữ liệu sống từ MySQL qua các hàm chỉ đọc được kiểm soát như tồn kho, doanh thu, khách hàng, hóa đơn.
4. **Evaluation + feedback:** bộ câu hỏi chuẩn, đáp án/rubric, log phản hồi tốt/xấu và regression test prompt.

Model routing đề xuất:

- `gemini-3.1-flash-lite`: mặc định cho chat hỗ trợ nhân viên, phân loại câu hỏi, tóm tắt và tác vụ tần suất cao; đây là model stable, tối ưu high-frequency/high-volume.
- `gemini-3.5-flash`: dùng khi phân tích doanh thu phức tạp, nhiều bước hoặc cần phối hợp nhiều tool; stable, context 1M.
- `gemini-embedding-2`: embedding tài liệu đa phương thức/RAG khi cần tự quản vector store; giai đoạn đầu có thể dùng Gemini File Search để giảm hạ tầng.
- Không dùng alias `latest` và không dùng preview/experimental trong production.

Quota thực tế phụ thuộc project và usage tier, áp dụng theo project chứ không theo từng API key. Vì vậy phải bật billing, xem quota thật trong AI Studio, có rate limiter/queue/retry và ngân sách theo ngày; không được hiểu “ít giới hạn” là không giới hạn.

Tài liệu đối chiếu:

- [Gemini 3.1 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite)
- [Gemini 3.5 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash)
- [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini model tuning](https://ai.google.dev/gemini-api/docs/model-tuning)
- [Gemini File Search/RAG](https://ai.google.dev/gemini-api/docs/file-search)
- [Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling)

### 1.4. QR sản phẩm

Mỗi sản phẩm có một mã công khai ngẫu nhiên, ổn định và có thể revoke/rotate. QR chỉ chứa URL HTTPS dạng:

```text
https://<domain>/qr/product.html?code=<opaque-public-code>
```

Không nhúng giá, tồn kho hoặc numeric database ID vào QR vì các dữ liệu này có thể đổi hoặc bị dò quét. URL được resolve server-side:

- Quét bằng camera điện thoại: mở thẳng trang sản phẩm công khai và có nút chọn/mua.
- Quét bằng máy quét/Barcode-to-PC tại POS: parser lấy `code`, gọi resolver và thêm đúng sản phẩm vào giỏ.
- Nếu sản phẩm ngừng bán hoặc QR bị revoke: trang trả trạng thái rõ ràng, không tự chuyển tới sản phẩm khác.

---

## 2. Hiện trạng code và khoảng trống

| Khu vực | Hiện trạng | Khoảng trống cần xử lý |
|---|---|---|
| Checkout | `POST /api/staff/pos/checkout` tạo order `completed`, trừ tồn và ghi ca trong một lần | `bank_transfer` cũng bị coi là đã thanh toán ngay, chưa có `pending/paid/expired/failed` |
| Nội dung CK | Response có `PG{orderId}` | Được sinh sau khi order đã hoàn tất; chưa có nonce, expiry, account hoặc webhook match |
| Payment data | `orders.payment_method`, `amount_paid`, `change_amount` | Chưa có payment intent, provider transaction, raw webhook, signature status, reconciliation |
| Realtime | Table QR đã dùng SSE | Có thể tái sử dụng pattern SSE cho payment status |
| Product lookup | POS tìm exact SKU/name rồi thêm giỏ | Chưa parse QR URL/opaque code, API chưa lookup theo public QR code |
| Product QR | Có in barcode CODE128 và QR theo bàn | Chưa có QR riêng cho sản phẩm/trang product landing |
| Analytics | Dashboard API + reports | Có dữ liệu nền cho AI, nhưng reports còn xử lý nhiều ở client; chưa có AI tools/read model |
| Security | Auth, role, rate limit, audit đã có | Webhook cần public route riêng, HMAC, replay protection, IP rules và rate limit phù hợp |
| AI | Chưa có dependency/config/module | Chưa có gateway, prompt version, RAG, tool policy, eval, cost/usage log |

---

## 3. Kiến trúc mục tiêu

```text
Khách quét VietQR
      |
      v
Ngân hàng -> SePay/Casso/payOS -> POST /api/webhooks/payments/:provider
                                      |
                                      v
                              verify signature + dedupe
                                      |
                                      v
payment_intents <-> payment_transactions -> order/payment status
      |                                           |
      +---------------- SSE/poll -----------------+
                           |
                           v
                     POS Client cập nhật

Nhân viên/Admin -> POST /api/staff|admin/ai/chat
                           |
                           v
                    AI Orchestrator
               /          |          \
      system policy     RAG corpus   read-only POS tools
               \          |          /
                  Gemini model router

QR sản phẩm -> /qr/product.html?code=... -> public resolver -> sản phẩm
                                           -> POS parser -> thêm giỏ
```

Nguyên tắc quan trọng:

- Server luôn tự tính tiền; client/provider không được quyết định `total_amount`.
- Webhook là nguồn xác nhận thanh toán, không dùng ảnh chụp màn hình hay redirect client làm bằng chứng.
- Mỗi provider transaction chỉ được xử lý một lần.
- Chỉ transition trạng thái hợp lệ; không cho webhook cũ hoàn tất order đã hủy/hết hạn.
- AI mặc định read-only. Mọi action ghi dữ liệu trong tương lai phải qua API nghiệp vụ, RBAC và bước xác nhận rõ ràng.
- AI không được tự chẩn đoán bệnh mắt, tự đổi giá/chiết khấu, hoàn tiền hoặc xác nhận thanh toán.

---

## 4. Backlog chi tiết

Effort tham khảo: **S = 0,5–1 ngày; M = 2–3 ngày; L = 4–6 ngày** cho một kỹ sư đã quen codebase. Mỗi task dưới đây nên là một PR độc lập hoặc một commit review được.

### Phase 0 — Quyết định, sandbox và baseline (3–5 ngày)

#### PAY-00 — Chốt provider bằng PoC — M

**Công việc**

- Xác nhận ngân hàng, loại tài khoản cá nhân/doanh nghiệp, chủ tài khoản và môi trường vận hành.
- Tạo tài khoản SePay Test mode; mô phỏng webhook vào một endpoint tạm.
- Kiểm tra payload thực, chữ ký, retry, độ trễ, mã giao dịch, `accountNumber`, `transferAmount`, `content/code`.
- Thử liên kết tài khoản thật bằng quy trình chính thức; không nhập thông tin Internet Banking vào POS.
- Chạy cùng test case trên Casso nếu ngân hàng không được SePay hỗ trợ hoặc SLA/chi phí không phù hợp.
- Lập bảng quyết định: ngân hàng hỗ trợ, personal/business, độ trễ p50/p95, sandbox, HMAC, retry, reconciliation API, phí tháng/phí giao dịch, SLA/support.

**Nghiệm thu**

- Có ít nhất 20 webhook sandbox liên tiếp và 3 lần retry/deduplicate thành công.
- Có biên bản chọn provider và xác nhận loại tài khoản cụ thể được hỗ trợ.

#### BASE-01 — Chụp baseline và test regression — S

- Chạy toàn bộ `npm test` và lưu kết quả baseline.
- Ghi lại response hiện tại của checkout cash/card/bank transfer.
- Ghi lại SQL schema hiện có và dữ liệu seed liên quan.
- Bổ sung ADR ngắn cho state machine payment và QR public code.

#### ENV-01 — Bổ sung cấu hình — S

Thêm vào `src/config/env.js` và `.env.example`:

```text
PAYMENT_PROVIDER=sepay
PAYMENT_WEBHOOK_SECRET=...
PAYMENT_ACCOUNT_NUMBER=...
PAYMENT_BANK_CODE=...
PAYMENT_INTENT_TTL_MINUTES=10
PAYMENT_TEST_MODE=false
PAYMENT_TEST_AMOUNT=2900
GEMINI_API_KEY=...
GEMINI_DEFAULT_MODEL=gemini-3.1-flash-lite
GEMINI_ANALYSIS_MODEL=gemini-3.5-flash
AI_DAILY_BUDGET_USD=...
AI_ENABLED=false
PUBLIC_APP_URL=https://...
```

- Validate fail-fast secret production.
- Không commit secret thật.
- Thêm feature flags để rollout payment/AI/QR độc lập.

---

### Phase 1 — Payment intent và thử 2.900đ (1,5–2 tuần)

#### PAY-01 — Schema payment — L

Tạo migration versioned:

```text
payment_intents(
  id, public_id, order_id nullable, provider,
  purpose, is_test, currency,
  expected_amount, received_amount,
  transfer_content, bank_code, account_number_masked,
  status, expires_at, paid_at, cancelled_at,
  created_by, created_at, updated_at
)

payment_transactions(
  id, provider, provider_transaction_id,
  payment_intent_id nullable,
  account_number_masked, transfer_type, amount,
  transfer_content, bank_reference,
  transaction_at, signature_valid,
  match_status, raw_payload_json, received_at
)

payment_webhook_deliveries(
  id, provider, delivery_key,
  signature_valid, processing_status,
  error_code, received_at, processed_at
)
```

Ràng buộc:

- Unique `(provider, provider_transaction_id)`.
- Unique `payment_intents.public_id` và `transfer_content` trong cửa sổ active.
- `expected_amount > 0`, VND integer.
- Index `status, expires_at`, `transfer_content`, `order_id`.
- `raw_payload_json` có retention/redaction policy; không trả ra client.

Mở rộng order bằng migration tương thích:

- `payment_status`: `not_required | pending | paid | expired | failed | refunded`.
- Không dùng một trường `orders.status` để gộp cả trạng thái fulfillment và payment.

#### PAY-02 — Provider adapter — M

Tạo module `src/modules/payments/providers/`:

```text
PaymentProvider.createQr(intent)
PaymentProvider.verifyWebhook(headers, rawBody)
PaymentProvider.normalizeTransaction(payload)
PaymentProvider.queryTransaction(reference) // nếu provider hỗ trợ
```

- `sepay.js` là implementation đầu tiên.
- `fake.js` dùng cho unit/integration test.
- Controller/service không được phụ thuộc payload riêng của SePay.

#### PAY-03 — Tạo test intent 2.900đ — M

API admin/staging:

```text
POST /api/admin/payment-test-intents
GET  /api/admin/payment-test-intents/:publicId
```

Quy tắc:

- Chỉ hoạt động khi `PAYMENT_TEST_MODE=true` và user là admin.
- Server ép `expected_amount=2900`; bỏ qua amount client gửi lên.
- `purpose=verification`, `is_test=1`, không tạo order thật.
- Response có QR payload/image data, masked account, nội dung CK duy nhất, expiry.
- UI hiển thị rõ “GIAO DỊCH KIỂM THỬ — KHÔNG GHI DOANH THU”.
- Khi webhook match: intent thành `paid`, nhưng không gọi checkout/stock/shift/loyalty.

**Nghiệm thu**

- Chuyển đúng 2.900đ + đúng nội dung: client nhận `paid`.
- Sai amount hoặc sai nội dung: không tự xác nhận; transaction vào hàng chờ đối soát.
- Event gửi lặp 2–7 lần vẫn chỉ có một transaction và một transition.

#### PAY-04 — Payment intent cho order thật — L

Tách luồng bank transfer khỏi checkout hoàn tất ngay:

```text
POST /api/staff/pos/payment-intents
POST /api/staff/payment-intents/:publicId/cancel
GET  /api/staff/payment-intents/:publicId
GET  /api/staff/payment-intents/:publicId/stream
```

- Reuse toàn bộ validation giá, tồn, promotion, loyalty hiện có.
- Server snapshot cart và tính `expected_amount`.
- Tạo mã nội dung ngắn, duy nhất, ví dụ `PG<base36-id><checksum>` theo giới hạn ký tự ngân hàng/provider.
- Trả VietQR động chứa đúng account, amount, content.
- Cash/card tiếp tục dùng checkout hiện tại; bank transfer chuyển sang flow intent.

#### PAY-05 — Reservation và finalize atomic — L

Không để khách đã trả tiền nhưng sản phẩm vừa hết tồn:

- Khi tạo intent thật: reserve stock trong transaction hoặc tạo pending order và movement `reserve_out`.
- Khi `paid`: một transaction DB chuyển intent pending -> paid, order -> completed, ghi sale movement, shift sale, promotion usage, loyalty points và audit.
- Khi hết hạn/hủy: release reservation đúng một lần.
- Nếu reservation/finalize thất bại: đưa vào `needs_review`, không báo thành công giả cho client.
- Tách các side effect đang chạy ngay trong `orders.service.checkout` thành hàm dùng chung cho cash và payment finalization.

#### PAY-06 — Webhook public an toàn — L

Đăng ký route public trước `authMiddleware`:

```text
POST /api/webhooks/payments/sepay
```

Pipeline:

1. Giữ raw body phục vụ verify signature.
2. Xác minh HMAC/API key bằng so sánh constant-time.
3. Validate schema, transfer type `in`, account đích, amount, content, timestamp.
4. Insert delivery/transaction theo unique key trước khi side effect.
5. Match chính xác intent đang `pending` và chưa hết hạn.
6. Finalize trong DB transaction.
7. Trả 2xx nhanh; job/reconciliation xử lý tình huống cần retry.

Security:

- HTTPS production, optional provider IP allowlist, request size limit nhỏ.
- Không log full account/secret/raw authorization.
- Replay window + idempotency.
- Webhook không đi qua staff JWT nhưng có auth riêng của provider.

#### PAY-07 — UI chờ xác nhận — M

Trong `frontend/orders.html`:

- Khi chọn chuyển khoản, nút checkout trở thành “Tạo QR chuyển khoản”.
- Modal/rail hiển thị QR, 2.900đ ở test mode hoặc tổng order thật, nội dung CK, countdown và trạng thái.
- SSE báo `pending -> paid/expired/needs_review`; fallback polling với exponential backoff.
- Chỉ clear cart/in hóa đơn/beep thành công sau `paid`.
- Nếu timeout, cho “Kiểm tra lại”, “Hủy intent”; không tạo intent mới liên tục.
- Staff không được tự bấm “đã nhận tiền”; admin override cần lý do + audit và chỉ là quy trình ngoại lệ.

#### PAY-08 — Reconciliation và vận hành — M

- Job mỗi 1–5 phút tìm pending quá hạn, transaction chưa match và webhook lỗi.
- Nếu provider có query API, đối soát lại theo reference/time window.
- Trang admin: pending, paid, expired, duplicate, amount mismatch, unmatched.
- Nút replay/match thủ công chỉ admin, bắt buộc lý do.
- Cảnh báo khi webhook im lặng vượt SLA hoặc tỷ lệ lỗi tăng.

#### PAY-09 — Test suite — L

Unit:

- Signature valid/invalid, payload normalize, amount/content/account match.
- State transition và invalid transition.
- Test intent 2.900đ không ảnh hưởng order/stock/shift/loyalty.

Repository/integration:

- Race hai webhook cùng transaction.
- Webhook retry, out-of-order, late after expiry, wrong account, partial amount.
- Finalize rollback toàn bộ nếu một side effect lỗi.

Frontend contract:

- Bank transfer không gọi success ngay.
- Cart chỉ clear khi `paid`.
- Amount format đúng `2.900 ₫`/`2.900đ` theo formatter chuẩn.

---

### Phase 2 — QR sản phẩm E2E (1 tuần)

#### QR-01 — Schema public code — M

Ưu tiên bảng riêng để lưu lịch sử/revoke:

```text
product_qr_codes(
  id, product_id, public_code,
  status, version, created_by,
  created_at, revoked_at
)
```

- `public_code` random tối thiểu 128-bit, URL-safe, unique.
- Mỗi sản phẩm chỉ có một code active ở v1.
- Rotate code không làm đổi SKU và không xóa lịch sử.

#### QR-02 — Public resolver API — M

```text
GET /api/public/products/by-qr/:code
```

Chỉ trả safe fields:

- name, brand, SKU hiển thị, image, current price, trạng thái còn/hết hàng, variants được phép.
- Không trả cost price, supplier, stock movement, margin hoặc internal notes.
- Rate limit + cache ngắn; code invalid/revoked trả 404 chung để hạn chế enumeration.

#### QR-03 — Trang mở thẳng sản phẩm — M

Tạo `frontend/qr/product.html`:

- Resolve code từ URL.
- Hiển thị sản phẩm, giá hiện tại, ảnh, biến thể, tình trạng.
- Nếu đang ở lane khách hàng/table order: thêm thẳng vào cart/session hiện tại.
- Nếu mở độc lập: hiển thị CTA “Mua tại quầy/nhờ nhân viên tư vấn”; không tạo order public ngoài phạm vi.
- Mobile-first, loading/error/revoked/out-of-stock states.

#### QR-04 — Sinh và in QR — M

Trong `products.html`/`print-labels.html`:

- Admin/staff có quyền tạo, xem, in và rotate QR.
- Label gồm QR + tên rút gọn + SKU dạng chữ để xử lý khi camera lỗi.
- Batch print với kích thước tem thực tế; test scan ở 3 cỡ và 2 loại máy in.
- QR luôn chứa `PUBLIC_APP_URL`, không hardcode localhost.

#### QR-05 — POS scan parser — M

Mở rộng ô `productSearch` hiện có:

- Nhận exact SKU như cũ.
- Nhận URL product QR hoặc payload nội bộ hợp lệ.
- Parse bằng `URL`, không regex lỏng; chỉ chấp nhận origin/path được allowlist.
- Resolve server-side rồi gọi `addToCart(product.id)` đúng một lần.
- Debounce/deduplicate scan kép, giữ focus và có âm báo riêng cho success/error.

#### QR-06 — QR tests — M

- Token entropy/unique/revoke/rotate.
- Public endpoint không rò cost/margin/internal ID không cần thiết.
- Scan URL thêm đúng product, hết hàng không thêm, revoked không resolve.
- XSS/open redirect/foreign origin bị từ chối.
- Scan thực tế iOS Camera, Android Camera, USB QR scanner và Barcode-to-PC.

---

### Phase 3 — AI foundation và trợ lý POS (2–3 tuần)

#### AI-01 — Chốt use case và ranh giới — M

Ưu tiên theo giá trị/rủi ro:

| Ưu tiên | Use case | Người dùng | Dữ liệu/tool | Mức tự động |
|---|---|---|---|---|
| P0 | Hỏi đáp quy trình POS, promotion, loyalty, bảo hành, đơn kính | Staff/admin | RAG tài liệu | Chỉ trả lời |
| P0 | Tìm/gợi ý sản phẩm theo ngân sách, brand, kiểu dáng, tồn kho, lịch sử mua | Staff | Product/customer read tools | Đề xuất, staff quyết định |
| P0 | Tóm tắt doanh thu theo kỳ, top sản phẩm/staff, so sánh kỳ trước | Admin | Dashboard/order aggregate tools | Phân tích read-only |
| P1 | Phát hiện tín hiệu bất thường: doanh thu giảm, refund tăng, tồn kho sắp hết | Admin | Aggregate/anomaly input | Cảnh báo, không tự hành động |
| P1 | Gợi ý nhập hàng theo sell-through/lead time | Admin | Stock/sales/supplier tools | Draft đề xuất |
| P1 | Tóm tắt hồ sơ khách và gợi ý chăm sóc | Staff | Customer 360 read tool | Draft nội dung |
| P2 | Nhập câu tự nhiên để lọc báo cáo/sản phẩm | Staff/admin | Structured output | Chuyển thành filter an toàn |

Không đưa vào v1:

- Chẩn đoán bệnh mắt hoặc thay thế chuyên gia y tế.
- Tự sửa giá/chiết khấu, tự checkout, void/refund, xác nhận thanh toán.
- Đọc toàn bộ DB tùy ý hoặc sinh SQL rồi thực thi.

#### AI-02 — Gemini gateway và model router — L

Tạo `src/modules/ai/`:

```text
gateway.js          // SDK, timeout, retry 429/5xx, circuit breaker
modelRouter.js      // Flash-Lite vs 3.5 Flash
service.js
controller.js
routes.js
tools/
prompts/
rag/
evals/
```

- Dùng official Google Gen AI JavaScript SDK hiện hành.
- Timeout, AbortController, exponential backoff + jitter, max retry hữu hạn.
- Per-user/per-role rate limit, concurrency cap, daily budget kill switch.
- Log request id, model, latency, token usage, tool names, status; không log PII thô.
- Fallback: model analysis lỗi thì thử Flash-Lite hoặc trả câu trả lời có kiểm soát; không bịa dữ liệu.

#### AI-03 — Corpus/RAG — L

Nguồn dữ liệu phiên bản đầu:

- Hướng dẫn thao tác POS, chính sách promotion/loyalty/refund/void.
- Bảo hành, prescription/đơn kính, variants, size/brand guide.
- FAQ nội bộ, catalog mô tả sản phẩm, thông tin tư vấn đã được admin duyệt.
- Schema API/tool contract dành cho AI, không nạp secret/source code không cần thiết.

Pipeline:

1. Chuẩn hóa Markdown, bỏ secret/PII, thêm metadata `source`, `version`, `role`, `updated_at`.
2. Chunk theo mục nghiệp vụ, không cắt máy móc giữa rule.
3. Index vào Gemini File Search cho MVP; lưu manifest/hash để incremental update.
4. Filter tài liệu theo role trước khi retrieve.
5. Câu trả lời nghiệp vụ phải kèm tên nguồn nội bộ/version; nếu không có nguồn thì nói không đủ dữ liệu.
6. Re-index khi policy/catalog thay đổi; có rollback corpus version.

#### AI-04 — Read-only POS tools — L

Không cho model viết SQL. Khai báo các tool có schema chặt:

```text
search_products(q, brand, min_price, max_price, in_stock, limit)
get_product(product_id)
get_customer_summary(customer_id)
get_sales_summary(from, to, group_by)
get_top_products(from, to, limit)
get_inventory_alerts(limit)
get_promotion_policy(code)
get_order_status(order_id)
```

- Service tool gọi repository hiện có hoặc query aggregate mới, luôn parameterized.
- Enforce RBAC ở server theo `req.user`; không tin role do model/client gửi.
- Limit time range, page size và output fields để tránh tràn token/PII.
- Tool kết quả là structured JSON, tiền luôn integer VND + formatter ở lớp trình bày.

#### AI-05 — System prompts theo vai trò — M

Tạo versioned prompts:

- `staff-assistant.v1`: ngắn, thao tác được, ưu tiên tồn hiện có, không lộ cost/margin.
- `admin-analyst.v1`: được xem aggregate doanh thu/lãi gộp, nêu time range và nguồn số.
- Quy tắc chung: không đoán dữ liệu sống; cần số liệu thì gọi tool; phân biệt fact/suggestion; từ chối action vượt quyền.
- Prompt và tool config phải có version trong usage log để regression.

#### AI-06 — API và UI assistant — L

```text
POST /api/staff/ai/chat
POST /api/admin/ai/chat
POST /api/users/me/ai-feedback
```

UI:

- Panel assistant dùng chung, gợi ý câu hỏi theo trang.
- Ở POS: “Tìm kính dưới 3 triệu còn hàng”, “Khách này thường mua gì?”.
- Ở dashboard/reports: “Vì sao doanh thu tuần này giảm?”, “So sánh top 5 sản phẩm”.
- Hiển thị nguồn/tool/time range, cảnh báo AI có thể sai, nút tốt/xấu và copy.
- Không render HTML model trả về; escape/sanitize toàn bộ.

#### AI-07 — Evaluation thay cho “train mù” — L

Tạo bộ eval tối thiểu 150–300 case:

- 40 câu quy trình/policy.
- 40 tìm và gợi ý sản phẩm.
- 40 phân tích số liệu với fixture cố định.
- 20 RBAC/PII/prompt injection.
- 20 câu ngoài phạm vi/không đủ dữ liệu.
- Case tiếng Việt không dấu, viết tắt, lỗi chính tả của nhân viên.

Metrics:

- Grounded answer accuracy >= 90% với policy P0.
- Tool selection accuracy >= 95%.
- Numeric accuracy = 100% trên fixture tài chính.
- Unauthorized data leakage = 0.
- P95 latency: Flash-Lite <= 4 giây cho câu đơn giản; analysis <= 10 giây.
- Tỷ lệ helpful beta >= 80%.

Quy trình cải thiện:

1. Thu feedback đã loại PII.
2. Phân loại lỗi: retrieval, tool, prompt, model, dữ liệu nguồn.
3. Sửa source/tool/prompt trước khi cân nhắc model lớn hơn.
4. Chạy regression eval trước mỗi prompt/model/corpus release.
5. Chỉ cân nhắc supervised fine-tuning qua nền tảng Google phù hợp khi có hàng nghìn example chất lượng và chứng minh RAG/tool/prompt chưa đủ.

#### AI-08 — Privacy, cost và observability — M

- Dùng paid service cho production; review điều khoản xử lý dữ liệu.
- Redact số điện thoại/email/address/account trước khi gửi nếu không cần thiết.
- Không gửi raw webhook/payment secret hoặc full audit log cho model.
- Lưu `ai_usage_logs`: user/role, use_case, prompt_version, model, token, latency, cost estimate, tool calls, outcome; không lưu full prompt mặc định.
- Dashboard quota/cost/error/429, alert theo ngân sách ngày.
- Cache câu hỏi policy theo corpus/prompt version; không cache customer-specific response dùng chung.

---

### Phase 4 — AI analytics nâng cao và rollout (1–2 tuần)

#### AIA-01 — Analytics dataset đáng tin — L

- Chuyển các phép tính report quan trọng từ client về API aggregate server-side.
- Chuẩn hóa revenue: chỉ `completed/partial_refund` theo quy tắc hiện tại, trừ refund đúng snapshot.
- Mọi AI narrative phải nhận bảng số đã tính sẵn, không để LLM tự cộng hàng nghìn order thô.
- Thêm comparison period, AOV, sell-through, gross margin, refund rate, low-stock days.

#### AIA-02 — Gợi ý sản phẩm có kiểm soát — M

- Rule filter trước: còn hàng, đúng ngân sách, trạng thái active, variant khả dụng.
- AI chỉ xếp hạng/giải thích trong tập kết quả hợp lệ.
- Nếu có dữ liệu prescription, chỉ dùng như thông số lọc/tư vấn sản phẩm, không kết luận y khoa.
- Log sản phẩm được gợi ý/click/add-to-cart để đo conversion, không tự học trực tiếp từ mọi click chưa kiểm duyệt.

#### AIA-03 — Trend/anomaly — M

- Statistical layer tính delta/z-score/moving average trước.
- Gemini diễn giải nguyên nhân khả dĩ dựa trên dữ liệu đã tính và nêu rõ “quan sát” vs “giả thuyết”.
- Admin có drill-down về report gốc; không chỉ xem văn bản AI.

#### ROLL-01 — Rollout theo cohort — M

1. Internal admin, dữ liệu fixture.
2. Một admin với dữ liệu production read-only.
3. 1–2 staff beta, AI assistant P0.
4. 25% staff -> 100% nếu KPI và chi phí đạt.
5. Payment rollout: sandbox -> test intent 2.900đ -> một quầy/một tài khoản -> toàn bộ quầy.
6. QR rollout: 20 SKU pilot -> kiểm tra scan/error -> batch toàn catalog.

Feature flag phải cho phép tắt AI/payment auto-confirm/QR public độc lập mà cash checkout vẫn hoạt động.

---

## 5. Thứ tự phụ thuộc và lịch gợi ý

```text
PAY-00 provider PoC
   -> ENV-01
   -> PAY-01 schema -> PAY-02 adapter -> PAY-03 test 2.900đ
                                  \-> PAY-04 intent thật -> PAY-05 finalize
                                                         -> PAY-06 webhook
                                                         -> PAY-07 UI
                                                         -> PAY-08/09

QR-01 -> QR-02 -> QR-03/QR-04 -> QR-05 -> QR-06

AI-01 -> AI-02 -> AI-03 + AI-04 + AI-05 -> AI-06 -> AI-07/08
                                              -> AIA-01/02/03 -> rollout
```

Lịch tham khảo cho 2 kỹ sư full-stack + 1 QA part-time:

| Tuần | Track A | Track B | QA/Deliverable |
|---|---|---|---|
| 1 | Provider PoC, baseline, env | QR schema/resolver | Chọn provider, ADR |
| 2 | Payment schema/adapter/test intent | QR page/print/POS parser | Scan pilot + webhook sandbox |
| 3 | Intent thật/reservation/finalize | AI use case/gateway | Test chuyển thật 2.900đ |
| 4 | Webhook/UI/SSE/reconciliation | RAG + prompts | Payment race/security tests |
| 5 | Payment hardening/one-counter pilot | AI read tools/API/UI | AI eval baseline |
| 6 | Fix pilot issues | AI analytics/recommendation | Staff/admin beta |
| 7 | Rollout có kiểm soát | Cost/privacy/observability | Go/no-go review |

Nếu chỉ có một kỹ sư, thực hiện tuần tự và ước lượng 9–12 tuần; không triển khai payment và AI production cùng lúc.

---

## 6. File/module dự kiến thay đổi

| Phạm vi | File hiện có | File mới/dự kiến |
|---|---|---|
| App wiring | `src/app.js`, `src/config/env.js` | đăng ký public webhook trước auth; wire payment/AI services |
| Checkout | `src/modules/orders/service.js`, `repository.js`, `routes.js`, `controller.js` | trích pricing/finalize dùng chung, không complete bank transfer sớm |
| Payment | — | `src/modules/payments/{routes,controller,service,repository,events}.js`, `providers/{sepay,fake}.js` |
| Payment DB | `src/db/migrationRunner.js`, schema hiện có | migration payment intents/transactions/order payment status |
| POS UI | `frontend/orders.html` | payment modal/state/SSE và QR product parser; sau đó nên trích page module |
| Product | `src/modules/products/*` | public QR resolver và QR management service/repository |
| Product UI | `frontend/products.html`, `frontend/print-labels.html` | `frontend/qr/product.html`, QR generation/print |
| AI | dashboard/products/customers/orders repositories | `src/modules/ai/*`, prompt/RAG/eval manifests |
| Tests | `tests/modules/orders/*`, frontend contract tests | `tests/modules/payments/*`, `tests/modules/ai/*`, QR public/security tests |

---

## 7. Definition of Done tổng thể

### Payment

- Test transfer 2.900đ xác minh thành công qua webhook, không làm thay đổi doanh thu/tồn/điểm/ca.
- Order bank transfer không còn `completed` trước webhook.
- Đúng account + đúng amount + đúng content + intent active mới được paid.
- Webhook retry/duplicate/out-of-order không tạo side effect trùng.
- Có expiry, release reservation, reconciliation, audit và admin review.
- Cash/card vẫn chạy qua regression suite.

### QR sản phẩm

- Mỗi SKU pilot có QR ổn định, scan bằng điện thoại mở đúng trang sản phẩm.
- Scan tại POS thêm đúng sản phẩm một lần.
- Rotate/revoke hoạt động, code không đoán được, endpoint không rò dữ liệu nội bộ.
- Giá/tồn hiển thị lấy từ server hiện tại, không lấy từ dữ liệu nhúng trong QR.

### AI

- Staff hỏi policy/tìm sản phẩm; admin hỏi doanh thu/xu hướng qua tools read-only.
- Không có fine-tuning giả; corpus, prompt, tool và eval đều versioned.
- Numeric fixture accuracy 100%, P0 grounded accuracy đạt ngưỡng, không lộ dữ liệu trái quyền.
- Có rate limit, budget, token/latency/error dashboard và kill switch.
- AI lỗi hoặc Gemini hết quota không chặn checkout/payment/QR.

---

## 8. Rủi ro và biện pháp

| Rủi ro | Biện pháp |
|---|---|
| Hạ giá thật xuống 2.900đ gây sai doanh thu | Test intent/SKU staging + `is_test`, production flag off |
| Webhook giả/replay | HMAC, HTTPS, account/amount/content validation, unique transaction, replay window |
| Khách chuyển sai nội dung/sai tiền | QR động prefill; unmatched queue; không fuzzy-match tự động nhiều intent |
| Provider chậm/mất webhook | Retry + reconciliation query/job + UI pending, không success giả |
| Race tồn kho trong lúc chờ CK | Reservation atomic + expiry release |
| AI bịa số doanh thu | Tool trả aggregate chuẩn; LLM chỉ diễn giải; link drill-down |
| AI lộ PII/cost price | RBAC tool, field allowlist, redaction, role-specific RAG |
| Gemini 429/chi phí tăng | Flash-Lite mặc định, quota/concurrency, cache, daily budget, fallback |
| Model bị deprecate | Stable explicit model ID, model adapter, eval trước khi đổi |
| QR bị sao chép | QR chỉ định danh sản phẩm, không là chứng từ thanh toán; revoke/rotate khi cần |

---

## 9. Các quyết định mặc định để bắt đầu ngay

1. Provider PoC: SePay; Casso là fallback.
2. Ngân hàng/tài khoản: xác nhận trong PAY-00, không giả định mọi tài khoản cá nhân đều được hỗ trợ.
3. Số tiền test: 2.900đ, chỉ qua verification intent `is_test=1`.
4. Model mặc định: `gemini-3.1-flash-lite`; nâng lên `gemini-3.5-flash` theo router.
5. “Train”: RAG + function calling + eval/feedback; chưa fine-tune.
6. AI v1 read-only.
7. QR chứa opaque HTTPS URL; không chứa giá/numeric product ID.
8. Rollout payment trước, QR song song; AI production sau khi payment ổn định để giảm rủi ro vận hành.
