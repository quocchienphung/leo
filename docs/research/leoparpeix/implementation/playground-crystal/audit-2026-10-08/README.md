# Rescan Crystal Playground — 2026-10-08

## Kết luận để hành động

Source hiện tại đã tiến bộ so với audit 07/10: có sáu Florere, cut-solid tracer theo mặt thật và chế độ QA transmission toàn độ phân giải. Tuy vậy, ảnh runtime vẫn khác rõ ảnh original cuối của người dùng. Vấn đề hero chủ yếu là **lớp sáng trắng cộng thêm phủ thân cánh làm mất tương phản thể tích**, không chỉ thiếu pixel hoặc roughness cao. A/B tắt riêng glow xác nhận đây là một tác nhân lớn; glitter dày tạo thêm nhiễu. Thân chính cũng có glow riêng, cần chỉnh độc lập.

**Yêu cầu mới: bỏ cây/hoa tự nhiên, giữ toàn bộ tượng crystal.** Đã truy đúng factory tạo cây và chụp preview crystal-only trong browser. Chưa sửa implementation scene; đây là gói phân tích, evidence và prompt để Claude triển khai tiếp trên công việc đang có.

Đọc [CLAUDE_HANDOFF.md](CLAUDE_HANDOFF.md) để giao việc; mở ảnh theo [EVIDENCE_INDEX.md](EVIDENCE_INDEX.md). [evidence-manifest.json](evidence-manifest.json) lưu kích thước, SHA-256, provenance và fingerprint source. [runtime-rescan.json](runtime-rescan.json) lưu settings/material inventory/console.

## Thứ tự ưu tiên tham chiếu

1. Lời yêu cầu mới của người dùng: xóa thực vật thật; giữ tượng crystal.
2. [00-user-original-target.png](references/00-user-original-target.png): **ảnh cuối người dùng chỉ định là original muốn đạt**, bản copy nguyên byte từ file Downloads; chuẩn chất liệu, ánh sáng, độ rõ và phân tầng.
3. Hai moodboard `01-user-pavilion-design-board.png`, `02-user-alternative-flower-board.png`: đối chiếu chi tiết, không tự thêm tất cả loài trong board.
4. Sáu ảnh Swarovski và `swarovski-references.json`: chuẩn nhận diện từng Florere, đã thu thập ngày 07/10. Đây là ảnh sản phẩm, không phải bằng chứng có model 3D tải sẵn.
5. `03-previous-project-reference.png`: tham chiếu dự án cũ, hữu ích để đối chiếu độ trong của stem/hero; không thay thế ảnh đích cuối.
6. Runtime hiện tại và capture lịch sử: bằng chứng lỗi/tiến bộ, không phải ảnh chuẩn cần sao chép.

Original và boards có foliage tự nhiên. Điều đó **không** cho phép đưa olive, cypress, bụi lá/hoa thật trở lại. Lấy ngôn ngữ ánh sáng và crystal; thay khoảng trống bằng bố cục crystal có kiểm soát nếu cần. Bầu trời/núi là backdrop phong cảnh, không phải tượng thực vật cần xóa.

Ba screenshot đầu trong tin nhắn hiện tại không có đường dẫn file local được cung cấp. Không giả danh chúng là file đã lưu: `09` là capture lại đúng kích thước 2559×1276; `16/17` là crop runtime tương ứng vùng người dùng khoanh. Ảnh original cuối và hai boards đã tìm thấy đúng file local và copy nguyên byte.

## Những kết luận cũ đã được sửa

| Audit 07/10 | Source đang chạy 08/10 |
| --- | --- |
| Chưa có sáu loài | Đã có `Rose`, `Forget-me-not`, `Blue Bellflower`, `Lily`, `Rozanne`, `Lily of the Valley` trong `FlorereGarden` |
| Voronoi/random refraction normal là vấn đề chính của cut crystal | `crystalTrace.ts` đã truy đường đi qua các plane của convex solid; giữ tiến bộ này |
| QA high vẫn transmission 0.45 | `crystalEnvironment.ts:290` đặt transmission scale **1** khi pinned; runtime xác nhận |
| Stem thickness 0.7 | `materials.ts:308` hiện là **0.13**, roughness 0.02 |
| Debug không tắt milk/translucency | `plainGlass()` đã tắt những uniform đó; còn một ngoại lệ mới phát hiện: rimLine hard-coded không phụ thuộc `uGlitter` |

