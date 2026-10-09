# Suối và thác hậu cảnh — 09/10/2026

Đã thêm thác chính phía trái và suối uốn theo sườn núi vào `/playground`. Nhánh nước xa phía phải lấp ló trong mây. Cột và hoa crystal vẫn che nước đúng vị trí trong không gian; giữ DOF hậu cảnh hiện tại.

- [Trang thực trước/sau](comparison-desktop.png)
- [Tách lớp background để kiểm tra đường nước](comparison-backdrop.png)
- [Desktop](after/desktop.png), [màn hình rộng](after/wide.png), [mobile](after/mobile.png)
- [Runtime và phép đo chuyển động độc lập trên GPU](after/runtime.json)

## Cách dựng

- Hai watershed đặt bằng tọa độ km trong cùng hệ địa hình với mountain raymarch. Heightfield có ledge và gorge hẹp; các bờ lộ đá ướt. Suối nằm trên địa hình, curtain của thác bị cắt theo giao điểm terrain, không phủ lên trời hoặc núi gần hơn.
- Flow map HDR lưu loại nước, tọa độ ngang/dọc dòng và độ phủ sau cloud/haze occlusion. Được bake khi đổi frustum rồi cập nhật dần theo mây. Chuyển động nước chạy riêng mỗi frame trên dome, không phải chờ 320 dải núi refresh xong.
- Shader nước có filaments chảy xuống, gợn/foam trên suối, viền bất quy tắc và sương nhỏ ở chân thác. Đây là chuyển động procedural, không phải fluid simulation. Một phần chân thác/runoff bị các đồi gần hơn che khuất.
- Thu hẹp một phần cloud bank quanh watershed để nhánh xa không bị che hoàn toàn. Giữ toàn bộ kiến trúc, hoa, lighting, crystal shader và render quality từ lần sửa trước.
- Water render target được resize cùng sky target và dispose trong `Backdrop.dispose()`. Manager cache environment giữa các route như trước, nên không dispose mỗi lần sang About.

## Kiểm tra

- `npm run check`: lint, TypeScript và production build qua sau chỉnh sửa cuối.
- `node scripts/capture-crystal-waterfalls.mjs after`: desktop 1672×941, wide 2559×1276, mobile 390×844 DPR 2; không lỗi browser/page, không tràn ngang.
- GPU readback render riêng dome, loại bỏ film grain, post-processing và các hoa chuyển động: khi bake núi đứng yên, đổi thời gian nước từ 0 sang 0.8 s làm thay đổi 4,763 pixel trong vùng y 390–571. Chuyển động nằm cục bộ ở đường nước, không thay đổi toàn ảnh.
- Resize 1024×768: sky và flow map cùng 1126×845. Điều hướng About → Playground và quay lại render thành công.
- Đã xem ảnh toàn cảnh desktop/wide, ảnh tách background và mobile. Trên mobile dọc, hai sườn núi có thác nằm ngoài khung hẹp, tương tự các hoa bên rìa; không dịch thác vào giữa daisy.
- Warning ANGLE, CSS preload và GSAP target vẫn có; không lỗi shader compilation. Flow map thêm một texture HDR và một lượt bake terrain ban đầu; chưa benchmark FPS dài hạn trên nhiều GPU.

## Source

- `src/components/sites/leoparpeix/webgl/env/crystal/backdrop.ts`: sở hữu target, thời gian, placement và lifecycle.
- `src/components/sites/leoparpeix/webgl/shaders/backdrop.ts`: ledge/gorge, flow map và occlusion địa hình/mây.
- `src/components/sites/leoparpeix/webgl/shaders/backgroundWater.ts`: chuyển động nước và màu HDR.

Chạy `npm run dev`, mở `http://localhost:3000/playground`. Tạo lại comparison bằng `node scripts/package-crystal-waterfalls.mjs`.
