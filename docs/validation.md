# Kết quả nghiệm thu

Cập nhật ngày 21/10/2026. Có website production và project Supabase đang hoạt động. Phân biệt kiểm tra cấu hình hosted với nghiệm thu Auth/Storage end-to-end.

| Phần | Kết quả | Phạm vi |
|---|---|---|
| Cài bằng lockfile | Đạt | `npm ci`, Node 24.19.0 |
| TypeScript + production build | Đạt | `npm run build`; Vite và precache shell |
| Mô hình và CSV | 6/6 đạt | Chương/ngôn ngữ/ID, khóa, lịch sử, tiếp tục thiếu đoạn, gộp từ, bảo vệ CSV formula |
| Worker API | 8/8 đạt | Disabled không gửi nội dung; origin/auth/validation, server-only key, 429 không fallback, missing model, không lộ lỗi/secret |
| PostgreSQL RLS | 5/5 đạt | Migration chạy bằng PGlite; hai danh tính, quyền SELECT/INSERT/UPDATE/DELETE, chặn đổi chủ, revision, child/vocabulary/events/job và private storage policies |
| Chromium E2E | 22/22 đạt | Các luồng chi tiết bên dưới |
| Dependency audit production | Đạt | `npm audit --omit=dev`: 0 vulnerabilities được báo cáo tại thời điểm kiểm tra |
| Worker runtime local | Đạt | Wrangler/Workerd phục vụ build và API health/capabilities |
| Giao diện | Đã kiểm tra | 1440px và 390px; kiểm thử không tràn ngang mobile; focus modal, Escape/Tab, giảm hiệu ứng theo hệ thống |
| Supabase hosted | Đã kiểm tra cấu hình | API quản lý: ACTIVE_HEALTHY, bảng/RLS/bucket/Auth URL; còn nghiệm thu hai tài khoản live |
| Cloudflare deployment | Đạt qua API | Worker `readbook`, version `ddf07dfd-76b6-47eb-ac97-d017d60dfa47`, 100% traffic; HTTP từ Codex bị 403/1010 |
| Dịch thực tế 6 chiều | Đạt upstream | MyMemory API chính thức, câu tổng hợp; thêm 2 đoạn dịch thật qua browser/handler với Node proxy |
| Hanzii trên thiết bị thật | Chưa chạy | Website bị proxy 403; deep link/API/CSV chưa xác minh |

## 10 luồng trình duyệt

1. Nhập sách dán → căn chỉnh đoạn → bản dịch thủ công → khóa → ghi chú → lưu vị trí/từ → tải lại, dữ liệu giữ nguyên.
2. Từ chối trùng; nhập HTML có script và event handler không thực thi chúng.
3. Hồ sơ trẻ chỉ thấy sách đã duyệt và không có lookup ngoài trong luồng đọc.
4. Fixture provider báo hết quota sau một đoạn: giữ đoạn đã lưu, tiếp tục chỉ phần còn thiếu, không dịch trùng phần đã có.
5. Tạo và nhập tệp EPUB thực (zip/container/OPF/spine), đọc đúng thứ tự; tải lại tệp gốc và so sánh byte-for-byte.
6. Tạo và nhập DOCX thực, nối text runs và giải XML entities đúng.
7. CSV ba dòng qua preview/ánh xạ → hai nghĩa riêng, gộp bản trùng; dữ liệu giữ sau reload.
8. Production PWA precache → mất mạng → reload → đọc sách local; mobile không tràn ngang.
9. Sao lưu và khôi phục sang browser context riêng gồm originals; từ chối vị trí đọc sai cấu trúc.
10. Microphone tổng hợp của Chromium: không gọi capture trước thao tác, có permission rồi bấm mới ghi; MediaRecorder tạo Blob audio local, nghe/xóa qua UI, không POST dữ liệu âm thanh. Không phải kiểm thử giọng nói trẻ thật hoặc đánh giá phát âm.

## Giới hạn bằng chứng

