import sharp from 'sharp';

const root = 'docs/research/leoparpeix/implementation/playground-crystal/palace-2026-10-08';
const baseline = `${root}/../polish-2026-10-08/after/02-desktop-high.png`;
for (const [name, left, right, labels] of [
  ['comparison-palace', baseline, `${root}/after/02-desktop-high.png`, ['BEFORE', 'PALACE + DEPTH OF FIELD']],
  ['comparison-dof', `${root}/after/09-dof-off.png`, `${root}/after/08-dof-on.png`, ['DEPTH OF FIELD OFF', 'DEPTH OF FIELD ON']],
]) {
  const images = await Promise.all([left, right].map((file) => sharp(file).resize(1003, 565).png().toBuffer()));
  const title = Buffer.from(`<svg width="2006" height="38"><rect width="100%" height="100%" fill="#f6f2eb"/><g font-family="Arial" font-size="16" fill="#15261f"><text x="16" y="25">${labels[0]}</text><text x="1019" y="25">${labels[1]}</text></g></svg>`);
  await sharp({ create: { width: 2006, height: 603, channels: 3, background: '#f6f2eb' } }).composite([
    { input: title, top: 0, left: 0 }, { input: images[0], top: 38, left: 0 }, { input: images[1], top: 38, left: 1003 },
  ]).png().toFile(`${root}/${name}.png`);
}
