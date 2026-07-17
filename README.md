# POS Glasses

POS Glasses là hệ thống bán lẻ dành riêng cho cửa hàng mắt kính. Phạm vi chính gồm bán hàng tại quầy, sản phẩm và biến thể, tồn kho, khách hàng hội viên, đơn kính và toa kính, bảo hành, nhà cung cấp, ca làm việc, khuyến mãi, thanh toán và báo cáo quản trị.

Luồng đặt hàng bằng QR theo bàn đã được loại khỏi sản phẩm. QR còn lại chỉ phục vụ nhận diện sản phẩm và VietQR thanh toán.

## Yêu cầu

- Node.js 20 trở lên
- MySQL 8
- npm 10 trở lên

## Chạy local

```bash
npm ci
copy .env.example .env
npm run dev
```

Mặc định ứng dụng chạy tại `http://localhost:3000`.

Nếu database chưa có người dùng, cấu hình hai biến sau trước lần khởi động đầu tiên:

```text
BOOTSTRAP_ADMIN_USERNAME=admin.store
BOOTSTRAP_ADMIN_PASSWORD=<mật khẩu mạnh tối thiểu 12 ký tự, có chữ và số>
```

Sau khi tài khoản quản trị được tạo, xóa hai secret bootstrap khỏi môi trường deploy.

## Kiểm tra chất lượng

```bash
npm run check
npm audit --omit=dev
```

`npm run check` kiểm tra cú pháp JavaScript, inline script trong các trang HTML, asset local bị thiếu, secret `.env` bị Git theo dõi và các dấu vết của luồng đặt bàn đã nghỉ.

## Cấu hình production tối thiểu

```text
NODE_ENV=production
PUBLIC_APP_URL=https://pos.example.com
CORS_ORIGINS=https://pos.example.com
TRUST_PROXY=1
JWT_SECRET=<chuỗi ngẫu nhiên dài tối thiểu 64 byte>

DB_HOST=<host>
DB_PORT=3306
DB_NAME=pos_glasses
DB_USER=<tài khoản ứng dụng, không dùng root>
DB_PASSWORD=<secret>

PAYMENT_PROVIDER=sepay
PAYMENT_WEBHOOK_AUTH=hmac
PAYMENT_WEBHOOK_SECRET=<secret>
PAYMENT_ACCOUNT_NUMBER=<số tài khoản nhận tiền>
PAYMENT_BANK_CODE=<mã ngân hàng>
PAYMENT_TEST_MODE=false
```

Các biến Cloudinary và Gemini trong [.env.example](./.env.example) là tùy chọn. Không commit `.env`, certificate, database dump chứa dữ liệu thật hoặc API secret.

## Triển khai

1. Backup database và kiểm thử restore.
2. Deploy vào staging với database clone đã ẩn dữ liệu cá nhân.
3. Chạy `npm ci`, `npm run verify` và `npm audit --omit=dev`.
4. Khởi động bằng `npm start`.
5. Kiểm tra `/health/live` và `/health/ready`.
6. Smoke test đăng nhập, mở ca, bán tiền mặt, tạo payment intent, nhận webhook, in hóa đơn, hoàn đơn và điều chỉnh kho.
7. Chỉ chuyển traffic production khi toàn bộ bước trên đạt.

Khi khởi động, server tự chạy các schema upgrade idempotent và dọn các bảng đặt hàng theo bàn cũ. Production sẽ từ chối khởi động nếu phát hiện tài khoản lưu mật khẩu rõ hoặc database chưa có người dùng mà thiếu bootstrap admin.
Production cũng từ chối provider thanh toán giả, test mode, provider lạ hoặc cấu hình SePay thiếu tài khoản/xác thực webhook.

## Phân quyền

- `staff`: bán hàng, ca làm việc, hóa đơn, sản phẩm đọc, khách hàng, bảo hành, kho và nhập hàng theo quyền API.
- `admin`: toàn bộ quyền staff, dashboard, báo cáo, quản lý tài khoản, audit log và cấu hình nghiệp vụ.

Trang HTML được kiểm tra phiên và vai trò ở server trước khi phục vụ. API mutation dùng HttpOnly cookie, SameSite Strict, CSRF same-origin, role guard và request ID.

## Cấu trúc

```text
frontend/          Giao diện multi-page và shared assets
src/app.js         HTTP app, middleware và route wiring
src/modules/       Module nghiệp vụ
src/db/            Bootstrap schema và migration runner
scripts/           Dump, migrations và công cụ vận hành
docs/              Phân tích và runbook chi tiết
```

Chi tiết đợt production hardening gần nhất nằm tại [docs/2026-07-17-production-upgrade.md](./docs/2026-07-17-production-upgrade.md).