- Các bài quota/error dùng provider fixture. Có bằng chứng MyMemory upstream thật ở sáu chiều và browser/handler qua Node proxy; chưa nghiệm thu Worker production qua URL công khai do 403. Không tuyên bố chất lượng văn học hoặc độ chính xác chung của provider.
- RLS chạy trên PostgreSQL thật qua WASM/PGlite nhưng Supabase Auth/Storage nền tảng được tạo fixture tối thiểu. **Không thay nghiệm thu hosted Auth, object storage hoặc hai tài khoản trên URL production.**
- Recording dùng thiết bị audio tổng hợp, permission cấp riêng cho test. Chưa xác minh micro thực, TTS giọng Việt/Trung/Anh, iOS background audio hoặc offline voices.
- Hanzii chỉ có sao chép và mở homepage bằng cơ chế web chuẩn; chưa kiểm tra được trên mobile, chưa có deep link/API/Pro/CSV chính thức.
- Không có test browser toàn diện cho WCAG/screen reader. Có hỗ trợ thao tác bàn phím và semantic labels; chưa tuyên bố chứng nhận accessibility.
- Không có durable background worker khi đóng tab. Resume giai đoạn 1 dựa trên bản dịch từng đoạn đã lưu. Chưa nghiệm thu quy mô sách rất dài, dữ liệu nhiều tài khoản hoặc nhiều thiết bị ghi đồng thời ngoài test revision.
- PIN phụ huynh đã có trên trình duyệt: hash PBKDF2 với salt riêng, cooldown sau nhập sai, chặn mở ứng dụng khi reload phiên trẻ. Người có quyền sửa/xóa dữ liệu trình duyệt vẫn có thể bỏ khóa; đây không phải sandbox tài khoản trẻ.
- Còn nguồn sách online, ngữ cảnh/AI/SRS nâng cao, audiobook timing, sync offline/cloud outbox hoặc xóa toàn bộ tài khoản. Phạm vi còn lại được giữ tại `backlog.md`.

## Kiểm tra cloud ngày 20/10/2026

Hai credential Cloudflare/Supabase đã sẵn sàng và API quản lý đều trả kết quả thành công. Project `sddqnjefltipcpgypsun` ACTIVE_HEALTHY; books, children, vocabulary, translation_jobs, integration_events đều bật RLS; bucket originals private. Auth site_url là https://readbook.manhhuong.workers.dev/. Worker hiện có `readbook` dùng Static Assets và tắt dịch máy. Không tạo tài nguyên mới hay thay đổi schema.

Các kiểm thử mới: lịch ôn tăng khoảng cách/chưa nhớ/loại từ bỏ qua, kiểm tra backup sai; trình duyệt kiểm tra Noto Sans Việt offline, PIN sai/đúng/reload, lưu buổi luyện, lịch ôn sau reload. Kết quả: 22/22 Vitest đạt; 10 E2E nền và 3 E2E mới đều đạt (test PIN chạy lại sau khi sửa assertion chờ lưu checkbox bất đồng bộ). Build và deploy dry-run đạt. Ảnh build production ở desktop 1440px/mobile 390px: dấu Việt đúng, mobile không tràn ngang.

Endpoint dịch tự quản lý chưa được cấu hình. Dịch máy, OCR/PDF, AI và cloud outbox chưa được nghiệm thu; không báo hoàn thành các phần này.

Triển khai production lúc 02:41 UTC ngày 20/10/2026. API Cloudflare xác nhận phiên bản trên nhận 100% traffic. Yêu cầu HTTP tới URL công khai từ Codex nhận 403 với mã Cloudflare 1010; chưa xác minh live browser. Kiểm thử browser và ảnh giao diện dùng đúng artifact production cục bộ. Không vô hiệu hóa TLS hoặc đổi thiết lập firewall để vượt lỗi này.

## PDF/OCR và nâng dung lượng — 20/10/2026

