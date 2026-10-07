# Hồ sơ khảo sát Léo Parpeix

Ngày bàn giao theo phiên người dùng: 07/10/2026. Nguồn: https://www.leoparpeix.com/?ref=landing.love, `/about`, `/playground`.

Đây là hồ sơ nghiên cứu để viết prompt triển khai cho Claude Code. Chưa triển khai website local, chưa chạy build/test app và chưa xác nhận mức độ tương đồng của một bản clone.

## Những gì đã làm

- Duyệt browser thật, cuộn trang Home và About từ đầu đến footer trên desktop; duyệt nội dung Playground đến vùng footer.
- Xem các route ở viewport desktop 2048×1018 và viewport nhỏ 390×844; ghi hình menu mobile và các section đại diện. Đây là resize viewport, không phải kiểm chứng một thiết bị touch thực.
- Thử điều khiển sound/gesture, kéo gallery, mở archive Longines, mở/đóng Credits, điều hướng ba route, mở/phát/đóng showreel và click vùng feed-bee.
- Lưu 74 screenshot samples và 4 contact sheets tại thời điểm viết báo cáo. Có ảnh giữa animation, ảnh reload còn trắng, và vài ảnh tại cuối trang trùng nhau; không được dùng số lượng ảnh để suy ra bao phủ toàn bộ state.
- Thu HTML/CSS/JS công khai; lưu DOM/nội dung mỗi route, inventory tài nguyên và geometry snapshots.
- Tải và parse thành công 6 GLB gốc; tải hai font gốc. Texture/video/audio phần lớn mới có URL inventory, chưa được tải và kiểm chứng toàn bộ.
- Hợp nhất 184 URL asset đã thấy qua browser inventory/DOM tại thời điểm tạo `asset-map.json`. Đây không phải cam kết toàn bộ tài nguyên website đã được phát hiện.

## Cách đọc bộ hồ sơ

| File/thư mục | Công dụng | Giới hạn |
|---|---|---|
| `../../../LEOPARPEIX_CLAUDE_MASTER_PROMPT.md` | Prompt thực thi chính cho Claude Code | Cần công cụ browser và coding thực sự |
| `evidence/home-contact-sheet.jpg` | Bố cục Home toàn hành trình | Mẫu rời rạc, không phải full-page golden |
| `evidence/about-contact-sheet.jpg` | Cảnh About và các section | Có frame reveal chưa kết thúc |
| `evidence/playground-contact-sheet.jpg` | Bố trí tác phẩm lệch cột | Một số video ở frame trắng/chuyển cảnh |
| `evidence/intro-contact-sheet.jpg` | Các frame rất sớm sau reload | Gần như trắng; không mô tả đủ intro |
| `evidence/desktop-2048x1018-hero.png` | Hero Home desktop | Một góc máy/pointer tại một thời điểm |
| `evidence/desktop-about-hero.png` | Hero thiên nhiên | Không phải video chuyển động |
| `evidence/mobile-390x844-load-sample.png` | Hero Home tại viewport nhỏ | Warm/session observation |
| `evidence/mobile-menu-settled.png` | Menu mobile mở | Trạng thái đã settle |
| `evidence/desktop-credits.png` | Credits overlay vàng | Kiểm tra thêm timing/keyboard |
| `evidence/desktop-archive-longines-open.png` | Archive mở rộng | Có thể đang reveal; chỉ test một hàng |
| `evidence/desktop-showreel-playing.png` | Showreel phát được | Chưa kiểm thử toàn bộ timeline controls |
| `content-initial.txt`, `content-about.txt`, `content-playground.txt` | Copy của trang | Có nội dung alternate/ẩn trong DOM |
| `dom-*.json` | DOM render để truy selector/content | Không dùng nguyên DOM làm kiến trúc React |
| `asset-inventory*.json`, `asset-map.json` | URL nguồn đã quan sát | Có tài nguyên được prefetch; không đồng nghĩa visible |
| `model-metadata.json` | Node/camera/material/extension của GLB | Runtime thay đổi nhiều properties |
| `downloaded-files.json` | Kích thước, SHA-256 và kiểm tra header của file tải về | GLB chưa GPU-decode/render trong app local |
| `source-excerpts.json` | Source locations cho camera/Lenis/material | Đọc call sites để hiểu nhánh active |
| `desktop-geometry.json`, `mobile-geometry.json` | Các số đo snapshot | Không biến thành layout constants |
| `reload-samples.json` | Timestamp và trạng thái các frame đầu | Clock do môi trường tool cung cấp, không phải timeline đầy đủ |
| `raw/` | HTML/CSS/JS, GLB và font tham chiếu | Không nhúng production app bundle vào bản clone |

## Route map đã xác nhận

| Source | Phạm vi clone được đề xuất | Đích |
|---|---|---|
| `/?ref=landing.love` và `/` | Home/Work đầy đủ | `/` |
| `/about` | About đầy đủ | `/about` |
| `/playground` | Playground đầy đủ | `/playground` |
| `https://lab.leoparpeix.com` | Link ngoài origin | Giữ link ngoài |
| Website dự án/social/agency | Link ngoài | Giữ đích nguồn |

## Layout và hình ảnh đã nhìn thấy

