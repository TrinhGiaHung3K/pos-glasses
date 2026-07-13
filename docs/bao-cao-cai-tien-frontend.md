# Báo cáo cải tiến Frontend – POS Glasses

---

## 1. Giao diện trang Kho hàng (`inventory.html`)

- Thiết kế lại theo design system hiện có (màu teal, font, card, KPI).
- Thêm: chỉ số tồn kho, thanh sức khỏe kho, lọc/tìm/sắp xếp, trạng thái loading/empty/error.
- Tooltip chuẩn hệ thống cho các đoạn “Còn hàng / Sắp hết / Hết hàng”.

---

## 2. Giao diện trang Hóa đơn (`invoices.html`)

- Thiết kế lại đồng bộ với inventory/dashboard.
- Thêm: KPI doanh thu, lọc theo thời gian/nguồn/nhân viên, tìm kiếm, sắp xếp.
- Bảng hóa đơn đầy đủ hơn (mã HĐ, khách, NV, nguồn, trạng thái, tiền, ngày, xem/in).

---

## 3. Giao diện & logic trang Sản phẩm (`products.html`)

- Thiết kế lại catalog: KPI, lọc tồn/thương hiệu, card sản phẩm.
- **Thêm sản phẩm:** form đầy đủ, validate, lưu API.
- **Sửa sản phẩm:** form prefill, cập nhật API.
- **Xóa sản phẩm:** confirm (có xác nhận 2 lần nếu còn tồn).
- **Mua ngay:** bán nhanh qua API checkout POS, hoặc chuyển sang quầy `orders.html` kèm giỏ hàng.

---

## 4. Sửa lỗi cập nhật giá sản phẩm

- **Lỗi:** giá MySQL dạng `2890000.00` bị parse sai → phình số → lỗi `Out of range` cột `price`.
- **Sửa:** chuẩn hóa parse tiền VND ở `format.js` + form products + validate backend.

---

## 5. Popup hệ thống (confirm / form / overlay)

- Chỉ đóng popup khi **nhấn và thả** đúng vùng nền mờ (không đóng khi kéo từ trong ra ngoài).
- Nút trong popup luôn hiện `cursor: pointer`.
- Áp dụng cho confirm xóa, form modal, products, customers, orders.

---

## 6. Chuẩn mã SKU toàn hệ thống

- Module dùng chung: `frontend/assets/js/sku.js`.
- Quy tắc:
    - Ưu tiên mã model trong tên (VD: `RB4171`).
    - Không có / bị trùng → `BRAND + 3 số` (VD: `RB014`, `OK008`).
    - Hãng lạ → prefix `PG`.
- Form thêm SP: tự gợi ý khi gõ tên + nút **Gợi ý**.

---

## 7. Căn layout form Mã SKU / Danh mục

- Gợi ý SKU tách xuống hàng riêng full-width.
- Hai ô SKU và Danh mục căn thẳng ngang (cùng baseline).

---

## 8. Xử lý nền ảnh kính (toàn hệ thống)

- Module: `frontend/assets/js/productImage.js`.
- Pipeline: tách nền studio → làm mềm viền → căn giữa → PNG trong suốt.
- API: `POST /products/image` → lưu `images/products/...`.
- Form SP: chọn file / **Xử lý nền** / tự xử lý khi lưu.
- CSS hiển thị thống nhất: `.pos-product-media` (products, inventory, POS).

---
