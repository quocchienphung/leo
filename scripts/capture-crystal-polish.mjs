import { existsSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const phase = process.argv[2] ?? 'after';
if (!/^[a-z0-9-]+$/.test(phase)) throw new Error('Invalid phase');
const quick = process.argv.includes('--quick');
const out = `docs/research/leoparpeix/implementation/playground-crystal/polish-2026-10-08/${phase}`;
await mkdir(out, { recursive: true });
const root = join(process.env.LOCALAPPDATA, 'ms-playwright');
const executablePath = readdirSync(root).filter((x) => /^chromium-\d+$/.test(x)).sort().reverse().map((x) => join(root, x, 'chrome-win64', 'chrome.exe')).find(existsSync);
const browser = await chromium.launch({ executablePath, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const report = { phase, shots: [], errors: [], warnings: [], navigation: [] };
const cases = [
  { name: '01-desktop-default', width: 1672, height: 941, dpr: 1, query: '' },
  { name: '02-desktop-high', width: 1672, height: 941, dpr: 1, query: '&quality=high' },
  ...(!quick ? [
    { name: '03-desktop-bloom-off', width: 1672, height: 941, dpr: 1, query: '&quality=high', bloomOff: true },
    { name: '04-wide', width: 2559, height: 1276, dpr: 1, query: '' },
    { name: '05-mobile', width: 390, height: 844, dpr: 2, query: '' },
    { name: '06-tablet', width: 1024, height: 768, dpr: 1, query: '' },
  ] : []),
];
try {
  for (const c of cases) {
    const page = await browser.newPage({ viewport: { width: c.width, height: c.height }, deviceScaleFactor: c.dpr });
    page.on('pageerror', (e) => report.errors.push({ case: c.name, message: e.message }));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push({ case: c.name, message: m.text() }); if (m.type() === 'warning') report.warnings.push(m.text().slice(0, 1000)); });
    await page.goto(`http://localhost:3000/playground?skipLoader&debug=probe${c.query}`);
    await page.waitForFunction(() => window.__crystal?.envTarget, undefined, { timeout: 120000 });
    if (c.bloomOff) await page.evaluate(() => { const u = window.__crystal.post.finalMat.uniforms; u.uBloom.value.set(0, 0, 0); u.uGlare.value.z = 0; if (u.uGlints) u.uGlints.value = 0; });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${out}/${c.name}.png` });
    const state = await page.evaluate(() => { const e = window.__crystal; return { renderScale: e.renderScale, hdr: [e.post.target.width, e.post.target.height], mirror: [e.floor.target.width, e.floor.target.height], garden: e.garden.planted.map((p) => p.figurine.name), props: e.props.children.map((o) => o.type), stone: e.pavilion.children.filter((o) => o.material?.userData.stone).map((o) => o.material.name) }; });
    report.shots.push({ ...c, ...state });
    if (c.name === '02-desktop-high') {
      for (const [name, clip] of Object.entries({ hero: { x: 570, y: 115, width: 500, height: 790 }, column: { x: 230, y: 80, width: 355, height: 610 }, floor: { x: 0, y: 720, width: 690, height: 220 } })) await page.screenshot({ path: `${out}/crop-${name}.png`, clip });
      if (!quick) {
        await page.mouse.move(1020, 380, { steps: 18 });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `${out}/07-pointer.png` });
        for (const route of ['/', '/about', '/playground?skipLoader&debug=probe']) {
          await page.goto(`http://localhost:3000${route}`);
          await page.waitForTimeout(2000);
          report.navigation.push({ route, status: await page.title(), canvas: await page.locator('canvas').count() });
        }
      }
    }
    await page.close();
    console.log(`${phase}/${c.name}`);
  }
} finally {
  report.warnings = [...new Set(report.warnings)];
  await writeFile(`${out}/runtime.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
