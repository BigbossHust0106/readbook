# Tích hợp: đã xác minh gì

Ngày kiểm tra: 19/10/2026. Không có API key, tài khoản hay máy chủ dịch sẵn trong runtime. Không in giá trị biến môi trường hoặc credential.

## LibreTranslate

Website docs bị egress proxy trả 403. Đã đọc nguồn chính thức mới nhất qua GitHub:

- https://github.com/LibreTranslate/LibreTranslate/blob/main/README.md
- https://github.com/LibreTranslate/LibreTranslate/blob/main/libretranslate/app.py

Nguồn triển khai chính thức có `GET /languages` trả `code` và `targets`, `POST /translate` nhận `q`, `source`, `target`, `format`, tùy chọn `api_key`; kết quả `translatedText`. Adapter dùng đúng giao thức, URL chỉ từ cấu hình server. Không dùng endpoint Google không chính thức, không gọi instance công cộng không rõ điều khoản.

Tests Worker và E2E dùng phản hồi provider có nhãn fixture, **không chứng minh bản dịch thực tế hoặc chất lượng dịch**. Cần endpoint được chủ ứng dụng cấp quyền và các model hỗ trợ vi/zh/en. UI không bật chế độ ngữ cảnh/hiệu đính/offline khi chưa có nhà cung cấp thực sự.

## Cloudflare

Đã đọc tài liệu Static Assets chính thức trong repo Cloudflare (website docs bị proxy 403):

- https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/workers/static-assets/index.mdx

Cấu hình dùng `main`, `assets.directory`, binding `ASSETS`, SPA fallback và Worker-first routing. Wrangler schema/build/runtime local đã chấp nhận. Worker + assets được build và chạy thật bằng `wrangler dev --local`. Free-plan quota tài khoản, account ID, subdomain và quyền deploy **chưa kiểm tra được** vì `wrangler whoami` báo chưa xác thực. Không tự triển khai vào tài khoản tạm ngoài quyền người dùng.

## Supabase

Không có Supabase MCP/API capability được cung cấp trong phiên, CLI chưa có, và không có binding/biến xác thực Supabase. Đã hoàn thiện adapter `@supabase/supabase-js`, migration, policy và test PostgreSQL local. Chưa tạo project/bucket remote, chưa chạy hosted Auth/RLS/Storage test. Không dùng database của project khác.

## Hanzii

Chưa truy cập được `hanzii.net` từ môi trường (proxy 403), chưa xác minh API/OAuth/deep link/CSV notebook chính thức hoặc quyền lợi Pro có thể chuyển vào ứng dụng ngoài.

UI chỉ thực hiện cơ chế web chuẩn: sao chép từ do người dùng chọn, mở `https://hanzii.net` ở tab khác. Người dùng tự dán để tra. Không tuyên bố có truyền từ tự động, mở app theo deep link, tự đồng bộ hoặc CSV tương thích Hanzii. Nếu clipboard/popup không hoạt động, báo sao chép/mở thủ công. Không iframe, cookie, mật khẩu hay API nội bộ.

## Kết nối cần bổ sung (qua xác thực/kho secrets, không qua chat)

- Quyền Supabase cho tạo **project mới** và thông tin chọn tổ chức nếu có nhiều tổ chức; cần kiểm tra còn suất free trước khi tạo.
- Quyền Cloudflare cho Workers/Static Assets trong tài khoản đã chọn; kiểm tra Workers Free và các tài nguyên cùng tên trước khi tạo.
- URL máy chủ LibreTranslate tự quản lý, API key nếu máy chủ yêu cầu, model phù hợp; whitelist hostname khi mạng hạn chế.

Khi có quyền, Codex tiếp tục thiết lập và deploy; không giao việc tạo bảng/bucket/migration hay chạy deploy trở lại chủ ứng dụng. Đây là thiếu quyền kết nối trong phiên, không phải yêu cầu xin phép lại việc đã được ủy quyền.