- Build TypeScript/Vite đạt; 22 unit/Worker/RLS checks đạt. 13 kiểm thử trình duyệt cũ và 4 kiểm thử PDF/OCR đều đạt.
- PDF hai trang thực, thêm padding thành hơn 21 MB: trích đúng từng trang, sửa trước lưu, xem trang PDF gốc, đọc lại sau reload, tải PDF gốc giống byte-for-byte.
- PDF scan tạo từ ảnh chữ Việt: Tesseract nhận được “cuốn sách”, “tiếng Việt” dưới CSP production; kiểm tra không có request ra origin bên ngoài. Đây là mẫu ảnh sạch tổng hợp, không đại diện độ chính xác cho mọi sách scan, chữ viết tay, bảng hoặc đa cột; chưa có bộ nghiệm thu OCR tiếng Trung/Anh riêng.
- Từ chối tệp 50 MB + 1 byte; PDF hỏng có lỗi, đổi tệp và xử lý lại được; từ chối khoảng vượt số trang. Hủy tải model không lưu sách và cùng dialog có thể thử lại.
- `npm audit --omit=dev`: 0 vulnerabilities được báo cáo.
- Supabase global file limit xác nhận 52.428.800 byte. Áp dụng migration nâng bucket originals từ 20 lên 50 MB qua SQL API và đọc lại xác nhận `public=false`, `file_size_limit=52428800`. Không thay đổi dữ liệu sách hoặc chính sách RLS. Chưa có thử upload/download 50 MB vào Supabase hosted bằng hai tài khoản.

Triển khai PDF/OCR thành công lúc 02:56 UTC ngày 20/10/2026, version `b2f70992-b36b-4c8b-bd84-e3802361a673`. API Cloudflare xác nhận 100% traffic. Đợt đầu bulk asset upload trả 401 từ lớp tích hợp; tải từng asset cùng endpoint/auth đã thành công (223 tệp mới, 18 có sẵn). Chỉ tạm chia nhỏ bucket upload trong CLI dependency cục bộ, sau đó khôi phục CLI nguyên bản; không thay đổi credential/network policy. HTTP health công khai từ Codex vẫn bị Cloudflare 403/1010; không báo đã nghiệm thu browser live. Modal PDF ở 390px đã kiểm tra không tràn ngang.

## Cập nhật ngày 21/10/2026 (giờ Việt Nam)

- PDF thực 205 trang được xử lý toàn bộ trong một lần; đóng dialog/mở lại cùng tệp vẫn đọc được checkpoint và trang 205. Unit mô phỏng 55 trang scan: hủy sau 20 trang rồi chỉ OCR 35 trang còn thiếu. Unit PDF 241 trang không có giới hạn 200.
- Phân trang giữ nguyên toàn bộ Unicode, không mất/lặp đoạn hoặc bản dịch; giữ vị trí khi đổi ngân sách ký tự. Browser kiểm tra lật trang, reload, slider, cuộn tự nối chương và thanh điều hướng bám đáy ở 390px.
- MyMemory upstream thật trả kết quả ở sáu chiều en↔vi, en↔zh-CN, vi↔zh-CN với câu tổng hợp. Worker handler chạy qua proxy được cấu hình trả 200: “Reading a book opens a new world.” → “Đọc một cuốn sách mở ra một thế giới mới.”. Đây không phải đánh giá chất lượng văn học. API spec/usage limits xác nhận 500 byte/request, 5.000 ký tự/ngày ẩn danh. Không dùng endpoint Google/DeepL không chính thức hoặc API có phí.
- Workerd local không ra Internet qua proxy phiên này; test mạng thực của handler dùng Node/Vite SSR với ProxyAgent và TLS trust kế thừa. Browser dịch dùng fixture có nhãn để kiểm tra lưu/hiển thị/resume; không coi fixture là bản dịch thật. Cần phân biệt bằng chứng upstream thật với nghiệm thu endpoint Worker production.
- DTV: URL mẫu user cung cấp và robots/trang chủ đều 403/1010 từ Codex. Chỉ thử metadata, không tải nội dung sách mẫu có bản quyền. Parser/danh mục/tải tệp dùng fixture tổng hợp; test chặn URL ngoài, redirect ngoài và xác nhận chỉ dữ liệu được chọn. Có browser test tìm kiếm DTV/Google vẫn sẵn sàng khi catalog API trả lỗi.
- Kiểm thử cuối cùng và version triển khai được bổ sung ở cuối tài liệu.

