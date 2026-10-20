# Kết quả nghiệm thu

Cập nhật ngày 20/10/2026. Có website production và project Supabase đang hoạt động. Phân biệt kiểm tra cấu hình hosted với nghiệm thu Auth/Storage end-to-end.

| Phần | Kết quả | Phạm vi |
|---|---|---|
| Cài bằng lockfile | Đạt | `npm ci`, Node 24.19.0 |
| TypeScript + production build | Đạt | `npm run build`; Vite và precache shell |
| Mô hình và CSV | 6/6 đạt | Chương/ngôn ngữ/ID, khóa, lịch sử, tiếp tục thiếu đoạn, gộp từ, bảo vệ CSV formula |
| Worker API | 8/8 đạt | Disabled không gửi nội dung; origin/auth/validation, server-only key, 429 không fallback, missing model, không lộ lỗi/secret |
| PostgreSQL RLS | 5/5 đạt | Migration chạy bằng PGlite; hai danh tính, quyền SELECT/INSERT/UPDATE/DELETE, chặn đổi chủ, revision, child/vocabulary/events/job và private storage policies |
| Chromium E2E | 13/13 đạt | Các luồng chi tiết bên dưới |
| Dependency audit production | Đạt | `npm audit --omit=dev`: 0 vulnerabilities được báo cáo tại thời điểm kiểm tra |
| Worker runtime local | Đạt | Wrangler/Workerd phục vụ build và API health/capabilities |
| Giao diện | Đã kiểm tra | 1440px và 390px; kiểm thử không tràn ngang mobile; focus modal, Escape/Tab, giảm hiệu ứng theo hệ thống |
| Supabase hosted | Đã kiểm tra cấu hình | API quản lý: ACTIVE_HEALTHY, bảng/RLS/bucket/Auth URL; còn nghiệm thu hai tài khoản live |
| Cloudflare deployment | Đạt qua API | Worker `readbook`, version `749a6f36-3cee-4166-ab3b-868627644c08`, 100% traffic; HTTP từ Codex bị 403/1010 |
| Dịch thực tế 6 chiều | Chưa chạy | Chưa có endpoint/model/API credential |
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

- Worker và E2E quota dùng provider fixture. **Không có bản dịch máy live được xác nhận.** Không tuyên bố chất lượng/độ chính xác của provider.
- RLS chạy trên PostgreSQL thật qua WASM/PGlite nhưng Supabase Auth/Storage nền tảng được tạo fixture tối thiểu. **Không thay nghiệm thu hosted Auth, object storage hoặc hai tài khoản trên URL production.**
- Recording dùng thiết bị audio tổng hợp, permission cấp riêng cho test. Chưa xác minh micro thực, TTS giọng Việt/Trung/Anh, iOS background audio hoặc offline voices.
- Hanzii chỉ có sao chép và mở homepage bằng cơ chế web chuẩn; chưa kiểm tra được trên mobile, chưa có deep link/API/Pro/CSV chính thức.
- Không có test browser toàn diện cho WCAG/screen reader. Có hỗ trợ thao tác bàn phím và semantic labels; chưa tuyên bố chứng nhận accessibility.
- Không có durable background worker khi đóng tab. Resume giai đoạn 1 dựa trên bản dịch từng đoạn đã lưu. Chưa nghiệm thu quy mô sách rất dài, dữ liệu nhiều tài khoản hoặc nhiều thiết bị ghi đồng thời ngoài test revision.
- PIN phụ huynh đã có trên trình duyệt: hash PBKDF2 với salt riêng, cooldown sau nhập sai, chặn mở ứng dụng khi reload phiên trẻ. Người có quyền sửa/xóa dữ liệu trình duyệt vẫn có thể bỏ khóa; đây không phải sandbox tài khoản trẻ.
- Chưa chạy PDF/OCR, nguồn sách online, ngữ cảnh/AI/SRS nâng cao, audiobook timing, sync offline/cloud outbox hoặc xóa toàn bộ tài khoản. Phạm vi còn lại được giữ tại `backlog.md`.

## Kiểm tra cloud ngày 20/10/2026

Hai credential Cloudflare/Supabase đã sẵn sàng và API quản lý đều trả kết quả thành công. Project `sddqnjefltipcpgypsun` ACTIVE_HEALTHY; books, children, vocabulary, translation_jobs, integration_events đều bật RLS; bucket originals private. Auth site_url là https://readbook.manhhuong.workers.dev/. Worker hiện có `readbook` dùng Static Assets và tắt dịch máy. Không tạo tài nguyên mới hay thay đổi schema.

Các kiểm thử mới: lịch ôn tăng khoảng cách/chưa nhớ/loại từ bỏ qua, kiểm tra backup sai; trình duyệt kiểm tra Noto Sans Việt offline, PIN sai/đúng/reload, lưu buổi luyện, lịch ôn sau reload. Kết quả: 22/22 Vitest đạt; 10 E2E nền và 3 E2E mới đều đạt (test PIN chạy lại sau khi sửa assertion chờ lưu checkbox bất đồng bộ). Build và deploy dry-run đạt. Ảnh build production ở desktop 1440px/mobile 390px: dấu Việt đúng, mobile không tràn ngang.

Endpoint dịch tự quản lý chưa được cấu hình. Dịch máy, OCR/PDF, AI và cloud outbox chưa được nghiệm thu; không báo hoàn thành các phần này.

Triển khai production lúc 02:41 UTC ngày 20/10/2026. API Cloudflare xác nhận phiên bản trên nhận 100% traffic. Yêu cầu HTTP tới URL công khai từ Codex nhận 403 với mã Cloudflare 1010; chưa xác minh live browser. Kiểm thử browser và ảnh giao diện dùng đúng artifact production cục bộ. Không vô hiệu hóa TLS hoặc đổi thiết lập firewall để vượt lỗi này.
