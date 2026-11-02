# TÀI LIỆU KIẾN TRÚC DỰ ÁN & TỐI ƯU TRẢI NGHIỆM NGƯỜI DÙNG (UX/UI)

**Dự án:** Web 3D Virtual Cinema & Watch Party  
**Hạ tầng:** Self-hosted trên Mac mini M4, mạng gia đình VNPT  
**Quy mô vận hành ban đầu:** 2–3 người dùng đồng thời; hỗ trợ cấu hình phòng có nhiều ghế hơn số người đang online  
**Trạng thái:** Đặc tả định hướng để AI/Codex lập kế hoạch và triển khai; chưa phải hệ thống đã hoàn thiện  
**Nguyên tắc:** Ưu tiên trải nghiệm xem phim ổn định, sau đó mới tăng mức độ chân thực và hiệu ứng.

---

## PHẦN I. MỤC TIÊU VÀ PHẠM VI

### 1.1 Mục tiêu sản phẩm

Tạo một rạp chiếu phim ảo trên trình duyệt, nơi 2–3 người có thể vào cùng một phòng, điều khiển avatar, chọn ghế, xem video đồng bộ và trò chuyện bằng giọng nói. Cảm giác như đi xem phim ngoài đời: có sảnh chờ, màn hình lớn, lối đi, ghế đơn/đôi, ghế VIP và các tương tác xã hội.

### 1.2 Phạm vi MVP

- Tạo phòng riêng bằng link mời và mã phòng; giới hạn người tham gia.
- Chọn một trong bốn mẫu phòng: Standard, VIP, Couple, Private Lounge.
- Chọn sức chứa, bố cục ghế; phân biệt số **chỗ ngồi** và số **cụm ghế**.
- Avatar di chuyển, chọn ghế, đi tới ghế, ngồi và đứng lên.
- Đồng bộ trạng thái phòng, vị trí avatar, ghế và video.
- Phát video hợp lệ do chủ phòng cung cấp/tự host; đồng bộ play, pause, seek.
- Voice chat WebRTC với quyền bật/tắt mic và xử lý lỗi kết nối.
- Camera xem phim, HUD tối giản và chế độ xem 2D dự phòng.
- Hoạt động trên desktop và giao diện mobile cơ bản.

### 1.3 Ngoài phạm vi MVP

- Không cần thanh toán, bán vé, tài khoản công khai hay hàng trăm người dùng.
- Không cố phát lại nội dung DRM hoặc vượt qua hạn chế bản quyền/CORS của nền tảng video.
- Whisper riêng tư thực sự, tương tác ném đồ, ảnh kỷ niệm, ngả ghế nâng cao và hệ thống trang trí tùy biến là tính năng giai đoạn sau.

---

## PHẦN II. KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE)

```text
+-----------------------------------------------------------------------+
| CLIENT: DESKTOP / MOBILE BROWSER                                      |
| Three.js: 3D scene, avatar, camera, seat interactions                 |
| HTMLVideoElement: playback; VideoTexture when supported              |
| Socket.io Client: room, movement, seat, reactions, video control      |
| WebRTC: peer-to-peer voice; Web Audio API: spatial audio              |
| UI/HUD: create/join room, invite, seat map, chat, media controls      |
+-------------------------------+---------------------------------------+
                                | HTTPS / WSS / WebRTC
                                v
+-----------------------------------------------------------------------+
| MAC MINI M4                                                           |
| Reverse proxy + HTTPS termination                                     |
| Node.js + Express: app, static assets, API, authorized video delivery |
| Socket.io: rooms, signaling, server-authoritative state               |
| Room Generator: layout presets, seat map, collision/navmesh metadata  |
| Room State: occupants, seat claims, playback timeline, host rights    |
| Persistence: JSON/SQLite for presets, room configs, optional history  |
+-------------------------------+---------------------------------------+
                                |
                                v
+-----------------------------------------------------------------------+
| NETWORK: VNPT / INTERNET                                              |
| Public IPv4 or IPv6/DDNS; router rules OR suitable tunnel             |
| STUN for NAT discovery; TURN fallback for WebRTC relay                |
| Secure room invite token; access control and rate limiting           |
+-----------------------------------------------------------------------+
```

