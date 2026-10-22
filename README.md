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
- Kết nối Google Translate trong trình đọc (mặc định, sáu chiều Việt/Anh/Trung) và MyMemory tùy chọn (API chính thức có hạn mức) và adapter LibreTranslate tùy chọn qua Worker: đọc mô hình khả dụng, dịch mẫu/chương, xác nhận gửi dữ liệu, xử lý từng đoạn và lưu ngay. Dừng khi 429 hoặc lỗi mạng; tiếp tục phần chưa có bản dịch, không fallback. Chỉ bật các cặp thực sự được máy chủ hỗ trợ.
- CSV: xem trước, ánh xạ, gộp theo từ/ngôn ngữ/nghĩa hoặc giữ riêng; xuất CSV chung có bảo vệ công thức bảng tính. **Chưa xác minh tương thích Hanzii hay Anki.**
- Mở trang chủ Hanzii sau sao chép từ Trung; không dùng deep link/API chưa xác minh, không đăng nhập Hanzii.
- Phần nền giai đoạn 2: hồ sơ trẻ thuộc phụ huynh, duyệt sách và bật ngôn ngữ; luyện đọc từng câu, TTS trình duyệt, micro chỉ bật khi bấm thu âm và cấp quyền. Bản thu chỉ trong RAM, không lưu cloud, không chấm phát âm. Mức luyện ngoài đọc câu chưa có giáo trình riêng.
- IndexedDB cục bộ; sao lưu/khôi phục JSON gồm tệp gốc, không ghi đè ID đã có. PWA lưu vỏ ứng dụng và đọc sách cục bộ offline sau lần mở có mạng; không cache API hoặc tài liệu cloud.
- Adapter Supabase Auth/DB/private Storage, migration RLS cho từng thao tác. Revision phát hiện ghi sách từ thiết bị khác để chặn ghi đè im lặng; mở lại/tải lại để đọc dữ liệu mới, chưa có đồng bộ thời gian thực hoặc hàng đợi sửa cloud khi offline.

## Supabase

Cấu hình công khai trong `.env.local` (máy phát triển), `.env.preview` hoặc `.env.production` theo `.env.example`. Chỉ dùng publishable/anon key, tuyệt đối không dùng service-role key ở `VITE_*`.

Migration: `supabase/migrations/202610190001_initial.sql`. Bucket `originals` riêng tư, đường dẫn `<owner UUID>/<book UUID>/original`. Mỗi bảng có policy SELECT/INSERT/UPDATE/DELETE; policy storage kiểm tra thư mục chủ sở hữu. Tài khoản trẻ không có thông tin đăng nhập riêng. `translation_jobs` và `integration_events` là nền schema, chưa được frontend sử dụng cho worker nền hoặc nhật ký cloud.

Đã kiểm tra project `sddqnjefltipcpgypsun` ngày 20/10/2026: 5 bảng ứng dụng bật RLS, bucket `originals` riêng tư và Auth site URL đúng website production. Không tạo thêm project hoặc chạy lại migration lên dữ liệu có sẵn. Nghiệm thu Auth/Storage end-to-end bằng hai tài khoản live vẫn còn trong backlog.

Địa chỉ Auth phải dùng đúng origin HTTPS được Cloudflare cấp. `site_url` và redirect URL của preview/production tách riêng. Không dùng wildcard tùy ý cho production. Mặc định email phải được xác nhận; cấu hình nhà cung cấp email tùy dự án.

## Dịch song ngữ

Mặc định production bật `TRANSLATION_ENABLED=true`, `TRANSLATION_PROVIDER=google`. Google Translate trả nghĩa ngay trong trình đọc, không cần khóa API. Endpoint công khai có thể thay đổi hoặc giới hạn lượt, không có SLA. Có thể chọn `TRANSLATION_PROVIDER=mymemory` để dùng API chính thức https://api.mymemory.translated.net/get ; bản miễn phí ẩn danh giới hạn **5.000 ký tự/ngày theo IP dịch vụ**, có thể chia sẻ giữa người dùng. Không nâng gói hoặc hứa dịch không giới hạn.

Trong trình đọc, bấm **Dịch song ngữ**, đồng ý gửi văn bản tới nhà cung cấp rồi chọn **Dịch trang này**, **Dịch chương** hoặc **Dịch toàn sách / tiếp tục**. Chỉ gửi các đoạn còn thiếu; lưu ngay từng đoạn đã hoàn tất, giữ đoạn sửa/khóa. Gặp hết hạn mức hoặc mất mạng thì dừng, lần sau bỏ qua đoạn đã lưu. Công việc chạy khi tab còn mở, chưa có dịch nền bền vững. Đầu ra máy có nhãn nhà cung cấp, vẫn cần kiểm tra chất lượng.

