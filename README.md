# Lá sách · readbook

Ứng dụng web/PWA đọc song ngữ Việt–Trung–Anh. Giai đoạn 1 có luồng dùng thực tế trên thiết bị; kết nối cloud và dịch cần tài khoản/máy chủ do chủ ứng dụng cấp quyền. Không dùng bản dịch giả để thay dịch vụ thật.

## Chạy

Node.js 22.12+ (đã kiểm tra Node 24.19), npm và Chromium cho kiểm thử trình duyệt.

```sh
npm ci
npm run build
npm run preview -- --local --ip 0.0.0.0 --port 8787
```

Wrangler phục vụ cả frontend và `/api`. Phát triển có HMR: giữ Worker ở cổng 8787 và chạy `npm run dev` trong terminal khác; Vite proxy `/api` sang Worker. Chế độ cục bộ không cần Supabase, tài khoản hay API key. Một task cloud đã là môi trường cô lập; dùng checkout hiện có, không cần tạo worktree.

## Đã triển khai

- Thư viện, lọc theo ngôn ngữ/kệ, tìm tên/tác giả/thể loại; thêm bài đọc mẫu do AI tạo, có nhãn, theo lựa chọn.
- Nhập EPUB theo thứ tự spine, TXT UTF-8, DOCX và HTML; văn bản dán. Tệp tối đa 20 MB, giải nén tối đa 30 MB. Giữ nguyên tệp gốc, SHA-256 phát hiện trùng.
- Chương và đoạn có UUID cố định; hai cột/xen kẽ/nguyên văn/bản dịch; font lớn nhỏ, sáng/tối/sepia, tìm trong chương, lưu vị trí bằng nút dấu trang từng đoạn.
- Bản dịch thủ công có lịch sử tối đa 20 phiên bản và khóa; ghi chú, tô sáng; bảng từ vựng có nhiều ngữ cảnh và bốn trạng thái học.
- Kết nối API chính thức LibreTranslate qua Worker: đọc mô hình khả dụng, dịch mẫu/chương, xác nhận gửi dữ liệu, xử lý từng đoạn và lưu ngay. Dừng khi 429 hoặc lỗi mạng; tiếp tục phần chưa có bản dịch, không fallback. Chỉ bật các cặp thực sự được máy chủ hỗ trợ.
- CSV: xem trước, ánh xạ, gộp theo từ/ngôn ngữ/nghĩa hoặc giữ riêng; xuất CSV chung có bảo vệ công thức bảng tính. **Chưa xác minh tương thích Hanzii hay Anki.**
- Mở trang chủ Hanzii sau sao chép từ Trung; không dùng deep link/API chưa xác minh, không đăng nhập Hanzii.
- Phần nền giai đoạn 2: hồ sơ trẻ thuộc phụ huynh, duyệt sách và bật ngôn ngữ; luyện đọc từng câu, TTS trình duyệt, micro chỉ bật khi bấm thu âm và cấp quyền. Bản thu chỉ trong RAM, không lưu cloud, không chấm phát âm. Mức luyện ngoài đọc câu chưa có giáo trình riêng.
- IndexedDB cục bộ; sao lưu/khôi phục JSON gồm tệp gốc, không ghi đè ID đã có. PWA lưu vỏ ứng dụng và đọc sách cục bộ offline sau lần mở có mạng; không cache API hoặc tài liệu cloud.
- Adapter Supabase Auth/DB/private Storage, migration RLS cho từng thao tác. Revision phát hiện ghi sách từ thiết bị khác để chặn ghi đè im lặng; mở lại/tải lại để đọc dữ liệu mới, chưa có đồng bộ thời gian thực hoặc hàng đợi sửa cloud khi offline.

## Supabase

Cấu hình công khai trong `.env.local` (máy phát triển), `.env.preview` hoặc `.env.production` theo `.env.example`. Chỉ dùng publishable/anon key, tuyệt đối không dùng service-role key ở `VITE_*`.

Migration: `supabase/migrations/202610190001_initial.sql`. Bucket `originals` riêng tư, đường dẫn `<owner UUID>/<book UUID>/original`. Mỗi bảng có policy SELECT/INSERT/UPDATE/DELETE; policy storage kiểm tra thư mục chủ sở hữu. Tài khoản trẻ không có thông tin đăng nhập riêng. `translation_jobs` và `integration_events` là nền schema, chưa được frontend sử dụng cho worker nền hoặc nhật ký cloud.

Khởi tạo project mới, kiểm tra free-plan/quota, chạy migration và cấu hình Auth do Codex thực hiện khi được cấp kết nối. Phiên bàn giao hiện **không có kết nối Supabase** nên chưa tạo project hay áp dụng migration lên cloud. Không tác động dự án có sẵn. Local Supabase CLI/Docker là tùy chọn, chưa được cài và chạy trong lần này.

Địa chỉ Auth phải dùng đúng origin HTTPS được Cloudflare cấp. `site_url` và redirect URL của preview/production tách riêng. Không dùng wildcard tùy ý cho production. Mặc định email phải được xác nhận; cấu hình nhà cung cấp email tùy dự án.