**Phân định trách nhiệm:** Three.js render trên GPU của **thiết bị người xem**, không phải GPU Mac mini. Mac mini chủ yếu phục vụ web, API, signaling và có thể phục vụ video; băng thông upload của mạng nhà có thể là nút thắt nếu nhiều client stream video trực tiếp.

### 2.1 Đồng bộ video không đồng nghĩa truyền video bằng WebRTC

- Dùng **Socket.io** để đồng bộ lệnh và mốc thời gian phát (play/pause/seek/current timeline).
- Dùng **HTTP(S)**/range requests hoặc cơ chế phát video hợp lệ khác để mỗi client lấy luồng video; cân nhắc HLS nếu cần adaptive bitrate.
- Dùng **WebRTC** cho voice chat (và signaling thông qua Socket.io). Không cần WebRTC để truyền nội dung phim trong MVP.
- Host có quyền điều khiển phát phim; server xác thực quyền và phát tán trạng thái chuẩn.

### 2.2 Kết nối và bảo mật

- Bắt buộc HTTPS/WSS khi truy cập từ Internet, đặc biệt để trình duyệt cho phép micro.
- Kiểm tra WAN IP và CGNAT của VNPT trước khi cấu hình port forwarding. Nếu không có public IPv4, cân nhắc IPv6 hoặc tunnel/reverse proxy phù hợp.
- Dùng STUN + TURN dự phòng (TURN có thể phát sinh băng thông relay).
- Mã phòng không thay thế xác thực: dùng invite token khó đoán, hết hạn hoặc có thể thu hồi; kiểm tra quyền ở server.
- Validate dữ liệu Socket.io, giới hạn tốc độ sự kiện, giới hạn số thành viên/phòng, không tin tọa độ hay quyền do client tự khai.
- Giới hạn truy cập media theo chính sách mong muốn; không công khai đường dẫn tệp riêng tư nếu không chủ ý.

---

## PHẦN III. HỆ THỐNG TẠO PHÒNG ĐỘNG (DYNAMIC CINEMA ROOM SYSTEM)

### 3.1 Bốn loại phòng

| Loại phòng | Đặc trưng | Ghế hỗ trợ | Sức chứa gợi ý (cấu hình, không phải giới hạn người online) |
|---|---|---|---|
| **Standard Cinema** | Rạp truyền thống, hàng ghế, lối đi, bậc cao dần | Ghế đơn; có thể thêm ghế đôi | 2–12 chỗ |
| **VIP Cinema** | Ghế rộng, khoảng cách hàng lớn, ánh sáng sang trọng | VIP đơn, VIP đôi, ghế ngả | 2–8 chỗ |
| **Couple Cinema** | Rạp ấm cúng, ghế đôi, gần màn hình, tương tác thân mật | Loveseat, ghế đôi, ghế đơn | 2–6 chỗ |
| **Private Lounge** | Home theater, sofa, bàn nhỏ, bố cục linh hoạt | Sofa, ghế đơn, ghế đôi, VIP | 2–10 chỗ |

Các con số trên là **preset UX**, không phải hard limit. Ví dụ: 2 người vẫn có thể xem trong rạp 12 ghế. Hệ thống phải tách `capacity` (số chỗ ngồi) khỏi `maxParticipants` (giới hạn người được vào) và `seatGroupCount` (số cụm ghế vật lý).

### 3.2 Quy trình tạo phòng