Worker giới hạn đầu vào 4.000 ký tự/đoạn; chia theo biên UTF-8 dưới 1.000 byte mỗi yêu cầu Google hoặc 500 byte mỗi yêu cầu MyMemory, ưu tiên ngắt câu/từ. Các lỗi/quota warning không được lưu thành bản dịch. Không tự chuyển nhà cung cấp.

Có thể chọn `TRANSLATION_PROVIDER=libretranslate` và đặt `LIBRETRANSLATE_URL`, `LIBRETRANSLATE_API_KEY` (secret Worker), `SUPABASE_URL`, `SUPABASE_ANON_KEY` để dùng adapter tự triển khai có xác thực như trước. LibreTranslate phải cung cấp `/languages` và `/translate`; chỉ bật những cặp thực sự có model. `LOCAL_TRANSLATION=true` chỉ bỏ JWT khi request localhost. Không bật dịch có phí hoặc dựng máy chủ gây phí tự động.

## Cloudflare

`wrangler.jsonc` chứa Worker + Static Assets, hai tên riêng preview/production. Không có D1/R2. Auth và tệp cá nhân thuộc Supabase.

```sh
npm run build:preview
npx wrangler deploy
# Production dùng .env.production và env.production trong wrangler.jsonc:
npm run deploy
```

Production dùng Worker hiện có `readbook`, URL https://readbook.manhhuong.workers.dev/. Khi deploy giữ nguyên các biến đang có bằng `--keep-vars`. Không thay đổi gói tài khoản. Xem bằng chứng triển khai mới nhất trong `docs/validation.md`.

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
5. Trong **Góc trẻ em**, tạo hồ sơ, duyệt sách rồi mở góc đọc. Có thể đặt PIN để khóa cửa về quản lý trên trình duyệt này; đây không phải cơ chế cách ly tài khoản.
6. Sao lưu trong **Cài đặt & kết nối**. Dữ liệu cục bộ gắn với trình duyệt/origin này, chưa mã hóa trên thiết bị; xóa dữ liệu trình duyệt có thể làm mất sách nếu chưa sao lưu.

## Bổ sung ngày 20/10/2026

Noto Sans có dấu tiếng Việt, tự lưu và cache offline. Sổ từ có ôn theo lịch tự đánh giá (10 phút / ngày). Góc trẻ có lịch sử 100 buổi gần nhất và PIN phụ huynh trên trình duyệt; reload phiên trẻ yêu cầu PIN trước khi mở ứng dụng. Lịch ôn và buổi luyện đi cùng JSON của từ/hồ sơ, tương thích dữ liệu cũ, không cần migration mới. PIN không đồng bộ cloud và không thay thế xác thực tài khoản.

## PDF, OCR và giới hạn tệp

Tệp sách tối đa **50 MB (52.428.800 byte)** ở cả local và bucket Supabase `originals`. Migration bổ sung: `supabase/migrations/202610200002_originals_50mb.sql` (đã áp dụng lên project hiện có). Giới hạn global storage của project cũng đã xác nhận là 50 MB; không thay đổi gói. Tệp EPUB/DOCX giải nén tối đa 150 MB, văn bản trích xuất tối đa 30 MB; CSV vẫn 5 MB và backup JSON vẫn 100 MB.

Trong **Thêm sách**, chọn PDF → chọn ngôn ngữ nguyên bản (mặc định toàn bộ tệp) → **Đọc PDF / OCR** → đối chiếu trang gốc, sửa văn bản → **Nhập & lưu sách**. Mặc định OCR trang có dưới 10 ký tự không phải khoảng trắng; chọn OCR tất cả nếu trang có lớp chữ không đầy đủ. Hỗ trợ Việt/Anh/Trung giản thể. Chỉ số tin cậy OCR là ước tính của engine. Không có cam kết độ chính xác hoặc giữ bố cục nhiều cột/bảng. PDF có mật khẩu cần được xuất thành bản không khóa.

Mặc định xử lý toàn bộ PDF, không còn giới hạn 200 trang hoặc 50 trang OCR. Có tùy chọn khoảng trang nếu bạn muốn; không bắt buộc chia tệp. Tiến độ từng trang được ghi vào IndexedDB theo SHA-256/ngôn ngữ/mode để tiếp tục sau khi hủy hoặc mở lại. Tiến độ được dọn sau khi nhập thành công. Tệp gốc vẫn đầy đủ, từng chương nhớ số trang gốc. Có thể nhập các khoảng khác nhau của cùng PDF. Trong trình đọc dùng **Đối chiếu PDF gốc**.

