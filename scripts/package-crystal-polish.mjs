import sharp from 'sharp';

const root = 'docs/research/leoparpeix/implementation/playground-crystal/polish-2026-10-08';
for (const [name, filename, width, height] of [
  ['comparison-desktop', '02-desktop-high.png', 1003, 565],
  ['comparison-hero', 'crop-hero.png', 500, 790],
  ['comparison-stone', 'crop-column.png', 355, 610],
]) {
  const images = await Promise.all(['before', 'after'].map((phase) => sharp(`${root}/${phase}/${filename}`).resize(width, height).png().toBuffer()));
  const labels = Buffer.from(`<svg width="${width * 2}" height="38"><rect width="100%" height="100%" fill="#f6f2eb"/><g font-family="Arial" font-size="16" fill="#15261f"><text x="16" y="25">BEFORE</text><text x="${width + 16}" y="25">AFTER</text></g></svg>`);
  await sharp({ create: { width: width * 2, height: height + 38, channels: 3, background: '#f6f2eb' } }).composite([
    { input: labels, top: 0, left: 0 },
    { input: images[0], top: 38, left: 0 },
    { input: images[1], top: 38, left: width },
  ]).png().toFile(`${root}/${name}.png`);
}
