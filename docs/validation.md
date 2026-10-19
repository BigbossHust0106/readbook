# Kết quả nghiệm thu

Kiểm thử trong môi trường cloud ngày 19/10/2026. Chỉ xác nhận các bước có bằng chứng dưới đây; chưa có project hoặc URL production.

| Phần | Kết quả | Phạm vi |
|---|---|---|
| Cài bằng lockfile | Đạt | `npm ci`, Node 24.19.0 |
| TypeScript + production build | Đạt | `npm run build`; Vite và precache shell |
| Mô hình và CSV | 6/6 đạt | Chương/ngôn ngữ/ID, khóa, lịch sử, tiếp tục thiếu đoạn, gộp từ, bảo vệ CSV formula |
| Worker API | 8/8 đạt | Disabled không gửi nội dung; origin/auth/validation, server-only key, 429 không fallback, missing model, không lộ lỗi/secret |
| PostgreSQL RLS | 5/5 đạt | Migration chạy bằng PGlite; hai danh tính, quyền SELECT/INSERT/UPDATE/DELETE, chặn đổi chủ, revision, child/vocabulary/events/job và private storage policies |
| Chromium E2E | 10/10 đạt | Các luồng chi tiết bên dưới |
| Dependency audit production | Đạt | `npm audit --omit=dev`: 0 vulnerabilities được báo cáo tại thời điểm kiểm tra |
| Worker runtime local | Đạt | Wrangler/Workerd phục vụ build và API health/capabilities |
| Giao diện | Đã kiểm tra | 1440px và 390px; kiểm thử không tràn ngang mobile; focus modal, Escape/Tab, giảm hiệu ứng theo hệ thống |
| Supabase hosted | Chưa chạy | Không có kết nối/tài khoản được cấp trong phiên |
| Cloudflare deployed HTTPS | Chưa chạy | `wrangler whoami` báo chưa xác thực; không tạo tài nguyên |
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
- Chưa có khóa phụ huynh PIN; nút về quản lý hiện rõ. Không tuyên bố đây là sandbox xác thực riêng cho trẻ.
- Chưa chạy PDF/OCR, nguồn sách online, ngữ cảnh/AI/SRS, audiobook timing, sync offline/cloud outbox hoặc xóa toàn bộ tài khoản. Phạm vi còn lại được giữ tại `backlog.md`.

## Cấu hình môi trường đã lưu

Draft save đã xác nhận thành công: `install_script`, `start_skill`, hai requirement credential cá nhân `CLOUDFLARE_API_TOKEN` và `SUPABASE_ACCESS_TOKEN`. Tự thêm hai hostname `api.cloudflare.com`, `api.supabase.com` vào mạng hạn chế. Không lưu giá trị secret. Draft cần người dùng review/save trong cài đặt môi trường và publish để có hiệu lực; thao tác này chưa tạo Supabase project hoặc triển khai Cloudflare.

Endpoint dịch tự quản lý và quyền tạo tài nguyên miễn phí vẫn là điều kiện bên ngoài còn thiếu. Khi được cấp quyền an toàn, Codex tiếp tục kiểm tra quota, tạo tài nguyên riêng, migration/Auth/Storage, deploy và nghiệm thu trên URL HTTPS. Không yêu cầu chủ ứng dụng tự thực hiện các lệnh thiết lập đã được giao.