OCR chạy trong browser worker, không gọi API tính phí và không gửi trang scan ra dịch vụ OCR. Ở chế độ cloud, sách/văn bản và PDF gốc vẫn được lưu vào tài khoản Supabase như các định dạng khác. Engine, WASM và model được tự lưu bởi `scripts/prepare-document-assets.mjs`, tự chạy trước dev/build; không commit các tệp nhị phân được tạo. Service worker cache engine/model sau khi dùng; lần đầu cần mạng. Hiệu năng phụ thuộc RAM/CPU của thiết bị, nên chọn khoảng ngắn trên điện thoại.

## Trình đọc và tìm sách DTV — 21/10/2026

Chọn **Lật trang** hoặc **Cuộn liên tục**. Thanh kéo 500–8.000 ký tự gốc/trang điều chỉnh phân trang; vị trí lưu có offset trong đoạn để khôi phục khi đổi lượng chữ. Cuộn liên tục tự nối thêm chương khi đến cuối phần đang tải. Máy tính có nút trước/sau ở đáy màn hình; điện thoại vuốt ngang. Chế độ lật trang đo bố cục thực để vừa màn hình. Các đoạn hiển thị thành dòng văn xuôi, bỏ đường ngăn và hàng công cụ chen giữa; chạm/hover/focus đoạn để hiện thao tác. Không sửa ngôn ngữ hoặc văn bản gốc khi đổi cách đọc.

Trong **Thêm sách → Tìm sách trên DTV-Ebook**, nhập từ khóa và bấm **Tìm sách** để lấy kết quả từ nguồn tìm kiếm đã cấu hình. Mỗi kết quả hiển thị tên, liên kết DTV và **Thêm vào thư viện**. Sau khi xác nhận quyền sử dụng, nút này đọc trang nguồn, tìm tệp rồi nhập EPUB/DOCX/TXT vào thư viện hiện tại; nếu có nhiều định dạng, người dùng chọn một định dạng. PDF được tải vào bước **Đọc PDF / OCR** để xử lý và kiểm tra trước khi lưu. Luồng lưu sử dụng cùng tài khoản cloud / nhóm đang chọn như nhập tệp thông thường; không cần tải qua ổ đĩa của người dùng.

**Tải danh mục mới** chỉ đọc tối đa 100 đầu sách trên trang chủ DTV, không phải tìm toàn bộ kho. **Tìm trên DTV** và **Tìm bằng Google trong DTV** mở tìm kiếm ngoài ứng dụng, luôn có sẵn khi nguồn nội bộ chưa được cấu hình hoặc bị chặn. Nếu thiếu nguồn tìm kiếm, API trả `SEARCH_NOT_CONFIGURED`, không tạo kết quả thay thế. Nguồn DTV mẫu vẫn trả 403/1010 từ mạng Codex; chưa xác nhận được luồng tìm/trích trang DTV thật trên production.

**Hoặc nhập từ liên kết tệp/trang sách** nhận HTTPS thuộc dtv-ebook.com.vn / www.dtv-ebook.com.vn và tệp Google Drive công khai (`docs.google.com/uc?id=…`, `drive.google.com/file/d/…/view`). Bấm **Tìm tệp sách**, xác nhận quyền sử dụng rồi **Nhập [định dạng]** để tải, kiểm tra metadata và lưu. Chuyển hướng Drive chỉ được theo tới dịch vụ tải Google cho cùng mã tệp. Không chuyển tiếp cookie/token tài khoản; không vượt đăng nhập, CAPTCHA hoặc xác nhận tải. Tệp tối đa 50 MB, giới hạn cả khi server không cung cấp Content-Length. Trang HTML đăng nhập/xác nhận không được nhập thành sách.

