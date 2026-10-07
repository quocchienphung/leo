# Audit Crystal Playground — hướng triển khai cho Claude Code

Ngày: 2026-10-07. Phạm vi: đọc source, kiểm tra render thật, đối chiếu 6 sản phẩm Swarovski và các ảnh người dùng gửi. **Chưa thay đổi implementation của scene.** Các thử nghiệm material chỉ chạy trong bộ nhớ một phiên Chromium riêng.

## 1. Kết luận và quyết định đề xuất

Scene có nền tảng tích hợp tốt: Three.js thuần, camera/transition chung, HDR riêng cho playground, reflection sàn, environment capture và animation daisy. Nên giữ những phần này.

Khoảng cách với ảnh mong muốn nằm ở ba lớp:

1. **Quang học:** shader hiện bù cho khúc xạ thiếu chiều sâu bằng nhiễu hướng, màu cộng thêm và ô Voronoi. Kết quả dễ đọc thành mosaic/kim loại ghép mảnh.
2. **Asset:** chưa có sáu loài Florere. Lá/đế hiện có hình khối, nhưng chưa có thiết kế mặt cắt và đường đi ánh sáng đủ tốt để đạt chất crystal trong ảnh.
3. **Art direction:** layout đang bám ảnh cũ, ít hoa và nhiều khoảng trống. Ảnh mới là một khu vườn có lớp sâu, hoa màu, phản sáng và các cụm cây. Tuning material không tự tạo được bố cục ấy.

**Hướng chính:** giữ renderer hiện tại; xây thư viện hoa 3D có hình học được kiểm soát, ưu tiên model GLB được dựng theo ảnh sản phẩm; làm một scene thử vật liệu nhỏ trước; sau đó bố trí đủ sáu mẫu vào pavilion. Chỉ cân nhắc khúc xạ truy vết trong mesh cho một vài crystal nổi bật nếu PBR thông thường vẫn không đủ. Không mở đầu bằng việc thêm thư viện render hoặc viết lại toàn scene.

Ảnh moodboard là mục tiêu thẩm mỹ, không phải bằng chứng rằng toàn bộ hiệu ứng trong đó có thể tái tạo chỉ bằng vài thông số realtime. Cần duyệt silhouette, phản xạ và độ trong riêng trước khi duyệt bloom.

## 2. Bằng chứng đã kiểm tra

- Đọc toàn bộ 11 module trong `webgl/env/crystal/`, `webgl/shaders/crystal.ts`; kiểm tra backdrop shader, `manager.ts`, `assets.ts`, `cameras.ts`, route/view và tài liệu scene hiện tại. Đường dẫn dưới đây tương đối với `src/components/sites/leoparpeix/` nếu không nói khác.
- Phiên bản khai báo: Three.js `^0.186.1`, Next.js `16.3.5`. Đã đối chiếu trực tiếp các shader chunk và transmission pass trong `node_modules/three` của workspace.
- Chạy `/playground?skipLoader&quality=high&debug=probe`, Chromium/ANGLE D3D11, viewport 1672 × 941, DPR 1; GPU phiên kiểm tra: RTX 4070 SUPER.
- Inventory environment: 252 mesh objects; 327.182 tam giác khi cộng các instance trong toàn cây scene. Đây **không phải** số tam giác nhìn thấy, draw calls, FPS hay benchmark mobile.
- Không ghi nhận `pageerror`/console error trong phiên A/B; có 6 compiler warning, lưu trong [runtime-audit.json](runtime-audit.json). Không suy ra shader đúng tuyệt đối từ việc trang vẫn render.
- Đọc sáu trang sản phẩm; tải ảnh primary, lưu URL gallery và kích thước ở [swarovski-references.json](swarovski-references.json). Trong HTML đã kiểm tra không tìm thấy link `.glb`, `.gltf`, `.usdz`; chưa kiểm chứng toàn bộ network của mọi widget trên site.

### Ảnh A/B