Bản cuối: **35/35 Vitest và 22/22 Chromium E2E đạt**. Sau chỉnh offset bookmark dài và vị trí toast, 4 luồng reader/source liên quan chạy lại đều đạt; build và deploy dry-run đạt. Audit production báo 0 vulnerabilities. Smoke browser với upstream MyMemory thật (Node proxy/TLS chuẩn của phiên): hai đoạn tiếng Anh dịch sang tiếng Việt, lưu/hiển thị cặp đoạn và ảnh 1440px/390px, không tràn ngang. Ảnh và dữ liệu smoke chỉ dùng nội dung tổng hợp của test.

Triển khai lúc **08:36 ngày 21/10/2026 (+07:00)**, version `ddf07dfd-76b6-47eb-ac97-d017d60dfa47`; API Cloudflare xác nhận 100% traffic. Đọc settings xác nhận `TRANSLATION_ENABLED=true`, `TRANSLATION_PROVIDER=mymemory`, `LOCAL_TRANSLATION=false`. HTTP capabilities từ Codex vẫn 403/1010; không vô hiệu TLS hoặc thay đổi firewall để vượt chặn. Không đổi gói trả phí, không tạo project Supabase mới hoặc thêm tài nguyên AI.

## Trình đọc, nhóm và đồng bộ — 21/10/2026

- Migration nhóm/trạng thái cá nhân đã áp dụng trên project Supabase hiện có. Trước migration có 0 sách cloud. Test SQL PGlite xác nhận chuyển annotations riêng trước khi làm sạch canonical, giữ progress cũ, RLS nhóm, Storage, unique hash/ngôn ngữ, timestamp chống cập nhật offline cũ và thu hồi thành viên.
- Supabase hosted thật: tạo ba tài khoản tạm bằng Admin API (không gửi email), Auth lấy JWT từng người; sách/tệp gốc dùng chung, outsider không thấy, thành viên không sửa nội dung/chia sẻ quyền, trạng thái/ghi chú riêng, tag nhóm chỉ lộ tọa độ đọc. Request Storage mới sau thu hồi bị từ chối. Một URL đã tải trước đó còn được CDN cache; upload mới dùng cache-control 0. Đã dọn người dùng/tệp/dữ liệu thử.
- Build production chạy tại localhost với Worker handler thật; Supabase request từ Chromium đi qua Node ProxyAgent theo proxy/TLS phiên. Hai tài khoản thật tạo/tham gia nhóm, thêm sách, hiện tag; cùng tài khoản khôi phục offset trên browser thứ ba độc lập. Sau đổi ngân sách ký tự, phím mũi tên dùng danh sách trang mới (đã sửa closure cũ). Đây là hosted DB/Auth/Storage và build thật, chưa phải nghiệm thu trang công khai Cloudflare.
- Browser màn hình 390px chạm từ “Reading”, Worker handler gọi MyMemory thật trả “Đọc hiểu”. Không gửi toàn trang. Từ đơn có thể có nghĩa thiếu ngữ cảnh. Google là liên kết web chính thức; không báo đã có API Google Translation.
- Browser E2E kiểm tra bấm khoảng trống trái/phải, pointer swipe hai chiều, popup/cache chỉ một từ, lưu từ, menu mobile/hover desktop, công cụ nổi không kéo lên đầu, tự lưu và khôi phục đoạn khi reload; không tràn ngang. Swipe E2E là sự kiện pointer mô phỏng, cần nghiệm thu cảm giác vuốt trên thiết bị vật lý. Ảnh ở /tmp chỉ là dữ liệu tổng hợp kiểm thử.
- Lỗi upload tệp text/cloud cũ đã sửa: neutral Blob type application/octet-stream đúng allowlist của bucket, giữ nguyên bytes; lỗi trước đó chỉ được phát hiện bằng luồng browser thực.

