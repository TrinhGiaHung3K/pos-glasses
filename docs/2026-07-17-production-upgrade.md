# Báo cáo nâng cấp production POS Glasses

## Phạm vi nghiệp vụ sau nâng cấp

Hệ thống được chốt là POS bán lẻ mắt kính tại quầy. Các phần thuộc mô hình nhà hàng đã bị loại gồm quản lý bàn, QR đặt bàn, hàng chờ order theo bàn, public table order API và các bảng dữ liệu liên quan.

QR sản phẩm được giữ để tra cứu thông tin an toàn. VietQR được giữ cho thanh toán có xác nhận webhook.

## Các thay đổi chính

### Kiến trúc và dữ liệu

- Gỡ module `tables` và `tableOrders` khỏi repository, service, controller và route wiring.
- Gỡ cột và join `table_id`, `table_order_id` khỏi luồng hóa đơn.
- Xóa migration QR theo bàn cũ để tránh bị chạy thủ công và tạo lại schema đã nghỉ.
- Thêm cleanup schema idempotent cho database cũ.
- Dump cài mới không còn bảng đặt bàn và không seed tài khoản mật khẩu yếu.
- Thêm bootstrap admin bằng secret môi trường cho lần chạy đầu.

### Bảo mật

- Trang HTML nội bộ được xác thực và phân quyền ở server trước khi serve file.
- Dashboard, báo cáo, người dùng và audit log là trang admin-only.
- Xóa đăng ký công khai và các API tạo đơn từng phần không còn an toàn.
- Production dùng cookie `__Host-` mặc định, loại JWT trên query string và kiểm tra CSRF đúng origin gồm cả protocol.
- Thắt CSP, frame policy, permission policy và request tracing.
- Production fail-fast nếu còn mật khẩu rõ.
- Production fail-fast nếu dùng payment provider giả, bật test mode hoặc thiếu xác thực SePay.

### Giao diện và trải nghiệm

- Menu không còn nhóm Bàn QR hoặc trang test thanh toán.
- Dashboard và báo cáo đổi biểu đồ nguồn đơn sang phương thức thanh toán.
- Hóa đơn không còn hiển thị bàn hoặc nguồn QR.
- Public QR sản phẩm không điều hướng khách chưa đăng nhập vào POS nội bộ.
- Login dùng form semantic, hỗ trợ submit bàn phím và quay lại trang đích an toàn.
- Bỏ Google Fonts runtime và ảnh fallback gắn cứng với một Cloudinary account.

### Vận hành và chất lượng

- Thêm live probe `/health/live` và readiness probe `/health/ready`.
- Production ghi log request lỗi hoặc chậm, không ghi query string.
- Error response có `request_id` để đối soát log.
- Thêm `npm run check` và `npm run verify`.
- Dependency audit tại thời điểm nâng cấp: không có lỗ hổng production được báo cáo.

## Checklist trước khi deploy

- [ ] Backup và thử restore MySQL.
- [ ] Tạo DB user riêng, không dùng root.
- [ ] Đặt `JWT_SECRET` ngẫu nhiên tối thiểu 64 byte.
- [ ] Đặt đúng `PUBLIC_APP_URL`, `CORS_ORIGINS` và `TRUST_PROXY`.
- [ ] Tắt `PAYMENT_TEST_MODE`.
- [ ] Dùng HMAC/API key SePay đúng với dashboard webhook.
- [ ] Xóa bootstrap admin secret sau lần tạo đầu.
- [ ] Chạy `npm ci`, `npm run verify`, `npm audit --omit=dev`.
- [ ] Kiểm tra health probes và smoke test các luồng bán hàng quan trọng.
