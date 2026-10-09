import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const phase = process.argv[2] ?? 'before';
assert(/^[a-z0-9-]+$/.test(phase));
const out = `docs/research/leoparpeix/implementation/playground-crystal/proportions-2026-10-09/${phase}`;
await mkdir(out, { recursive: true });
const cache = join(process.env.LOCALAPPDATA, 'ms-playwright');
const executablePath = readdirSync(cache).filter((x) => /^chromium-\d+$/.test(x)).sort().reverse().map((x) => join(cache, x, 'chrome-win64', 'chrome.exe')).find(existsSync);
const browser = await chromium.launch({ executablePath, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const report = { shots: [], errors: [] };
try {
  for (const [name, width, height] of [['desktop', 1672, 941], ...(phase === 'after' ? [['mobile', 390, 844]] : [])]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('pageerror', (e) => report.errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
    await page.goto('http://localhost:3000/playground?skipLoader&debug=probe');
    await page.waitForFunction(() => window.__crystal?.envTarget, undefined, { timeout: 120000 });
    await page.evaluate(() => { const e = window.__crystal, update = e.update; e.update = function (...args) { window.__proportionCamera = args[2]; return update.apply(this, args); }; });
    await page.waitForFunction(() => window.__proportionCamera);
    await page.mouse.move(width / 2, height / 2);
    await page.waitForTimeout(5000);
    for (const route of ['playground', 'home', 'about']) {
      if (route !== 'playground') {
        await page.getByRole('link', { name: route === 'home' ? 'Work' : 'About', exact: true }).click();
        await page.waitForURL((url) => url.pathname === (route === 'home' ? '/' : '/about'));
        await page.mouse.move(width / 2, height / 2);
        await page.waitForTimeout(4500);
      }
      const data = await page.evaluate((route) => {
        const c = window.__proportionCamera;
        const root = c.parent.parent.parent;
        root.updateMatrixWorld(true);
        const bounds = (points) => {
          const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
          const screenMin = [Infinity, Infinity], screenMax = [-Infinity, -Infinity];
          for (const p of points) {
            const arr = p.toArray();
            for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], arr[a]); max[a] = Math.max(max[a], arr[a]); }
            const q = p.clone().project(c);
            const xy = [(q.x + 1) * innerWidth / 2, (1 - q.y) * innerHeight / 2];
            for (let a = 0; a < 2; a++) { screenMin[a] = Math.min(screenMin[a], xy[a]); screenMax[a] = Math.max(screenMax[a], xy[a]); }
          }
          return { vertices: points.length, min, max, size: max.map((v, i) => v - min[i]), screenMin, screenMax, screenSize: screenMax.map((v, i) => v - screenMin[i]) };
        };
        const meshPoints = (m, ids) => {
          const attr = m.geometry.attributes.position;
          return ids.map((i) => c.position.clone().fromBufferAttribute(attr, i).applyMatrix4(m.matrixWorld));
        };
        let parts;
        if (route === 'playground') {
          const f = window.__crystal.flower;
          parts = [];
          f.traverse((m) => {
            if (!m.isMesh || m.geometry.type === 'PlaneGeometry') return;
            const ids = m.geometry.index ? [...new Set(m.geometry.index.array)] : Array.from({ length: m.geometry.attributes.position.count }, (_, i) => i);
            const petal = f.petals.findIndex((p) => p.mesh === m);
            parts.push({ name: petal >= 0 ? `petal-${petal}` : (m.name || m.geometry.type), ...bounds(meshPoints(m, ids)) });
          });
          return { route, parts, flower: bounds(parts.length ? (() => { const ps = []; f.traverse((m) => { if (m.isMesh && m.geometry.type !== 'PlaneGeometry') ps.push(...meshPoints(m, Array.from({ length: m.geometry.attributes.position.count }, (_, i) => i))); }); return ps; })() : []), camera: { fov: c.fov, zoom: c.zoom, position: c.getWorldPosition(c.position.clone()).toArray() } };
        }
        const mesh = root.children.find((o) => o.visible && o.getObjectByName('TexFleur'))?.getObjectByName('TexFleur');
        const g = mesh.geometry, attr = g.attributes.position, ix = g.index;
        const parents = Array.from({ length: attr.count }, (_, i) => i);
        const find = (a) => { while (parents[a] !== a) { parents[a] = parents[parents[a]]; a = parents[a]; } return a; };
        const used = new Set();
        for (let i = 0; i < ix.count; i += 3) {
          const a = ix.getX(i), b = ix.getX(i + 1), d = ix.getX(i + 2);
          const r = find(a); parents[find(b)] = r; parents[find(d)] = r;
          used.add(a); used.add(b); used.add(d);
        }
        const groups = new Map();
        for (const i of used) { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); }
        parts = [...groups.values()].map((ids, i) => ({ name: `component-${i}`, ...bounds(meshPoints(mesh, ids)) }));
        return { route, parts, flower: bounds(meshPoints(mesh, [...used])), camera: { fov: c.fov, zoom: c.zoom, position: c.getWorldPosition(c.position.clone()).toArray() } };
      }, route);
      report.shots.push({ name, width, height, ...data });
      await page.screenshot({ path: `${out}/${name}-${route}.png` });
    }
    await page.close();
  }
  assert.equal(report.errors.length, 0);
} finally {
  await writeFile(`${out}/runtime.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