Chuyển local → cloud đã kiểm tra bằng tài khoản hosted tạm: sách, tệp gốc giữ đúng bytes, ghi chú riêng và đoạn cuối được chuyển; browser độc lập đăng nhập lại nhận đúng dữ liệu và tải tệp gốc. Đã dọn toàn bộ tài khoản, sách, nhóm và Storage test; truy vấn cuối xác nhận không còn dữ liệu thử.

Kiểm tra cuối: `tsc -b`, build production và `git diff --check` đạt; **40/40 Vitest**, toàn bộ **25/25 Chromium E2E** đạt. Sau đó thêm test chống tự lưu tiến độ làm sống lại sách đã xóa; cả 4 reader-interactions đều đạt (tổng cộng 26 case E2E đã chạy đạt). Không thêm kiểm thử giả lập tên nhà cung cấp để coi là bằng chứng dịch thật.

Đã triển khai lúc **11:15 ngày 21/10/2026 (+07:00)** trên Worker `readbook`, version **fd70a4d2-7f96-41c0-96c6-cdcab598e9e6**. API quản lý Cloudflare xác nhận version nhận 100% traffic, translation enabled/provider MyMemory và local fixture disabled. Public `/api/health` từ mạng Codex vẫn HTTP 403; không báo đã kiểm tra browser trên URL production. Không tạo tài nguyên/gói AI trả phí hoặc project mới.

## Đồng bộ ngoại tuyến và trình đọc vừa màn hình — 21/10/2026

- Đã áp dụng migration `202610210004_offline_sync.sql` trên project Supabase hiện có; chỉ thêm RPC compare-and-swap, không viết lại nội dung sách/người dùng. PGlite xác minh gộp/đụng độ, progress không bị annotations ghi đè, từ đã xóa không sống lại từ baseline cũ, từ chối sửa dữ liệu tài khoản khác/table name không hợp lệ. Unit merge giữ bản dịch như một đơn vị để không trộn text/provider/lock.
- Hosted Auth/REST thật xác minh tạo/sửa/xóa từ, CAS từ chối baseline cũ, gửi lại sau mất response là idempotent. Các user thử được tạo bằng admin với email_confirm, không gửi email, rồi xóa cùng dữ liệu thử.
- Browser production build qua Node Worker handler + proxy/TLS của phiên: nhóm chia sẻ sách, progress nhiều browser, PWA giữ ghi chú sau reload thật khi offline; khi hai browser cùng tài khoản sửa ghi chú khác nhau, Supabase trả xung đột và bản được chọn xuất hiện trên browser còn lại. Luồng chuyển thư viện local/tệp gốc/ghi chú/vị trí sang cloud vẫn đạt. Đây là hosted Supabase + build thật tại localhost, không phải browser vào Worker public URL.
- E2E client offline dùng API fixture có nhãn qua hostname `offline-fixture.supabase.co`; không coi fixture là chứng cứ hosted. Fixture kiểm tra hàng đợi qua reload, merge khác trường, xung đột, lựa chọn và hoàn tác trong lúc request trước còn đang gửi. Cấu hình fixture chỉ truyền cho Vite test server, không có trong dist production.
- Menu drawer dùng chung desktop/mobile và khi đọc; có các mục ứng dụng chính cộng mục lục/tìm toàn sách/chọn sách/từ trong reader. Test tìm VI không dấu và nhảy chapter/offset, font/leading/width qua reload.
- Pagination đo DOM theo viewport/font/bản dịch. Test đi hết các trang và nối fragment trùng chính xác nguyên văn; bản dịch dài trên trang rộng 560px cũng nối lại đúng, mọi trang không tràn chiều cao. Đổi cỡ chữ 30/khoảng dòng 2,5 và xoay 390×844 sang 844×390 vẫn vừa màn hình. Desktop nút và ArrowLeft/Right; mobile có cả pointer fixture và CDP touchStart/touchMove/touchEnd thật trong Chromium emulation hai chiều. Chưa thay cho nghiệm thu thiết bị vật lý.
- Hover không gửi dịch. Bôi đen mở cùng form dịch/chỉnh nghĩa/lưu từ. Browser gọi Worker handler với upstream MyMemory thật: selection “Reading” → “Đọc hiểu”, đúng một request sau selection, 0 request khi hover. Không dịch cả trang ngầm. Cache/quota vẫn theo provider. Ghi chú dài mở qua dialog trong mode paged để giữ trang vừa màn hình.
- `npm test`: **50/50 đạt**. `npm run build`: đạt. Toàn bộ Chromium E2E sau cập nhật menu/selection/pagination: **34/34 đạt**. Có ảnh desktop/mobile/landscape/menu và form conflict bằng văn bản tổng hợp ở /tmp. `git diff --check` đạt. Không bật provider AI có phí hoặc tạo project mới.