Không đưa các giả định cũ vào prompt như lỗi chưa sửa. Audit 07/10 và capture `after/` giữ làm lịch sử; prompt 08/10 thay thế prompt cũ.

## Phạm vi và cách đo

Đọc lại flower/materials/props/layout/environment/post/floor/world/architecture/backdrop, cut topology, Florere kit/species/garden, lightformers, shader crystal/crystalTrace và đoạn tích hợp WebglManager. Đối chiếu renderer và transmission chunk của **Three.js đang cài**; không suy API từ trí nhớ.

Capture bằng Playwright Chromium trên Windows ANGLE D3D11, localhost:3000; không tương tác pointer. Có 13 ảnh runtime và 9 crop/bảng phân tích, cùng toàn bộ references và capture lịch sử: **45 ảnh trong manifest**.

Ảnh `02–07,11–13` dùng cùng page QA: environment time 12s, full HDR/transmission/mirror. Mỗi case restore material/post trước khi đổi biến. Grain ở composer ngoài và yếu tố trình duyệt vẫn có thể thay đổi: so sánh định tính, không tuyên bố pixel-perfect determinism. `01/08/09/10` là các page riêng, không dùng pixel diff giữa chúng để quy hoàn toàn cho độ phân giải.

| Case | CSS viewport / DPR | HDR | Mirror | Transmission scale |
| --- | --- | --- | --- | --- |
| Default `01` | 1672×941 / 1 | 1672×941 | 1003×565 | 0.8 |
| High `02–07,11–13` | 1672×941 / 1 | 1672×941 | 1672×941 | 1 |
| High retina `08` | 1672×941 / 2 | 3344×1882 | 3344×1882 | 1 |
| Wide `09` | 2559×1276 / 1 | 2559×1276 | 1535×766 | 0.8 |
| Mobile emulation `10` | 390×844 / 2 | 780×1688 | 312×675 | 0.5 |

Tất cả capture này `renderScale=1`. Không quy triệu chứng hiện tại cho adaptive tự hạ scale khi log không chứng minh điều đó. `frameMs` là EMA của nhịp callback, pinned giữ giá trị khởi tạo 16; **không phải GPU benchmark**, và browser mobile emulation không chứng minh hiệu năng điện thoại thật.

Không có `pageerror`/console error trong lần capture. Có warning shader D3D: precision X4122, gradient trong loop X3595, biến dynamic-index/traceScreen có khả năng chưa khởi tạo X4000. Chưa đủ bằng chứng warning là nguyên nhân vẻ ngoài; kiểm tra shader portability riêng, không ghi “clean console” hoặc “mọi GPU đều đúng”.

## 1. Daisy: khác biệt giữa frosted glass và lớp trắng phủ

Đối chiếu [19-original-vs-current-hero.png](evidence/19-original-vs-current-hero.png), [20-petal-isolation-contact-sheet.png](evidence/20-petal-isolation-contact-sheet.png), và ảnh full-res gốc. Các bảng dùng crop 1:1, không sharpen/đổi màu/upscale.

Ảnh đích có cánh tròn frosted với thân cánh vẫn có độ sâu, mép sáng rõ, vùng chuyển sáng/tối có chọn lọc. Runtime có vùng trắng tương đối đều trên gần toàn bộ cánh, hạt li ti dày, ánh phản xạ cửa lặp trên orb. Đây là nhận xét thị giác, không đồng nghĩa geometry bị out-of-focus.

`flower.ts:43` tạo cánh từ sphere 56×72, reshape thành paddle và tính lại normals. Geometry đã khá dày và silhouette mượt: tăng subdivisions không giải quyết lớp trắng. Giữ rig mở/đóng, pivot và tính cách của daisy; không biến cánh hero thành gem đa giác chỉ để “sắc”.

`materials.ts:153` / `frostedGlass()` hiện:

| Tham số | Giá trị | Ý nghĩa trong source |
| --- | --- | --- |
| transmission / roughness | 1 / 0.24 | Khúc xạ qua volume, mip lọc theo roughness |
| ior / thickness | 1.45 / 0.22 | Volume cánh |
| clearcoat / roughness | 0.8 / 0.04 | Lớp specular bề mặt |
| milk amount / edge | 0.3 / -0.35 | Trộn màu truyền qua về milk-luma; edge âm làm sáng viền |
| translucency scale / ambient | 0.26 / 0.045 | **Cộng** vào outgoingLight, gồm wrapped light/through/lobe và ambient mặt trước |
| glitter | object-space cells 420 / 190 | Hai lớp hạt, có additive nền và sparkle |

