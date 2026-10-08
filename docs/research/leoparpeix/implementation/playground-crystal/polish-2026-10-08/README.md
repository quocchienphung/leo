# Crystal pavilion — sửa trực tiếp ngày 08/10/2026

Mục tiêu: đá granite trắng ngà có chi tiết khoáng tự nhiên; cột/vòm có mạch ghép và cạnh bắt sáng; crystal trong hơn, có độ cong và phản chiếu rõ. Giữ cảnh không có cây/hoa tự nhiên theo yêu cầu trước đó. Ảnh đích là [original của người dùng](../audit-2026-10-08/references/00-user-original-target.png); phần cây thật trong ảnh đích không được đưa trở lại.

## Kết quả để xem

- [Toàn cảnh trước/sau](comparison-desktop.png)
- [Hoa chính trước/sau](comparison-hero.png)
- [Cột đá trước/sau](comparison-stone.png)
- [Desktop cuối, 1672 × 941](after/02-desktop-high.png)
- [Bản mặc định](after/01-desktop-default.png), [tắt bloom/glare/glints](after/03-desktop-bloom-off.png)
- [Màn hình rộng](after/04-wide.png), [mobile](after/05-mobile.png), [tablet](after/06-tablet.png)
- [Pointer đang hoạt động](after/07-pointer.png), [đổi kích thước khi đang chạy](after/08-live-resize.png)

Baseline `before/` là source hiện hữu lúc bắt đầu lượt sửa này: đã có các thay đổi mới của Claude, đã bỏ cây thật. Không phải bản cũ trong ảnh đầu hội thoại. Các ảnh chụp ở thời điểm animation khác nhau; mắt/chuyển động nhẹ không phải phép so sánh pixel cố định. Navbar có độ trễ mở trang sẵn có; ảnh cuối đợi 6 giây để fade hoàn tất.

## Đã sửa gì trong source

Đường dẫn bên dưới tính từ `src/components/sites/leoparpeix/webgl/`.

| Phần | File | Thay đổi |
| --- | --- | --- |
| Granite | `env/crystal/stone.ts` mới | Một bộ texture dùng chung; chiếu texture theo tọa độ thế giới lên ba mặt để cột/vòm không kéo giãn UV; roughness và bump lấy từ surface map; mạch ghép được lọc theo kích thước pixel. |
| Cột và vòm | `env/crystal/architecture.ts` | Granite honed, viền đá polished; thêm khối đá vòm có bevel thật; gộp các khối vòm thành một geometry để giảm draw calls. |
| Nền, hồ, bệ | `env/crystal/floor.ts`, `env/crystal/florere/garden.ts` | Nền granite ướt, bệ polished; giữ phản chiếu phẳng của cảnh. |
| Độ nét truyền sáng | `env/crystalEnvironment.ts` | Tránh giảm độ phân giải transmission hai lần; desktop truyền sáng 1×, lite 0.75×; mirror mặc định 0.75× desktop/0.5× lite. Chờ texture tải xong trước precompile và chụp environment. |
| Crystal và nguồn phản chiếu | `env/crystal/materials.ts`, `lightformers.ts` | Cân bằng roughness, absorption, frost/translucency; giảm các nguồn HDR quá gắt, thêm vùng tối cho facet có độ tương phản. Environment crystal 512 desktop/256 lite. |
| Hoa chính | `env/crystal/flower.ts`, `layout.ts`, `cut.ts` | Tán đầy hơn, cánh dưới ngắn hơn, tâm hoa cong hơn; lá bất đối xứng và đế crystal có đỉnh tròn hơn. Giữ rig mở hoa, OrbFace và tương tác hiện hữu. |
| Lấp lánh | `env/crystal/post.ts`, `shaders/crystal.ts`, `shaders/crystalGlints.ts` mới | Bloom tiết chế và tia lóe ngắn lấy từ pixel HDR sáng thật; không rải sao ngẫu nhiên lên màn hình. Pass glint chạy ở 1/4 độ phân giải. |
| Vòng đời | `manager.ts` | Dispose environment và reset promise nếu precompile thất bại, cho phép lần tạo sau thử lại. |

