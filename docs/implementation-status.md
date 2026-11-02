# Tiến độ CineVerse

## Nền tảng có thể chạy local

- PostgreSQL + Prisma migration cho tài khoản, phiên, nhân vật, vật phẩm, phòng, lịch sử thay đổi và lịch sử xem.
- Studio chỉnh nhân vật procedural, lưu/tải bằng API.
- Phòng riêng, sơ đồ ghế, host-controlled video timeline và WebRTC voice cơ bản.
- Git local main; skill nguồn được ghim commit; bí mật được bỏ qua bởi Git.

## Milestone tiếp theo (đã hoàn thành phần 1–3, chọn thiết bị ở phần 4)

1. **Đã có:** upload MP4/WebM theo luồng, thư viện theo tài khoản, private GET/HEAD/byte-range. Người trong phòng chỉ được truy cập file đang chọn; đổi nguồn thu hồi quyền cho request mới tới file cũ.
2. **Đã có:** VideoTexture dùng chung một video với 2D, camera toàn rạp/từ ghế/tập trung, reduced motion và HUD thu gọn. Đã sửa lỗi màu vật liệu làm đen texture. URL ngoài giữ xem 2D khi không có quyền CORS.
3. **Đã có:** waypoint qua lối giữa/lối ngang dùng chung server/client; bước chân, ngồi/đứng, reserve ghế ngay và kết thúc chuyển động theo mốc server. Chưa có đi tự do, joystick hoặc va chạm avatar với nhau.
4. **Đã có chọn micro/loa voice**, chờ ICE trước khi gọi và đếm kết nối. Còn cấu hình TURN, test hai mạng khác nhau, Social/Cinema mode và spatial audio.
5. Asset/animation, mobile thật, đo hiệu năng; triển khai HTTPS trên Mac mini và backup PostgreSQL.

Không dùng build/typecheck làm bằng chứng cho FPS, chất lượng thoại hoặc độ lệch phim thực tế. Xem README để biết chức năng và giới hạn hiện tại.

## Đã xác minh

- `npm test`: 7 kiểm thử domain qua, gồm layout bốn loại phòng/capacity 2–12, ghế lẻ, tranh ghế, HTTP range, đường đi tránh ghế khác, chuyển động/reconnect/host và timeline.
- `npm run test:integration`: qua trên database `cineverse_test`; kiểm tra tài khoản, khôi phục ngoại hình sau đăng nhập, lịch sử riêng, quyền sở hữu, token mời, tranh ghế Socket.io, host control, reconnect và chặn origin khác.
- Bổ sung integration test cho upload sai định dạng, vượt giới hạn có/không Content-Length, private stream, byte-range/HEAD/416, chia sẻ file theo nguồn đang chọn. Dùng thư mục media QA riêng và dọn file theo ID sinh trong test.
- Bổ sung hồi quy polling không có Origin như trình duyệt sau khi browser QA phát hiện lỗi. Chỉ chấp nhận Origin cấu hình hoặc Sec-Fetch-Site cùng origin với host được cấu hình; session vẫn bắt buộc.
- Build production và kiểm tra TypeScript qua. Còn cảnh báo kích thước chunk Three.js (đã lazy-load) và chú thích tree-shaking từ Zod; chưa phải lỗi build.
- npm audit tại thời điểm cài đặt: không có lỗ hổng được báo cáo. Prisma có dependency công cụ phụ khuyến nghị Node 22; local Node 20.19 vẫn chạy generate/migrate/build/test, khuyến nghị Node 22 LTS khi triển khai.
- Browser QA với video hoa CC0 của MDN: đăng nhập/vào phòng, chọn thư viện, phát 2D, chọn ghế và tự chuyển camera, hiển thị video trên màn hình 3D, tua bằng bàn phím và về 2D với duy nhất một HTML video. Breakpoint 390px không tràn ngang và hiển thị video 3D. Ảnh ở `.local/qa-proof/`, không commit dữ liệu QA.
- Chưa xác minh mic/loa phần cứng, chất lượng voice/TURN, đồng bộ phim qua hai mạng, context loss hoặc FPS trên điện thoại thật. Các kiểm thử hiện tại không thay thế các phép đo đó.

## Việc còn lại

- Kiểm thử 2–3 thiết bị trên hai mạng, cấu hình TURN và đo sai lệch phim thực tế.
- Spatial voice/ducking, reactions, đi tự do/joystick, asset GLB và animation nâng cao.
- Quota/quản lý media, phụ đề, backup cả DB lẫn media và triển khai HTTPS trên Mac mini.
- State phòng/ghế/timeline hiện còn ở RAM; restart server hoặc phòng trống sau grace period đặt lại phiên. Nhân vật, cấu hình và lịch sử đã lưu vẫn giữ nguyên.
