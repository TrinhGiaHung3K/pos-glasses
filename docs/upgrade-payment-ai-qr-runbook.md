# Runbook vận hành Payment, AI và QR sản phẩm

## 1. Trạng thái triển khai

- Payment intent test 2.900đ: hoàn thành.
- Payment intent order thật, reservation, webhook finalize, expiry release, SSE POS: hoàn thành.
- Adapter: `fake` cho local/test, `sepay` cho production.
- QR sản phẩm public/POS/in/rotate: hoàn thành.
- AI Gemini: gateway, model router, local RAG v1, function tools read-only, RBAC, usage/feedback log và UI: hoàn thành.

## 2. Cấu hình local an toàn

Copy các key cần thiết từ `.env.example` sang `.env`. Không commit secret.

```text
PAYMENT_PROVIDER=fake
PAYMENT_TEST_MODE=true
PAYMENT_TEST_AMOUNT=2900
PUBLIC_APP_URL=http://localhost:3000
AI_ENABLED=false
```

Khởi động và chạy test:

```powershell
npm test
npm run dev
```

Admin mở `/payment-test.html`, tạo QR test 2.900đ. Với fake provider, mô phỏng webhook:

```http
POST /api/webhooks/payments/fake
Content-Type: application/json

{
  "id": "unique-test-1",
  "accountNumber": "<PAYMENT_ACCOUNT_NUMBER>",
  "transferType": "in",
  "transferAmount": 2900,
  "content": "<transfer_content trên màn hình>"
}
```

## 3. Cấu hình SePay

```text
PAYMENT_PROVIDER=sepay
PAYMENT_WEBHOOK_SECRET=<API key hoặc HMAC secret>
PAYMENT_ACCOUNT_NUMBER=<tài khoản đã liên kết SePay>
PAYMENT_BANK_CODE=<mã ngân hàng VietQR>
PAYMENT_INTENT_TTL_MINUTES=10
PAYMENT_TEST_MODE=true
PUBLIC_APP_URL=https://pos.example.com
```

Webhook URL:

```text
https://pos.example.com/api/webhooks/payments/sepay
```

Checklist go-live:

1. Endpoint HTTPS hợp lệ và truy cập được từ Internet.
2. Bật API key hoặc HMAC, không dùng webhook không xác thực.
3. Gửi webhook mẫu trong SePay Test mode.
4. Tạo test intent và chuyển đúng 2.900đ với đúng nội dung.
5. Kiểm tra `/payment-test.html`: intent `paid`, transaction `matched`.
6. Thử sai amount và sai content: không được tự paid.
7. Tắt `PAYMENT_TEST_MODE` sau smoke test nếu không còn nhu cầu.

Không lưu tài khoản/mật khẩu Internet Banking trong POS. Nếu đổi tài khoản nhận, cập nhật env và chạy lại smoke test trước khi nhận đơn thật.

## 4. State machine chuyển khoản

```text
pending -> processing -> paid
pending -> expired
processing -> needs_review (finalize lỗi)
```

- Tạo intent order: order `payment_pending`, kho ghi `reserve_out`.
- Webhook hợp lệ: intent được claim `processing`, order finalize `completed`, movement đổi thành `sale`, ca/loyalty được ghi, intent thành `paid`.
- Hết TTL: order `cancelled`, kho ghi `reserve_release`, intent `expired`.
- Duplicate webhook bị chặn bởi unique delivery và unique provider transaction.
- `needs_review`, `amount_mismatch`, `account_mismatch`, `unmatched` phải được admin kiểm tra; hệ thống không fuzzy-match tự động.

## 5. QR sản phẩm

1. Mở `/products.html`.
2. Chọn `QR sản phẩm` trên card.
3. In tem hoặc copy URL.
4. `Đổi mã` revoke mã cũ ngay lập tức.

QR chỉ chứa:

```text
<PUBLIC_APP_URL>/qr/product.html?code=<opaque-code>
```

Không nhúng giá/tồn kho/ID số vào QR. Khi đổi domain phải cập nhật `PUBLIC_APP_URL` rồi in lại QR nếu URL cũ không còn redirect.

## 6. Gemini AI

```text
AI_ENABLED=true
GEMINI_API_KEY=<secret>
GEMINI_DEFAULT_MODEL=gemini-3.1-flash-lite
GEMINI_ANALYSIS_MODEL=gemini-3.5-flash
AI_DAILY_BUDGET_USD=5
```

Sau restart:

- Staff thấy panel AI ở POS, được tìm sản phẩm, xem customer/order phục vụ bán hàng và hỏi policy.
- Admin thấy panel ở dashboard/reports, được gọi sales summary và inventory alerts.
- Staff gọi admin AI endpoint hoặc sales tool bị 403.
- AI không có tool ghi dữ liệu; không thể tự checkout, đổi giá, hoàn tiền hoặc xác nhận chuyển khoản.

RAG v1 nằm tại `src/modules/ai/knowledge/pos-policies.md`. Khi đổi policy:

1. Cập nhật file và version heading.
2. Bổ sung eval/unit test cho rule mới.
3. Chạy `npm test`.
4. Deploy và theo dõi `ai_usage_logs` (latency/error/model/tool); không lưu prompt thô.

Nếu Gemini lỗi/quá quota, API AI trả lỗi có kiểm soát; checkout/payment/QR không phụ thuộc AI và vẫn hoạt động.

## 7. Rollback

- AI: `AI_ENABLED=false`, restart.
- Auto bank transfer: đổi UI về cash/card hoặc `PAYMENT_PROVIDER=fake` chỉ ở staging; không dùng fake ở production.
- QR public: có thể ngừng route bằng deploy rollback; dữ liệu code không ảnh hưởng SKU/order.
- Không xóa payment intents/transactions khi rollback; giữ để audit và đối soát.

## 8. Kiểm tra sau deploy

- `GET /health` trả `ok=true, db=true`.
- Cash checkout pass.
- Bank transfer không còn trả success ngay.
- Order pending được release sau TTL.
- QR điện thoại mở đúng sản phẩm; POS scan thêm đúng một lần.
- AI staff không xem doanh thu; AI admin nêu đúng kỳ dữ liệu.
- Chạy toàn bộ `npm test` và lưu kết quả theo release.