1. Nhập tên phòng, chọn mẫu Standard/VIP/Couple/Lounge.
2. Chọn **sức chứa**, **giới hạn người tham gia** (mặc định 3), riêng tư và tùy chọn đặt mật mã nếu cần.
3. Chọn ghế đơn, ghế đôi, VIP, sofa hoặc chế độ phối hợp.
4. Tự sinh bố cục phòng, hàng ghế, lối đi, vị trí camera, điểm spawn và điểm tương tác.
5. Xem trước sơ đồ 2D và mô hình 3D; sửa cấu hình trước khi tạo.
6. Tạo phòng, nhận link mời có token, vào sảnh chờ và bắt đầu chọn ghế.
7. Có thể lưu preset yêu thích để dùng lại.

### 3.3 Quy tắc sinh bố cục

- Ghế là **seat group** gồm một hoặc nhiều **seat slot**. Ghế đôi có 2 slot độc lập, sofa có số slot xác định.
- Mỗi slot có `seatId` duy nhất, tọa độ và hướng ngồi riêng; không cho hai người chiếm cùng một slot.
- Phòng phải có lối đi đủ rộng, không để avatar đi xuyên ghế; các hàng sau có thể nâng cao để không chắn tầm nhìn.
- Bố cục cân đối theo chiều rộng màn hình, khoảng cách xem, góc nhìn, số hàng và loại ghế.
- Đối với sức chứa lẻ trong chế độ ưu tiên ghế đôi, có thể thêm một ghế đơn; không tạo slot vượt sức chứa nếu không có xác nhận.
- Bố cục ghế và dữ liệu collision/navmesh phải cùng xuất phát từ một cấu hình chuẩn để tránh lệch giữa render và logic server.

### 3.4 Đặt ghế và chuyển ghế

- Sơ đồ ghế kiểu rạp thực: ghế trống, đang có người, ghế mình chọn, ghế đôi, ghế VIP.
- Người dùng click một slot; server kiểm tra và **claim slot theo cơ chế atomic**, sau đó broadcast cho phòng.
- Avatar đi đến ghế bằng đường hợp lệ, xoay người, phát animation ngồi; có trạng thái `walkingToSeat`, `seated`, `standing`.
- Nếu đường đi lỗi hoặc thiết bị yếu, dùng animation ngắn/fallback an toàn thay vì kẹt vĩnh viễn.
- Đổi ghế phải được xử lý nhất quán: xác nhận ghế mới rồi giải phóng ghế cũ, tránh chiếm hai ghế.
- Khi ngắt kết nối, có thể giữ ghế tạm thời trong một khoảng reconnect grace period; hết hạn mới giải phóng.
- Ghế đôi có thể có animation tựa vai/nắm tay **khi cả hai người cùng đồng ý**, không ép tương tác.

### 3.5 Ví dụ cấu hình phòng (định hướng schema)

```json
{
  "roomId": "cinema-01",
  "name": "Rap phim cua chung minh",
  "roomType": "couple",
  "capacity": 5,
  "maxParticipants": 3,
  "privacy": "invite-only",
  "seatGroups": [
    { "groupId": "A1", "type": "loveseat", "slots": ["A1-L", "A1-R"] },
    { "groupId": "A2", "type": "loveseat", "slots": ["A2-L", "A2-R"] },
    { "groupId": "A3", "type": "standard", "slots": ["A3"] }
  ],
  "theme": "warm-cozy",
  "video": { "sourceId": null, "state": "paused", "positionSeconds": 0 }
}
```

**Lưu ý:** Đây là ví dụ hợp đồng dữ liệu; khi triển khai cần thêm tọa độ 3D, hướng ghế, kích thước/collision, version schema, timestamp và validation.

---

## PHẦN IV. UX/UI VÀ HÀNH VI MÔ PHỎNG RẠP THẬT

### 4.1 Spatial Awareness

- Camera third-person để quan sát avatar và bạn bè trong phòng.
- Click-to-move trên desktop; virtual joystick trên mobile, không che màn hình phim.
- Khi chọn ghế, camera theo avatar đi tới; khi ngồi, chuyển mượt sang góc nhìn từ ghế.
- **Smart Cinematic Camera:** chế độ `Explore`, `Seated`, `Cinema Focus` và quay lại `Explore` khi đứng lên.
- Tránh motion sickness: cho phép giảm animation camera, tắt rung/lắc và điều chỉnh độ nhạy.