| Ảnh | Thay đổi trong phiên kiểm tra | Điều quan sát được |
|---|---|---|
| [01 baseline](evidence/01-baseline.png) | Source hiện tại, độ phân giải HDR được ghim | Đế/lá thành các mảng đục; cube có ô đa giác rõ |
| [02 debug glass hiện tại](evidence/02-existing-debug-glass.png) | Gọi đúng `plainGlass()` hiện có | Ô đa giác và màu phân mảnh vẫn còn |
| [03 tắt toàn bộ facet effects](evidence/03-all-facet-effects-off.png) | Tiếp tục đặt `uScatter`, `uInternal`, `uShade` về 0, cùng `uFire/uInner/uGlitter` | Pattern mosaic biến mất; crystal còn lại rất phẳng |
| [04 crystal không patch](evidence/04-unpatched-crystal-diagnostic.png) | Bỏ patch trên cut crystal; dispersion 0; thickness 0.2; transmission scale 1 ở main pass | Lộ rõ giới hạn hình học/khúc xạ và môi trường phản chiếu hiện có |

Ảnh 04 thay nhiều biến, chỉ dùng chẩn đoán, **không phải preset sửa lỗi hay bản đề xuất hoàn thiện**. Nó vẫn giữ patch milk/translucency của daisy. Animation environment được ghim ở 12 giây và cloud bake được đóng băng; grain của manager vẫn chạy nên không dùng pixel diff tuyệt đối.

## 3. Các phát hiện trong source, theo ưu tiên

### P0 — Shader đang vẽ thêm “mặt cắt” không thuộc hình học

`webgl/shaders/crystal.ts:257` (`facetedTransmission`) thêm vector hash vào normal trước khi khúc xạ. `:401` (`crystalFireMain`) thêm phản xạ với back-normal giả, phổ màu tự dựng và `crystalCells`. Ở `:447`, cell được lấy theo world position + một tia dịch ngắn, rồi nhân màu/viền lên `outgoingLight`. Đây không phải giao điểm với mặt sau thật hay phản xạ nội toàn phần.

`webgl/env/crystal/flower.ts:301` bật cho lá: scatter 1.1, internal 0.4; `:315` bật cho đế: scatter 1.3, internal 0.55. Cube trong `props.ts` dùng cùng cơ chế. Pattern giả hiện lên cả những chỗ geometry đáng lẽ là một mặt phẳng lớn. Ảnh 02 → 03 xác nhận nó đóng góp trực tiếp vào cảm giác mosaic.

**Làm:** tạo baseline cut-crystal không patch. Đánh giá thật các mặt ngoài, độ dày, environment và đường đi của tia. Bỏ Voronoi nội khối, dark seams trên mọi tam giác và random normal khỏi vật liệu chuẩn. Hiệu ứng sparkle nếu giữ phải thưa, có quan hệ với góc nhìn/ánh sáng; không phủ màu lên toàn bộ mặt.

### P0 — `debug=glass` không phải baseline vật lý

`webgl/env/crystal/crystalEnvironment.ts:138` chỉ đặt `uFire`, `uInner`, `uGlitter` về 0. `uInternal` vẫn chạy độc lập; `uScatter` vẫn làm lệch normal; milk và translucency cũng còn.

**Làm trước mọi tuning:** tách debug “không stylization” khỏi debug “material không patch”. Cách chắc chắn cho baseline là material mới không có `onBeforeCompile`; tránh gọi một trạng thái là physical-only khi vẫn còn code cộng sáng/đổi tia. Các replace trong `materials.ts:110` và shader patch nên báo lỗi development khi không tìm thấy anchor. Các anchor transmission đang khớp phiên bản cài đặt, chưa có bằng chứng patch bị vô hiệu do nâng Three.js.

### P1 — Thickness không theo kích thước mesh; dispersion quá mạnh để làm baseline

