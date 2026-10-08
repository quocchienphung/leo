// Packages unretouched screenshots, native pixel crops, reference copies and an image manifest.
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, relative, resolve } from 'node:path';
import sharp from 'sharp';

const out = 'docs/research/leoparpeix/implementation/playground-crystal/audit-2026-10-08';
const old = 'docs/research/leoparpeix/implementation/playground-crystal/audit-2026-10-07';
await mkdir(`${out}/evidence`, { recursive: true });
const copiedReferences = [
  ['C:/Users/quocc/Downloads/ChatGPT Image Oct 7, 2026, 09_49_26 PM-1.png', '01-user-pavilion-design-board.png'],
  ['C:/Users/quocc/Downloads/ChatGPT Image Oct 7, 2026, 09_49_50 PM.png', '02-user-alternative-flower-board.png'],
  ['docs/design-references/playground-crystal-reference.png', '03-previous-project-reference.png'],
];
for (const [src, dest] of copiedReferences) await copyFile(src, `${out}/references/${dest}`);
for (const f of await readdir(`${old}/references`)) if (/\.(jpg|png)$/.test(f)) await copyFile(`${old}/references/${f}`, `${out}/references/${f}`);
await copyFile(`${old}/swarovski-references.json`, `${out}/references/swarovski-references.json`);