Home mở bằng xưởng màu ngà/nâu sáng, hoa cúc trắng có ria mép, ba vùng cửa sổ vòm, mây, thang bên trái, bàn và phác thảo bên phải, bục/ghế/vật thể điêu khắc, sàn gỗ. Chất liệu có shading/texture và hạt; hiệu ứng tổng thể cách điệu nhưng có chiều sâu. Không phải một ảnh hero DOM thông thường.

Sau cảnh mở là nền gần trắng, display type xanh rất đậm, ong vàng/đen và trái cây. Intro và showreel nằm trên grid thoáng. Sáu selected projects có ảnh lớn giữa và lát cắt slide hai bên, kéo ngang; metadata chia theo cột. Một đoạn cảnh xưởng/thư viện toàn chiều rộng chen giữa Mechachain và Dulcedo. Archives là danh sách 23 hàng mảnh có expansion. Footer chữ cực lớn; Credits mở một panel vàng phủ bên trái và làm tối phần còn lại.

About mở bằng cảnh hoa trong chậu trên nền cây–núi–mặt nước, sau đó chuyển sang nền xanh đậm và chữ kem. Có ảnh du lịch, manifesto typography với hoa, bảng kinh nghiệm đặt trên cảnh xưởng/thư viện, awards/clients và ảnh chân dung. Playground có nền vàng, typography xanh/đen đậm, media lệch cột với khoảng trống lớn; ong xuất hiện trong vùng content.

Mobile có sound/menu buttons vuông bo góc; menu trắng ở phía trên, chữ nav lớn xếp dọc và email. Hero đổi crop/camera. Archive ẩn bớt cột phụ. Footer contact xếp dọc. Không suy ra toàn bộ touch behavior từ kết quả resize này.

## Dữ kiện source quan trọng

- Site khai báo Vite + Vue 3; có Lenis và WebGL. Không phải Framer.
- Font UI là Monument Grotesk regular, display là Avantt variable. Display thường đặt trục wght=622.
- Grid CSS desktop 12 cột, max-width 2560px; có nhánh 8 cột; breakpoint logic JS nhỏ hơn 1025px.
- Các màu source: `#022016`, `#f7f7f7`, `#083d2a`, `#eed6c8`, `#f6e016`, `#ff0`; phải đọc selector để gán theme.
- Main/header camera thay đổi theo scroll và pointer. Lenis source có lerp desktop .085, nhánh nhỏ 1; không đồng nghĩa có thể copy nguyên option sang phiên bản mới.
- `scene_v9.glb`: 14 nodes, camera có vertical FOV ~22.895°, không materials/images/animation nhúng, dùng Draco.
- `scene_v15.glb`: 393 nodes, hai camera entries, không materials/images/animation nhúng, dùng Draco.
- `flower_v2.glb` và `bee_v4.glb`: không material/image/animation nhúng. Fruit models có material đơn giản.
- Environment material gán texture riêng trong JS; About có reflector/water deformation. Pipeline có custom shaders, clouds, particles và fluid/postprocessing. Chưa trace đầy đủ mọi uniform/call site.
- Showreel full video desktop được browser báo duration 47.018s và trạng thái đang phát sau click; preview là media riêng.

## Phần chưa được chứng minh — bắt buộc Claude đo tiếp

1. Timeline intro đầy đủ với cold-cache/warm-cache, timestamp và keyframes đồng bộ. Đã nhìn thấy loader, cảnh trong card bo góc và cảnh mở rộng, nhưng frame sequence lưu hiện chỉ bắt đầu rất sớm; không có video liên tục của toàn chuỗi.
2. Thời gian/easing chính xác của tất cả reveal, flip chữ, route mask, gallery inertia/deformation, bee steering và feed lifecycle.
3. Toàn bộ shader pipeline, texture-to-node mapping, colorspace/tone mapping, baked/live lighting, water/reflection quality và tier theo thiết bị.
4. Mọi slide trong cả 6 gallery; mọi archive expansion; video controls pause/seek/end; email clipboard feedback và sound mix. Chỉ một số tương tác đại diện đã thử.
5. Các breakpoint trung gian, màn hình >2560px, coarse pointer/touch thật, landscape, reduced motion và lỗi GPU/network.
6. Pixel-level geometry golden sau fonts/layout ổn định; snapshots geometry hiện có cần remeasure. Browser resize và các lớp đang chuyển động có thể ảnh hưởng số đo.
7. Toàn bộ file assets được tải/decode/render local. Inventory không thay thế bước này.

Không có căn cứ để gọi một bản clone là “100% giống” chỉ dựa vào hồ sơ này. Mục tiêu 1:1 cần được biến thành vòng lặp build → render → compare → fix, như master prompt yêu cầu.

## Cách khởi chạy trong Claude Code

Mở đúng workspace chứa bộ file, rồi gửi:

```text
Đọc LEOPARPEIX_CLAUDE_MASTER_PROMPT.md và docs/research/leoparpeix/SCAN_REPORT.md. Thực thi đầy đủ prompt trong repo này, bắt đầu bằng kiểm tra bằng chứng live còn thiếu, sau đó triển khai và QA cả ba route. Không dừng ở kế hoạch hoặc hero; không tuyên bố khớp 100% khi chưa có bằng chứng.
```

Không thay đổi clone skill dùng chung chỉ để phục vụ một site. Các yêu cầu riêng của Léo được giữ trong prompt/dossier này.
