# Kiểm tra CineVerse bằng điện thoại cùng mạng

Ưu tiên điện thoại: mặc định mở player 2D để nhẹ máy, chạm chọn ghế/đổi góc nhìn, vùng chạm tối thiểu 44px, chữ ô nhập 16px để tránh iPhone tự zoom. Có nút toàn màn hình cho video 2D khi trình duyệt hỗ trợ. Cần đo thêm trên máy thật trước khi kết luận hiệu năng.

## Chạy nhanh qua Wi-Fi

```powershell
npm run dev:lan
```

Điện thoại và máy chạy server dùng cùng Wi-Fi. Mở URL IPv4 được terminal in ra trong Safari/Chrome. Ví dụ tại thời điểm cấu hình máy này: `http://192.168.86.13:5173`.

- PC cũng có thể dùng `http://localhost:5173`. Link mời tạo trên localhost sẽ dùng địa chỉ LAN để người nhận mở được.
- API, video và Socket.io đều đi qua cổng web 5173; điện thoại không kết nối trực tiếp port 3001 hoặc PostgreSQL 5432.
- Địa chỉ IP có thể đổi khi đổi Wi-Fi/router. Chạy lại lệnh sau khi đổi mạng. `npm run lan:info` chỉ in địa chỉ, không khởi động server.
- Nếu có nhiều card mạng, đặt `LAN_IP=192.168.x.x` trong `.env`. Chỉ nhận IPv4 nội bộ đang gắn trên máy. Tự động bỏ qua ZeroTier/VPN/adapter ảo trừ khi bạn chọn IP cụ thể.
- Chạy `npm run dev` vẫn chỉ mở localhost. Dừng dev LAN bằng Ctrl+C.

## Nếu điện thoại không kết nối được

### Tự cập nhật khi sửa code

`npm run dev:lan` chạy đồng thời Vite HMR và `tsx watch`. Giữ trang trên điện thoại mở: thay đổi React/CSS tự cập nhật qua WebSocket trên cổng 5173. Thay đổi backend, mã dùng chung hoặc `.env` tự khởi động lại API; Socket.io của trang tự kết nối lại. Trạng thái phòng tạm trong RAM có thể được tạo lại sau khi API khởi động, tài khoản và nhân vật vẫn lưu trong PostgreSQL.

Không cần build hay chạy lại lệnh sau mỗi lần sửa. Nếu dùng thư mục đồng bộ hoặc ổ mạng khiến file watcher không nhận thay đổi, thêm `DEV_WATCH_POLL=1` vào `.env` rồi chạy lại dev LAN để bật polling cho frontend. Khi đổi IP Wi-Fi hoặc cấu hình khởi chạy, chạy lại lệnh để nhận địa chỉ mới. Trang bị hệ điều hành treo ở nền có thể cần mở lại tab để nhận cập nhật.

1. Kiểm tra Wi-Fi giống nhau, đúng URL/port 5173 và server vẫn đang chạy.
2. Tránh Wi-Fi khách có AP/client isolation; các thiết bị bị router cách ly sẽ không truy cập nhau được.
3. Kiểm tra firewall Windows. Script sau chỉ mở TCP 5173 từ LocalSubnet, không mở API/database, cần **PowerShell Run as administrator**:

```powershell
cd C:\Users\vuhon\Documents\CineVerse
.\scripts\allow-lan-firewall.ps1
```

Script mặc định dùng profile Private. Mạng Wi-Fi máy này hiện là **Public**; nếu vẫn giữ profile đó, dùng rule giới hạn đúng địa chỉ Wi-Fi:

```powershell
.\scripts\allow-lan-firewall.ps1 -NetworkProfile Public -LocalAddress 192.168.86.13
```

Nếu IP thay đổi, xóa rule cũ `CineVerse-Dev-LAN-5173-Public` (hoặc `-Private`) trong Windows Defender Firewall và chạy lại với IP mới. Không tắt toàn bộ firewall. Script không tự nâng quyền, đổi profile mạng hoặc ghi đè rule đã có. Phiên triển khai không có quyền Administrator nên chưa tạo được rule này.

## Xem bằng link YouTube

Mọi người mở **Gửi video** hoặc **Hàng chờ**, dán link YouTube và bấm **Thêm vào hàng chờ**.
Có thể đặt tên video, bình chọn để đưa lên đầu, bỏ phiếu bằng cách bấm lại.
Chủ phòng bấm **Bắt đầu chiếu** / **Bài tiếp theo**. Thêm video không thay phim đang chiếu.
Mỗi phòng tối đa 50 mục, từ chối link YouTube trùng dù dùng dạng link khác.
Chủ phòng hoặc người gửi được xóa mục; mọi người có thể gửi phim/ảnh thuộc thư viện riêng.
Nhận link watch, youtu.be, Shorts và live có mã video. Phát/dừng/tua bằng thanh điều khiển
của phòng; người tham gia nhận timeline từ server. Nếu điện thoại chặn tự phát, chạm
**Bật phát YouTube và âm thanh**. YouTube dùng trình phát nhúng chính thức, có chế độ 2D và ghép vào cảnh rạp bằng lớp giao diện, không lấy stream để tạo VideoTexture.
Video riêng tư, giới hạn quyền xem hoặc không cho nhúng có thể không phát được.