const cropDefs = [
  ['14-current-hero-native', 'evidence/02-high-quality.png', { left: 570, top: 115, width: 500, height: 790 }],
  ['15-original-hero-native', 'references/00-user-original-target.png', { left: 570, top: 115, width: 500, height: 790 }],
  ['16-real-white-shrub-runtime-crop', 'evidence/09-current-wide-adaptive.png', { left: 0, top: 1056, width: 391, height: 220 }],
  ['17-real-olive-and-crystal-runtime-crop', 'evidence/09-current-wide-adaptive.png', { left: 0, top: 350, width: 725, height: 740 }],
  ['18-crystal-figurine-green-parts-keep', 'evidence/02-high-quality.png', { left: 1430, top: 425, width: 210, height: 350 }],
];
for (const [name, src, rect] of cropDefs) await sharp(`${out}/${src}`).extract(rect).png().toFile(`${out}/evidence/${name}.png`);
const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const svg = (width, height, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`);
const text = (x, y, s, size = 18, color = '#fff') => `<text x="${x}" y="${y}" fill="${color}" font-family="Arial" font-size="${size}">${esc(s)}</text>`;
async function sheet(name, panels, rect, cols, footer) {
  const gap = 12;
  const labelH = 42;
  const width = cols * rect.width + (cols + 1) * gap;
  const rows = Math.ceil(panels.length / cols);
  const height = rows * (rect.height + labelH + gap) + gap + 44;
  const images = [];
  let labels = '';
  for (let i = 0; i < panels.length; i++) {
    const [file, label] = panels[i];
    const left = gap + (i % cols) * (rect.width + gap);
    const top = gap + Math.floor(i / cols) * (rect.height + labelH + gap);
    const input = await sharp(`${out}/${file}`).extract(rect).png().toBuffer();
    images.push({ input, left, top: top + labelH });
    labels += text(left + 4, top + 26, label);
  }
  labels += text(gap, height - 17, footer, 15);
  images.push({ input: svg(width, height, labels), left: 0, top: 0 });
  await sharp({ create: { width, height, channels: 4, background: '#151b20' } }).composite(images).png().toFile(`${out}/evidence/${name}.png`);
}
await sheet('19-original-vs-current-hero', [
  ['references/00-user-original-target.png', 'ORIGINAL - desired material / light'],
  ['evidence/02-high-quality.png', 'CURRENT - high quality DPR 1'],
], { left: 570, top: 115, width: 500, height: 790 }, 2, 'Native pixel crops, same rectangle. No sharpening, color edits or resizing.');
await sheet('20-petal-isolation-contact-sheet', [
  ['evidence/02-high-quality.png', 'Baseline'],
  ['evidence/11-petal-glow-only-off.png', 'Only petal glow OFF'],
  ['evidence/12-petal-glitter-only-off.png', 'Only petal glitter OFF'],
  ['evidence/13-petal-milk-rim-only-off.png', 'Only petal milk + rim OFF'],
  ['evidence/05-petal-roughness-008.png', 'Only roughness 0.24 -> 0.08'],
  ['evidence/03-post-optical-effects-off.png', 'Post optical effects OFF'],
], { left: 590, top: 140, width: 460, height: 450 }, 3, 'Native pixel crops. Diagnostics are not final materials. Ambient noise/time is not perfectly deterministic.');
await sheet('21-stem-glow-native-comparison', [
  ['references/00-user-original-target.png', 'ORIGINAL'],
  ['evidence/02-high-quality.png', 'CURRENT'],
  ['evidence/06-stem-glow-off.png', 'Only stem glow OFF'],
], { left: 700, top: 550, width: 300, height: 330 }, 3, 'Native crops. Removing glow alone does not redesign the tube, leaves or base.');
const marks = [
  [2, 310, 95, 345, 'REMOVE olive', '#ef4444'],
  [55, 466, 65, 190, 'REMOVE cypress', '#ef4444'],
  [345, 458, 44, 180, 'REMOVE cypress', '#ef4444'],
  [1120, 452, 130, 205, 'REMOVE cypresses', '#ef4444'],
  [1575, 448, 94, 207, 'REMOVE olives', '#ef4444'],
  [2, 835, 175, 104, 'REMOVE flowers', '#ef4444'],
  [18, 767, 185, 90, 'REMOVE shrub', '#ef4444'],
  [535, 719, 130, 80, 'REMOVE shrub', '#ef4444'],
  [1070, 715, 130, 83, 'REMOVE shrub', '#ef4444'],
  [1450, 862, 218, 76, 'REMOVE flowers', '#ef4444'],
  [1440, 664, 85, 42, 'REMOVE understory', '#ef4444'],
  [3, 657, 55, 45, 'REMOVE understory', '#ef4444'],
  [1448, 434, 148, 336, 'KEEP entire LotV', '#38bdf8'],
  [70, 423, 112, 160, 'KEEP blue crystal', '#38bdf8'],
  [326, 328, 151, 244, 'KEEP rose + leaves', '#38bdf8'],
];
let body = '<rect x="0" y="0" width="1672" height="75" fill="#101820" fill-opacity="0.92"/>';
body += text(20, 29, 'REMOVAL MAP - red: natural Props; blue: crystal figurines and their designed parts', 21);
body += text(20, 56, 'Boxes are visual guides, NOT segmentation masks. Do not delete by green color or by rectangular image region.', 17);
for (const [x,y,w,h,label,color] of marks) {
  body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="3"/>`;
  const labelY = Math.max(80, y - 4);
  const labelWidth = Math.min(290, label.length * 9.5 + 10);
  const labelX = Math.min(x, 1672 - labelWidth);
  body += `<rect x="${labelX}" y="${labelY-21}" width="${labelWidth}" height="24" fill="#101820" fill-opacity="0.85"/>`;
  body += text(labelX + 4, labelY - 3, label, 16, color);
}
await sharp(`${out}/evidence/02-high-quality.png`).composite([{ input: svg(1672, 941, body) }]).png().toFile(`${out}/evidence/22-remove-natural-keep-crystal-map.png`);

