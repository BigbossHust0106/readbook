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
