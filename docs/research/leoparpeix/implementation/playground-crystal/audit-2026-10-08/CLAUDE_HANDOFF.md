# Claude Code — thực hiện lại Crystal Playground từ rescan 08/10

Đây là yêu cầu triển khai tiếp, không dừng ở giải thích/plan. Người dùng muốn `/playground` gần **ảnh original cuối**, hoa chính rõ và có chất crystal hơn; **xóa toàn bộ cây/hoa thật, chỉ giữ các tượng hoa crystal cùng bộ phận cấu thành của chúng**. Giữ pavilion, sky/mountains, nước/bệ/kính và tương tác daisy. Yêu cầu bỏ thực vật thật ưu tiên cao hơn foliage xuất hiện trong original/moodboards.

## 1. Đọc ảnh thật trước khi code

Root gói: `docs/research/leoparpeix/implementation/playground-crystal/audit-2026-10-08/`.

Đọc toàn bộ `README.md`, `EVIDENCE_INDEX.md`, `runtime-rescan.json`, `evidence-manifest.json`. **Dùng tool đọc ảnh của bạn để mở từng PNG/JPG trong danh sách 45 ảnh của EVIDENCE_INDEX. Chỉ đọc Markdown, tên file hoặc contact sheet không được tính là đã xem ảnh gốc.** Xem theo batch để giữ context; ghi file đã xem và nhận xét thị giác ngắn. Dùng crop ở native pixels khi đánh giá độ mờ. Nếu tool chỉ xem ảnh dạng resize, mở crop tương ứng để nhìn chi tiết.

Thứ tự: original `references/00-user-original-target.png` → boards `01/02` → original/current crop `19` → removal map `22` và runtime crop `16/17/18` → A/B `02–06,11–13,20/21` → preview `07` → DPR/wide/mobile `01/08/09/10` → sáu product photos và contact sheet → previous project reference `03` → các ảnh lịch sử 07/10. **Ảnh lịch sử có nhãn riêng: không coi chúng là source hiện tại hoặc target.**

Ba screenshot chat hiện tại không có raw local file; capture `09/16/17` là tái lập vùng phàn nàn, không phải byte gốc upload. Original cuối và boards là copy nguyên byte từ Downloads; manifest có SHA-256. Không bỏ qua ảnh cuối rồi chỉ làm theo board.

Sáu identity bắt buộc giữ: Rose 5666973, Forget-me-not 5666971, Rozanne 5693143, Lily 5666972, Lily of the Valley 5721541, Blue Bellflower 5719807. Tham chiếu product JSON/ảnh đã thu thập, không tự nhận có model chính hãng. Iris/Tulip/Hydrangea trong board không phải yêu cầu thêm loài mới.

## 2. Scan source đang có, không áp lại diagnosis cũ

Đọc AGENTS.md và guide liên quan trong `node_modules/next/dist/docs/` trước khi sửa framework. Dùng canonical `.agents/skills/clone-website/SKILL.md` nếu cần workflow; `.claude/commands/clone-website.md` chỉ là bridge. Giữ working tree đang dirty, không reset/checkout đè công việc hiện tại.

Đọc kỹ:

- `src/components/sites/leoparpeix/webgl/env/crystal/{flower,materials,props,layout,crystalEnvironment,post,floor,world,architecture,backdrop,lightformers,cut}.ts`.
- `.../env/crystal/florere/{kit,species,garden}.ts`.
- `.../webgl/shaders/{crystal,crystalTrace,backdrop}.ts` và đoạn manager/composer/resize/quality liên quan.
- Three renderer/transmission chunks đang cài khi sửa optics hoặc scale.

Bản mới đã có sáu loài, tracer qua face planes, QA high transmission1 và stem thickness0.13. **Không báo lại lỗi “thiếu sáu hoa”, “Voronoi cũ”, “high còn 0.45”, “stem còn0.7” như hiện trạng.** Source fingerprint trong manifest dùng để nhận biết thay đổi sau audit; line numbers trong README chỉ đúng snapshot này.

