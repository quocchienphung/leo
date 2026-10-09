import sharp from 'sharp';

const root = 'docs/research/leoparpeix/implementation/playground-crystal/proportions-2026-10-09';
const label = (title, width) => Buffer.from(`<svg width="${width}" height="36"><rect width="100%" height="100%" fill="#f5f2eb"/><text x="16" y="24" font-size="18" font-family="Arial" fill="#17382c">${title}</text></svg>`);

async function compare(file, sources, width, crop) {
  const panels = [];
  let height;
  for (const [path, title] of sources) {
    let source = sharp(`${root}/${path}`);
    if (crop) source = source.extract(crop);
    const rendered = await source.resize({ width }).png().toBuffer({ resolveWithObject: true });
    height = rendered.info.height;
    const left = panels.length / 2 * width;
    panels.push({ input: label(title, width), left, top: 0 });
    panels.push({ input: rendered.data, left, top: 36 });
  }
  await sharp({ create: { width: sources.length * width, height: height + 36, channels: 3, background: '#f5f2eb' } }).composite(panels).png().toFile(`${root}/${file}`);
}

const desktop = [
  ['after/desktop-home.png', 'Work — reference'],
  ['before/desktop-playground.png', 'Playground — before'],
  ['after/desktop-playground.png', 'Playground — after'],
];
await compare('comparison-desktop.png', desktop, 600);
await compare('comparison-subject.png', desktop, 600, { left: 535, top: 80, width: 600, height: 861 });
await compare('comparison-mobile.png', [
  ['after/mobile-home.png', 'Work — mobile'],
  ['after/mobile-playground.png', 'Playground — mobile'],
], 390);
