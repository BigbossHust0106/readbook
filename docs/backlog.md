# Backlog giữ toàn bộ phạm vi

Đặc tả đầy đủ trong `requirements.md`. Dấu ✅ nghĩa có mã và có kiểm thử local phù hợp; 🔌 là adapter đã có nhưng thiếu kết nối/nghiệm thu dịch vụ; ⏳ chưa triển khai. Không coi các mục dự kiến là chức năng hoàn thành.

## Giai đoạn 1 — nhập, thư viện, trình đọc, dịch, vị trí và từ vựng

- ✅ Việt/Trung/Anh, giao diện Việt, ngôn ngữ gốc không bị chuyển đổi.
- ✅ TXT, EPUB, DOCX, HTML, văn bản dán; SHA-256, giới hạn, tệp gốc riêng; chương/đoạn ổn định.
- ✅ Hai cột trong cùng hàng (cuộn chung nên căn theo đoạn), xen kẽ, nguyên văn, bản dịch; chỉnh cỡ chữ/nền, mục lục, tìm chương, vị trí thủ công, ghi chú, tô sáng.
- ✅ Bản dịch thủ công, khóa, lịch sử; chọn từ/cụm có ngữ cảnh, trạng thái học; CSV có preview/mapping và báo cáo trùng.
- ✅ Kệ đang đọc/đọc sau/yêu thích/hoàn thành, tìm metadata/ngôn ngữ, sao lưu gồm originals.
- ✅ MyMemory API chính thức: đã kiểm tra sáu chiều Việt/Anh/Trung bằng câu thử thật; consent, dịch trang/chương/toàn sách, lưu từng đoạn, dừng quota/lỗi và tiếp tục phần thiếu. Free 5.000 ký tự/ngày theo IP dịch vụ, không vô hạn. LibreTranslate vẫn là adapter tùy chọn, cần endpoint/model riêng.
- ✅ Supabase Auth/private Storage/RLS; nhóm và nhiều thiết bị đã kiểm tra hosted bằng tài khoản tạm, ghi chú/vị trí riêng. URL Cloudflare production vẫn bị 403 từ mạng kiểm thử; xem validation.
- ✅ Cloudflare Worker/Static Assets: cấu hình production trỏ Worker hiện có `readbook`. Xem ngày nghiệm thu trong `validation.md`.
- ✅ Fallback Hanzii sao chép và mở homepage; ⏳ xác minh deep link/API/OAuth, Pro, CSV Hanzii chính thức.
- ✅ Nhập bản dịch có sẵn sau nguyên văn: dán hoặc TXT/EPUB/DOCX/HTML, chọn chương/toàn sách, ghép theo thứ tự có preview, gán/ghép thêm và chỉnh từng đoạn, xác nhận phần chưa ghép; giữ đoạn khóa và lịch sử. Dịch nhập sẵn lưu riêng cho từng tài khoản. ✅ Dấu trang nhiều vị trí/offset, đổi tên/xóa/tìm/nhảy lại sau đổi font hoặc phân trang, đồng bộ offline và riêng trong nhóm. ⏳ Nhập đồng thời hai tệp ngay trong lần tạo sách; sửa bìa/mục lục/ngôn ngữ/thể loại sau nhập (hiện sửa tên/tác giả).
- ⏳ Tra popup có từ điển thực, phonetics, pinyin, giản/phồn, giải nghĩa chọn ngôn ngữ; hiện chỉ lưu nghĩa nhập tay và TTS.
- ✅ Noto Sans tự lưu với bộ ký tự Việt/Latin, precache offline.
- ✅ Chọn Noto Sans/serif/system, khoảng dòng, chiều rộng; lật trang vừa viewport, menu drawer chung, bôi đen hiện nghĩa; tìm toàn sách không dấu Việt (nguyên văn/bản dịch), đi tới kết quả. ⏳ Lề tùy chỉnh, timer đọc bền vững, câu hay và chọn nhiều từ rời.