### 4.2 Cognitive Load Reduction

- HUD tự thu gọn khi phim chạy; chỉ mở khi hover, chạm hoặc dùng phím tắt.
- Các thao tác cốt lõi luôn tìm được: mic, volume, chat, danh sách người, đổi ghế, thoát phòng, play/pause nếu có quyền.
- Trên mobile, ưu tiên nút lớn, vùng chạm rõ, điều khiển camera đơn giản.
- Có **2D Focus Mode**: video HTML hiển thị trực tiếp thay vì video texture 3D khi GPU yếu hoặc trình duyệt không hỗ trợ.

### 4.3 Hành trình người dùng

1. **Lobby:** Thấy avatar người khác, poster/phim được chọn, trạng thái kết nối.
2. **Choose Seat:** Chọn ghế qua sơ đồ 2D hoặc click trực tiếp ghế 3D.
3. **Walk & Sit:** Avatar di chuyển đến ghế và ngồi; camera tự chuyển chế độ.
4. **Watch Together:** Đèn tối dần, video đồng bộ, HUD thu gọn, voice chat hoạt động.
5. **After Movie Lounge:** Đèn sáng trở lại, có thể chấm điểm phim, trò chuyện và lưu kỷ niệm (giai đoạn sau).

### 4.4 Âm thanh

- **Social Mode:** Proximity voice với suy giảm âm lượng theo khoảng cách; có giới hạn âm lượng tối thiểu/tối đa hợp lý.
- **Cinema Mode:** Voice vẫn nghe rõ khi đang xem, không bị tắt hẳn vì khoảng cách ghế.
- **Whisper Mode (sau MVP):** Kênh riêng cho người được chọn; nếu cần riêng tư thật sự, phải phân tách đường truyền/quyền nhận âm thanh, không chỉ giảm volume ở client khác.
- Tùy chọn **ducking**: giảm âm lượng phim nhẹ khi có người nói, rồi phục hồi từ từ.
- Người dùng có quyền mute, deafen, tắt spatial audio, chọn thiết bị micro/loa nếu trình duyệt hỗ trợ.

---

## PHẦN V. TÍNH NĂNG TƯƠNG TÁC & CẢM XÚC

### 5.1 Ưu tiên gần MVP

1. **Emotes & Reactions:** vỗ tay, cười, tim, ngạc nhiên, buồn ngủ; hiệu ứng nhỏ gần avatar, tự biến mất và không che phim.
2. **Avatar Micro-interactions:** chớp mắt, đổi tư thế ngồi, quay đầu nhẹ về người đang nói, cầm nước/bỏng ngô.
3. **Ambient Cinema Lighting:** phòng tối dần khi play, sáng nhẹ khi pause; ánh sáng hắt theo màu phim ở tần suất lấy mẫu thấp, có thể tắt để tiết kiệm GPU.
4. **Shared Popcorn & Drinks:** vật phẩm ảo, động tác đưa nước/ăn bỏng ngô; không ảnh hưởng điều khiển phim.
5. **Couple Interactions:** tựa vai, nắm tay, nâng tay vịn ghế đôi; cả hai chủ động chấp nhận tương tác.

### 5.2 Sau MVP

6. **Lighthearted Props:** ném bỏng ngô/đồ vật ảo với giới hạn tần suất và tùy chọn tắt hiệu ứng.
7. **Movie Night Memories:** lịch sử xem, ngày giờ, rating, ảnh avatar (chỉ lưu/chia sẻ với sự đồng ý).
8. **Personal Cinema Themes:** thay ghế, thảm, màu đèn, vật trang trí, preset phòng.
9. **VIP Recliner:** animation ngả lưng, gác chân và điều chỉnh tư thế.
10. **Vote Movie:** đề xuất phim, bình chọn, danh sách xem tiếp theo.

---

## PHẦN VI. ĐỒNG BỘ MULTIPLAYER, VIDEO VÀ PHỤC HỒI KẾT NỐI