Triển khai **13:56 ngày 21/10/2026 (+07:00)**, Worker `readbook`, version **87242d13-6bea-4f49-9f40-b2a1dbf28ab5**; Cloudflare management API xác nhận 100% traffic. Provider MyMemory enabled, local fixture disabled. Public `/api/health` từ mạng Codex vẫn HTTP 403; không báo đã nghiệm thu browser trực tiếp trên URL public.


## Sửa lỗi bảng dịch và lưu từ — 21/10/2026

- Bổ sung nút **Dịch / Thử dịch lại** ngay trong bảng. Dịch theo nội dung đang sửa, không dùng lại selection cũ. Giữ nghĩa tự nhập khi kết quả về muộn; có **Dùng bản dịch** để chủ động thay nghĩa. Sửa từ/đóng bảng hủy yêu cầu trước và bỏ qua kết quả cũ.
- Giới hạn chờ 50 giây trên client kể cả bộ dịch native bị treo; thông báo mất mạng, response không hợp lệ và timeout đều có thể thử lại. Chỉ cache bản dịch hợp lệ, lỗi ghi cache không biến kết quả dịch thành lỗi.
- Worker thử lại tối đa một lần khi lỗi transport/HTTP 5xx; không tự thử lại quota hoặc kết quả bị provider từ chối. Mỗi lần kết nối tối đa 12 giây, deadline toàn yêu cầu 45 giây. JSON đầu vào hỏng trả 400. Không thêm API/gói trả phí hoặc thay dữ liệu Supabase.
- **54/54 Vitest**, **37/37 Chromium E2E**, production build và diff check đạt. E2E mới mô phỏng HTTP 502 → sửa cụm → thử lại; bảo vệ nghĩa tự nhập; chặn response cũ; dữ liệu không phải JSON; treo request → timeout → thử lại.
- Browser mobile chạy đúng production build + Worker handler qua Node proxy/TLS của phiên: tạo lỗi đầu tiên có nhãn fixture, bấm **Thử dịch lại**, rồi gọi MyMemory chính thức thật với cụm “, trong lòng dì sẽ cảm thấy áp lực, lỡ như hai tiếng”, nhận “In her heart, she would feel the pressure, like two hours.”. Đây là bằng chứng luồng thử lại và upstream tại thời điểm kiểm tra, không phải bảo đảm uptime/chất lượng văn học hoặc nghiệm thu Worker public URL. MyMemory vẫn có hạn mức miễn phí; Google Dịch vẫn là liên kết web, không phải API Google đã cấu hình.

Triển khai lúc **14:12 ngày 21/10/2026 (+07:00)**, Worker `readbook`, version **234bb7aa-1643-478b-ab25-57930f6292f8**. API quản lý xác nhận version nhận 100% traffic, `TRANSLATION_ENABLED=true`, `TRANSLATION_PROVIDER=mymemory`, `LOCAL_TRANSLATION=false`. Public `/api/health` từ Codex tiếp tục HTTP 403; không báo đã nghiệm thu browser trên URL công khai.


## Nguyên nhân lỗi dịch trên Cloudflare Workers — 21/10/2026

Ảnh người dùng sau bản sửa retry vẫn báo không kết nối MyMemory, kể cả từ “Ăn”. Đã tái hiện lỗi ở đúng runtime workerd/compatibility date `2026-01-01`: `fetch` ném `TypeError: Invalid redirect value, must be one of "follow" or "manual" ("error" won't be implemented since it does not make sense at the edge; use "manual" and check the response status code).` Lỗi xảy ra trước outbound request, không phải lỗi Supabase/token hay hạn mức MyMemory. Kiểm tra Node ở đợt trước không phát hiện khác biệt runtime này; kết quả dịch thật qua Node không chứng minh Worker chạy được.