`flower.ts:301`: lá có `thickness=1.4` trong khi hình học ở `layout.ts` khai báo bề dày 0.16/0.18. `flower.ts:315`: đế chính cao khoảng 0.8 nhưng dùng thickness 3.2, rồi dùng chung material đó cho hai viên nhỏ hơn. Stem đường kính khoảng 0.12–0.14 nhưng `glassRod()` đặt thickness 0.7. Đây là độ lệch scale cần hiệu chỉnh; thickness scalar vốn đã là xấp xỉ, không tự đo mesh.

Dispersion của lá/đế/cube là 6. API cho phép giá trị đó, nhưng tài liệu Three.js ghi khoảng thường dùng cho hiện thực là 0–1. Vì vậy 6 là lựa chọn cường điệu, không phải lỗi API. `crystal()` dùng IOR 1.75 nhưng shader fake bounce hard-code 1.9: hai cơ chế không thống nhất.

**Làm:** thống nhất đơn vị và transform, dùng thickness riêng theo bộ phận hoặc thickness map/depth phù hợp. Bắt đầu dispersion 0, thêm dần sau khi hình đã trong và có volume. Không coi IOR là nút “tăng chất lượng”, cũng không khẳng định một giá trị thử nghiệm là IOR thật của Swarovski.

Nguồn API: [MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html). Bằng chứng tại chỗ: `node_modules/three/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js:121` nhân độ dài tia bằng thickness và model scale.

### P1 — Transmission hiện tại không giải được hoa nhiều lớp

Trong bản Three.js đang cài, `WebGLRenderer.js:2002` tạo transmission target từ opaque objects; có nhánh bổ sung backfaces cho một số trường hợp DoubleSide. Nó không thực hiện chuỗi truy vết tùy ý xuyên qua nhiều vật thể crystal. Shader sample lại ảnh bằng tia ước lượng từ thickness.

Rose có cánh chồng, Forget-me-not nhiều bông, bellflower có lòng chuông: nếu chỉ thêm nhiều `MeshPhysicalMaterial transmission=1`, không thể mặc định các lớp sẽ khúc xạ đúng qua nhau. Tăng subdivision, `DoubleSide` hoặc chuyển sang React Three Fiber không tự khắc phục giới hạn này.

**Làm:** thử vật liệu trên một cánh có thể tích, một lá, một đế và hai cánh chồng trước. Midground/background có thể dùng approximation được kiểm chứng tại camera cuối. Nếu hero vẫn phẳng, làm prototype truy vết trong mesh/BVH có entry → backface → exit và Fresnel/TIR, với số bounce giới hạn. Mỗi crystal phải là solid hợp lệ. BVH của một object vẫn không tự giải được toàn scene, inter-object refraction hay caustics sàn. Chỉ triển khai sau khi benchmark; chưa có dependency này trong repo.

### P1 — `quality=high` vẫn để khúc xạ ở độ phân giải thấp

`crystalEnvironment.ts:250` luôn gán transmission scale 0.45 desktop / 0.35 tablet. `quality=high` chỉ bỏ adaptive downscale của HDR target. Với main target 1672 × 941, transmission main pass chỉ khoảng 752 × 423 ở DPR 1.

`floor.ts:129` dùng reflection 0.6 desktop / 0.4 tablet và `:138` chỉ update mỗi hai frame. Các lựa chọn này có lý do hiệu năng, nhưng làm so sánh chất lượng dễ sai, nhất là khi crystal cần cạnh sắc. Runtime ghi reflection target 1003 × 565.

**Làm:** quality tier điều khiển riêng HDR, transmission, reflection và tần suất reflection. Chế độ QA phải cho phép transmission 1 để so sánh. Đừng tăng tất cả target mặc định cho mọi thiết bị. Đánh giá cả đứng yên lẫn pointer/dolly trước khi giảm chất lượng.

### P1 — Hình học phù hợp daisy nhưng không phải bộ Florere