### 6.1 Nguyên tắc server-authoritative

- Server sở hữu trạng thái chuẩn của phòng, danh sách người, quyền host, ghế và timeline phim.
- Client gửi **yêu cầu**; server xác thực và phát **kết quả**. Không tin sự kiện `seatOccupied`, `hostChanged` hoặc `videoSeeked` do client tự quyết định.
- Tọa độ avatar có thể được kiểm tra tốc độ và va chạm; client dùng interpolation để chuyển động mượt.
- Tần suất cập nhật avatar tham khảo 10–15 Hz; điều chỉnh sau khi đo thực tế.

### 6.2 Timeline phim

Ví dụ trạng thái:

```json
{
  "roomId": "cinema-01",
  "sourceId": "movie-001",
  "isPlaying": true,
  "positionSeconds": 125.5,
  "playbackRate": 1,
  "serverUpdatedAtMs": 1783000000000,
  "revision": 42,
  "hostId": "user-01"
}
```

- Khi đang play, client suy ra thời gian mục tiêu dựa trên thời gian đã trôi qua kể từ mốc server (có hiệu chỉnh sai lệch đồng hồ/RTT).
- Lệch nhỏ: điều chỉnh playbackRate nhẹ trong khoảng cho phép; lệch lớn: seek.
- Khi pause hoặc seek, tăng `revision` và broadcast; sự kiện cũ không được ghi đè sự kiện mới.
- Khi mới vào hoặc reconnect, lấy snapshot chuẩn và tự bắt kịp vị trí phim.
- Xử lý autoplay policy: người dùng có thể phải bấm một lần để cho phép phát có âm thanh.

### 6.3 Reconnect

- Tạo session identity ổn định trong thời gian phiên; không dùng socket ID làm danh tính duy nhất.
- Khi rớt mạng, hiển thị trạng thái đang kết nối lại; tạm giữ ghế trong grace period.
- Sau reconnect: xác thực lại, nhận room snapshot, khôi phục ghế nếu còn quyền, sync timeline, tái thiết lập WebRTC voice nếu cần.
- Khi host rời phòng: có chính sách chuyển host hoặc kết thúc phòng rõ ràng.

### 6.4 Video source

- MVP ưu tiên file video do người dùng có quyền sử dụng và tự host hoặc URL trực tiếp tương thích.
- Hỗ trợ byte-range để tua; cân nhắc HLS khi cần nhiều mức chất lượng.
- VideoTexture có thể bị hạn chế bởi CORS, DRM và hiệu năng thiết bị; luôn có HTML video 2D fallback.
- Không giả định có thể nhúng/phát trực tiếp mọi nền tảng streaming thương mại.

---

## PHẦN VII. TỐI ƯU HIỆU NĂNG VÀ HẠ TẦNG

### 7.1 Render

| Hạng mục | Hướng triển khai |
|---|---|
| FPS mục tiêu | Desktop 60 FPS; mobile 30–60 FPS tùy thiết bị |
| Ghế lặp lại | InstancedMesh khi cùng geometry/material; ghế có animation riêng dùng instance phù hợp hoặc mesh riêng |
| Ánh sáng | Baked lighting + số ít đèn động; bloom vừa phải |
| Video ambient | Lấy mẫu màu tần suất thấp, cho phép tắt |
| Avatar | glTF/GLB, animation đơn giản, LOD khi cần |
| Texture | Nén KTX2 nếu pipeline hỗ trợ, hạn chế texture quá lớn |
| Chuyển động | Interpolation giữa các snapshot mạng |
| Cấu hình | Auto / Low / Medium / High; giảm pixel ratio khi GPU yếu |

### 7.2 Network & media