Nguồn tìm kiếm hiện hỗ trợ **Brave Search API**: tạo/quản lý API key trên [Brave Search API](https://api-dashboard.search.brave.com/), tự kiểm tra gói, hạn mức và chi phí trước khi sử dụng. Cloudflare → Workers & Pages → `readbook` → Settings → Variables and Secrets → Add, chọn **Secret**, đặt tên `BRAVE_SEARCH_API_KEY`, nhập khóa rồi deploy cấu hình. Không cần thay đổi Supabase. Máy chủ chỉ trả kết quả thuộc trang sách DTV; khóa nằm phía Worker. Có khóa Brave thì ưu tiên Brave. Chưa cấu hình/chưa nghiệm thu Brave thật vì môi trường hiện không có khóa này; không tự bật gói tính phí. API tìm kiếm chỉ cung cấp metadata; nếu DTV chặn đọc trang sách bằng 403 thì vẫn cần dán liên kết Drive trực tiếp. [Tài liệu API và phân trang](https://api-dashboard.search.brave.com/documentation/services/web-search).

Nguồn dự phòng tùy chọn hỗ trợ Google Custom Search JSON API cho **khách hàng đã có quyền sử dụng**: Cloudflare → Workers & Pages → `readbook` → Settings → Variables and Secrets, thêm secret `GOOGLE_SEARCH_API_KEY` và biến `GOOGLE_SEARCH_ENGINE_ID` (cx), rồi deploy cấu hình. API key nên giới hạn cho Custom Search API và hạn mức phù hợp. Không đưa khóa vào mã frontend, Git hoặc hội thoại. **API này không nhận khách hàng mới và sẽ ngừng ngày 01/01/2027**, theo [tài liệu chính thức](https://developers.google.com/custom-search/v1/overview) kiểm tra ngày 22/10/2026. Không cần tạo tài khoản mới hoặc bật tính phí để dùng nhập liên kết; nếu chưa có quyền API, dùng tìm kiếm ngoài ứng dụng rồi dán liên kết tải vào đây. Không thể coi toàn bộ tính năng tìm kho DTV trong ứng dụng là đã vận hành khi chưa có nguồn tìm kiếm khả dụng.

Kiểm tra thực tế ngày 22/10/2026: Worker chạy bằng workerd, tải liên kết Google Drive công khai do người dùng cung cấp, nhận nguyên tệp PDF 19.243.671 byte / 164 trang, tên tiếng Việt `Con Có Thể Làm Được Mà! - Maja Pitamic.pdf`, SHA-256 `0fc84be6986aa22b2b94f0609e75d26a3465ffdaa0aca7ba516530ed08127d1a`. Đây là kiểm tra tệp thật qua proxy của môi trường, không chứng minh DTV bỏ chặn hoặc toàn bộ 164 trang đã OCR. Không commit nội dung PDF.

## Đọc trên nhiều thiết bị và trong nhóm

Đăng nhập cùng tài khoản trong **Cài đặt & kết nối** trên các thiết bị. Với sách cũ đang lưu riêng trong trình duyệt, bấm **Đưa dữ liệu thiết bị lên cloud** trên chính thiết bị đó một lần; sách/tệp gốc, ghi chú, từ vựng và hồ sơ trẻ được chuyển, bản local vẫn giữ. Nếu chưa có tài khoản, đăng ký và xác nhận email rồi đăng nhập.

Mở **Nhóm đọc & cloud**, đặt tên hiển thị, tạo nhóm rồi **Thêm sách vào nhóm**. Chủ nhóm tạo mã mời, người khác đăng nhập và nhập mã trong cùng màn hình. Tệp giống hệt và cùng ngôn ngữ được dùng lại trong nhóm; mỗi thành viên có tag tiến độ riêng, ghi chú/bản dịch riêng. Bấm **Xem tag tiến độ** để xem các thành viên đang đọc đến đâu.

Trình đọc tự mở lại sách và vị trí cuối. Chế độ lật trang chứa phần chữ vừa một màn hình. Máy tính dùng nút trái/phải, bấm lề hoặc phím mũi tên; điện thoại vuốt ngang. Bôi đen từ/cụm để mở bảng dịch và lưu từ. **Hiện công cụ** mở thanh phía trên tại vị trí đang đọc. Nút ba sọc mở cùng menu thư viện/từ vựng/nhóm/cài đặt trên máy tính và điện thoại; khi đọc có thêm mục lục và tìm toàn sách.

Đồng bộ dùng polling khoảng 10 giây khi online; vị trí offline được gửi lại khi nối mạng. Google Dịch mở qua liên kết theo từ, dịch nổi dùng MyMemory hoặc mô hình đã có sẵn trong trình duyệt; MyMemory có hạn mức miễn phí.

## Đồng bộ ngoại tuyến và tìm kiếm toàn sách

Ghi chú, bản dịch thủ công, kệ sách, từ vựng và hồ sơ trẻ được ghi vào thiết bị trước; khi có mạng ứng dụng tự gửi lại khi tab mở. Trong **Cài đặt & kết nối → Thay đổi chờ đồng bộ**, xem mục chờ gửi, bấm đồng bộ hoặc tải bản sao. Nếu hai máy sửa cùng một nội dung, ứng dụng giữ hai bản; chọn bản trên thiết bị hoặc trên cloud. Chọn bản áp dụng cho cả mục đang hiển thị. Đừng xóa dữ liệu trình duyệt khi còn thay đổi chưa gửi.

Mở **Mục lục**, nhập vào **Tìm chương hoặc toàn sách** để tìm cả nguyên văn và bản dịch hiện có, kể cả chương chưa mở. Hỗ trợ tìm tiếng Việt không dấu. Bấm kết quả để tới đoạn đó. Trong công cụ đọc có thêm phông chữ, khoảng dòng và chiều rộng; tùy chọn lưu riêng trên từng thiết bị.

Thêm sách, sửa nội dung gốc và thao tác tệp gốc cloud vẫn cần mạng. Đợt này chưa thêm dịch vụ AI trả phí hoặc xử lý tác vụ khi trình duyệt đóng.

Ở chế độ lật trang, bấm **Hiện công cụ** để đổi cỡ chữ, phông, khoảng dòng, chiều rộng hoặc chuyển sang cuộn liên tục. Khi đóng công cụ, trang đọc vừa màn hình và không cần kéo dọc. Bôi đen từ/cụm để dịch; bảng nổi cho chỉnh nghĩa và **Lưu từ**, không tự hiện khi rê chuột. Giới hạn phần bôi đen là 1.000 ký tự; dịch trang/chương vẫn là thao tác riêng trong công cụ.


Trong bảng **Dịch và lưu từ**, nếu nguồn dịch gián đoạn hãy bấm **Thử dịch lại**. Bạn có thể sửa cụm từ rồi bấm **Dịch**. Nghĩa tự nhập được giữ khi kết quả đến; bấm **Dùng bản dịch** nếu muốn thay bằng kết quả mới. **Google Dịch** mở riêng khi cần; nguồn MyMemory miễn phí vẫn có hạn mức.


## Dấu trang và nhập bản dịch có sẵn

Trong trình đọc mở **menu ba sọc → Dấu trang**, đặt tên (có thể bỏ trống) rồi **Lưu trang đang đọc**. Có thể lưu nhiều vị trí trong cùng đoạn; vị trí đọc tiếp vẫn tự lưu độc lập. Bấm dấu trang để trở lại, dùng **Đổi tên / Xóa dấu trang** để quản lý; nhập ở ô tìm trong bảng để lọc tên hoặc trích đoạn. Nút **Thêm dấu trang đoạn…** cạnh đoạn lưu ngay đầu phần đang hiển thị.

Mở **Hiện công cụ → Dịch & nghe → Nhập bản dịch có sẵn**, chọn ngôn ngữ đích và chương/toàn sách. Dán nội dung, cách đoạn bằng dòng trống, hoặc chọn TXT/EPUB/DOCX/HTML tối đa 50 MB. Bấm **Đối chiếu bản dịch**: ghép ban đầu theo thứ tự, cần kiểm tra khi hai bản chia đoạn khác nhau. Chọn số **Đoạn nguyên văn**, sửa ô **Bản dịch đang ghép**; trong mục điều chỉnh, chọn **Đoạn trong bản dịch** rồi gán hoặc ghép thêm. Các đoạn chưa ghép phải được xử lý hoặc xác nhận bỏ qua. Kiểm tra số đoạn sẽ lưu, xác nhận đối chiếu rồi **Lưu bản dịch đã ghép**.

Mặc định giữ bản dịch đã có và luôn giữ đoạn khóa. Có thể chọn thay các bản chưa khóa; lịch sử cũ được giữ tối đa 20 bản/đoạn. Bản nhập mới mặc định được khóa, có nhãn **Bản dịch nhập sẵn**. Không gọi dịch máy hoặc thay tệp nguyên văn. Ở chế độ cloud, dấu trang và bản dịch này thuộc tài khoản của bạn, đi cùng hàng đợi đồng bộ ngoại tuyến; các thành viên nhóm dùng chung sách gốc nhưng không thấy dữ liệu riêng của nhau.


Trong **Nhóm đọc & cloud**, chọn nhóm → **Chọn sách từ cloud của tôi** → tìm và đánh dấu các sách → **Thêm sách đã chọn vào nhóm**. Dùng sách/tệp đã có trên cloud, không cần tải lên lần nữa. Sách đã có cùng nội dung/ngôn ngữ trong nhóm được nhận diện. Chỉ sách do tài khoản của bạn sở hữu được chia sẻ từ danh sách này; bản riêng vẫn còn trong thư viện. Khi thêm nhiều sách mà một sách gặp lỗi, các sách thành công vẫn được giữ, các lựa chọn còn lại có thể thử lại.


## Kéo thả tệp sách

Trên máy tính, kéo **một tệp** PDF/EPUB/TXT/DOCX/HTML vào vùng **Kéo thả sách vào thư viện** hoặc vùng chọn tệp trong cửa sổ **Thêm sách**. Vùng nhận sáng lên khi kéo qua. Kiểm tra tên sách, tác giả và ngôn ngữ rồi **Nhập & lưu sách**. PDF vẫn cần **Đọc PDF / OCR** và kiểm tra văn bản trước khi lưu. Tối đa 50 MB/tệp.

Trong nhóm chọn **Thêm sách vào nhóm**, rồi kéo tệp vào cửa sổ nhập; sách được thêm vào nhóm đang chọn. Điện thoại vẫn dùng nút chọn tệp. Thả nhầm nhiều tệp, thư mục hoặc định dạng không hỗ trợ sẽ báo lỗi và giữ nội dung đang nhập. Kéo thả chưa hỗ trợ nhập hàng loạt.


Khi thêm sách, tên dạng **ABC - XYZ.pdf** tự điền **Tên sách: ABC**, **Tác giả: XYZ**. Áp dụng cho chọn tệp, kéo thả và tên nhập trực tiếp (tách khi rời ô tên). Nếu có nhiều dấu ` - `, dùng dấu cuối để giữ phụ đề ở phần tên sách. Không tách dấu nối liền như `Jean-Paul`. Bạn có thể sửa hai ô trước khi lưu; đổi tệp giữ các giá trị đã sửa tay.

## Phân trang ưu tiên và nghe đoạn văn — 22/10/2026

Chế độ lật trang đo trang tại vị trí đang đọc trước, cho trang đó hiển thị rồi chuẩn bị thêm hai trang phía sau. Phần còn lại được đo dần cả tiến và lùi trong các đợt nhàn rỗi khoảng 4 ms; yêu cầu lật tới trang chưa chuẩn bị được ưu tiên. Trình đọc giữ vị trí bằng chương/đoạn/offset, nên trang không nhảy khi phần nền bổ sung các trang trước đó. Tổng số trang hiển thị `…` đến khi tính xong. Đổi cỡ chữ, phông, khoảng dòng, chiều rộng, ngân sách ký tự hoặc xoay màn hình hủy tác vụ cũ và đo lại từ vị trí hiện tại. Ba bố cục hoàn chỉnh gần nhất được giữ trong RAM; tiến độ/ghi chú/dấu trang và lần đồng bộ có cùng văn bản không làm chia lại trang. Vẫn cần tải tài liệu sách từ bộ nhớ/cloud trước khi đo bố cục, và cần giữ tab mở để phần nền chạy.

**Hiện công cụ → Hiện nút chuyển trang** là công tắc riêng, lưu trên thiết bị, áp dụng cho cả điện thoại và máy tính. Ẩn các nút không thay đổi ngân sách ký tự hay kích thước trang; phím trái/phải, chạm hai nửa trang và vuốt vẫn hoạt động.

Bấm biểu tượng loa trên thanh đầu để **Nghe trang đang đọc**, hoặc loa **Nghe đoạn N** trong thao tác đoạn để nghe toàn đoạn. Trình phát có MP3/native controls, tạm dừng, tiếp tục, dừng và thử lại. Trong công cụ có **Nguồn giọng đọc**:

- **Google trực tuyến** mặc định: chỉ gửi từng phần văn bản đang nghe qua `/api/speech` tới endpoint Google Translate TTS, tối đa 180 Unicode code point/phần, chuẩn bị trước một phần kế tiếp. Không cần API key, không sửa Supabase, không bật dịch vụ trả phí. Endpoint công khai này không phải Google Cloud Text-to-Speech có SLA; có thể thay đổi, bị chặn hoặc giới hạn lượt. Ứng dụng báo lỗi và cho thử lại/chọn giọng thiết bị, không giả âm thanh. Cần Internet; request/âm thanh không lưu vào cloud hoặc service-worker cache. Âm thanh chỉ giữ tạm trong RAM và giải phóng khi dừng/đổi sách. Nếu trình duyệt chặn tự phát sau khi tải, bấm **Phát** hoặc **Tiếp tục nghe** trên trình phát.
- **Giọng thiết bị**: không gọi API giọng đọc của ứng dụng, chờ `voiceschanged`, chọn giọng đúng ngôn ngữ sách (Việt/Anh/Trung) và giữ utterance theo từng phần để tránh mất đối tượng/đoạn quá dài. Thiếu giọng thì báo rõ, có thể cài giọng trên thiết bị hoặc chọn Google trực tuyến. Tính offline của giọng hệ thống phụ thuộc thiết bị/nhà cung cấp giọng.

Kiểm tra thực tế qua workerd và proxy môi trường: Google TTS trả MP3 HTTP 200 cho Việt/Anh/Trung. Chromium chế độ điện thoại giải mã và phát âm thanh thật dưới CSP production (`currentTime > 0`, `paused=false`, `readyState=4`). Kiểm tra tự động không thay thế đánh giá nghe bằng tai hoặc kiểm tra mọi thiết bị. Fixture `tests/fixtures/speech-vi.mp3` là âm thanh tổng hợp của câu thử “Đọc sách mỗi ngày.”; kiểm tra giao diện thường dùng fixture để không phụ thuộc quota bên ngoài.


## Điều khiển đọc và dịch Google tại chỗ — 22/10/2026

Nghe trang tự chuyển sang trang/chương tiếp theo khi đọc xong toàn bộ các phần âm thanh của trang, giữ giọng/âm lượng/tốc độ và dừng khi hết sách. Nút dừng, chuyển sách, điều hướng thủ công hoặc hết giờ hẹn vô hiệu hóa yêu cầu đọc tiếp đang chờ. Nghe **phần bôi đen** chỉ đọc phần chọn, không tự đọc cả sách. Có âm lượng 0–100%, tốc độ, giọng thiết bị thực có và cao độ (chỉ giọng thiết bị); giọng Google trực tuyến hiện chỉ có một giọng mỗi ngôn ngữ, không tạo lựa chọn nam/nữ giả. Một số điện thoại yêu cầu dùng phím âm lượng hệ thống. Với giọng thiết bị, thay đổi tốc độ/cao độ áp dụng từ phần đọc tiếp theo. Hẹn giờ tùy chỉnh 0–1.440 phút: 0 tắt; tính từ lúc bắt đầu nghe, đổi thời lượng khi đang nghe sẽ đặt lại hạn từ thời điểm đổi. Tạm dừng vẫn tính thời gian. Bộ hẹn giờ thuộc tab trình duyệt, cần tab tiếp tục chạy; có kiểm tra lại khi tab hiện và trước khi đọc trang tiếp.

Bỏ điều khiển số ký tự/trang và chiều rộng; bỏ tác động của setting cũ tới bố cục. Trang tự vừa khung và cỡ chữ. **Cỡ chữ** là ô số 8–72. Nút menu và thanh đầu giữ vị trí khi cuộn ở mọi tab. Menu dùng các chức năng toàn cục cố định, chỉ danh sách chương cuộn độc lập; mục lục gắn đúng sách và chỉ có khi đang đọc. Các tab phụ Thư viện/Từ vựng/Dấu trang và tìm kiếm trong menu được bỏ. Danh sách dấu trang và tìm toàn sách vẫn truy cập trong **Hiện công cụ**.

Không tạo thanh thao tác nổi khi hover đoạn. Bôi đen mới hiện hộp dịch cùng lưu dấu trang tại offset chọn, lưu vị trí, tô sáng, ghi chú/bản dịch và nghe phần chọn. Dữ liệu dấu trang cũ vẫn giữ, đổi tên/xóa trong danh sách dấu trang.

Dịch mặc định đổi sang **Google Translate**, cấu hình `TRANSLATION_PROVIDER=google` trong Worker. `/api/translate` trả kết quả ngay trong hộp bôi đen / bản dịch song ngữ; nút **Dịch bằng Google** gọi `/api/translate/google` cố định để thử trực tiếp ngay cả khi cấu hình cũ còn MyMemory. Không mở tab Google Translate, không cần cài tiện ích trình duyệt, không nhúng iframe/script bên ngoài hoặc nới CSP. Endpoint công khai `translate.googleapis.com/translate_a/single` không có SLA và có thể bị chặn/giới hạn; không phải Cloud Translation API trả phí, không cần lấy khóa Custom Search để dịch. Mỗi đoạn tối đa 4.000 UTF-16 code unit, chia yêu cầu dưới 1.000 byte UTF-8; chỉ báo giới hạn lượt khi upstream HTTP 429. HTTP 403/5xx hoặc dữ liệu lỗi là lỗi nguồn riêng, không gán thành “hết hạn mức”. Không cache/lưu lỗi thành nghĩa, không ghi đè nghĩa sửa tay. MyMemory giữ làm adapter tùy chọn; hạn mức theo IP dịch vụ có thể dùng chung giữa nhiều người, không phản ánh số từ tài khoản vừa dịch.

Kiểm tra Google thật qua workerd và proxy môi trường: `Ăn → Eat`, `Eat → Ăn`, `吃 → ăn`; Chromium đọc sách, bôi đen và hiện nghĩa `Eat` ngay trong hộp dịch, không mở trang khác. Chưa chứng minh khả dụng qua mọi IP Cloudflare hoặc mọi thời điểm; API public có thể thay đổi.

## Cài Lá sách trên điện thoại

Mở menu **☰ → Cài đặt ứng dụng**, hoặc vào **Cài đặt & kết nối → Cài đặt ứng dụng**. Mục này có cả khi đang đọc sách. Android Chrome/Edge: bấm **Cài Lá sách** khi trình duyệt cung cấp lời mời cài; nếu chưa có, mở menu trình duyệt → **Cài đặt ứng dụng / Thêm vào màn hình chính**. iPhone/iPad: mở trong Safari → **Chia sẻ → Thêm vào MH chính → Thêm**; bật **Mở dưới dạng ứng dụng web** nếu có. Nếu mở bằng trình duyệt trong Zalo/Facebook/Instagram, chuyển sang Safari/Chrome trước. Không tự bật hộp thoại hoặc khẳng định đã cài chỉ vì đã bấm xác nhận; trạng thái dựa trên `appinstalled` hoặc chế độ standalone. Có PNG 192/512, Apple touch icon 180 và metadata; hướng dẫn/biểu tượng vẫn dùng được ngoại tuyến sau khi vỏ ứng dụng được lưu. Cài đặt và dữ liệu cục bộ thuộc từng thiết bị; đồng bộ nhiều thiết bị vẫn cần đăng nhập/cloud.

## Lật trang, cảm nghĩ và đánh giá trong nhóm

Chế độ **Lật trang** có hiệu ứng giấy cong bốn dải và bóng đổ theo chiều lật, áp dụng nút/phím/vuốt và tự lật khi nghe hết trang. Trang mới được cập nhật ngay; chỉ trang cũ đang nhìn được chụp vào lớp trang trí tạm trong RAM, không quét/chia lại cả sách. Lật nhanh hủy hiệu ứng cũ; đổi cỡ chữ/bố cục, xoay màn hình hoặc rời trình đọc sẽ dọn lớp này. Tôn trọng **Giảm chuyển động** của thiết bị; chế độ cuộn liên tục không có hiệu ứng lật.

Trong **Nhóm đọc & cloud**, chọn nhóm → **Thảo luận & đánh giá** dưới sách. Thành viên đăng nhập có thể chia sẻ cảm nghĩ tối đa 2.000 ký tự, sửa/xóa bình luận của mình; chủ nhóm có thể xóa bình luận trong nhóm để quản lý. Hiện tên thành viên và thời điểm, bình luận mới trước, tải thêm từng 30 bình luận. Văn bản được hiển thị thuần, không thực thi HTML. Mỗi tài khoản có **một đánh giá 1–5 sao cho mỗi sách trong mỗi nhóm**, có thể thay đổi hoặc bỏ; điểm trung bình và số lượt đánh giá hiện ở sách và cửa sổ thảo luận. Các nhóm có thảo luận/đánh giá riêng dù dùng cùng sách. Ghi chú đọc cá nhân vẫn riêng tư.

Bình luận/đánh giá cần mạng và lưu trực tiếp ở Supabase; lỗi gửi giữ nội dung đang nhập trong cửa sổ để thử lại, không giả đã đồng bộ và không có hàng đợi gửi ngoại tuyến. Thử lại cùng bình luận chưa nhận phản hồi dùng cùng UUID để tránh bản trùng. Khi đang xem bình luận mới nhất, cửa sổ kiểm tra cập nhật mỗi 10 giây; đã tải thêm bình luận cũ thì dùng **Làm mới** để về phần mới. Bình luận và đánh giá cũ được giữ khi thành viên rời nhóm (bình luận mang tên “Thành viên cũ”); người rời nhóm mất quyền truy cập. Bỏ sách khỏi nhóm hoặc xóa nhóm sẽ xóa thảo luận/đánh giá thuộc nhóm đó, không xóa sách riêng hay dữ liệu nhóm khác. Migration: `supabase/migrations/202610220005_group_discussion.sql`, có RLS và RPC kiểm tra thành viên, sách, tác giả; không đổi gói dịch vụ.