- ✅ Đọc liền mạch, cuộn liên tục tự nối chương hoặc lật trang, thanh kéo lượng chữ/trang, điều hướng cố định; lưu offset khi phân trang.
- ✅ Ô tìm đầu sách DTV/Google site-search; danh mục metadata khi nguồn cho phép. 🔌 Nguồn DTV mẫu trả 403 từ Codex, chưa nghiệm thu danh mục live; không báo đã tải đầu sách thực tế.

## Giai đoạn 2 — trẻ em và nghe đọc

- ✅ Phần nền: nhiều hồ sơ phụ huynh, nickname/tuổi/mức đọc, tiếng Việt mặc định và bật Trung/Anh, phê duyệt sách, câu ngắn, nghe mẫu và thu âm nghe lại trong RAM.
- ✅ PIN 4–8 số trên trình duyệt: PBKDF2, kiểm tra khi về quản lý và khi tải lại phiên trẻ; chờ 5 giây sau PIN sai. Không phải tài khoản/quyền máy chủ riêng cho trẻ.
- ⏳ Session trẻ có phạm vi quyền riêng nếu cần; giáo trình được biên soạn cho từng năng lực, chữ/âm/vần/tiếng Việt đã duyệt chuyên môn.
- ⏳ Thư viện trẻ nguồn hợp pháp, lọc độ tuổi/mức đọc/chủ đề/thời lượng, minh họa và nội dung được duyệt.
- ⏳ Các mode luân phiên phụ huynh, đọc hiểu, kể lại; highlights theo audio timing, lặp và khoảng nghỉ, cloud TTS có cấu hình; ưu tiên Việt.
- ✅ Lưu tối đa 100 buổi luyện/hồ sơ: sách, số câu tự xác nhận, thời lượng và thời điểm; lưu cùng hồ sơ local/cloud.
- ⏳ Từ cần luyện, mục tiêu/ngủ/nhắc ôn, huy hiệu không xếp hạng, giới hạn thời gian; lưu/xóa recording chỉ khi consent, retention.
- ⏳ Nhập audiobook/subtitle, căn thời gian, playback nền/lock screen khi hỗ trợ, giọng Anh–Mỹ/Anh–Anh thực tế; không cam kết trên mọi nền tảng.

## Giai đoạn 3 — ngữ cảnh, OCR/PDF, SRS và đồng bộ