`crystal.ts:352–366` cộng glow không trừ khỏi thành phần khác. Đây là xấp xỉ nghệ thuật, không mô phỏng tán xạ bảo toàn năng lượng. Giá trị phụ thuộc cường độ đèn trước khi tone-map; số nhỏ không đảm bảo tác động nhỏ.

### A/B và điều nó thực sự chứng minh

| Ảnh | Chỉ đổi gì | Quan sát / suy ra |
| --- | --- | --- |
| `03` | Tắt bloom/streak/rays/glare/sharpen/aberration và shafts; giữ tone map, material | Haze cảnh giảm nhưng thân cánh vẫn trắng. Hậu kỳ không phải nguyên nhân duy nhất |
| `04` | Tắt các uniform petal milk/rim-multiplier/glow/glitter cùng nhóm | Cánh nhìn xuyên rõ hơn nhiều; không dùng như material cuối vì target cần frost |
| `05` | roughness 0.24 → 0.08; các patch khác giữ nguyên | Cánh vẫn trắng; giảm roughness riêng không giải quyết tương phản thân cánh |
| `11` | Chỉ scale+ambient của petal translucency về 0 | **Thay đổi lớn nhất trong các isolation hiện có:** sky/mountain thấy qua cánh, lớp trắng phủ giảm rõ |
| `12` | Chỉ `uGlitter=0` | Bớt hạt; thân cánh vẫn trắng. Glitter góp nhiễu nhưng không phải tác nhân lớn nhất của lớp trắng |
| `13` | Chỉ `uMilk/uMilkEdge=0` | Thay đổi nhỏ hơn case 11 trong ánh sáng này; không kết luận milk là thủ phạm chính |
| `06` | Chỉ glow stem về 0 | So sánh riêng stem; chưa phải giải pháp hoàn chỉnh cho tube/refraction/environment |

**Ngoại lệ quan trọng của debug:** `crystal.ts:405–406` vẫn cộng `rimLine * 0.55` ngoài phép nhân `uGlitter`. Vì vậy `uGlitter=0`, `plainGlass()` và cả case `04` chưa tắt toàn bộ hiệu ứng trong glitter chunk. Case `12` là “uniform glitter off”, không phải shader chunk removed. Sửa cách điều khiển/debug rim riêng để có baseline đúng; debug `unpatched()` mới bỏ patch thực sự, nhưng nó cũng thay một số material properties nên không phải isolation một biến.

### Hướng sửa có căn cứ

Giữ surface rõ và volume frosted vừa đủ. Tách độ sáng thân cánh, edge highlight, glitter và scattering thành controls riêng. Giảm/định hình glow trước, để tương phản vùng thân cánh trở lại, rồi cân roughness, absorption, clearcoat và ánh sáng dựa trên ảnh original. Không chép trực tiếp case 11 thành final: nó quá trong ở nhiều vùng và vẫn thiếu frost đúng target.

Giảm số hạt nhìn thấy đồng thời, bỏ nền cộng sáng của hạt nếu tạo màn bụi, làm glitter có lọc theo screen footprint hoặc texture/mip ổn định. Source dùng `floor(position * scale)` và không có derivative filtering cho cell này. Với cánh ~181 px/stage-unit ở frame tham chiếu, lớp 420 cells/unit có thể nhỏ hơn 1 pixel. Đây là **nguy cơ aliasing suy từ source**; cần video chậm/intro để xác nhận shimmer, không tuyên bố đã đo temporal aliasing.

## 2. Stem, lá và đế hero

[21-stem-glow-native-comparison.png](evidence/21-stem-glow-native-comparison.png) tách original/current/stem-glow-off. Stem `glassRod()` có roughness 0.02, thickness 0.13, IOR 1.5 và glow 0.18/0.05. Đừng sửa bằng cách tăng radius cho rõ hoặc tăng emission: target là thanh kính, có rìa specular và nền khúc xạ bên trong.