- Đổi cả ba lời gọi MyMemory/LibreTranslate sang `redirect: "manual"`. HTTP 3xx vẫn bị từ chối bởi kiểm tra non-2xx, không tự chuyển văn bản/API key sang đích khác. Không bật chuyển hướng tự do, không đổi cấu hình Supabase/credential/provider hoặc tài nguyên trả phí.
- Thêm regression test chạy **bundle Worker thật trong workerd**, cùng compatibility date lấy từ `wrangler.jsonc`, chỉ fixture outbound response. Cả 6 case thất bại trên mã cũ (502, không có outbound request), đạt sau sửa: dịch tiếng Việt, quota, từ chối redirect, LibreTranslate/languages/translate. Miniflare và esbuild khai báo trực tiếp ở devDependencies, khóa đúng phiên bản sẵn trong lockfile. Các test này tự chạy trong `npm test`.
- Live smoke: **workerd → outbound bridge Node ProxyAgent theo proxy/TLS của phiên → API MyMemory chính thức**. Đã nhận vi→en “Ăn” → “Feeding”, en→vi “Eat” → “Ăn”, zh→vi “吃” → “Ăn”. Chromium mobile chạy artifact production với chính Worker workerd cũng bôi đen “Ăn” và nhận “Feeding” trong bảng. Bridge chỉ chấp nhận origin MyMemory và không đi theo redirect. Không thay `fetch` trong workerd bằng Node; workerd tự kiểm tra redirect/options trước khi đến bridge. Đây là upstream thật + runtime cục bộ, không đại diện IP egress của Worker production hoặc chất lượng dịch từ đơn.

Kiểm tra sau sửa: **60/60 Vitest** (gồm 6 workerd regression), **37/37 Chromium E2E**, `npm run build` và `git diff --check` đạt. Translation config trên Worker production xác nhận `TRANSLATION_ENABLED=true`, provider MyMemory, `LOCAL_TRANSLATION=false`; không cần người dùng chỉnh Supabase/Cloudflare hoặc thêm token.

Triển khai **14:36 ngày 21/10/2026 (+07:00)**, Worker `readbook`, version **ed06fbd9-e177-41d6-afd7-3ad9bead287a**. Cloudflare management API xác nhận version nhận **100% traffic**. Đọc lại module `index.js` đã upload qua Content API, tách khỏi source map: cả bốn giá trị redirect đều là `manual`, không còn `error`. Public `/api/health` từ mạng Codex vẫn HTTP 403; chưa nghiệm thu qua URL công khai. Người dùng chỉ cần tải lại trang và thử dịch; không xóa dữ liệu trình duyệt.


## Dấu trang, bản dịch nhập sẵn và chia sẻ sách cloud — 21/10/2026

