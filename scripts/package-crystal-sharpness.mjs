import sharp from 'sharp';

const root = 'docs/research/leoparpeix/implementation/playground-crystal/sharpness-2026-10-08';
for (const [name, file, width, height] of [
  ['comparison', 'desktop', 1003, 565],
  ['comparison-rose', 'detail-rose', 570, 465],
  ['comparison-lily', 'detail-lily', 470, 450],
  ['comparison-leaves', 'detail-leaves', 640, 250],
  ['comparison-base', 'detail-base', 620, 330],
]) {
  const panels = await Promise.all(['before', 'after'].map((phase) => sharp(`${root}/${phase}/${file}.png`).resize(width, height, { kernel: 'nearest' }).png().toBuffer()));
  const title = Buffer.from(`<svg width="${width * 2}" height="38"><rect width="100%" height="100%" fill="#f6f2eb"/><g font-family="Arial" font-size="16" fill="#15261f"><text x="16" y="25">BEFORE</text><text x="${width + 16}" y="25">SHARPER CRYSTAL</text></g></svg>`);
  await sharp({ create: { width: width * 2, height: height + 38, channels: 3, background: '#f6f2eb' } }).composite([
    { input: title, top: 0, left: 0 }, { input: panels[0], top: 38, left: 0 }, { input: panels[1], top: 38, left: width },
  ]).png().toFile(`${root}/${name}.png`);
}