Phải phân biệt stem hero bằng glass với wires champagne-gold của Florere. Wires vàng là identity sản phẩm, không bị “lỗi opaque” chỉ vì không transmission. Stem/thân mảnh có thể cần chống răng cưa tốt khi xuống DPR1/mobile; không có bằng chứng một global DOF đang làm nhòe chúng.

Lá và đế hero dùng tracedCrystal roughness 0.015. Chúng khá sắc nhưng các band phản xạ/khúc xạ lặp trên đế cushion đọc thành tầng đều; original là cụm đá bất quy tắc có sáng/tối đa dạng. `flower.ts:106` / `baseStones()` dùng ringGem nhiều tầng đều. Đánh giá silhouette/cut layout cùng environment; không chỉ tăng bounces/dispersion để che topology.

Orb dùng milk 0.55, glow 0.5/0.3, roughness 0.2; nhiều phản xạ cửa cong đồng tâm đang nổi rõ. So với mặt champagne mềm trong original, nên kiểm soát kích thước/vị trí/intensity lightformers và cân body glow riêng, không làm tất cả vật liệu cùng trắng sáng.

## 3. Xóa cây thật: object ownership chính xác

[22-remove-natural-keep-crystal-map.png](evidence/22-remove-natural-keep-crystal-map.png) là chú thích vùng, **không phải segmentation mask**. Cây thật và tượng crystal chồng lên nhau. Phân loại bằng factory/ownership trong source, không bằng màu xanh, tên “leaf”, material opaque hay hình chữ nhật.

Tất cả thực vật tự nhiên cần bỏ nằm trong `webgl/env/crystal/props.ts`:

| Nhóm xóa | Nguồn | Số nhánh trực tiếp thấy trong inventory |
| --- | --- | --- |
| Olive trong hai chậu | `oliveTree()` :101, loop `PROPS.planters` :244 | 2 groups |
| Undergrowth dưới hai olive | `shrub()` :162, trong loop chậu | 2 groups |
| Bụi hoa trắng ở góc trước và cạnh pool | `PROPS.shrubs`, loop :263 | 6 groups |
| Cypress đằng sau parapet | loop `CYPRESSES` :274 | 7 meshes |
| Olive xa bên phải | loop `DISTANT_TREES` :283 | 5 groups |
| Đất trong chậu | soil plane, màu 4a3a2a | 2 meshes |

Tổng preview ẩn **24 nhánh trực tiếp**, chứa nhiều mesh/instance con. Không gọi đó là “24 cây”: có soil và shrub groups. `runtime-rescan.json` lưu indices để tái lập ở đúng snapshot, không dùng indices hard-code trong implementation lâu dài.

Vật liệu cây thật: bark roughness .85, leaf .6, blossom trắng .5, heart vàng .5, cypress .95. Hoa trắng flat 5 cánh từ `blossomGeometry()` hoàn toàn khác bell/cut petals của figurines. Đây chính là nhóm người dùng phát hiện ở screenshot crop dưới trái.

Các thứ **phải giữ**:

- Daisy và cả sáu figurines dưới `FlorereGarden`; từng crystal bloom, bud, leaf, base.
- Thân/calyx/stamens champagne-gold và wire quấn đá của Florere.
- **Lily of the Valley thân và lá xanh lacquer opaque**: đó là bộ phận của tượng, không phải cây thật. `species.ts:206`, `greenLacquer()` ở materials; không xóa vì nhìn xanh hoặc vì dùng metal material.
- Các quả cầu kính trong Props, kiến trúc, bệ đá/kính và mặt nước; chậu đá có thể đổi thành bệ/loại bỏ nếu bị bỏ trống, không cần giữ hình chậu vô nghĩa.

`layout.ts:118/123/137/148` giữ planters/shrubs/cypresses/distant trees; dọn placements và helpers/materials không dùng sau khi xóa. Không xóa cả `Props` vì nó còn chứa spheres. `Props.render()` chỉ phục vụ tree sway hiện tại; sửa hoặc dọn nếu không còn đối tượng cần animate. Disposal phải đồng bộ, không để resource không còn gắn vào scene nhưng vẫn cấp phát.

### Preview đã kiểm chứng, chưa phải final

