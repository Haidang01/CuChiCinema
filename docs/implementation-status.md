# Tiến độ CineVerse

## Nền tảng có thể chạy local

- PostgreSQL + Prisma migration cho tài khoản, phiên, nhân vật, vật phẩm, phòng, lịch sử thay đổi và lịch sử xem.
- Studio chỉnh nhân vật procedural, lưu/tải bằng API.
- Phòng riêng, sơ đồ ghế, host-controlled video timeline và WebRTC voice cơ bản.
- Git local main; skill nguồn được ghim commit; bí mật được bỏ qua bởi Git.

## Milestone tiếp theo

1. Media hợp lệ tự host: endpoint có phân quyền, byte-range, chọn video từ thư viện và kiểm thử seek thực tế.
2. VideoTexture có CORS hợp lệ, camera Seated/Focus và fallback 2D; HUD thu gọn có thể mở lại bằng bàn phím/chạm.
3. Avatar navigation từ lối đi đến ghế bằng metadata layout dùng chung, state đi/ngồi/đứng, xử lý lỗi đường đi.
4. Voice: cấu hình TURN, test hai mạng khác nhau, chọn thiết bị, Social/Cinema mode và spatial audio.
5. Asset/animation, mobile thật, đo hiệu năng; triển khai HTTPS trên Mac mini và backup PostgreSQL.

Không dùng build/typecheck làm bằng chứng cho FPS, chất lượng thoại hoặc độ lệch phim thực tế. Xem README để biết chức năng và giới hạn hiện tại.

## Đã xác minh

- `npm test`: 5 kiểm thử domain qua, gồm layout bốn loại phòng/capacity 2–12, ghế lẻ, tranh ghế, reconnect/host và timeline.
- `npm run test:integration`: qua trên database `cineverse_test`; kiểm tra tài khoản, khôi phục ngoại hình sau đăng nhập, lịch sử riêng, quyền sở hữu, token mời, tranh ghế Socket.io, host control, reconnect và chặn origin khác.
- Build production và kiểm tra TypeScript qua. Còn cảnh báo kích thước chunk Three.js (đã lazy-load) và chú thích tree-shaking từ Zod; chưa phải lỗi build.
- npm audit tại thời điểm cài đặt: không có lỗ hổng được báo cáo. Prisma có dependency công cụ phụ khuyến nghị Node 22; local Node 20.19 vẫn chạy generate/migrate/build/test, khuyến nghị Node 22 LTS khi triển khai.
- Trình duyệt: scene nhân vật hiển thị trên desktop sau khi sửa camera; kiểm tra bố cục hẹp 390px không tràn ngang. Kiểm thử tương tác mobile còn hạn chế do phiên tab preview bị đóng trong lúc QA; chưa thay thế test điện thoại thật.