Giữ Three.js/WebglManager/rig/transition/camera/DOM copy và home/about. Không đổi renderer hoặc global colorSpace tùy tiện. Có thể dùng authored geometry/GLB phù hợp nếu procedural không đạt silhouette; bảo đảm asset load/precompile/failure/disposal đúng. Đừng thay tất cả bằng một ảnh phẳng vì có intro/motion tương tác.

## 3. Xóa đúng thực vật thật ngay từ scene construction

Trong `props.ts`, bỏ:

- Olive của `PROPS.planters`, undergrowth `shrub()` dưới chậu và soil planes.
- Toàn bộ `PROPS.shrubs`: các bụi hoa trắng/góc foreground/cạnh pool.
- `CYPRESSES` và `DISTANT_TREES`.
- Helpers/materials/geometry/placement constants và tree animation không còn dùng; disposal đồng bộ.

Preview đã tìm 15 natural groups +7 cypress meshes +2 soil meshes =24 nhánh trực tiếp. Đừng hard-code child indices hoặc xóa theo rectangle/color/material.transmission: scene tree có ownership rõ.

**Giữ nguyên sáu Florere và mọi bộ phận của chúng**, gồm lá crystal xanh, stem/calyx/stamens vàng, dây quấn đá, buds và bases. **Lily of the Valley dùng thân/lá xanh lacquer opaque là đúng tượng: PHẢI GIỮ.** Giữ daisy, kính/spheres, bệ; không xóa cả Props. Chậu rỗng cần đổi thành plinth đẹp hoặc bỏ theo bố cục, không để đất/cây sót.

Kiểm tra removal trong main scene/mirror/IBL/shadows, wide/mobile, intro và remount. Fresh construction sạch trước capture; nếu có toggle phải invalidate capture/shadow/reflection. `07-crystal-only-preview.png` chỉ là browser diagnostic, chưa phải implementation hoặc ảnh final. Nó còn empty planters và vùng LotV washed-out: cần relight/recompose tiếp, không copy rồi tuyên bố hoàn tất.

## 4. Sửa nguyên nhân cánh mờ/trắng bằng từng lớp

Đích là cánh **rounded frosted crystal có thân trong vừa đủ, rim sáng sắc có chọn lọc và tương phản thể tích**, không cánh phấn trắng, không glass rỗng hoàn toàn, không biến hero thành polygon gem.

Evidence cụ thể:

- `03`: tắt post optical effects nhưng cánh vẫn trắng → không chỉ do bloom/haze.
- `05`: chỉ roughness .24→.08 vẫn trắng → không chỉ giảm roughness.
- `11`: tắt riêng petal additive glow làm giảm mạnh lớp trắng phủ → ưu tiên sửa `translucencyMain`/controls ở `frostedGlass()`.
- `12`: glitter off giảm hạt, body vẫn trắng → glitter là noise contributor riêng.
- `13`: milk/rim multiplier off tác động nhỏ hơn glow trong ánh sáng này → không đổ lỗi chủ yếu cho milk.
- `04` là grouped diagnostic, không phải final preset để copy.

Tách glow body/edge/translucency/glitter độc lập. Điều chỉnh glow theo ánh sáng và vùng cánh, tránh cộng sáng diện rộng làm tone-map san phẳng body. Giữ frost, tune roughness/absorption/clearcoat sau khi body không bị phủ trắng. Làm highlight có hình và rim/core contrast như original. Không tăng subdivisions vốn đã56×72 để chữa vấn đề này.

**Sửa debug quan trọng:** `glitterFragmentMain` có `rimLine*0.55` cộng vô điều kiện ngoài `uGlitter`; `plainGlass()`/uGlitter0 chưa tắt term đó. Thêm control/debug gating đúng; giữ phân biệt “uniform off”, “chunk removed” và “unpatched”. Không tự nhận một case là clean optics khi còn stylisation.

Glitter object-space cell420/190 chưa có footprint filtering. Giảm phủ hạt và additive nền, kiểm tra derivative/mip/LOD phù hợp; đảm bảo stable khi chuyển động và DPR thấp. Không tăng global sharpen (đang.45), bloom hoặc exposure để giả sắc nét.

Stem hero: material glassRod roughness.02/thickness.13, vẫn có glow.18/ambient.05. Cân riêng, tham chiếu `06/21` và previous project original. Cần thanh kính có rìa specular/nền khúc xạ, không ivory rod/emission hay tăng radius vô cớ. Không đổi wires vàng Florere thành glass.

