# Minimal mega rail sidebar

## Mục tiêu

Đơn giản hóa sidebar dùng chung của POS Glasses thành một mega rail hiện đại, dễ quét và có cảm giác của một công cụ bán lẻ chuyên nghiệp. Thiết kế loại bỏ các chi tiết dễ tạo cảm giác dashboard mẫu: mô tả dài trong menu, bộ đếm mục, gradient nặng, badge trang trí và hiệu ứng bóng đổ lớn.

## Phạm vi

Áp dụng cho component sidebar dùng chung ở `frontend/assets/js/components.js` và các kiểu dáng liên quan trong `frontend/assets/css/layout.css`. Giữ nguyên URL, tập menu, quyền theo vai trò, các điểm mount sidebar và luồng bán hàng hiện tại. Các ghi đè riêng của màn POS chỉ nhận những thay đổi không ảnh hưởng đến luồng lập đơn và thanh toán.

## Điều hướng

- Các điểm đến độc lập, hiện gồm Tổng quan và Báo cáo, xuất hiện trực tiếp trên rail.
- Các điểm đến còn lại được nhóm theo nghiệp vụ: Bán hàng, Catalog, Khách hàng, Kho, QR bàn và Hệ thống.
- Mỗi nhóm là một nút gồm icon, nhãn và chevron nhỏ. Không hiển thị mô tả hoặc số lượng mục.
- Nhấn một nhóm mở một mega panel ở cạnh rail. Chỉ một panel mở tại một thời điểm.
- Mega panel là lưới hai cột gồm icon và nhãn điểm đến. Nó không có phần đầu trang, số lượng, mô tả hay mũi tên trang trí.
- Trang đang hoạt động luôn giữ nhóm chứa nó ở trạng thái mở khi khởi tạo.

## Ngôn ngữ thị giác

- Rail dùng nền xanh than phẳng, logo nhỏ ở đầu và vùng tài khoản/đăng xuất ở chân.
- Các hàng điều hướng có khoảng cách và typography tiết chế để tạo nhịp quét nhanh.
- Mục hiện tại được nhận biết bằng nền accent nhạt và một vạch định vị mảnh, thay vì khối màu lớn.
- Hover/focus chỉ thêm tương phản vừa đủ. Không dùng gradient, chip/badge, shadow nổi bật hay animation phô trương.
- Panel mega có nền sáng, viền nhẹ, bán kính vừa phải và bóng đổ ngắn để tách khỏi nội dung mà không tạo cảm giác nổi lềnh bềnh.

## Responsive và khả năng truy cập

- Desktop giữ rail ở kích thước đầy đủ và panel mở bên cạnh.
- Tablet thu rail về icon nhưng vẫn mở panel định vị cạnh nút kích hoạt.
- Mobile giữ điều hướng đáy; panel hiển thị phía trên thanh này.
- Nút nhóm duy trì `aria-expanded` và `aria-controls`. Tất cả mục vẫn truy cập được bằng bàn phím.
- `Escape`, click ngoài panel, chuyển trang và thay đổi breakpoint đều đóng panel khi phù hợp, không để panel che nội dung.

## Dữ liệu và tương thích

Component tiếp tục lấy dữ liệu từ `APP_MENU_ITEMS`, `APP_MENU_GROUPS`, bản đồ đường dẫn đang hoạt động và quyền người dùng hiện tại. Không đổi API hoặc vai trò. Lưu trữ session cho trạng thái nhóm được thu gọn còn một nhóm đang mở hoặc được loại bỏ nếu không cần để đảm bảo trạng thái đơn giản, dễ dự đoán.

## Kiểm thử và xác minh

- Cập nhật kiểm thử component menu cho cấu trúc mega rail, panel lưới tối giản, active state và phân quyền admin/nhân viên.
- Chạy toàn bộ test Node hiện có.
- Kiểm tra trực quan sidebar trên desktop, tablet và mobile; xác nhận nhóm POS và màn Đơn hàng vẫn hoạt động đúng.

## Ngoài phạm vi

Không thay đổi nội dung trang, quy trình bán hàng/thanh toán, schema cơ sở dữ liệu, API hay hệ thống phân quyền.
