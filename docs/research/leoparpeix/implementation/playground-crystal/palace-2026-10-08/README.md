# Playground — cung điện có chiều sâu và Depth of Field

Route sửa: `/playground`. Giữ nguyên Home/About, typography và tương tác hiện hữu. [Ảnh original](../audit-2026-10-08/references/00-user-original-target.png) là định hướng về tỷ lệ kiến trúc, chiều sâu, ánh sáng và tiêu điểm; tiếp tục giữ yêu cầu không có cây/hoa tự nhiên. Tái sử dụng [texture granite của lượt trước](../polish-2026-10-08/README.md).

## Xem kết quả

- [Toàn cảnh trước/sau](comparison-palace.png)
- [Cùng camera, bật/tắt DOF](comparison-dof.png)
- [Desktop high, ảnh đầy đủ](after/02-desktop-high.png), [desktop mặc định](after/01-desktop.png)
- [Màn hình rộng 2559 × 1276](after/03-wide.png)
- [Mobile 390 × 844, DPR 2](after/04-mobile.png), [tablet 1024 × 768](after/05-tablet.png)
- [Sau intro không dùng skipLoader](after/06-intro.png)
- [Sơ đồ vùng nét](after/10-focus-zones.png): xanh lá = vùng nét, xanh dương = phía sau, vàng/cam = phía trước.
- [Pointer](after/11-pointer.png), [resize khi đang chạy](after/12-resize.png)

## Bố cục mới

Thay toàn bộ bức tường vòm gần camera bằng một loggia mở với hai cánh hành lang. Cột cao tới spring 8.3 đơn vị, cornice cao 13.7, mặt ngoài hai cánh cách nhau 19 đơn vị. Năm nhịp đặt tại z = −4, −12, −20, −28, −36: kiến trúc kéo dài 32 đơn vị giữa nhịp đầu/cuối, hậu cảnh ở khoảng 44 đơn vị tính từ camera. Đơn vị scene được dùng như mét để dựng tỷ lệ; đây không phải mô hình kiến trúc khảo sát.

20 cột có chân, cổ cột, rãnh khắc nhẹ, đầu cột và abacus; 27 vòm có voussoir chia khối, bevel thật và cornice. Cổng lớn phía trước nối hai cánh; sân giữa mở ra núi thay vì bị các vòm ngang phía sau chắn kín. Toàn bộ đá được gộp thành hai mesh theo finish để hạn chế draw calls, ngoài bốn thanh kính.

Hồ phản chiếu kéo dài từ z = 0.85 tới −11.4, tạo đường dẫn mắt từ hoa chính tới bậc thềm. Bốn bậc và hai sân cao phía sau tiếp tục dẫn chiều sâu. Nền được mở rộng để phủ toàn bộ công trình. Đưa các figurine lặp lại ra z = −9 tới −30.5, thêm quartz gần hai mép camera. Desktop có 12 figurine, lite giữ 6. Sửa vị trí bệ để cùng cao độ với figurine khi đặt trên sân nâng.

## DOF hoạt động thế nào

DepthTexture gắn vào HDR render target, gồm cả depth đã resolve từ MSAA ở desktop. DOF dùng khoảng cách theo trục nhìn của camera để tính circle of confusion có dấu: âm ở phía trước, dương ở phía sau.

Tiêu điểm lấy từ **vị trí thật của đầu hoa đang animate** và camera đang di chuyển. Vùng nét rộng ±1.1 đơn vị giúp giữ cánh, tâm, thân/lá và đế gần cùng lớp rõ nét. Không dùng mask hình tròn cố định trên màn hình.

Gather dạng đĩa Vogel chạy ở nửa độ phân giải (28 samples desktop, 16 lite), có kiểm tra depth để hạn chế màu hậu cảnh tràn vào silhouette cánh/cành. Upsample theo CoC rồi composite ở độ phân giải HDR trước bloom/tone mapping. Lấy mẫu explicit LOD để tránh derivative không xác định trong nhánh shader. Cỡ bokeh tính theo chiều cao viewport nên không tăng gấp đôi chỉ vì DPR 2. Hai render target và material được resize/dispose cùng scene.