- ⏳ Queue nền bền vững: lease, retry giới hạn, pause/cancel/resume, tiến độ/notifications, không trùng request sau kết quả mơ hồ; tách sách lớn theo chương ở DB.
- ⏳ Nhà cung cấp chính thức bổ sung (DeepL/Google/AI/local model sau xác minh): capability, free-quota/cost controls, không tự phí/chuyển nhà cung cấp.
- ⏳ Dịch đoạn/chương/toàn sách/khi đọc, style, ngữ cảnh hai bên, nhân vật/xưng hô/glossary, metadata source/version; so sánh khi được yêu cầu; advanced proofreading; QA thiếu/lặp/ngôn ngữ/số/thuật ngữ; dễ đọc là chức năng riêng có nhãn.
- ✅ PDF có chữ và PDF scan: PDF.js/Tesseract chạy trên thiết bị, tự tải engine/model từ cùng website; chọn khoảng trang, tự động/OCR tất cả/chỉ lớp chữ, tiến độ, hủy, sửa văn bản trước khi lưu, đối chiếu trang gốc trong trình đọc. Việt/Anh/Trung giản thể; 50 MB/tệp; xử lý toàn bộ tệp, không giới hạn số trang. Checkpoint từng trang trong IndexedDB để tiếp tục. Giữ nguyên PDF gốc.
- ⏳ Nhập ảnh rời, tự xoay/dewarp, bảng/nhiều cột và hiệu chỉnh bố cục nâng cao; OCR job nền khi tab đóng, xoay/dewarp và resume đa thiết bị. Không hứa giữ mọi bố cục.
- ✅ Căn chỉnh bản dịch nhập sẵn bằng UI theo đoạn, giữ nguyên văn và các bản đã khóa; không tự căn theo nghĩa. ⏳ Rich illustrations/metadata sau nhập; series/tập/chương và theo dõi chương mới ở nguồn hỗ trợ.
- ⏳ Online providers/API/OPDS/RSS chính thức; metadata khác full-text, phân quyền/bản quyền rõ; lọc ba ngôn ngữ, tác giả/thể loại/tuổi/trình độ/độ dài; URL import theo allowlist chống SSRF/redirect/DNS rebinding, không DRM/paywall.
- ✅ SRS cơ bản: hiện nghĩa, tự đánh giá chưa nhớ/còn khó/đã nhớ, lịch 10 phút/ngày, lưu cùng từ vựng local/cloud.
- ✅ Bôi đen để dịch, chỉnh nghĩa và lưu từ trong cùng bảng; cache 30 ngày; liên kết Google Dịch. ⏳ Đa nghĩa/ngữ cảnh/lemma/idiom/phrasal verbs; multi-selection; decks theo sách/ngôn ngữ/chủ đề, CSV Anki đã xác minh; cloze/listening/dịch hai chiều/reading questions.
- ✅ PWA shell, cache sách cloud đã mở, outbox vị trí offline, polling 10 giây và khôi phục phiên đăng nhập. ✅ Nhóm đọc với sách canonical chống trùng hash/ngôn ngữ trong nhóm, mã mời, tag vị trí từng tài khoản và annotations riêng. ✅ Nút chuyển dữ liệu thiết bị sang cloud. ✅ Chọn nhiều sách đang sở hữu trong thư viện cloud để thêm vào nhóm mà không upload lại; loại sách mượn từ nhóm khác và nhận diện trùng nội dung/ngôn ngữ. ✅ Outbox ghi chú/bản dịch/dấu trang/kệ/phê duyệt trẻ/từ vựng/hồ sơ trẻ; CAS, merge khác trường và chọn phiên bản khi xung đột. ⏳ Outbox cấu trúc sách/tệp gốc, tải trước audio/deck, quản lý eviction, Supabase Realtime.
- ⏳ Bộ sưu tập/tag/sắp xếp nâng cao; xóa toàn tài khoản và tất cả tệp liên quan, mã hóa thiết bị theo thiết kế threat model, telemetry consent tách riêng.
- ⏳ Hanzii notebook CSV có schema đã xác minh và log import/export cloud; API/OAuth/Pro chỉ khi nhà cung cấp cho phép. Không scrape cookie/password/API nội bộ.

## Giai đoạn 4 — AI và đánh giá nâng cao

- ⏳ Giải thích câu/ngữ pháp/văn hóa/thành ngữ, tóm tắt/nhân vật/sự kiện, QA dẫn đoạn nguồn và không spoil vượt vị trí đọc, chống prompt injection từ tài liệu.
- ⏳ Nội dung luyện đọc AI có nhãn và qua phụ huynh duyệt; gợi ý theo sở thích/từ chưa biết, độ khó có nhãn ước tính.
- ⏳ Đánh giá luyện đọc khi công nghệ và dữ liệu thực tế đủ tốt: sau lượt đọc, không dùng STT một mình chấm phát âm, không coi phương ngữ là lỗi; phụ huynh xác nhận khi không chắc, không chẩn đoán.
- ⏳ Thống kê nâng cao, gợi ý bài tiếp theo theo kết quả thực, xử lý/xóa dữ liệu trẻ theo consent, không training ngoài mục đích cho phép.

## Nghiệm thu production còn lại

Đã có kết nối Cloudflare/Supabase, deploy Worker hiện có và đọc cấu hình project/bucket/RLS/Auth. MyMemory đã được bật và kiểm tra upstream thật, không cần endpoint dịch tự quản lý cho provider mặc định. Đã nghiệm thu hosted Auth/Storage bằng ba tài khoản tạm, nhóm/quyền và vị trí trên nhiều browser độc lập qua build local. Còn kiểm tra giao diện qua URL production; mạng Codex vẫn nhận HTTP 403/1010 từ URL công khai. DTV cũng chặn server fetch ở môi trường kiểm tra, vì vậy chỉ xác nhận bộ tìm kiếm mở trong browser và parser/flow qua fixture, chưa xác nhận danh mục live. Không coi các phần bị chặn là đã nghiệm thu xong.
