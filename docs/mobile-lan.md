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