Orb: giảm cảm giác cửa phản chiếu lặp dạng rings và vàng nhựa bằng body/lightformer balance, giữ mặt champagne ấm/đôi mắt. Lá/đế hero giữ crystal crisp; xét cut topology đế nhiều tầng đều và environment cùng nhau để tiến gần cụm đá original. Không phủ rainbow/mosaic lên mọi mặt.

## 5. Polish garden, optics và composition

Sáu loài cần đọc được ở kích thước thật. So product photos và `debug=florere`: Rose đủ fullness/cánh chồng có chủ đích; Lily nhận ra trumpet/petals/stamens; Forget-me-not đọc cụm nhỏ và tâm; blue bells không thành mảng cobalt đen; Rozanne cân violet; LotV vẫn giữ green lacquer và clear bells.

Đánh giá shape trước color và bounces. `petalChip()`/bellBody qua convex solid không đại diện mọi shape concave; model nhiều phần hoặc geometry authored nếu cần. Trace hiện chỉ nội bộ một solid; traceScreen dùng exit + direction × backDist, không depth-hit bông khác; bounce sau/remaining throughput dựa vào PMREM. Không hứa “full ray tracing” hoặc caustics vật lý chưa có. Prototype interlayer approximation chỉ khi ảnh chứng minh cần và có budget đo được.

Tint.depth là world distance, garden scale1.75–2.45 làm absorption mạnh hơn. Calibrate ở scale dùng thật, không chọn màu chỉ trong isolated model. Environment mặc định hiện pavilion; jewel là query option. Điều chỉnh contrast lightformers/PMREM có kiểm soát, không làm tất cả crystal thành gương tối.

Sau bỏ cây thật, tạo các cụm crystal nhiều lớp và khoảng thở, không sáu cột thưa rời rạc cùng độ ưu tiên. Hero vẫn lớn nhất, mặt/copy không bị che. Không cần thêm loài ngoài sáu; có thể lặp loài ở hậu cảnh với scale khác nếu composition cần. Lighting/rays sau removal phải không white-out LotV và không lấy cây thật làm occluder để che lỗi.

Adaptive HDR đang scale và transmission lại scale theo renderScale, có thể xuống ~.8×scale² ở main desktop pass. Tách policy chất lượng/đo từng pass nếu cần; audit này scale1 nên không lấy adaptive làm lý do duy nhất của ảnh hiện tại. QA high đã full; phải làm default usable, không chỉ đẹp với quality=high. Mobile emulation không thay benchmark điện thoại thật.

## 6. Hoàn tất bằng evidence mới

Triển khai theo checkpoint: removal → hero material/stem → figurines/composition → lighting/post/quality. Sau mỗi checkpoint chụp cùng camera/viewport, mở ảnh thật và tự so với original; tiếp tục sửa trong phạm vi được giao, không dừng sau vài con số.

Bắt buộc deliver:

1. Before/after full 1672×941 DPR1, native crops hero/petals/stem/Rose/Lily/LotV, ảnh crystal-only cho thấy không còn cây thật.
2. A/B bloom off, petal glow/glitter off riêng; ghi chính xác term nào còn, không dùng diagnostic transparent petals làm final.
3. 2559×1276, 1672×941 DPR2, 390×844 DPR2 và tablet. Ghi URL/settings/renderScale/HDR/transmission/mirror thật.
4. Kiểm tra idle/pointer/intro/navigation home→playground→about→playground, resize, reflection/shadow ghost; video/frame sequence để kiểm shimmer và silhouette chuyển động.
5. `npm run check` sau implementation; sửa lỗi do thay đổi của mình. Console shader warnings phải được đánh giá, không giấu trong “no errors”.
6. Báo file sửa, ảnh evidence đã xem, những điểm khớp/chưa khớp original, giới hạn optics/performance còn lại. Không tự đánh dấu giống original chỉ vì test xanh.

Người dùng đã yêu cầu thực hiện hướng này. Không hỏi lại có bỏ cây thật không, không giữ foliage vì board có, không xóa nhầm figurines xanh. Hoàn thành thay đổi và verification cụ thể.
