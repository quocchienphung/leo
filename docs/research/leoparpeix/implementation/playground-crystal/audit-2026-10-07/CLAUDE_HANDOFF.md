# Prompt cho Claude Code

> **ĐÃ ĐƯỢC THAY THẾ ngày 08/10/2026.** Dùng [prompt rescan mới](../audit-2026-10-08/CLAUDE_HANDOFF.md) và [toàn bộ ảnh evidence](../audit-2026-10-08/EVIDENCE_INDEX.md). Yêu cầu mới: bỏ cây/hoa thật, giữ figurines crystal. Các lỗi mô tả dưới đây thuộc snapshot cũ; nhiều lỗi đã được sửa. Không triển khai lại prompt lịch sử này như hiện trạng.

Hãy cải thiện `/playground` theo ảnh Crystal Flower Pavilion mới của người dùng, dùng sáu sản phẩm Florere làm hoa phụ quanh daisy. Đọc toàn bộ `docs/research/leoparpeix/implementation/playground-crystal/audit-2026-10-07/README.md`, ảnh A/B trong `evidence/`, contact sheet và `swarovski-references.json` trước khi chỉnh scene. Đọc AGENTS.md và docs Next.js cài tại workspace trước khi viết code framework.

Kết quả cần đạt: giữ daisy làm hero tương tác; thêm đúng Rose, Forget-me-not, Rozanne, Lily, Lily of the Valley, Blue Bellflower với hình dáng riêng; crystal trong, có chiều sâu, highlight sắc có chọn lọc; bố cục garden nhiều lớp, ánh sáng và phản chiếu thống nhất với pavilion. Các ảnh moodboard mới là chuẩn composition; ảnh Swarovski là chuẩn nhận dạng sản phẩm. Đừng nhầm Iris/Tulip/Hydrangea trong moodboard với sáu mẫu được yêu cầu.

Giữ Three.js thuần và WebglManager hiện có, camera/transition/DOM copy, tuyến home/about và pipeline màu của chúng. Không thêm R3F/drei hay renderer thứ ba chỉ để sửa vật liệu. Có thể dùng GLB authored và baked assets phù hợp; “fully procedural, no downloads” trong mô tả cũ không phải yêu cầu mới của người dùng.

Triển khai theo thứ tự:

1. Sửa debug baseline trước. `plainGlass()` hiện chỉ tắt `uFire/uInner/uGlitter`, còn `uScatter/uInternal` và milk/translucency. Tạo test vật liệu không patch đáng tin; quality QA cần transmission scale 1. Khóa camera/exposure, tắt bloom/haze/grain/fluid trong bài test.
2. Bỏ Voronoi nội khối, random refraction-normal và viền tối theo mọi tam giác khỏi family cut-crystal chuẩn. Sửa thickness theo local scale từng bộ phận; lá đang 1.4 dù geometry dày khoảng 0.16–0.18, đế dùng 3.2 cho cả viên lớn và nhỏ. Bắt đầu dispersion 0 rồi thêm nhẹ, không giữ 6 làm mặc định. Kiểm tra hình học kín và normals trước.
3. Làm một Rose hoàn chỉnh trong scene thử, rồi đặt vào pavilion để duyệt silhouette/vật liệu. Ưu tiên dựng model GLB có cut topology được kiểm soát thay vì random hull. Không chỉ đổi màu daisy hoặc tạo placeholder. Ảnh sản phẩm không đồng nghĩa có model 3D tải sẵn.
4. Hoàn thành cả sáu loài. Giữ stem vàng cho các mẫu tương ứng; Lily of the Valley dùng thân/lá xanh sơn bóng; Lily gốc vàng; Rozanne là cụm xanh tím. Có preset recolor riêng nếu cần hòa moodboard. Material family riêng cho clear cut, colored cut, frosted daisy, gold, green lacquer và natural base.
5. Bố trí garden theo chiều sâu quanh hero, chừa vùng copy và mặt daisy; cập nhật layout/brief cũ. Đừng rải sáu hoa cùng hàng hoặc cùng tỷ lệ. Chỉnh sàn/caustics/background sau khi vật liệu và hoa đã ổn, bật bloom cuối.
6. Đo hiệu năng và làm quality tiers. Có intro dolly lớn nên không thay toàn garden bằng một ảnh phẳng mà chưa kiểm tra motion. Nếu PBR vẫn phẳng ở hero, prototype mesh ray tracing/BVH có giới hạn trên vài khối trước; nêu rõ nó không tự giải inter-object refraction/caustics. Không áp dụng shader nặng cho mọi hoa nền.

Khi thêm loader: `assets.ts` đang dùng NoColorSpace cho baked pipeline cũ; không áp quy tắc này cho mọi texture PBR mới. Giữ semantics của GLTFLoader, kiểm tra KTX2 wiring nếu GLB cần. `ensurePlayground()` cần await asset/precompile, có xử lý failure/retry/disposal. Không đổi global outputColorSpace vì CrystalPost đã tone-map và encode.

Sau mỗi bước giữ checkpoint và ảnh đối chiếu, rồi tiếp tục trong phạm vi được giao; không dừng chỉ ở plan hoặc tuning vài con số. Nghiệm thu: sáu loài nhận ra được ở kích thước cuối; crystal vẫn đẹp khi bloom off; không mosaic/rainbow phủ mặt; highlight ổn định khi chuyển động; đủ desktop/mobile và navigation regression. Chạy `npm run check` sau implementation. Bàn giao ảnh trước/sau, chất lượng render đã dùng, asset còn thiếu và giới hạn quang học thực sự còn lại.