[07-crystal-only-preview.png](evidence/07-crystal-only-preview.png) ẩn đúng natural branches trong page riêng; dispose environment target, recapture và bật lại shadow update. Tượng sáu loài vẫn giữ, kể cả lá xanh LotV. Không chỉnh source, không lưu thành feature toggle production.

Preview cho thấy sau khi bỏ foliage có khoảng trống bố cục; vùng LotV cũng sáng/washed-out hơn khi thiếu occlusion trong pass rays. Vì vậy cần **relight/recompose sau removal**, không coi preview là ảnh hoàn thiện. Không giữ cây thật chỉ để che white-out; sửa light/rays/material và thêm crystal phụ có chọn lọc nếu cần.

Scene bake IBL một lần, shadow map một lần, mirror update luân phiên. Nếu bỏ đối tượng trước tạo scene thì các bake mới tự sạch; nếu đổi bằng runtime toggle phải invalidation environment/shadow/mirror đúng để tránh bóng/phản chiếu cây ma. Kiểm tra cả intro, navigation remount và resize.

## 4. Cut crystal / Florere: tiến bộ và giới hạn còn lại

`cut.ts` dùng ConvexGeometry và face planes; `crystalTrace.ts` tìm exit-plane, Fresnel/TIR, absorption theo độ dài quang học. Đây là cải thiện thật. Trace geometry cần convex solid; không áp một convex hull duy nhất cho cả bông rose nhiều cánh hoặc shape concave rồi tuyên bố chính xác.

`traceScreen()` :88 lấy điểm exit + hướng × `uBackDist`, chiếu sang UV và sample transmission roughness 0. Không dò depth/hit của bông khác. Các bounce sau dùng static PMREM environment; phần throughput còn lại được cộng theo environment. Đây là **single-solid optical approximation**, không phải path tracing toàn scene hay inter-object refraction đầy đủ.

Renderer Three hiện tại render opaque vào transmission buffer; có nhánh back-face cho material DoubleSide tùy extension. Không nên nói mọi transmissive object tuyệt đối không bao giờ có mặt trong buffer, nhưng nó vẫn không giải khúc xạ nhiều bông/chồng nhiều cánh như path tracer. Florere traced materials mặc định FrontSide nên chồng petals không được nhìn xuyên như model offline đầy đủ. Đây là giới hạn nguồn; mức đóng góp vào ảnh phải kiểm nghiệm riêng.

Rose runtime có silhouette khá rỗng, các mảnh pink/blue rời nhau; Lily nhỏ và nhọn, chưa đọc thành lily có cup mở đầy đặn như board; Forget-me-not ở mé trái khó đọc tâm vàng khi nhỏ. Kiểm tra `debug=florere` và crop trong pavilion; shape recognition phải đạt ở kích thước sử dụng, không chỉ close-up đẹp.

`petalChip()` cuối cùng đi qua convex hull nên độ cong/cup/các lớp cánh không tự trở thành shell concave thật. Nếu cần model authored GLB để kiểm soát cut topology/silhouette, dùng trên từng loài, giữ rig và lifecycle. Không bắt toàn bộ scene phải procedural khi yêu cầu người dùng là độ giống.

`TINT.depth` là world optical distance; garden scale ~1.75–2.45. Khi phóng hình học, path dài hơn nên absorption mạnh hơn. Bellflower runtime cobalt rất đậm, Lily vàng gắt, leaf saturation cao: calibrate tint/depth theo **kích thước scene thực tế** và product identity; không global desaturate toàn scene. Cho phép palette scene nhẹ hơn qua preset có chủ đích.

Environment PMREM size256, một vị trí capture gần hero, nên hình highlight mềm/thiếu parallax cục bộ là giới hạn có thật. `crystalEnv=jewel` là preset studio thay cho pavilion; mặc định hiện là **pavilion** dù một vài comment còn mô tả jewel mặc định. So sánh có khóa exposure trước khi đổi; không thay environment tối toàn scene để làm gem nổi rồi lệch ánh sáng original.

## 5. Độ phân giải và hậu kỳ

`crystalEnvironment.ts:203` đặt HDR kích thước drawing buffer × renderScale. :290 lại đặt transmission scale bằng 0.8×renderScale desktop (0.5 mobile). Renderer dùng **active viewport của render target** × transmission scale. Khi main pass ở HDR, transmission có thể xuống xấp xỉ **0.8×scale²** so với drawing buffer, không chỉ 0.8×scale. Ví dụ scale .5 → nguồn transmission main khoảng .2 desktop. Cần cân chính sách chất lượng cho các pass; không cưỡng bức high trên mọi điện thoại.

