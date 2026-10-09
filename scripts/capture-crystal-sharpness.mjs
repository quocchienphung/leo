import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const phase = process.argv[2] ?? 'after';
assert(/^[a-z0-9-]+$/.test(phase));
const root = 'docs/research/leoparpeix/implementation/playground-crystal/sharpness-2026-10-08';
const out = `${root}/${phase}`;
await mkdir(out, { recursive: true });
const cache = join(process.env.LOCALAPPDATA, 'ms-playwright');
const executablePath = readdirSync(cache).filter((x) => /^chromium-\d+$/.test(x)).sort().reverse().map((x) => join(cache, x, 'chrome-win64', 'chrome.exe')).find(existsSync);
const browser = await chromium.launch({ executablePath, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const report = { shots: [], errors: [], warnings: [] };
try {
  const cases = phase === 'jewel' ? [['desktop', 1672, 941, 1, '&crystalEnv=jewel']] : [
    ['desktop', 1672, 941, 1, ''], ['mobile', 390, 844, 2, ''], ['wide', 2559, 1276, 1, ''],
  ];
  for (const [name, width, height, dpr, query] of cases) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
    page.on('pageerror', (e) => report.errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); if (m.type() === 'warning') report.warnings.push(m.text()); });
    await page.goto(`http://localhost:3000/playground?skipLoader&debug=probe${query}`);
    await page.waitForFunction(() => window.__crystal?.envTarget, undefined, { timeout: 120000 });
    await page.waitForTimeout(6000);
    // Identical botanical pose in before/after; the actual camera continues its normal lifecycle.
    await page.evaluate(() => {
      const e = window.__crystal, flower = e.flower.update.bind(e.flower), garden = e.garden.update.bind(e.garden);
      e.flower.update = (_, camera) => flower(3000, camera);
      e.garden.update = () => garden(3000);
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/${name}.png` });
    const state = await page.evaluate(() => {
      const e = window.__crystal, materials = new Set(), cuts = [];
      e.stage.traverse((o) => {
        const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of ms) if (!materials.has(m)) {
          materials.add(m);
          if (m.userData.traced) cuts.push({ planes: m.userData.uniforms.uPlaneCount.value, edge: Boolean(o.geometry.getAttribute('cutEdgeDistance')), topology: o.geometry.userData.facetEdges, roughness: m.roughness });
        }
      });
      return { hdr: [e.post.target.width, e.post.target.height], viewport: [innerWidth, innerHeight, devicePixelRatio], renderScale: e.renderScale, transmissionScale: window.__sharpRenderer?.transmissionResolutionScale, overflow: document.documentElement.scrollWidth > innerWidth, gardenCount: e.garden.planted.length, cuts, dof: { aperture: e.post.dof.gather.uniforms.uAperture.value, far: e.post.dof.gather.uniforms.uFarBlurScale.value, near: e.post.dof.gather.uniforms.uNearBlurScale?.value }, aberration: e.post.finalMat.uniforms.uAberration.value };
    });
    report.shots.push({ name, ...state });
    assert(!state.overflow);
    assert(state.cuts.every((c) => c.planes <= 256));
    if (phase === 'after') {
      assert(state.cuts.every((c) => c.edge && c.topology.borders > 0), 'All traced models need genuine facet edges');
      assert(state.cuts.some((c) => c.topology.hiddenDiagonals > 0), 'Coplanar triangulation edges must be hidden');
      assert.equal(state.aberration, 0);
    }
    if (name === 'desktop') {
      for (const [label, rect] of Object.entries({ rose: { left: 290, top: 285, width: 190, height: 155 }, lily: { left: 1120, top: 315, width: 235, height: 225 }, leaves: { left: 680, top: 580, width: 320, height: 125 }, base: { left: 660, top: 730, width: 310, height: 165 }, column: { left: 205, top: 180, width: 90, height: 390 } })) {
        await sharp(`${out}/${name}.png`).extract(rect).png().toFile(`${out}/detail-${label}.png`);
      }
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.waitForTimeout(1000);
      const sizes = await page.evaluate(() => { const p = window.__crystal.post; return [[p.target.width, p.target.height], [p.dof.output.width, p.dof.output.height], [p.target.depthTexture.image.width, p.target.depthTexture.image.height]]; });
      assert.deepEqual(sizes[0], sizes[1]); assert.deepEqual(sizes[0], sizes[2]);
      report.resize = sizes;
    }
    await page.close();
    console.log(`${phase}: ${name}`);
  }
  assert.equal(report.errors.length, 0);
} finally {
  report.warnings = [...new Set(report.warnings)];
  await writeFile(`${out}/runtime.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