- Đo upload thực tế của VNPT, không chỉ tốc độ download.
- Ví dụ: 3 người cùng lấy một phim từ Mac mini có thể tạo ba luồng outbound riêng; cần tính tổng bitrate và overhead.
- Có giới hạn bitrate/độ phân giải phù hợp; tránh transcode thời gian thực nếu không cần.
- Kiểm thử ngoài mạng nhà: 4G/5G, Wi-Fi khác, NAT nghiêm ngặt, TURN fallback.
- Log trạng thái Socket.io, WebRTC ICE, lỗi media và thời gian tải scene để chẩn đoán.

---

## PHẦN VIII. GỢI Ý CẤU TRÚC MÃ NGUỒN

```text
virtual-cinema/
  apps/
    web/
      src/
        scene/            # Three.js, room presets, lighting, cameras
        avatars/          # Movement, animation, interactions
        seats/            # Seat map, selection UI, client seat logic
        media/            # HTML video, video texture, sync controller
        voice/            # WebRTC, spatial audio, device controls
        ui/               # Lobby, HUD, invite, settings, mobile
        network/          # Socket.io client, reconnection
    server/
      src/
        rooms/            # Room state, permissions, lifecycle
        layouts/          # Generator, seat group/slot validation
        seats/            # Atomic seat claims, release, reconnect
        playback/         # Authoritative video timeline
        signaling/        # WebRTC signaling
        security/         # Invite tokens, validation, rate limiting
        persistence/      # Room presets and optional history
  packages/
    shared/               # Shared types, schemas, event contracts
  docs/
    architecture.md
    api-events.md
    acceptance-tests.md
```

Đây là gợi ý tổ chức, có thể dùng TypeScript toàn stack và schema validation (ví dụ Zod) cho payload. Không cần microservices, Kubernetes hay cơ sở dữ liệu phức tạp ở quy mô 2–3 người.

---

## PHẦN IX. LỘ TRÌNH TRIỂN KHAI (ROADMAP)

**Lưu ý:** Các mốc ngày là ước lượng cho prototype có asset sẵn và phạm vi chặt chẽ, không phải cam kết hoàn thiện sản phẩm.

### Giai đoạn 1 — Hạ tầng và nền tảng (Ngày 1–2)

- Khởi tạo frontend, backend, TypeScript, cấu hình môi trường.
- Kiểm tra WAN/CGNAT VNPT, HTTPS, DNS/tunnel/port forwarding phù hợp.
- Xây phòng riêng, token mời, kết nối Socket.io, quyền host.
- Dựng scene 3D mẫu có màn hình, sàn và camera.

**Nghiệm thu:** Hai thiết bị ở hai mạng khác nhau vào được cùng phòng qua HTTPS, có kết nối real-time.

### Giai đoạn 2 — Room Generator và ghế (Ngày 3–5)

- Tạo 4 preset Standard/VIP/Couple/Lounge.
- Xây seat group/seat slot và generator bố cục từ capacity.
- UI tạo phòng, preview sơ đồ ghế 2D.
- Click-to-move, collision/navigation cơ bản, ngồi/đứng/đổi ghế.
- Server atomic seat claims và xử lý reconnect giữ ghế.

**Nghiệm thu:** Hai client không chiếm trùng một slot; ghế đôi có đúng hai slot; avatar không xuyên qua ghế.

### Giai đoạn 3 — Xem phim đồng bộ (Ngày 6–7)

- Tích hợp nguồn video hợp lệ, play/pause/seek do host điều khiển.
- Server-authoritative timeline, snapshot, drift correction.
- Camera Seated/Cinema Focus và HTML video 2D fallback.
- HUD tự thu gọn, trạng thái tải video, thông báo autoplay.

**Nghiệm thu:** Hai client xem cùng nội dung, sai lệch được tự sửa; vào muộn và reload có thể bắt kịp.

### Giai đoạn 4 — Voice và ổn định (Ngày 8–10)

- WebRTC voice, STUN/TURN, mute/deafen, thiết bị audio.
- Social/Cinema audio mode; spatial audio cơ bản.
- Reconnect signaling, xử lý lỗi mic và media.
- Test desktop/mobile, mạng ngoài, logging và performance.

