# Góc nhìn và nội thất rạp

Trong phòng 3D, thanh dưới có các nút toàn cảnh, **1** (góc nhìn thứ nhất), **3** (góc nhìn thứ ba), màn ảnh và video 2D. Góc nhìn từ ghế đang ngồi nằm trong **Tùy chọn → Góc nhìn**.

- Kéo trên cảnh 3D để nhìn quanh. Chụm/tách hai ngón tay để thu/phóng, hoặc dùng nút **+ / −**. Trên PC dùng con lăn chuột.
- Nút **↺** đặt lại hướng và zoom. Trong góc thứ nhất, zoom thay đổi độ rộng góc nhìn; trong góc thứ ba, zoom thay đổi khoảng cách camera.
- Joystick và WASD đi theo hướng camera. Chọn ghế để ngồi; chọn **Đứng lên** trước khi tiếp tục đi.
- Camera xoay liên tục quanh phòng. Khi camera ra ngoài một mặt tường hoặc mái, mặt đó tự ẩn để giữ tầm nhìn vào phòng. Ghế sát camera tạm ẩn trên máy đó; quyền ngồi trên máy chủ không thay đổi.
- Zoom từ 0.4 đến 2.4. Góc thứ nhất thay đổi FOV liên tục 30–95°; góc thứ ba/toàn cảnh thay đổi khoảng cách, không dừng cứng ở tường. Góc Màn chiếu tính khoảng cách từ cả bốn góc màn, bao gồm độ nghiêng và tỷ lệ khung dọc/ngang.

Rạp dùng hình học và vật liệu dựng trực tiếp, một bản đồ bóng 1024px, DPR tối đa 1.5 và demand rendering. Đã kiểm tra browser ở 390×844 và 844×390; chưa đo FPS trên điện thoại thật. Pinch cần kiểm tra thêm trên thiết bị cảm ứng thực tế.

## Điều khiển nhanh và màn chiếu

- Điện thoại dọc: joystick ở giữa phía dưới. Xoay ngang: joystick bên trái, ngón phải dùng để xoay camera.
- Joystick dùng được ở toàn cảnh, góc nhìn thứ nhất và thứ ba. Đứng lên trước khi di chuyển khỏi ghế.
- Nhấn giữ **Hành động** hoặc **Cảm xúc** khoảng 220ms, kéo tới biểu tượng rồi thả. Thả ở giữa hoặc ngoài các biểu tượng để hủy. Chạm một lần cũng mở vòng chọn để dùng bằng bàn phím hoặc chọn từng nút.
- Có vẫy tay, gật đầu, vỗ tay, hoan hô, nhún nhảy và nhảy lên. Hai động tác cuối yêu cầu đứng yên, không ngồi ghế. Server kiểm tra thành viên, loại hành động và giới hạn tốc độ; mọi người trong cùng phòng nhận cùng thời điểm bắt đầu. Khi bật giảm chuyển động, biểu tượng vẫn xuất hiện nhưng không chạy động tác.
- Khung YouTube dùng phép chiếu phối cảnh của cùng camera với cảnh 3D; mặt nạ chiều sâu cho phép ghế/nhân vật che video đúng vị trí. Không đọc pixel từ iframe, không tải lại hay trích xuất nội dung YouTube.
- Đèn disco trong Tùy chọn bật quả cầu và các tia đèn sân khấu. Số ghế và nhân vật trong rạp phản ánh cấu hình/thành viên thật.

## Thanh điều khiển trên điện thoại

- Chạm nút con mắt ở đầu trang để thu gọn các thanh và lớp phủ, nhường toàn màn hình cho rạp 3D. Nút con mắt nhỏ còn lại dùng để hiện lại.
- Khi không có thao tác trong 15 giây, các thanh tự thu gọn. Chạm hoặc tương tác để hiện lại; lần chạm đầu tiên chỉ đánh thức giao diện, không chọn ghế hay làm nhân vật di chuyển.
- Đang nhập tin nhắn, kéo joystick/thanh trượt hoặc mở bảng chức năng thì bộ hẹn giờ tạm dừng để thao tác không bị ngắt.

Đã kiểm tra kéo/thả động tác và cảm xúc bằng trình duyệt, video YouTube trong rạp, khổ dọc/ngang; phép chiếu bốn góc màn hình có kiểm thử số học. Kiểm thử tích hợp xác nhận người cùng phòng nhận động tác, từ chối người chưa tham gia và chặn gửi liên tục.

## Màn chiếu và ánh sáng

- Màn 16:9 chiếm gần hết chiều ngang tường trước, chừa viền hốc tối mỏng. Trần, camera, khung YouTube và mặt nạ WebGL dùng cùng hàm kích thước từ bố cục ghế. Video/ảnh khác tỷ lệ giữ nguyên hình, không kéo méo.
- Hai đèn bề mặt rộng hắt sáng từ hai nửa màn, thêm ánh sáng phản xạ mềm và quầng sáng quanh hốc. Đây là mô phỏng ánh sáng trực tiếp/phản xạ, không phải ray tracing.
- Video mà canvas được phép đọc được lấy mẫu 8×4 pixel tối đa 5 lần/giây; màu và độ sáng chuyển mềm. Khung tối làm đèn màn chiếu giảm sáng; đèn lối đi vẫn giữ để di chuyển. Ảnh được lấy mẫu khi tải.
- YouTube dùng ánh sáng trắng xanh ổn định khi có nguồn. Không đọc pixel hay suy đoán màu từ iframe khác miền. Nguồn bị CORS chặn đọc màu cũng dùng ánh sáng trung tính.
- Không thêm postprocessing toàn màn hình. Đèn bề mặt không tạo thêm shadow map; các mẫu hình chỉ nằm trong bộ nhớ, không gửi lên máy chủ.