## Dịch thật

Tạo `.dev.vars` từ `.dev.vars.example`, không commit tệp này:

| Biến Worker | Ý nghĩa |
|---|---|
| `TRANSLATION_ENABLED` | Mặc định `false`; `true` mới kết nối nhà cung cấp |
| `LIBRETRANSLATE_URL` | URL HTTPS của máy chủ LibreTranslate tự quản lý |
| `LIBRETRANSLATE_API_KEY` | Secret tùy cấu hình máy chủ, chỉ ở Worker |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Worker kiểm tra JWT trước khi dịch trên Internet |
| `LOCAL_TRANSLATION` | Chỉ dùng `true` khi thử máy chủ cục bộ; bypass JWT chỉ chấp nhận request localhost |

Máy chủ phải có `/languages` và `/translate` theo API chính thức, cặp `vi`, `zh`, `en` tùy mô hình cài đặt. **Không giả định LibreTranslate có đủ sáu chiều**, không gọi public instance bất kỳ và không tự cài máy chủ gây phí. Chưa có giới hạn còn lại đáng tin cậy để hiển thị; giới hạn từng request 4.000 ký tự. Cần đặt quota/rate limit tại máy chủ tự quản lý trước khi mở production rộng rãi. Mặc định không có hoạt động dịch và không tự mua gói.

Hàng đợi giai đoạn 1 chạy khi tab mở. Mỗi đoạn dịch được lưu riêng trong sách; đóng tab dừng xử lý, mở lại và bấm dịch để bỏ qua các đoạn đã lưu. Không có worker dịch liên tục khi tab đóng. Request đã được nhà cung cấp nhận có thể hoàn tất dù người dùng tạm dừng; không tự retry request không rõ kết quả. Tác vụ nền bền vững, glossary/ngữ cảnh/QA thuộc giai đoạn 3.

## Cloudflare

`wrangler.jsonc` chứa Worker + Static Assets, hai tên riêng preview/production. Không có D1/R2. Auth và tệp cá nhân thuộc Supabase.

```sh
npm run build:preview
npx wrangler deploy
# Production dùng .env.production và env.production trong wrangler.jsonc:
npm run deploy
```

Các lệnh chỉ thực hiện khi tài khoản đã được chủ ứng dụng cấp quyền; đây là tài liệu vận hành, không phải bằng chứng đã deploy. Trong phiên này `wrangler whoami` trả về **chưa xác thực**, vì vậy chưa có URL HTTPS hay ứng dụng Cloudflare được tạo. Không dùng tài khoản preview tạm thời ngoài tài khoản của chủ ứng dụng.

Đưa secrets qua kho secrets/`wrangler secret put`, không nhúng ở frontend. Các vars không bí mật cần khai báo riêng từng môi trường trong Wrangler, secrets cũng tách riêng. Kiểm tra Workers Free và quota tài khoản trước khi deploy; không nâng gói. Sau deploy, cập nhật Auth site URL và redirect URL rồi chạy nghiệm thu trên URL thật. Rollback bằng `wrangler rollback` với version đã được liệt kê/kiểm tra; thay đổi schema cần migration tiến về trước, không xóa dữ liệu để rollback UI.

## Kiểm thử

```sh
npm test
npm run build
npm run test:e2e
npm audit --omit=dev
```

Playwright dùng `/usr/bin/chromium` nếu có; hoặc Chromium đã cài bởi Playwright. Có thể đặt `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. Kiểm thử khởi chạy Vite và Worker cục bộ, cần build trước. Kết quả và phạm vi thực sự: [docs/validation.md](docs/validation.md).

## Tài liệu

- [Kiến trúc và mô hình dữ liệu](docs/architecture.md)
- [Toàn bộ backlog theo giai đoạn](docs/backlog.md)
- [Đặc tả gốc của chủ ứng dụng](docs/requirements.md)
- [Kiểm chứng tích hợp chính thức](docs/integrations.md)
- [Kết quả nghiệm thu và giới hạn](docs/validation.md)

## Dùng nhanh

1. Bấm **Thêm sách**, chọn tệp hoặc dán nội dung; chọn đúng ngôn ngữ nguyên bản.
2. Mở sách, chọn ngôn ngữ đích và kiểu đọc. Nút dấu trang từng đoạn lưu chỗ đọc tiếp.
3. Bấm biểu tượng tệp cạnh đoạn để nhập/sửa/khóa bản dịch hoặc ghi chú. Chọn chữ để lưu từ cùng ngữ cảnh.
4. Nếu máy chủ dịch đã sẵn sàng, mở **Dịch & nghe**, xác nhận quyền gửi nội dung và dịch mẫu trước.
5. Trong **Góc trẻ em**, tạo hồ sơ, duyệt sách rồi mở góc đọc. Cửa về quản lý chưa khóa bằng PIN, không dùng như cơ chế cách ly tài khoản.
6. Sao lưu trong **Cài đặt & kết nối**. Dữ liệu cục bộ gắn với trình duyệt/origin này, chưa mã hóa trên thiết bị; xóa dữ liệu trình duyệt có thể làm mất sách nếu chưa sao lưu.