Lần capture scale luôn1, nên đây là nguy cơ ở thiết bị chậm, không phải nguyên nhân đã quan sát của lớp trắng. `quality=high` đã full resolution, nhưng mobile lite vẫn tắt sharpen/streak/MSAA theo tier; “high” không có nghĩa mọi switch chất lượng đều giống desktop.

Hậu kỳ hiện có bloom .16/.12/.1, bright threshold2.6, streak .035, sharpen .45, ray strength .9, glare .38. Không tìm thấy DOF/CSS filter blur cho hero trong pipeline đã đọc. Rays có pass 1/4 resolution và additive shafts; giữ bầu không khí nhưng không phủ trắng mọi cánh và vùng phải.

Không dùng tăng global sharpen/bloom/exposure như sửa chính. Sharpen đang khá mạnh; tăng có thể làm viền ring và glitter crawl. Điều chỉnh mức tương phản vật liệu/lighting, sau đó hoàn thiện post.

## Thứ tự triển khai đề xuất

1. Claude mở thật các ảnh trong EVIDENCE_INDEX, đọc source đang có và ghi checkpoint, giữ dirty work hiện tại.
2. Xóa natural factories/placements/resources, giữ figurine ownership; recapture và chỉnh bệ trống.
3. Sửa debug rim control, tách hero material controls, giảm/định hình additive petal glow. So sánh original ở native crop; giữ frosted character.
4. Chỉnh stem/orb/lightformers và glitter có AA; sửa topology đế nếu cần để bỏ cảm giác bands đều.
5. Polish silhouette và absorption của sáu Florere ở scale thật; relight khoảng trống bằng crystal, tránh cạnh tranh hero/copy.
6. Tuning post và chất lượng adaptive có đo; kiểm tra chuyển động/intro/navigation và mobile.
7. Chạy `npm run check` sau sửa implementation; giao before/after + crop + settings + giới hạn còn lại. Không tự đánh dấu đạt chỉ vì code build xanh.

## Nghiệm thu bằng hình

- Không còn hoa trắng tự nhiên, shrub/olive/cypress/soil trong direct render, mirror hoặc IBL sau fresh load; không xóa nhầm xanh lacquer/gold của figurines.
- Daisy đọc là frosted crystal: contour rõ, glow có chọn lọc, thân cánh có độ sâu; không phấn trắng đồng đều, không biến thành kính rỗng hay gem đa giác.
- Stem nhìn là kính với cạnh specular, không que ivory/emission; lá/đế có cut rõ và sáng tối đa dạng.
- Sáu loài nhận ra ở kích thước scene; Rose không rỗng quá mức, blue bells có chuyển sáng và Lily có silhouette đặc trưng; không thêm Iris/Tulip/Hydrangea chỉ vì board có.
- Crystal vẫn thuyết phục khi bloom off; full frame giữ copy đọc được, hero vẫn lớn nhất, nền mountains/sky và phản xạ ăn khớp.
- Before/after cùng 1672×941 DPR1, thêm DPR2, 2559×1276, 390×844 và tablet. Ghi URL, DPR, quality tier, renderScale, HDR/transmission/mirror thật.
- Video hoặc frame sequence idle/pointer/intro để phát hiện aliasing, seam, occlusion, shimmer; không kết luận motion tốt chỉ từ ảnh tĩnh.

## Tái lập gói này

Với server đang chạy tại localhost:3000, `node scripts/rescan-playground-crystal.mjs` chụp runtime; `node scripts/package-crystal-rescan.mjs` tạo crop/annotation/manifest từ capture và file references local. Helper không sửa source scene. Script capture đòi các file Downloads được nêu trong code; đây là công cụ audit local, không dependency của app.

Trong turn này chỉ thêm/cập nhật audit helpers, tài liệu và evidence; không chạy full app check cho thay đổi tài liệu. Đã qua `node --check` cho hai helper và ESLint hai file (exit0); validator xác nhận 45 ảnh đúng SHA-256, 20 source fingerprints không đổi sau đóng gói, toàn bộ Markdown file/image links tồn tại, original copy khớp nguyên byte. Implementation tương lai phải chạy app check riêng.