Khi video kết thúc trên máy chủ phòng đang kết nối, phòng tự chuyển sang mục tiếp theo.
Hàng chờ, phiếu và nguồn hiện tại được lưu vào `Room.mediaState` sau thay đổi.
Để giữ trạng thái qua khởi động lại API cần migration `20261102110000_room_media_state`.
Thành viên và chuyển động vẫn là trạng thái runtime; reconnect ngắn giữ ghế theo thời gian chờ.

**Chiếu ảnh** nhận JPG/PNG/WebP tối đa 10 MB. Ảnh được kiểm tra định dạng, lưu bằng API
và đưa vào hàng chờ; khi chọn sẽ hiện trên màn chiếu 3D hoặc 2D. Ảnh không tự hết giờ:
chủ phòng bấm **Bài tiếp theo**. HEIC cần xuất sang JPG; chưa có chuyển mã ảnh HEIC.

**Tủ đồ** đổi tên, da, tóc, trang phục/phụ kiện sở hữu; API kiểm tra quyền và lưu vào tài khoản,
sau đó socket tải lại nhân vật đã lưu và cập nhật cho cả phòng.

**Tùy chọn** có độ nét rạp 3D Mượt/Cao (DPR 1 hoặc tối đa 1.5, tắt/bật bóng đổ).
Chưa có số đo pin/FPS trên iPhone thật. Chất lượng stream YouTube do YouTube tự chọn.
Phụ đề YouTube có lựa chọn ưu tiên tiếng Việt nếu video cung cấp; lựa chọn mặc định theo YouTube.
Video MP4/WebM 2D có thể chọn/gỡ file VTT tối đa 1 MB trên máy riêng, không tải file đó lên server.

Upload hiện nhận MP4/WebM; video MOV từ iPhone cần chuyển sang MP4 (H.264/AAC).
Chưa có chuyển mã video tự động trên server.

## Micro/voice cần HTTPS trên điện thoại

HTTP theo IP LAN dùng được để kiểm tra giao diện, tài khoản, ghế và phim. Trình duyệt yêu cầu secure context cho micro; localhost trên PC là ngoại lệ, địa chỉ IP LAN qua HTTP không phải ngoại lệ. [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

Đã có lệnh:

```powershell
npm run dev:lan:https
```

Lệnh này cần cặp chứng chỉ/khóa ở `.local/certs/lan.pem` và `.local/certs/lan-key.pem` hoặc đường dẫn `LOCAL_TLS_CERT`, `LOCAL_TLS_KEY` trong `.env`.

Có thể chuẩn bị bằng [mkcert chính chủ](https://github.com/FiloSottile/mkcert). Sau khi bạn cài công cụ và CA phát triển trên máy:

```powershell
New-Item -ItemType Directory -Force .local/certs
mkcert -cert-file .local/certs/lan.pem -key-file .local/certs/lan-key.pem localhost 127.0.0.1 192.168.86.13
npm run dev:lan:https
```

Điện thoại phải tin cậy CA phát triển đó. Theo hướng dẫn mkcert, cài **rootCA.pem** trên điện thoại; iOS cần bật full trust cho CA trong cài đặt. Không sao chép/chia sẻ **rootCA-key.pem** hoặc private key. Nếu đổi IP, tạo chứng chỉ mới có IP mới. Chưa tự cài mkcert hoặc thay đổi trust store của máy/điện thoại.

Không dùng thao tác bỏ qua cảnh báo chứng chỉ để thay cho việc thiết lập HTTPS được tin cậy. Khi HTTPS được thiết lập đúng, mở URL `https://<IP>:5173` rồi cấp quyền micro theo thao tác của bạn.

## Rạp đông người và bố cục

Khi tạo phòng có thể nhập 2–300 ghế và giới hạn người tham gia độc lập (không vượt số ghế). Chỉnh 2–20 ghế mỗi hàng, khoảng cách 2–3,5m và bậc cao 0–0,6m. Các giá trị được lưu trong PostgreSQL; phòng cũ giữ bố cục 4 ghế/hàng, 2,2m và 0,18m. Rạp trên 80 ghế dùng mô hình ghế đơn giản vẽ theo lô. Chưa kiểm thử tải 100 người thật; voice mesh hiện tại không phù hợp để cam kết 100 người bật micro cùng lúc.

Hai terminal riêng: terminal FE chạy `npm run dev:lan:fe`, terminal BE chạy `npm run dev:lan:be`. Hoặc chỉ dùng một terminal `npm run dev:lan` để chạy cả hai. Dừng phiên cũ bằng Ctrl+C trước khi đổi cách chạy để tránh trùng cổng.
