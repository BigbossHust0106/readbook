# Bật đăng nhập Google cho Lá sách

Mã ứng dụng đã có nút **Đăng nhập bằng Google** tại **Cài đặt & kết nối → Tài khoản & Supabase**. Supabase cần một OAuth Client ID/Client Secret của Google để nút hoạt động với tài khoản thật. API key Google tìm kiếm sách không thay thế cặp OAuth này.

1. Mở [Google Cloud Console → Google Auth Platform](https://console.cloud.google.com/auth/overview), chọn hoặc tạo project dành cho ứng dụng.
2. Trong **Branding**, đặt tên ứng dụng (ví dụ Lá sách), email hỗ trợ và email liên hệ. Trong **Audience**, chọn External nếu muốn dùng tài khoản Google thông thường. Nếu ứng dụng đang ở Testing, thêm email sẽ đăng nhập vào Test users; nếu muốn cho người ngoài danh sách dùng, hoàn tất phần Audience/Publish phù hợp trong Google Console.
3. Vào **Clients → Create client → Web application**. Đặt **Authorized JavaScript origins**:

   ```text
   https://readbook.manhhuong.workers.dev
   ```

   Đặt **Authorized redirect URIs** (đây là callback của Supabase):

   ```text
   https://sddqnjefltipcpgypsun.supabase.co/auth/v1/callback
   ```

4. Sao chép **Client ID** và **Client Secret** từ OAuth client vừa tạo. Mở [Supabase → Authentication → Providers](https://supabase.com/dashboard/project/sddqnjefltipcpgypsun/auth/providers), chọn **Google**, nhập vào **Client IDs** và **Client Secret**, bật provider rồi lưu. Nhập Secret trực tiếp trong Supabase; không thêm vào mã frontend, GitHub, Cloudflare hoặc cuộc trò chuyện.
5. Supabase **Authentication → URL Configuration** đã được cấu hình cho website. Site URL:

   ```text
   https://readbook.manhhuong.workers.dev/
   ```

   Redirect URL của ứng dụng (khác callback Google ở bước 3):

   ```text
   https://readbook.manhhuong.workers.dev/auth/callback
   ```

6. Mở lại Lá sách → **Cài đặt & kết nối**, bấm **Đăng nhập bằng Google**, chọn tài khoản Google. Khi quay lại, ứng dụng hiển thị email và thư viện tài khoản. Có thể chuyển về thư viện cục bộ hoặc dùng chức năng đồng bộ dữ liệu thiết bị; không tự tải sách cục bộ lên tài khoản.

Không cần sửa database/migration, tạo Supabase project mới hoặc đưa Google Client Secret vào Secrets của Codex/Cloudflare. Giữ nguyên đăng nhập email và dữ liệu hiện có. Client dùng PKCE; khi xác nhận email đăng ký mới, mở liên kết trên cùng trình duyệt đã đăng ký.

Nếu Google báo `redirect_uri_mismatch`, đối chiếu chính xác URI Supabase ở bước 3, bao gồm HTTPS và `/auth/v1/callback`. Nếu báo `access_denied` khi Google app đang Testing, kiểm tra Test users. Nếu ứng dụng báo Google chưa được bật, kiểm tra switch và thao tác Save trong Google provider của đúng Supabase project. Nếu phiên đã hết hạn/thiếu verifier, bắt đầu lại bằng nút Google trên cùng trình duyệt, không chia sẻ hoặc mở lại URL callback cũ.

Trạng thái sau khi chủ tài khoản hoàn tất cấu hình ngày 23/10/2026: public `/auth/v1/settings` HTTP 200 với `external.google=true`; Management API xác nhận provider bật và có Client ID/Secret. Endpoint `/auth/v1/authorize` thật HTTP 302 tới `accounts.google.com`, dùng đúng Client ID đã cấu hình, callback Supabase ở trên, scope `email profile`, prompt `select_account`, response type `code`. Các ca đổi code/giữ phiên/logout được kiểm bằng fixtures và SDK thật; chưa chọn/đăng nhập một tài khoản Google cá nhân để nghiệm thu consent và token exchange thật.
