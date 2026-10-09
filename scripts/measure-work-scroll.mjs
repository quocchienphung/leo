import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const out = 'docs/research/leoparpeix/implementation/playground-crystal/scroll-2026-10-09/work-measurement';
await mkdir(out, { recursive: true });
const cache = join(process.env.LOCALAPPDATA, 'ms-playwright');
const executablePath = readdirSync(cache).filter((x) => /^chromium-\d+$/.test(x)).sort().reverse().map((x) => join(cache, x, 'chrome-win64', 'chrome.exe')).find(existsSync);
const browser = await chromium.launch({ executablePath, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const report = { samples: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
  page.on('pageerror', (e) => report.errors.push(e.message));
  await page.goto('http://localhost:3000/playground?skipLoader&debug=probe');
  await page.waitForFunction(() => window.__crystal?.envTarget, undefined, { timeout: 120000 });
  await page.evaluate(() => { const e = window.__crystal, original = e.update; e.update = function (...args) { window.__measureCamera = args[2]; return original.apply(this, args); }; });
  await page.waitForFunction(() => window.__measureCamera);
  await page.getByRole('link', { name: 'Work', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await page.mouse.move(836, 470.5);
  await page.waitForTimeout(4000);
  for (const progress of [0, .1, .24, .4, .5, .7, .9, 0]) {
    const headerHeight = await page.locator('[class*="headerBlock"]').first().evaluate((el) => el.getBoundingClientRect().height);
    const target = Math.round(headerHeight * progress);
    await page.mouse.wheel(0, target - await page.evaluate(() => scrollY));
    await page.waitForTimeout(1800);
    const sample = await page.evaluate(() => {
      const c = window.__measureCamera;
      c.parent.parent.parent.updateMatrixWorld(true);
      const world = c.getWorldPosition(c.position.clone());
      const direction = c.getWorldDirection(c.position.clone());
      const floor = c.parent.parent.parent.getObjectByName('TexFloor');
      const meshBounds = (mesh) => {
        mesh.geometry.computeBoundingBox();
        const box = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
        return { min: box.min.toArray(), max: box.max.toArray() };
      };
      const floorBounds = meshBounds(floor);
      const groundHit = (y) => {
        const ray = c.position.clone().set(0, y, .5).unproject(c).sub(world).normalize();
        const t = (floorBounds.max[1] - world.y) / ray.y;
        return t > 0 ? world.clone().addScaledVector(ray, t).toArray() : null;
      };
      return { scroll: scrollY, height: innerHeight, local: c.position.toArray(), localRotation: c.rotation.toArray().slice(0, 3), world: world.toArray(), forward: direction.toArray(), pitchDegrees: Math.asin(direction.y) * 180 / Math.PI, fov: c.fov, zoom: c.zoom, rig: { position: c.parent.parent.position.toArray(), rotation: c.parent.parent.rotation.toArray().slice(0, 3) }, floorBounds, flowerBounds: meshBounds(c.parent.parent.parent.getObjectByName('TexFleur')), floorCenter: groundHit(0), floorBottom: groundHit(-1) };
    });
    report.samples.push(sample);
    await page.screenshot({ path: `${out}/work-${progress === 0 && report.samples.length > 1 ? 'return' : target}.png` });
  }
  assert.equal(report.errors.length, 0);
} finally {
  await writeFile(`${out}/runtime.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
