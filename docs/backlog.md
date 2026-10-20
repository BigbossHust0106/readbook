# Backlog giữ toàn bộ phạm vi

Đặc tả đầy đủ trong `requirements.md`. Dấu ✅ nghĩa có mã và có kiểm thử local phù hợp; 🔌 là adapter đã có nhưng thiếu kết nối/nghiệm thu dịch vụ; ⏳ chưa triển khai. Không coi các mục dự kiến là chức năng hoàn thành.

## Giai đoạn 1 — nhập, thư viện, trình đọc, dịch, vị trí và từ vựng

- ✅ Việt/Trung/Anh, giao diện Việt, ngôn ngữ gốc không bị chuyển đổi.
- ✅ TXT, EPUB, DOCX, HTML, văn bản dán; SHA-256, giới hạn, tệp gốc riêng; chương/đoạn ổn định.
- ✅ Hai cột trong cùng hàng (cuộn chung nên căn theo đoạn), xen kẽ, nguyên văn, bản dịch; chỉnh cỡ chữ/nền, mục lục, tìm chương, vị trí thủ công, ghi chú, tô sáng.
- ✅ Bản dịch thủ công, khóa, lịch sử; chọn từ/cụm có ngữ cảnh, trạng thái học; CSV có preview/mapping và báo cáo trùng.
- ✅ Kệ đang đọc/đọc sau/yêu thích/hoàn thành, tìm metadata/ngôn ngữ, sao lưu gồm originals.
- 🔌 Dịch thật LibreTranslate, sample/chương, chỉ cặp có model, consent và xử lý 429. Cần endpoint và kiểm thử sáu chiều thực sự; không cam kết model VI tồn tại.
- 🔌 Supabase Auth/private Storage/RLS; tài khoản độc lập, tải lại trên thiết bị khác. Project hiện có đã xác nhận bảng/RLS/bucket riêng tư; còn nghiệm thu hai tài khoản qua Auth/Storage live.
- ✅ Cloudflare Worker/Static Assets: cấu hình production trỏ Worker hiện có `readbook`. Xem ngày nghiệm thu trong `validation.md`.
- ✅ Fallback Hanzii sao chép và mở homepage; ⏳ xác minh deep link/API/OAuth, Pro, CSV Hanzii chính thức.
- ⏳ Nhập đồng thời bản gốc/bản dịch có sẵn và căn chỉnh bằng UI; sửa bìa/mục lục/ngôn ngữ/thể loại sau nhập; bookmark nhiều vị trí riêng.
- ⏳ Tra popup có từ điển thực, phonetics, pinyin, giản/phồn, giải nghĩa chọn ngôn ngữ; hiện chỉ lưu nghĩa nhập tay và TTS.
- ✅ Noto Sans tự lưu với bộ ký tự Việt/Latin, precache offline.
- ⏳ Chọn font family, lề, khoảng dòng, chiều rộng, lật trang, chạm hiện nghĩa; tìm toàn sách, timer đọc bền vững, câu hay và chọn nhiều từ rời.

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
- ⏳ PDF text và trang gốc đối chiếu; OCR ảnh/PDF scan, sửa kết quả, tiến độ và lỗi, không hứa giữ mọi bố cục. Không xử lý nặng bên trong request Worker.
- ⏳ Căn chỉnh bản dịch nhập sẵn; rich illustrations/metadata sau nhập; series/tập/chương và theo dõi chương mới ở nguồn hỗ trợ.
- ⏳ Online providers/API/OPDS/RSS chính thức; metadata khác full-text, phân quyền/bản quyền rõ; lọc ba ngôn ngữ, tác giả/thể loại/tuổi/trình độ/độ dài; URL import theo allowlist chống SSRF/redirect/DNS rebinding, không DRM/paywall.
- ✅ SRS cơ bản: hiện nghĩa, tự đánh giá chưa nhớ/còn khó/đã nhớ, lịch 10 phút/ngày, lưu cùng từ vựng local/cloud.
- ⏳ Tra từ đa nghĩa/ngữ cảnh/lemma/idiom/phrasal verbs; multi-selection; decks theo sách/ngôn ngữ/chủ đề, CSV Anki đã xác minh; cloze/listening/dịch hai chiều/reading questions.
- ✅ PWA shell và đọc local offline; ⏳ tải trước dịch/audio/deck, quản lý dung lượng/eviction/persistent-storage, outbox offline cho cloud, conflict UI, realtime sync.
- ⏳ Bộ sưu tập/tag/sắp xếp nâng cao; xóa toàn tài khoản và tất cả tệp liên quan, mã hóa thiết bị theo thiết kế threat model, telemetry consent tách riêng.
- ⏳ Hanzii notebook CSV có schema đã xác minh và log import/export cloud; API/OAuth/Pro chỉ khi nhà cung cấp cho phép. Không scrape cookie/password/API nội bộ.

## Giai đoạn 4 — AI và đánh giá nâng cao

- ⏳ Giải thích câu/ngữ pháp/văn hóa/thành ngữ, tóm tắt/nhân vật/sự kiện, QA dẫn đoạn nguồn và không spoil vượt vị trí đọc, chống prompt injection từ tài liệu.
- ⏳ Nội dung luyện đọc AI có nhãn và qua phụ huynh duyệt; gợi ý theo sở thích/từ chưa biết, độ khó có nhãn ước tính.
- ⏳ Đánh giá luyện đọc khi công nghệ và dữ liệu thực tế đủ tốt: sau lượt đọc, không dùng STT một mình chấm phát âm, không coi phương ngữ là lỗi; phụ huynh xác nhận khi không chắc, không chẩn đoán.
- ⏳ Thống kê nâng cao, gợi ý bài tiếp theo theo kết quả thực, xử lý/xóa dữ liệu trẻ theo consent, không training ngoài mục đích cho phép.

## Nghiệm thu production còn bị chặn

Cần kết nối Supabase/Cloudflare được chủ tài khoản cấp qua luồng xác thực/kho secrets và endpoint dịch tự quản lý. Codex sẽ kiểm tra free quota, tạo tài nguyên riêng, migrate, Auth redirects, CORS, deploy, kiểm thử hai tài khoản/thiết bị, phiên đăng nhập, original private file, dịch sáu chiều, quota/mất mạng, Hanzii và secret leak trên URL HTTPS. Không yêu cầu chủ ứng dụng tự tạo bảng/bucket hay tự chạy deploy. Chưa có bằng chứng cho bất kỳ bước remote nào trong danh sách này.
