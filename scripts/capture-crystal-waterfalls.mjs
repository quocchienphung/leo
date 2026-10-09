import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const phase = process.argv[2] ?? 'after';
assert(/^[a-z0-9-]+$/.test(phase));
const out = `docs/research/leoparpeix/implementation/playground-crystal/waterfalls-2026-10-09/${phase}`;
await mkdir(out, { recursive: true });
const cache = join(process.env.LOCALAPPDATA, 'ms-playwright');
const executablePath = readdirSync(cache).filter((x) => /^chromium-\d+$/.test(x)).sort().reverse().map((x) => join(cache, x, 'chrome-win64', 'chrome.exe')).find(existsSync);
const browser = await chromium.launch({ executablePath, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const report = { shots: [], errors: [], warnings: [] };
try {
  for (const [name, width, height, dpr] of [['desktop', 1672, 941, 1], ...(phase === 'before' ? [] : [['wide', 2559, 1276, 1], ['mobile', 390, 844, 2]])]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
    page.on('pageerror', (e) => report.errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); if (m.type() === 'warning') report.warnings.push(m.text()); });
    await page.goto('http://localhost:3000/playground?skipLoader&debug=probe');
    await page.waitForFunction(() => window.__crystal?.envTarget, undefined, { timeout: 120000 });
    if (phase !== 'before') {
      await page.evaluate(() => { const e = window.__crystal, update = e.update; e.update = function (...args) { window.__waterRenderer = args[0]; window.__waterCamera = args[2]; return update.apply(this, args); }; });
      await page.waitForFunction(() => window.__waterRenderer);
    }
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${out}/${name}.png` });
    report.shots.push(await page.evaluate((name) => { const e = window.__crystal; return { name, hdr: [e.post.target.width, e.post.target.height], overflow: document.documentElement.scrollWidth > innerWidth, bakeSize: [e.backdrop.target.width, e.backdrop.target.height], waterSize: e.backdrop.waterTarget ? [e.backdrop.waterTarget.width, e.backdrop.waterTarget.height] : null }; }, name));
    if (phase !== 'before') assert.deepEqual(report.shots.at(-1).waterSize, report.shots.at(-1).bakeSize);
    if (name === 'desktop') {
      await page.evaluate(() => { const e = window.__crystal; e.stage.visible = false; e.post.dof.enabled = false; });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/backdrop.png` });
      if (phase !== 'before') {
        await page.evaluate(() => { const e = window.__crystal; window.__restoreWater = e.backdrop.update; e.backdrop.update = () => {}; e.backdrop.material.uniforms.uWaterTime.value = 0; });
        await page.waitForTimeout(100);
        await page.screenshot({ path: `${out}/water-time-0.png` });
        await page.evaluate(() => { window.__crystal.backdrop.material.uniforms.uWaterTime.value = 0.8; });
        await page.waitForTimeout(100);
        await page.screenshot({ path: `${out}/water-time-1.png` });
        const images = await Promise.all(['water-time-0', 'water-time-1'].map((f) => sharp(`${out}/${f}.png`).removeAlpha().raw().toBuffer()));
        report.screenshotChangedChannels = images[0].reduce((n, v, i) => n + (Math.abs(v - images[1][i]) > 2 ? 1 : 0), 0);
        // Independent GPU readback excludes film grain, moving flowers and the post pipeline.
        report.waterMotion = await page.evaluate(() => {
          const e = window.__crystal, r = window.__waterRenderer, camera = window.__waterCamera;
          const width = 1672, height = 941;
          const target = new e.post.target.constructor(width, height, { type: 1009, depthBuffer: false });
          const previous = r.getRenderTarget();
          const frames = [0, 0.8].map((time) => {
            e.backdrop.material.uniforms.uWaterTime.value = time;
            r.setRenderTarget(target); r.clear(); r.render(e.backdrop, camera);
            const pixels = new Uint8Array(width * height * 4);
            r.readRenderTargetPixels(target, 0, 0, width, height, pixels);
            return pixels;
          });
          r.setRenderTarget(previous); target.dispose();
          let changed = 0, minY = height, maxY = 0;
          for (let p = 0; p < width * height; p++) {
            const i = p * 4;
            if (Math.max(...[0, 1, 2].map((c) => Math.abs(frames[0][i + c] - frames[1][i + c]))) > 2) {
              changed++; const y = height - 1 - Math.floor(p / width); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            }
          }
          return { changed, minY, maxY, pixels: width * height };
        });
        assert(report.waterMotion.changed > 100, 'Water must visibly move independently of the frozen mountain bake');
        assert(report.waterMotion.changed < report.waterMotion.pixels * 0.1, 'Animation must remain local to the watercourses');
        await page.evaluate(() => { const e = window.__crystal; e.backdrop.update = window.__restoreWater; e.stage.visible = true; e.post.dof.enabled = true; });
        await page.setViewportSize({ width: 1024, height: 768 });
        await page.waitForTimeout(2000);
        report.resize = await page.evaluate(() => { const b = window.__crystal.backdrop; return { sky: [b.target.width, b.target.height], water: [b.waterTarget.width, b.waterTarget.height] }; });
        assert.deepEqual(report.resize.sky, report.resize.water);
        if (phase === 'after') {
          await page.evaluate(() => { window.__crystal.backdrop.waterTarget.addEventListener('dispose', () => { window.__waterDisposed = true; }); });
          await page.getByRole('link', { name: 'About', exact: true }).click();
          await page.waitForURL((url) => url.pathname === '/about');
          await page.waitForTimeout(3000);
          report.waterDisposedOnNavigation = await page.evaluate(() => Boolean(window.__waterDisposed));
          // The shared manager may cache route environments rather than disposing on navigation.
          await page.getByRole('link', { name: 'Playground', exact: true }).click();
          await page.waitForURL((url) => url.pathname === '/playground');
          await page.waitForTimeout(5000);
          await page.screenshot({ path: `${out}/return-playground.png` });
        }
      }
    }
    await page.close();
    console.log(`${phase}: ${name}`);
  }
  assert.equal(report.errors.length, 0);
  assert(report.shots.every((s) => !s.overflow));
} finally {
  report.warnings = [...new Set(report.warnings)];
  await writeFile(`${out}/runtime.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