Giữ nguyên các figurine crystal với thân/nhánh kim loại vàng và phần lá lacquer theo sản phẩm. Không gọi phần này là cây thật chỉ vì có màu xanh. `Props` vẫn chỉ gồm các quả cầu và cụm quartz; không khôi phục olive, cypress hoặc bụi hoa tự nhiên.

## Asset granite và prompt

Ảnh được tạo bằng imagegen rồi tích hợp vào material 3D, không dùng ảnh pavilion phẳng làm background thay cảnh.

- [Ảnh texture gốc](granite-generated-original.png): 1254 × 1254 thực tế.
- Asset chạy trên web: `public/sites/leoparpeix/textures/crystal/ivory-granite-albedo-v1.webp` — 1024 × 1024, WebP quality 92.
- Surface map: `public/sites/leoparpeix/textures/crystal/ivory-granite-surface-v1.png` — 1024 × 1024; R micro-height, G roughness, B 255. Đây là map suy ra từ độ sáng của albedo để tạo vi cấu trúc, không phải dữ liệu quét displacement đo được.
- Material trộn nhẹ màu ngà nền và dùng mirrored repeat để tránh đường nối ảnh; cùng một texture pair dùng chung cho các finish.

Prompt đã dùng (yêu cầu 2048 nhưng tool trả 1254; không báo asset là 2K):

```text
Use case: photorealistic-natural. Asset type: seamless physically based architectural stone BASE COLOR texture for a real-time 3D crystal flower pavilion. Create a single square 2048x2048 orthographic top-down scan of polished warm ivory WHITE GRANITE, sophisticated understated architectural stone. Fine interlocking feldspar and translucent quartz grains, very sparse tiny warm-gray mica flecks, gentle cloudy ivory mineral variation and a few delicate irregular champagne-beige and pale silver mineral veins. Overall color light warm off-white, neutral balanced average around #ddd6c9. Authentic photographic mineral detail at several scales, believable granite not concrete or plaster, no chunky black salt-and-pepper pattern. Veins subtle and organically branching, not straight scratches or dramatic black marble. Flat diffuse neutral illumination, de-lit albedo: NO directional lighting, NO highlights, NO cast shadows, NO ambient occlusion, NO baked reflections. Entire square filled edge to edge with continuous same material; seamless repeat on all four edges, no slab borders, no tile seams, no grout, no perspective, no frame, no objects, no text, no watermark. This is a texture map, not a rendered scene.
```

## Kiểm chứng

- `npm run check` đã qua: ESLint, TypeScript và Next.js production build.
- Chromium/ANGLE D3D11: desktop mặc định, desktop high, bloom off, wide, mobile và tablet; xem số liệu/lỗi thực tế trong [runtime.json](after/runtime.json).
- Kiểm tra click About → Playground → Work → Playground, pointer và resize sau khi scene đã tải. Các screenshot là trên máy phát triển, không phải benchmark GPU điện thoại thật.
- Cảnh desktop có 9 figurine, lite có 6. Texture tải đủ trước khi capture. Không có lỗi browser hoặc shader compile trong các ca chụp hoàn tất.
- Còn warning compiler ANGLE về precision/gradient/dynamic indexing và warning GSAP target rỗng ở route khác; không coi chúng là đã sửa trong lượt material này.

Chạy lại: `node scripts/capture-crystal-polish.mjs after`, rồi `node scripts/package-crystal-polish.mjs`.

## Khoảng cách còn lại so với ảnh đích

Đây vẫn là render real-time. Transmission screen-space và environment PMREM không tính đầy đủ khúc xạ giữa mọi vật thể, caustics hay nhiều lần nảy sáng như một offline path tracer. Hình dáng các hoa phụ procedural cũng chưa đạt chi tiết của model sản phẩm. Vì vậy bản này cải thiện vật liệu/độ nét/hình khối, chưa đạt 1:1 ảnh original. Không che giới hạn này bằng tăng bloom hoặc làm mờ toàn cảnh.

`source-before/` giữ một số file trước lượt sửa để tham khảo, không phải snapshot đầy đủ để restore cả repository. `iteration-1/`, `iteration-2/`, `iteration-3/` lưu các vòng thử vật liệu trước khi chốt.