**Nghiệm thu:** 2–3 người nghe được nhau trên các mạng khác nhau; rớt mạng vào lại không mất trạng thái phòng không cần thiết.

### Giai đoạn 5 — Trải nghiệm nâng cao (Sau MVP)

- Reactions, avatar micro-animation, ambient lighting.
- Ghế VIP ngả, Couple interactions có đồng thuận, đồ ăn/nước ảo.
- Whisper riêng tư, movie vote, memories, theme customization.
- Tối ưu asset, mobile, accessibility và polish animation.

---

## PHẦN X. TIÊU CHÍ NGHIỆM THU VÀ TÌNH HUỐNG KIỂM THỬ

1. **Tạo phòng:** Tạo đủ 4 loại phòng; capacity 2–12 (trong giới hạn preset) và maxParticipants độc lập.
2. **Ghế:** Ghế đôi gồm 2 slot, ghế đơn 1 slot; chọn cùng một slot từ 2 client chỉ 1 người thành công.
3. **Di chuyển:** Avatar đi tới ghế qua lối đi; đứng lên và đổi ghế không tạo trạng thái ma.
4. **Đồng bộ phim:** Play/pause/seek từ host đến các client; client vào muộn tự bắt kịp.
5. **Reconnect:** Reload hoặc ngắt mạng ngắn hạn khôi phục room state; hết grace period giải phóng ghế.
6. **Voice:** Mic permission, mute, lỗi ICE, TURN fallback và thiết bị mobile được xử lý có thông báo.
7. **UX:** Có camera xem phim, HUD không che video, mobile có joystick và chế độ 2D.
8. **Bảo mật:** Không thể vào phòng private nếu thiếu token; client không tự nhận quyền host hay chiếm ghế người khác.
9. **Hiệu năng:** Đo FPS, memory, băng thông, tải scene trên desktop/mobile; không chỉ dựa vào hiệu năng Mac mini.
10. **Phim:** Hỗ trợ seek/range và lỗi nguồn video; không cố vượt DRM/CORS.

---

## PHẦN XI. HƯỚNG DẪN DÀNH CHO AI / CODEX TRIỂN KHAI

**Vai trò:** Bạn là kỹ sư full-stack TypeScript/Three.js/WebRTC. Hãy dùng tài liệu này làm yêu cầu sản phẩm và kiến trúc định hướng, không mặc định mọi tính năng đã tồn tại.

**Quy tắc làm việc:**

1. Đầu tiên kiểm tra repo hiện tại, liệt kê những gì đã có/chưa có và đề xuất kế hoạch theo milestone.
2. Triển khai **MVP trước**; không làm tất cả hiệu ứng nâng cao cùng lúc.
3. Thiết kế shared types/schemas và event contract trước khi viết logic Socket.io.
4. Phân biệt `capacity`, `maxParticipants`, `seatGroups`, `seatSlots` trong toàn bộ hệ thống.
5. Server là nguồn sự thật cho ghế, host permission và timeline phim.
6. Giữ WebRTC voice tách khỏi đồng bộ điều khiển video.
7. Luôn có fallback cho lỗi media, autoplay, WebGL và kết nối mạng.
8. Viết unit test cho layout generator/seat allocation và integration test cho room state/playback sync.
9. Tránh thêm dependency nặng nếu không cần; giữ dự án dễ chạy trên Mac mini M4.
10. Sau mỗi milestone: cung cấp file đã sửa, lệnh chạy, hướng dẫn kiểm thử và các vấn đề còn tồn tại.

**Thứ tự yêu cầu AI thực hiện:** (1) Repo audit → (2) Architecture & data contracts → (3) Room management → (4) Dynamic layout/seat system → (5) Avatar movement → (6) Video sync → (7) WebRTC voice → (8) UX polish → (9) Testing & deployment.

**Ưu tiên cuối cùng:** Trải nghiệm 2–3 người thực sự dùng được, mượt, đồng bộ, riêng tư và dễ bảo trì quan trọng hơn mô hình 3D phức tạp.