const all = [];
async function collect(dir, role) {
  for (const f of (await readdir(dir)).sort()) {
    const file = `${dir}/${f}`;
    if (!/\.(png|jpg|jpeg)$/.test(f)) continue;
    const data = await readFile(file);
    const m = await sharp(data).metadata();
    all.push({ path: relative(resolve(out), resolve(file)).replaceAll('\\', '/'), name: basename(file), role, width: m.width, height: m.height, sha256: createHash('sha256').update(data).digest('hex') });
  }
}
await collect(`${out}/references`, 'reference');
await collect(`${out}/evidence`, 'current audit or explicitly labeled derived diagnostic');
for (const [src, dest, role] of [
  [`${old}/evidence`, `${out}/history/before`, 'historical pre-implementation'],
  [`${old}/evidence/after`, `${out}/history/claude-after`, 'previous Claude implementation capture'],
]) {
  await mkdir(dest, { recursive: true });
  for (const f of await readdir(src)) if (/\.(png|jpg|jpeg)$/.test(f)) await copyFile(`${src}/${f}`, `${dest}/${f}`);
  await collect(dest, role);
}
const sources = [];
async function sourceTree(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await sourceTree(file);
    else if (/\.(ts|tsx)$/.test(entry.name)) sources.push({ path: file, sha256: createHash('sha256').update(await readFile(file)).digest('hex') });
  }
}
await sourceTree('src/components/sites/leoparpeix/webgl/env/crystal');
for (const path of ['crystal.ts', 'crystalTrace.ts', 'backdrop.ts', 'screen.ts'].map((file) => `src/components/sites/leoparpeix/webgl/shaders/${file}`).concat('src/components/sites/leoparpeix/webgl/manager.ts')) {
  sources.push({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
}
await writeFile(`${out}/evidence-manifest.json`, JSON.stringify({ generatedAt: new Date().toISOString(), note: 'Runtime crops 16/17 correspond to the complaint regions; raw chat screenshots 1-3 were not available as local files. Not original user-upload bytes. References 00-02 are exact copies of locally supplied originals.', copiedReferences, crops: cropDefs, images: all, sourceSnapshot: sources }, null, 2));
const notes = {
  '00-user-original-target.png': 'CHUẨN ĐÍCH CHÍNH — ảnh cuối người dùng muốn. Foliage thật trong ảnh không được đưa lại vì yêu cầu mới ưu tiên bỏ cây thật.',
  '01-user-pavilion-design-board.png': 'Moodboard đã xuất hiện trong cuộc trò chuyện, copy nguyên byte. Lấy composition/material; bỏ natural plants, không tự thêm mọi species.',
  '02-user-alternative-flower-board.png': 'Moodboard chi tiết cánh/thân/lá và palette. Không thay thế original cuối hoặc sáu sản phẩm yêu cầu.',
  '03-previous-project-reference.png': 'Original dự án cũ: tham chiếu phụ cho độ trong/độ rõ hero; không phải đích cuối của lần sửa này.',
  'contact-sheet.jpg': 'Tổng quan sáu ảnh Swarovski. Vẫn mở từng ảnh sản phẩm bên dưới.',
  '01-current-adaptive.png': 'Runtime current, default quality, 1672×941 DPR1. Không phải target.',
  '02-high-quality.png': 'Baseline QA full HDR/transmission/mirror, 1672×941 DPR1; điểm so A/B cùng page.',
  '03-post-optical-effects-off.png': 'Tắt post optical effects + shafts; tone map/material giữ. Petal body vẫn trắng.',
  '04-petal-additions-off.png': 'Uniform milk/rim multiplier/translucency/glitter off theo nhóm. Hard-coded rimLine vẫn còn; không phải final material.',
  '05-petal-roughness-008.png': 'Chỉ petal roughness 0.24→0.08. Không chữa được lớp trắng khi glow vẫn bật.',
  '06-stem-glow-off.png': 'Chỉ additive glow của stem hero off. Giữ các vật liệu khác.',
  '07-crystal-only-preview.png': 'Browser-only natural Props hidden, IBL/shadows regenerated. Các figurine parts vẫn giữ. Chưa sửa source; preview còn cần relight/composition.',
  '08-high-quality-dpr2.png': '1672×941 CSS, DPR2 =3344×1882 pixels. Mở native crop khi so độ nét; không gọi resize image preview là resolution thật.',
  '09-current-wide-adaptive.png': 'Runtime 2559×1276 DPR1, cùng kích thước screenshot người dùng. Capture lại, không phải file upload gốc.',
  '10-current-mobile-adaptive.png': '390×844 CSS, DPR2. Browser emulation, không phải benchmark mobile hardware.',
  '11-petal-glow-only-off.png': 'Isolation quan trọng nhất: chỉ petal glow scale/ambient off. Lớp trắng giảm mạnh. Không copy thành final quá trong.',
  '12-petal-glitter-only-off.png': 'Chỉ uGlitter=0; rimLine hard-coded vẫn còn. Giảm noise, body vẫn trắng.',
  '13-petal-milk-rim-only-off.png': 'Chỉ milk desaturation/rim multiplier off, glow và glitter giữ; khác ít hơn glow-off.',
  '14-current-hero-native.png': 'Crop1:1 current hero, không sharpen/upscale/chỉnh màu.',
  '15-original-hero-native.png': 'Crop1:1 original, cùng rectangle với current. Đánh giá frost/rim/stem/base.',
  '16-real-white-shrub-runtime-crop.png': 'Crop lại vùng hoa trắng thật mà người dùng chỉ ra. Không phải raw attachment2. Xóa factory shrub/blossom, giữ crystal gần đó.',
  '17-real-olive-and-crystal-runtime-crop.png': 'Crop runtime tương ứng phàn nàn bên trái. Xóa olive/cypress, giữ Forget-me-not/Rose/gold wires. Không phải raw attachment3.',
  '18-crystal-figurine-green-parts-keep.png': 'GIỮ tượng Lily of the Valley kể cả green lacquer. Olive/shrub phía sau nó phải xóa theo ownership, không xóa toàn rectangle.',
  '19-original-vs-current-hero.png': 'Bảng so original trái/current phải; native crop không retouch.',
  '20-petal-isolation-contact-sheet.png': '6 native crops A/B: baseline, glow, glitter, milk/rim, roughness, post. Bảng không thay thế ảnh full.',
  '21-stem-glow-native-comparison.png': 'Original/current/stem-glow-off — crop1:1, không color grade.',
  '22-remove-natural-keep-crystal-map.png': 'Đỏ=natural Props cần bỏ; xanh=figurine parts cần giữ. Chú thích vùng, KHÔNG PHẢI segmentation mask.',
};
let md = '# Evidence index — mở ảnh thật trước khi code\n\n';
md += `Có **${all.length} ảnh** trong gói self-contained này. Mỗi mục có link/embedded image; Claude phải dùng image read tool mở file thật, không chỉ đọc alt text. Manifest JSON chứa kích thước/SHA-256 và source fingerprints.\n\n`;
md += 'Ưu tiên: yêu cầu mới bỏ cây thật → original cuối → boards/ảnh Swarovski → runtime diagnostics → lịch sử. Original có foliage không cho phép giữ cây thật. Ba screenshot chat hiện tại không có raw local path; ảnh09/16/17 là capture/crop tái lập và đã ghi nhãn trung thực.\n\n';
for (const [prefix, heading] of [['references/', 'A. Originals, boards và sáu sản phẩm'], ['evidence/', 'B. Runtime hiện tại, A/B và phân tích'], ['history/before/', 'C. Lịch sử TRƯỚC sửa — không phải hiện trạng'], ['history/claude-after/', 'D. Lần capture SAU sửa của Claude — lịch sử, không phải target']]) {
  md += `## ${heading}\n\n`;
  for (const item of all.filter((x) => x.path.startsWith(prefix))) {
    let note = notes[item.name] ?? 'Ảnh sản phẩm Swarovski: chuẩn identity, silhouette, gold/green parts; không phải model3D.';
    if (prefix.startsWith('history/')) note = `${item.role}. Mở để nhận biết tiến bộ; kết luận lỗi cũ có thể đã được sửa. Không copy baseline này làm đích.`;
    md += `### ${item.name}\n\n- [ ] Đã mở [${item.path}](${item.path}) — ${item.width}×${item.height}.\n\n${note}\n\n![${esc(item.name)}](${item.path})\n\n`;
  }
}
await writeFile(`${out}/EVIDENCE_INDEX.md`, md);
console.log(`Packaged ${all.length} images and ${sources.length} source fingerprints.`);
