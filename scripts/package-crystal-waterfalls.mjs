import sharp from 'sharp';

const root = 'docs/research/leoparpeix/implementation/playground-crystal/waterfalls-2026-10-09';
for (const name of ['desktop', 'backdrop']) {
  const panels = await Promise.all(['before', 'after'].map((phase) => sharp(`${root}/${phase}/${name}.png`).resize(1003, 565).png().toBuffer()));
  const title = Buffer.from('<svg width="2006" height="38"><rect width="100%" height="100%" fill="#f6f2eb"/><g font-family="Arial" font-size="16" fill="#15261f"><text x="16" y="25">BEFORE</text><text x="1019" y="25">STREAMS + WATERFALLS</text></g></svg>');
  await sharp({ create: { width: 2006, height: 603, channels: 3, background: '#f6f2eb' } }).composite([
    { input: title, top: 0, left: 0 }, { input: panels[0], top: 38, left: 0 }, { input: panels[1], top: 38, left: 1003 },
  ]).png().toFile(`${root}/comparison-${name}.png`);
}