`flower.ts:42` tạo cánh daisy từ sphere 56 × 72 với normals mượt. Cách này hợp cánh frosted tròn; không phải cơ sở để tạo Rose, Lily và chuông bằng đổi màu/scale. Giữ rig mở cánh, mắt và bố cục chính của daisy.

`crystalLeafGeometry():104` có thể tích và facets thật, không phải mặt phẳng 2D; không nên chẩn đoán rằng repo “chưa có geometry crystal”. Tuy nhiên normal của facets, độ sâu mặt sau và cấu trúc cut cần được kiểm chứng trong scene thử. `blockGeometry():170` là convex hull của các ring có jitter; tăng số điểm ngẫu nhiên chỉ tăng tam giác, không đảm bảo thiết kế mặt cắt tốt.

**Làm:** thiết kế cut theo các mặt có chủ ý; triangulate một mặt phẳng vẫn giữ normal chung cho cả mặt đó; split normals ở cạnh cut. Kiểm tra solid kín, hướng normals, mặt suy biến, giao nhau và transform. Bevel nhỏ chỉ ở cạnh thực sự cần bắt sáng. Không dùng flat shading cho toàn bộ cánh frosted daisy.

### P2 — Phân bố sáng và hậu kỳ đang làm vật liệu khó đọc

`materials.ts:170` dùng roughness 0.32 cho petal, milk tint và rim darkening; `:195` dùng milk 0.62 và ambient glow 0.45 cho tâm. Trong render hiện tại, petal rất đều và orb gần quả cầu vàng bóng. Cần thử riêng roughness, độ dày, backlight và reflection, không chỉ giảm roughness cả scene.

`crystalEnvironment.ts:86` có sun intensity 9; shader còn cộng glow/fire/rim. `post.ts:33` threshold 1.25; các bloom weights là 0.1/0.09/0.08; `shaders/crystal.ts:193` thêm haze cố định, grade ấm và tăng saturation. Những giá trị riêng lẻ không chứng minh overexposure; tổng pipeline cần A/B không bloom, không haze, không additive glow.

Cut crystal dùng jewel environment riêng trong `lightformers.ts`, còn glass thường nhận capture của pavilion (`crystalEnvironment.ts:223`). Đây là kỹ thuật art direction hợp lệ, nhưng độ sáng/hướng highlight cần ăn khớp. Không xóa lightformers một cách máy móc: kính vẫn cần các vùng sáng và tối để nhìn ra volume.

**Làm:** khóa exposure; cân key/fill và negative fill trước; daisy được backlight có chọn lọc; giữ vùng tối và vùng trong ở crystal. Chỉ bật bloom ở bước cuối, trên highlight nhỏ. Hạt trên cánh phải ổn định khi di chuyển và đủ thưa để không thành noise toàn bề mặt.

### P2 — Sàn/caustics và bố cục là công việc riêng

`shaders/crystal.ts:116` tạo caustic từ hàm sin; `:149` dùng vùng mask hard-code. Nó không lấy vị trí/cấu trúc sáu hoa mới. Pool tự blend nền và reflection, không phải mô phỏng truyền sáng vật lý.

Có thể giữ caustic giả nếu nó đúng vị trí, nhẹ và thuyết phục. Với bố cục gần cố định, texture/decal bake từ scene đồng nhất hợp lý hơn pattern cầu vồng rộng không gắn vật thể. Caustics chính nên nằm gần đế/đường chiếu; không dùng rainbow khắp sàn để che lỗi material.

`layout.ts`, `VISUAL_DECONSTRUCTION.md` và ảnh `docs/design-references/playground-crystal-reference.png` đang mô tả layout cũ: cube, bình cây, bowl, khoảng trời rộng. Ảnh mới người dùng gửi có vườn hoa dày hơn. Tài liệu cũ còn vài chi tiết lệch code, ví dụ milk 0.24 thay vì 0.07 và “six stones” thay vì hai viên phụ. Dùng code và ảnh mới làm chuẩn, cập nhật brief trước khi dựng garden.

