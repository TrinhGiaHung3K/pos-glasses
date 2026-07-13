# POS Glasses knowledge base v1

## Thanh toán

- Tiền mặt và thẻ được hoàn tất tại checkout sau khi server kiểm tra giá và tồn kho.
- Chuyển khoản phải tạo payment intent/VietQR và chỉ hoàn tất sau webhook ngân hàng hợp lệ.
- Nhân viên không tự đánh dấu đã nhận chuyển khoản. Giao dịch sai tiền hoặc sai nội dung chuyển vào hàng chờ admin đối soát.

## Giá, giảm giá và promotion

- Giá và tổng tiền luôn do server tính từ catalog hiện tại; không tin giá do client hoặc AI gửi lên.
- Giảm thủ công bị giới hạn theo cấp nhân viên. Promotion phải còn hiệu lực, đủ giá trị đơn và chưa hết lượt.
- AI chỉ được gợi ý, không được tự đổi giá hoặc áp dụng giảm giá.

## Tồn kho

- Checkout khóa tồn kho trong transaction.
- Chuyển khoản đang chờ dùng reservation; hết hạn phải hoàn reservation.
- Sản phẩm hết hàng không được thêm mới vào giỏ.

## Hội viên

- Hội viên tích điểm theo hóa đơn đã hoàn tất. Void/refund phải đảo điểm theo nghiệp vụ hiện có.
- Không tiết lộ số điện thoại, email hoặc địa chỉ khách nếu câu hỏi không cần thiết.

## Kính và sức khỏe

- AI có thể hỗ trợ lọc sản phẩm, thông số gọng và giải thích quy trình đơn kính.
- AI không chẩn đoán bệnh mắt, không thay thế bác sĩ/chuyên viên đo khám và phải đề nghị gặp chuyên gia khi có triệu chứng sức khỏe.

## Vai trò

- Staff được xem catalog, tồn, khách hàng đang phục vụ và trạng thái order phục vụ bán hàng.
- Chỉ admin được xem phân tích doanh thu/lãi gộp tổng hợp và dữ liệu quản trị nhạy cảm.
