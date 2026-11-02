# Đối chiếu chức năng với website tham khảo

Tham khảo: https://choigivui.com/, kiểm tra trang công khai bằng trình duyệt ngày 02/11/2026
và ảnh người dùng cung cấp. Không truy cập mã nguồn, tài khoản hay nội dung sau đăng nhập.

| Chức năng thấy được                                                                  | CineVerse local                                                                                                                                                        |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gửi YouTube, danh sách chờ, bình chọn                                                | Có bảng gửi rõ nhãn YouTube cho mọi thành viên; tối đa 50 mục; phiếu theo user, xóa theo quyền; host chuyển bài và tự chuyển khi kết thúc                              |
| Chiếu ảnh (thấy trong ảnh)                                                           | Upload JPG/PNG/WebP có xác thực, giới hạn 10 MB, kiểm tra chữ ký file; xếp hàng chung, hiển thị 3D/2D                                                                  |
| Chọn ghế, các góc nhìn                                                               | Giữ hệ thống ghế và góc nhìn sẵn có của CineVerse; cấu hình phòng riêng 2–3 người theo spec, không tăng thành rạp công cộng 100 người                                  |
| Trò chuyện (thấy trong ảnh), cảm xúc                                                 | Giữ chat và cảm xúc socket sẵn có; không tạo lượt online/bot hay tin nhắn giả                                                                                          |
| Tủ đồ (thấy trong ảnh)                                                               | Chỉnh nhân vật ngay trong rạp; API kiểm tra vật phẩm sở hữu; lưu PostgreSQL và refresh cho cả phòng                                                                    |
| Độ nét, đèn/hiệu ứng                                                                 | Thêm lựa chọn Mượt/Cao cho rạp, giữ bật/tắt đèn rạp/disco sẵn có; không mô tả hiệu ứng chưa có như đã hoàn thành                                                       |
| Phụ đề                                                                               | Ưu tiên phụ đề YouTube tiếng Việt khi có; nạp/gỡ VTT cục bộ cho video 2D; không tải hoặc tự tạo phụ đề YouTube                                                         |
| Âm lượng, toàn màn hình, mời bạn, phòng riêng                                        | Giữ chức năng CineVerse sẵn có; micro trên điện thoại vẫn cần HTTPS                                                                                                    |
| Ví, mua quyền chen hàng, thu phí phòng, ủng hộ tiền (thấy trong ảnh/mô tả công khai) | Chưa tích hợp thanh toán. Không có số dư, chuyển tiền hoặc lượt mua giả. Cần chọn nhà cung cấp, thông tin người nhận, webhook và đối soát trước khi làm giao dịch thật |

Trạng thái hàng chờ/phiếu/nguồn đang chiếu lưu trong PostgreSQL qua `Room.mediaState`
(cần migration mới); thành viên, chat và chuyển động vẫn là trạng thái runtime.
Ảnh và nhân vật được lưu trong thư viện/tài khoản; khả năng phát từng video YouTube phụ thuộc
quyền nhúng của chủ video và mạng. Trang tham khảo chặn chức năng phòng riêng khi chưa đăng nhập,
nên báo cáo này không khẳng định đã kiểm thử các luồng sau đăng nhập của họ.

Kiểm chứng CineVerse: kiểm thử domain, tích hợp với database `cineverse_test` riêng,
và trình duyệt QA trên cổng riêng (390×844, ngang 844×390). Không dùng tài khoản thật để thử.