## 4. Sáu mẫu cần dựng đúng

Xem [contact sheet ảnh sản phẩm](references/contact-sheet.jpg), thứ tự trái → phải, trên → dưới đúng bảng này. Facet counts bên dưới là tổng công bố của sản phẩm, **không phải** chỉ tiêu triangle count cho model.

| Mẫu / nguồn | Đặc trưng phải giữ từ sản phẩm | Điều không nên suy từ moodboard |
|---|---|---|
| [Rose 5666973](https://www.swarovski.com/en-US/p-5666973/Florere-Rose) — 150 facets | Đầu hồng nhiều mặt cắt, hai lá xanh, thân vàng mảnh cong, đế crystal tự nhiên không faceted theo mô tả hãng | Không làm thân kính; không thay cả đế bằng khối diamond ngẫu nhiên |
| [Forget-me-not 5666971](https://www.swarovski.com/en-US/p-5666971/Florere-Forget-me-not) — 876 | Cụm nhiều bông xanh nhỏ, nhụy sáng, có nụ, nhánh/thân vàng, đế tự nhiên | Không scale một daisy xanh; số facets cao do nhiều bộ phận |
| [Rozanne 5693143](https://www.swarovski.com/en-US/p-5693143/Florere-Rozanne) — 328 | Hai bông chính nhìn rõ trong ảnh primary và nụ; cánh xanh tím có Shimmer, thân champagne gold, đế tự nhiên | Không đổi thành một bông lavender lớn duy nhất như hình minh họa |
| [Lily 5666972](https://www.swarovski.com/en-US/p-5666972/Florere-Lily) — 222 | Hoa vàng, silhouette cánh nhọn mở và cong, nhụy vươn, lá xanh, thân vàng, đế tự nhiên | Bản crystal gần trong/champagne trong moodboard là biến thể nghệ thuật, không phải màu sản phẩm gốc |
| [Lily of the Valley 5721541](https://www.swarovski.com/en-US/p-5721541/Florere-Lily-of-the-Valley) — 312 | Nhiều chuông trong rủ trên thân kim loại sơn xanh, lá dài xanh, đế cắt gọn | Không dùng chung thân vàng; sản phẩm gốc là transparent blossoms, không mặc định trắng sữa |
| [Blue Bellflower 5719807](https://www.swarovski.com/en-US/p-5719807/Florere-Blue-Bellflower) — 239 | Chuông xanh đậm rủ xuống, mép xòe, có nụ; thân champagne gold mảnh, quấn đế | Không thay bằng Iris hoặc Forget-me-not màu xanh |

Thứ tự ưu tiên nguồn: **trang/ảnh sản phẩm cho identity, hình dáng, cấu trúc vật liệu; ảnh người dùng mới cho bố cục, ánh sáng và cảm xúc; ảnh local cũ cho phần daisy có thể tái sử dụng.** Nếu muốn recolor sản phẩm để phối cảnh, lưu thành preset riêng, không lặng lẽ gọi đó là bản clone chính xác.

Không cần clone UI bán hàng Swarovski. Asset thu được ở đây là ảnh reference, không phải model 3D sẵn. Ảnh một góc cũng không đủ suy ra chính xác toàn bộ hình học khuất; khi dựng cần dùng gallery và đánh dấu phần được tự thiết kế.

## 5. Hướng kiến trúc và material

### Giữ và mở rộng

- Giữ `WebglManager`, `PlaygroundEnvironment`, `CrystalPost`, camera, transitions, daisy rig và lifecycle dispose.
- Tạo `FlorereGarden` và manifest placement riêng; mỗi species có model/geometry riêng, dùng chung các material family.
- Ưu tiên dựng asset có kiểm soát trong Blender/DCC rồi export GLB. Nếu dựng bằng code, dùng template hình học riêng cho từng loài; không quay về random hull cho tất cả cánh.
- Thư mục đề xuất: `public/sites/leoparpeix/crystal/flowers/<species>.glb`; `webgl/env/crystal/florere/` cho loader/material/placement. Đây là đường dẫn đề xuất, chưa tồn tại.
- Naming node/material rõ: `petal`, `leaf`, `stemGold`, `stemGreen`, `stamen`, `base`. Có material slot riêng cho đế/cánh; áp dụng transform trước export; scale theo một quy ước chung.

### Những điểm tích hợp Claude phải để ý

`assets.ts` đã có GLTFLoader + Draco. Không cần thêm React Three Fiber/drei chỉ để load GLB. `ModelKey` hiện lấy từ `data/media.ts`, nên thêm API manifest/loader có type hoặc mở rộng model map, không truyền arbitrary key bằng cast.

Loader ảnh/KTX hiện ép `NoColorSpace` cho pipeline baked cũ. **Không tái sử dụng quy tắc đó cho mọi texture PBR mới**: color/albedo cần khai báo color space phù hợp; normal/roughness/thickness là dữ liệu. Giữ extension/material semantics của GLTFLoader. Nếu dùng KTX2 bên trong GLB, kiểm tra nối `setKTX2Loader` — code hiện mới nối Draco.

`ensurePlayground()` đang tạo procedural scene đồng bộ rồi precompile. Khi thêm GLB, await asset trước assembly/precompile, có failure/retry/fallback và disposal rõ ràng. Không sao chép promise lỗi bị giữ vĩnh viễn.

HDR được tone-map/sRGB ở `CrystalPost`, renderer chung chủ động dùng `LinearSRGBColorSpace` và pass cuối chuyển tiếp giá trị. **Chưa thấy bằng chứng double tone mapping. Không đổi global output color space để “sửa kính”**, vì có thể làm sai các route baked. Shader mới phải xuất linear HDR vào đúng stage hiện tại.

### Material families và điểm xuất phát thử nghiệm

Các khoảng sau chỉ là thử nghiệm, không phải thông số vật lý đã đo của Swarovski hoặc preset đảm bảo đạt ảnh.

| Family | Điểm xuất phát | Mục tiêu thị giác |
|---|---|---|
| Clear cut crystal | transmission 1, metalness 0; roughness 0.02–0.08; thử IOR 1.5–1.7; dispersion bắt đầu 0 rồi 0.1–0.8 | Nhìn xuyên có biến dạng; mặt sáng/tối gắn với môi trường; highlight sắc |
| Colored cut crystal | Cùng family trên, absorption/attenuation theo màu và độ dài tia; color tint nhẹ | Vùng mỏng sáng/trong, vùng dày đậm hơn; tránh toàn thân thành nhựa màu |
| Daisy frosted petal | Giữ geometry mượt; thử roughness 0.12–0.25 cạnh baseline 0.32; milk yếu và glitter được lọc | Trong mờ có chiều sâu, rim sáng chọn lọc, không đục đều |
| Champagne center | Giảm/tắt glow để chẩn đoán, thử lại attenuation và reflection | Tâm ấm, mềm, có volume; không thành bóng nhựa phát sáng |
| Gold stem/stamens | PBR metal, transmission 0, metalness gần 1, roughness thử 0.15–0.3 | Thân rất mảnh, có vùng tối và highlight vàng hẹp |
| Green lacquered metal | Lớp sơn xanh opaque, clearcoat vừa phải; không lấy metalness 1 chỉ vì lõi là kim loại | Nhận ra vật liệu sơn bóng ở Lily of the Valley |
| Natural crystal base | Hình organic khác cut base; normals/roughness có chủ ý | Không đồng nhất mọi đế thành cùng một cụm tam giác |

Thickness chọn theo **local geometry + transform**, attenuationDistance theo world scale; không dùng một con số chung cho cả bảng. Nếu dùng mesh ray tracing, tính quãng đường trong khối từ giao điểm thật và kiểm tra lại attenuation.

### Về phương án prerender/hybrid

Prerender/bake có lợi cho nền xa, caustics và chi tiết kiến trúc. Tuy nhiên camera hiện có intro dolly 5–7 units, route exit 6 units và scroll offset (`cameras.ts`). Dán toàn garden lên một tấm ảnh sẽ lộ sai parallax/occlusion khi chuyển động. Nếu chọn 2.5D cho hoa xa, phải kiểm tra đủ quãng camera hoặc điều chỉnh riêng camera playground có chủ ý. Hero, hoa midground và geometry phản chiếu quan trọng nên giữ 3D trong hướng chính.

## 6. Trình tự triển khai và điều kiện chuyển bước

### Bước 1 — Scene thử vật liệu và debug đáng tin

Trong development, tạo scene nhỏ bằng renderer hiện có: một lá cut, một viên đế, một petal frosted, một cánh màu và hai cánh chồng; nền sáng/tối có đường để nhìn biến dạng. Khóa camera, ánh sáng, exposure, tắt bloom/haze/grain/fluid cho bài test. Có toggle độc lập: patch, transmission scale, env, thickness, dispersion.

Điều kiện: crystal nhìn ra volume khi bloom bằng 0; pattern không giống vết nứt/mosaic; các thông số làm thay đổi đúng cơ chế. Ghi rõ giới hạn multilayer còn lại. Nếu PBR không đủ, prototype optical nâng cao ở đây trước khi nhân sáu loài.

### Bước 2 — Dựng và duyệt một Rose hoàn chỉnh

Dùng Rose vì phân biệt rõ cánh hồng, lá xanh, thân kim loại và đế tự nhiên. Dựng trong scene thử, đối chiếu primary + gallery ở chính diện, 3/4, bên hông. Có thể dựng asset bằng script DCC để Claude tái chạy; cần xuất được GLB thật, không chỉ tạo component placeholder.

Điều kiện: nhận đúng loài từ silhouette ở kích thước placement cuối; vật liệu nhìn khác nhau; không có overlap/culling bất thường. Đưa một Rose vào pavilion để kiểm tra material dưới ánh sáng thực trước khi tạo các mẫu còn lại.

### Bước 3 — Hoàn thành thư viện sáu loài

Hoàn thiện năm loài còn lại với cùng ngôn ngữ vật liệu. Dùng component con lặp lại/instancing nếu phù hợp; geometry và topology riêng theo loài. Không coi 876 facets là 876 mesh. Thử ở kích thước cuối trước khi thêm bevel/facet nhỏ hơn một pixel.

Điều kiện: contact sheet sáu model local có nhãn, ảnh cận và ảnh ở kích thước midground. Lily of the Valley và Blue Bellflower phải khác rõ nhờ thân/lá, nhánh và hình chuông.

### Bước 4 — Chuyển layout cũ thành garden theo ảnh mới

Đề xuất ban đầu theo chiều sâu stage (camera nằm ở z dương): daisy gần z=0; hoa phụ ở z âm, chia hai hoặc ba lớp thay vì một hàng ngang. Chọn vị trí bằng projection qua camera thật; không rải ngẫu nhiên rồi sửa bằng mắt từng object.

- Rose: trái midground, điểm nhấn hồng.
- Forget-me-not: trái, thấp hơn Rose và lệch ra ngoài phần chữ.
- Rozanne: phải phía sau, điểm nhấn tím; không nhầm Iris trong moodboard.
- Lily: phải midground, silhouette mở, thấp hơn đỉnh daisy.
- Lily of the Valley: rìa phải, chừa khoảng cho dáng rủ/lá dài.
- Blue Bellflower: cụm trái phía sau hoặc rìa phải thứ hai, tránh chồng trực tiếp lên Rozanne.

Mục tiêu ban đầu: hoa phụ khoảng 35–60% chiều cao projected của daisy, tùy loài và tầng sâu; đây là lựa chọn composition, không phải tỷ lệ kích thước thật Swarovski. Không chặn mặt daisy hoặc dòng chữ header. Dùng pedestal thấp và cao xen kẽ, thêm foliage như các cụm có chủ ý; giảm vai trò cube/bowl nếu chúng chiếm vị trí hoa.

Điều kiện: ảnh toàn cảnh 1672×941, 2560×1264 và mobile vẫn đọc rõ daisy + copy. Bộ sáu loài là phạm vi chính; Hydrangea, Iris, Tulip, wildflowers trong moodboard là mở rộng, không thay thế sáu URL.

### Bước 5 — Hoàn thiện sàn, background, hậu kỳ

Sau khi hoa và vật liệu ổn, chỉnh phản chiếu, texture đá, mật độ cây, silhouette núi và ánh sáng. Nền hiện có cloud/terrain raymarch phức tạp; không dành vòng đầu để tăng số sample mây. Baked high-quality background hoặc terrain asset có thể hiệu quả hơn nếu mục tiêu là chi tiết cảnh quan trong ảnh, nhưng phải khớp sun/environment và camera.

Bật lại bloom nhẹ, glare cục bộ, caustics gắn vị trí. Không dùng DOF toàn scene để che vật liệu lỗi; nếu dùng, hero và copy phải rõ, background blur có kiểm soát.

### Bước 6 — Chất lượng thích ứng và regression

Đo frame time/GPU time, draw calls, load và memory trên thiết bị mục tiêu. Scene hiện đã có nhiều lượt render: main HDR, transmission, mirror + transmission của mirror, bloom, grain/fluid và top canvas. Cộng số tam giác scene không đủ dự đoán FPS.

Ưu tiên LOD theo projected size, merge/instance stem và chi tiết lặp, giảm raymarch nền/bounce shader trước khi làm mờ toàn hero. Quality tiers điều khiển transmission/reflection riêng; có fallback không WebGL hoặc reduced-motion phù hợp app.

Kiểm tra intro không skipLoader; pointer hai biên; scroll tiến/lùi; home → playground → about → playground; resize qua 1025px; mobile portrait/landscape; tải asset thất bại. Lưu ý `lite` được chốt trong constructor hiện tại, không tự tái tạo khi vượt breakpoint. Sau sửa code chạy `npm run check` và chụp đối chiếu lại. Audit này chỉ thêm tài liệu/evidence/tool chẩn đoán, chưa chạy production check cho một implementation mới.

## 7. Checklist nghiệm thu về hình ảnh

- Daisy là tiêu điểm; sáu loài đúng identity và có lớp sâu.
- Cánh frosted và cánh crystal cắt có ngôn ngữ shading khác nhau.
- Lá/đế có vùng trong, vùng phản chiếu và vùng tối; không phải mọi facet đều sáng đục.
- Không có ô Voronoi, viền tối theo mọi tam giác hoặc rainbow nhuộm toàn khối.
- Highlights phản ứng liên tục khi pointer thay đổi; không nhấp nháy đổi pattern.
- Hoa nhiều lớp được kiểm tra thật dưới ánh sáng pavilion; giới hạn còn lại được ghi rõ.
- Sàn phản chiếu hoa ở vị trí đúng; caustic có quan hệ với nơi đặt crystal.
- Khi tắt bloom, vật liệu vẫn có chất crystal. Khi bật bloom, không mất cạnh và màu hoa.
- Screenshot high quality đi kèm thiết lập transmission/reflection và thời điểm animation, không chỉ query `quality=high`.

## 8. Bàn giao

Prompt thực thi ngắn: [CLAUDE_HANDOFF.md](CLAUDE_HANDOFF.md).

Script tái tạo A/B: `node scripts/audit-playground-crystal.mjs` khi dev server đang chạy ở port 3000. Script dùng debug development, tạo browser riêng và đóng browser sau khi chụp; không sửa source scene. Nó chỉ chạy Windows/ANGLE như môi trường audit này. Evidence cũ sẽ được ghi đè nếu chạy lại.
