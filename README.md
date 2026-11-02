# CineVerse

Rạp phim riêng cho 2–3 người, với nhân vật 3D và dữ liệu nhân vật lưu lâu dài trong PostgreSQL.

## Chạy local

Yêu cầu: Node.js >=20.19 (khuyến nghị Node 22 LTS), npm và PostgreSQL. PostgreSQL trên máy phát triển hiện dùng port 5432.

```powershell
npm install
Copy-Item .env.example .env
# Điền DATABASE_URL trong .env bằng thông tin PostgreSQL của bạn.
npm run db:generate
npm run db:setup
npm run dev
```

Nếu `.env` đã tồn tại, giữ file hiện tại, không sao chép đè. Mật khẩu có ký tự đặc biệt phải được URL-encode trong DATABASE_URL. Không dùng mật khẩu database làm mật khẩu đăng nhập ứng dụng.

- Web: http://127.0.0.1:5173
- API: http://127.0.0.1:3001/api/health
- Database ứng dụng: `cineverse`; kiểm thử: `cineverse_test`.

**Kiểm tra bằng điện thoại cùng Wi-Fi:** chạy `npm run dev:lan`, rồi mở URL mạng được in trong terminal. Máy này hiện dùng `http://192.168.86.13:5173`. Xem [hướng dẫn LAN, firewall và HTTPS cho micro](docs/mobile-lan.md). `npm run dev` vẫn chỉ mở localhost.

Đăng ký tài khoản → đặt tên/ngoại hình → lưu nhân vật → Phòng chiếu → tạo phòng → gửi link mời. Người được mời cần có tài khoản và nhân vật. Host tải MP4/WebM vào thư viện, rồi bấm **Chiếu phim**. Có thể dùng URL HTTP(S) trực tiếp ở chế độ 2D; nguồn có giới hạn đăng nhập/CORS/DRM có thể không phát được.

## Đã triển khai

- Đăng ký/đăng nhập, hash mật khẩu scrypt, cookie phiên HttpOnly, kiểm tra origin và giới hạn request.
- Nhân vật procedural 3D: tên, màu da, tóc, màu tóc, trang phục, kính. Lưu/khôi phục từ database; lịch sử thay đổi và vật phẩm khởi đầu.
- Tạo và lưu bốn loại phòng với số slot độc lập giới hạn người tham gia; preview 2D và sơ đồ 3D cơ bản. Ghế đôi có slot riêng và khung ghế chung.
- Link mời có token ngẫu nhiên, token hash ở server; server xác thực quyền, tranh ghế atomic, host transfer và reconnect giữ ghế 30 giây.
- Timeline phim server-authoritative, host play/pause/seek, hiệu chỉnh drift, bắt kịp khi vào lại và lịch sử tiến độ.
- Thư viện phim theo tài khoản, upload theo luồng, giới hạn dung lượng, phát private có byte-range/HEAD. Người trong phòng chỉ được xem file đang được chọn; biết URL không thay thế quyền xem.
- VideoTexture dùng cùng HTML video cho 2D/3D; camera toàn rạp/từ ghế/tập trung, reduced motion, đèn tối khi phát. Chế độ tập trung thu gọn điều khiển và có nút mở lại; Esc trở về 2D.
- Avatar đi theo lối giữa và lối ngang đến ghế, có bước chân và tư thế ngồi. Ghế được giữ ngay khi server chấp nhận; không đổi chỗ giữa chặng. Reconnect tiếp tục từ mốc chuyển động server.
- Voice WebRTC mesh, mute/deafen, chọn micro và loa voice trên trình duyệt hỗ trợ; cấu hình STUN/TURN từ server. Chưa xác minh phần cứng âm thanh hoặc thoại qua các mạng thực tế.
- Lazy-load 3D, demand rendering, giới hạn DPR, bố cục responsive và thông báo lỗi media/WebGL.

## Giới hạn bản prototype

- Di chuyển theo waypoint đến/ra ghế; chưa có đi tự do, joystick, va chạm avatar với nhau hoặc animation skeletal hoàn chỉnh.
- VideoTexture áp dụng cho phim tự host. URL ngoài giữ phát 2D để tránh hỏng nguồn không hỗ trợ CORS. Codec trong MP4/WebM vẫn phải được trình duyệt hỗ trợ; chưa có transcode.
- Chưa có spatial voice/ducking, reactions hoặc tương tác Couple. Chọn loa chỉ áp dụng voice; phim dùng đầu ra mặc định của trình duyệt.
- Ngoại hình trang bị lưu trong JSONB có kiểm tra vật phẩm sở hữu. Chưa có cửa hàng, progression, nhiều nhân vật/tài khoản hoặc giao diện inventory riêng.
- Phòng/cấu hình và lịch sử bền vững; danh sách online, ghế và timeline hiện tại nằm trong bộ nhớ. Server restart hoặc phòng không còn người sau grace period sẽ đặt lại phiên xem; lịch sử đã lưu vẫn còn.
- Chưa có quota tổng dung lượng từng tài khoản, xóa phim qua UI, backup tự động, HTTPS/reverse proxy hay triển khai Mac mini.
- Chưa đo FPS trên điện thoại thật, chưa kiểm chứng voice/TURN hoặc video sync trên hai mạng khác nhau.

## Kiểm thử

```powershell
npm run typecheck
npm test
npm run test:integration
npm run build
```

Integration runner chỉ chấp nhận PostgreSQL localhost và buộc database `cineverse_test`, tạo database nếu thiếu, áp dụng migration/seed. Tài khoản QA ngẫu nhiên được dọn theo đúng ID sinh trong test. Không drop database và không ghi vào `cineverse`.

## Cấu trúc

File phim mặc định nằm trong `media/` tại root, không public dưới static và bị Git bỏ qua. Có thể đặt `MEDIA_ROOT` và `MAX_MEDIA_BYTES` trong `.env` (mặc định 4 GiB/file). Database lưu metadata; backup/chuyển máy cần giữ cả PostgreSQL và thư mục media. Kiểm tra chữ ký container chỉ phát hiện file sai loại; player vẫn có thể báo codec không được hỗ trợ.

Nếu cập nhật từ bản trước: chạy `npm run db:generate` và `npm run db:migrate` trước khi khởi động.

```text
apps/web/          React, Three.js, UI, player, voice
apps/server/       Express, auth, Socket.io, room state
packages/shared/   Zod schemas, events, layout generator
prisma/            PostgreSQL schema + migrations
tests/             Domain + database/socket integration tests
.agents/skills/    Skill đã ghim nguồn + 4 skill CineVerse
docs/              Nguồn skill và tiến độ triển khai
```

## Production local

```powershell
npm run build
# Đặt NODE_ENV=production và APP_ORIGIN=https://ten-mien-cua-ban trong .env
npm start
```

Production phục vụ web và Socket.io từ cùng API port, bind loopback. Cần reverse proxy HTTPS để truy cập Internet và cookie Secure. Không đặt port PostgreSQL ra Internet. TURN_URL, TURN_USERNAME, TURN_PASSWORD là cấu hình tùy chọn ở server; chưa được cấu hình trong môi trường hiện tại.

Git hiện là repository local; chưa tạo remote GitHub hoặc publish ứng dụng.