- Dấu trang có nhiều offset trong cùng đoạn, tên/trích đoạn, tìm, đổi tên, xóa và nhảy về vị trí sau reflow. Vị trí đọc tiếp vẫn độc lập. Dữ liệu nằm trong paragraph overrides riêng của tài khoản, không có trong canonical shared book. Dùng CAS/outbox hiện có; không cần migration DB mới. Chuyển thư viện thiết bị lên cloud có chuyển cả dấu trang. Backup cũ không có dấu trang vẫn hợp lệ; kiểm tra schema từ chối offset/key/tên/ngày không hợp lệ.
- Nhập bản dịch sau nguyên văn bằng dán/TXT/EPUB/DOCX/HTML (giới hạn importer 50 MB; extracted/archive limits giữ nguyên). Phạm vi chương hoặc toàn sách; ghép theo thứ tự có preview, không tự căn theo nghĩa. Có chỉnh từng đoạn, gán hoặc ghép thêm từ một đoạn dịch, xem phần chưa ghép và xác nhận bỏ qua. Cần xác nhận đối chiếu trước khi lưu. Mặc định giữ bản dịch đã có, luôn giữ đoạn khóa; thay đoạn chưa khóa chỉ khi chọn rõ. Lịch sử tối đa 20 bản, bản mới mặc định khóa và nhãn “Bản dịch nhập sẵn”. Không sửa nguyên văn/tệp gốc, không gọi dịch máy; chỉ lưu annotations riêng.
- Sửa lỗi có sẵn: lưu riêng ghi chú không tạo một Translation rỗng hoặc thay provider/version bản dịch không sửa. Lỗi này gây xung đột giả khi máy khác nhập bản dịch; test mới đã bắt được và kiểm tra lại luồng gộp tự động. Bảng giải quyết xung đột hiện có cả tên/offset dấu trang.
- Nhóm có **Chọn sách từ cloud của tôi**: tìm/chọn nhiều sách đang sở hữu, chỉ gọi RPC `add_group_book` hiện có. RPC kiểm tra chủ sách/thành viên và chống trùng hash/ngôn ngữ. Không tạo bản sách hoặc upload tệp lại, không di chuyển/xóa bản riêng, không chia sẻ annotations. Danh sách ẩn sách được đọc nhờ nhóm khác, vô hiệu hóa sách đã có cùng nội dung trong nhóm. Lỗi giữa chừng giữ kết quả thành công và các lựa chọn chưa xong để thử lại.
- Kiểm thử trình duyệt mới: production PWA offline reload giữ hai bookmark/offset, đổi font rồi nhảy lại, đổi tên/xóa và mobile không tràn ngang; căn hai đoạn nguyên văn với ba đoạn dịch rồi gán/ghép thêm, không có request dịch; TXT thực, thay bản chưa khóa, giữ đoạn khóa/lịch sử; hai máy offline gộp bookmark/bản dịch/ghi chú. Group picker fixture có nhãn kiểm tra chỉ sách sở hữu, search/multi-select/chống trùng, 0 create-book/upload, lỗi sách thứ hai và retry chỉ phần còn lại.

Hosted live bằng hai tài khoản tạm và ba browser độc lập: tạo sách trong **thư viện cloud cá nhân** trước, lưu ghi chú/bản dịch/dấu trang riêng của chủ sách, rồi chọn sách đó để thêm vào nhóm. Đo luồng chia sẻ có **0 create-book/upload**, query dữ liệu thử xác nhận vẫn **một book record** và canonical document không chứa notes/translations/bookmarks. Thành viên nhập hai bản dịch khóa và một bookmark; browser khác của cùng tài khoản nhận đúng. Offline PWA reload giữ bookmark thứ hai, nối mạng gộp với note từ máy khác, đồng bộ lại đầy đủ. Chủ sách vẫn thấy bộ annotations riêng của mình và không thấy dữ liệu riêng của thành viên. Tài khoản/tệp/nhóm/sách thử đã dọn. Các request hosted Auth/REST/Storage dùng proxy/TLS của phiên; frontend là artifact production tại localhost, chưa phải browser truy cập Worker URL công khai.

Kiểm tra cuối: **65/65 Vitest**, toàn bộ **43/43 Chromium E2E**, production build và `git diff --check` đạt. Sau đó chỉnh hướng hàng checkbox của cloud picker cho mobile; cả 2 kiểm thử picker được chạy lại. Không đổi schema/cấu hình Supabase, không thêm provider trả phí hay tài nguyên cloud mới. Những mục chưa làm (từ điển/phát âm, metadata/bìa, nghe đọc nâng cao, queue nền/AI, tích hợp nguồn) vẫn giữ rõ trong backlog.

Đã triển khai **15:27 ngày 21/10/2026 (+07:00)**, Worker `readbook`, version **377aad4b-113c-48cf-8ff0-d7f1d7b21595**. API quản lý Cloudflare xác nhận **100% traffic**, provider MyMemory enabled và local fixture disabled. Public `/api/health` từ Codex vẫn HTTP 403; không báo đã nghiệm thu browser trực tiếp trên URL production.
