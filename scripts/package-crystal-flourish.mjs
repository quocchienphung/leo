import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const root = 'docs/research/leoparpeix/implementation/playground-crystal/flourish-2026-10-08';
// Read the prior render from history; do not restore research files removed by the user.
const baseline = execFileSync('git', ['show', '618e5aa:docs/research/leoparpeix/implementation/playground-crystal/palace-2026-10-08/after/02-desktop-high.png'], { maxBuffer: 20 * 1024 * 1024 });
const current = `${root}/flourish-after/02-desktop-high.png`;

async function comparison(name, inputs, width, height, labels) {
  const images = await Promise.all(inputs.map((input) => input.png().toBuffer()));
  const title = Buffer.from(`<svg width="${width * 2}" height="38"><rect width="100%" height="100%" fill="#f6f2eb"/><g font-family="Arial" font-size="16" fill="#15261f"><text x="16" y="25">${labels[0]}</text><text x="${width + 16}" y="25">${labels[1]}</text></g></svg>`);
  await sharp({ create: { width: width * 2, height: height + 38, channels: 3, background: '#f6f2eb' } }).composite([
    { input: title, top: 0, left: 0 },
    { input: images[0], top: 38, left: 0 },
    { input: images[1], top: 38, left: width },
  ]).png().toFile(`${root}/${name}.png`);
}

await comparison('comparison-garden', [sharp(baseline).resize(1003, 565), sharp(current).resize(1003, 565)], 1003, 565, ['BEFORE', 'FULLER CRYSTAL GARDEN']);
for (const [name, region] of Object.entries({ left: { left: 0, top: 160, width: 580, height: 730 }, right: { left: 1070, top: 160, width: 602, height: 730 } })) {
  await comparison(`comparison-${name}`, [sharp(baseline).extract(region), sharp(current).extract(region)], region.width, region.height, ['BEFORE', 'AFTER']);
}