Mặc định DOF bật. Tham số so sánh: `/playground?dof=off`. Trong dev, `/playground?debug=depth&skipLoader` hiển thị vùng nét; production không bật debug màu.

## File chịu trách nhiệm

Tính từ `src/components/sites/leoparpeix/webgl/`:

| File | Trách nhiệm |
| --- | --- |
| `env/crystal/architecture.ts` | Dựng lại cung điện, cột, hai cánh arcade, cornice, terrace. |
| `env/crystal/layout.ts` | Kích thước PALACE, hồ, các lớp crystal gần/xa; bỏ cấu hình wall/parapet cũ. |
| `env/crystal/floor.ts` | Nền lớn hơn; giữ phản chiếu thật của toàn cảnh. |
| `env/crystal/backdrop.ts` | Nâng hai đỉnh núi trung tâm cho vista có quy mô hơn. |
| `env/crystal/florere/garden.ts` | Bệ đi theo cao độ sân. |
| `env/crystal/flower.ts` | Cung cấp vị trí đầu hoa đã animate cho autofocus. |
| `env/crystal/crystalEnvironment.ts` | Cập nhật tiêu điểm theo camera/hoa mỗi frame. |
| `env/crystal/depthOfField.ts` mới | Vòng đời và cấu hình DOF, hai pass, resize/dispose. |
| `shaders/crystalDof.ts` mới | Signed CoC, disk gather, depth-aware composite, debug vùng nét. |
| `env/crystal/post.ts` | DepthTexture và thứ tự DOF → bloom/glints → tone map. |

## Kiểm chứng

`npm run check` đã qua ESLint, TypeScript và production build. Browser test dùng Chromium/ANGLE D3D11 trên máy phát triển; không phải benchmark phần cứng điện thoại.

[runtime.json](after/runtime.json) lưu từng viewport, focus, tier, lỗi/warning, click route, resize, phép đọc depth trên GPU và sai khác ảnh bật/tắt DOF. Script assert:

- Tâm hoa có CoC gần 0; sky có CoC dương, crystal sát camera có CoC âm mạnh hơn.
- Ảnh hậu cảnh thay đổi nhiều hơn vùng tâm hoa khi bật/tắt DOF; camera/hoa/cloud/ripple được giữ ổn định riêng trong cặp ảnh này.
- HDR, output DOF và DepthTexture khớp kích thước sau resize.
- Không có browser error hoặc overflow ngang trong các ca hoàn tất; `dof=off` thực sự tắt pass.
- Chuyển About → Playground → Work → Playground bằng click thật, pointer và intro mới.

Kết quả đo ở vòng quick đã qua: tâm hoa depth ≈ 7.78, cánh ≈ 8.28, cột xa ≈ 44.17; CoC gần 0 / gần 0 / +5.55 pixel tham chiếu. Quartz sát camera depth ≈ 4.27, CoC ≈ −4.67. Sai khác trung bình bật/tắt DOF khoảng 0.93/255 ở vùng tâm, 7.40 ở hậu cảnh và 3.53 ở tiền cảnh; số liệu cuối có thể chênh nhẹ do animation lúc đóng băng.

Chạy lại:

```text
node scripts/capture-crystal-palace.mjs after
node scripts/package-crystal-palace.mjs
```

## Giới hạn còn lại

Đây là DOF real-time dựa trên depth bề mặt, không phải mô phỏng ống kính bằng path tracing. Nó không tái dựng đầy đủ vật thể bị che khuất hoặc tiêu điểm quang học sau nhiều lớp khúc xạ; silhouette của vật quá mảnh có thể có sai khác nhẹ. Các hoa phụ vẫn là model procedural và ảnh original có chất lượng offline render cao hơn. Warning ANGLE/GSAP cũ vẫn được ghi lại, không coi là đã sửa trong lượt dựng cung điện.
