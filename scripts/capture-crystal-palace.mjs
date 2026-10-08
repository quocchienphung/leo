import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const phase = process.argv[2] ?? 'after';
if (!/^[a-z0-9-]+$/.test(phase)) throw new Error('Invalid phase');
const quick = process.argv.includes('--quick');
const flourish = phase.startsWith('flourish');
const out = `docs/research/leoparpeix/implementation/playground-crystal/${flourish ? 'flourish-2026-10-08' : 'palace-2026-10-08'}/${phase}`;
await mkdir(out, { recursive: true });
const root = join(process.env.LOCALAPPDATA, 'ms-playwright');
const executablePath = readdirSync(root).filter((x) => /^chromium-\d+$/.test(x)).sort().reverse().map((x) => join(root, x, 'chrome-win64', 'chrome.exe')).find(existsSync);
const browser = await chromium.launch({ executablePath, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const report = { shots: [], errors: [], warnings: [], navigation: [], probes: [] };
const cases = [
  { name: '01-desktop', width: 1672, height: 941, dpr: 1, query: '' },
  { name: '02-desktop-high', width: 1672, height: 941, dpr: 1, query: '&quality=high' },
  ...(!quick ? [
    { name: '03-wide', width: 2559, height: 1276, dpr: 1, query: '' },
    { name: '04-mobile', width: 390, height: 844, dpr: 2, query: '' },
    { name: '05-tablet', width: 1024, height: 768, dpr: 1, query: '' },
    { name: '06-intro', width: 1672, height: 941, dpr: 1, query: '&intro', intro: true },
    { name: '07-dof-disabled-query', width: 1672, height: 941, dpr: 1, query: '&dof=off' },
  ] : []),
];
try {
  for (const c of cases) {
    const page = await browser.newPage({ viewport: { width: c.width, height: c.height }, deviceScaleFactor: c.dpr });
    page.on('pageerror', (e) => report.errors.push({ case: c.name, message: e.message }));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push({ case: c.name, message: m.text() }); if (m.type() === 'warning') report.warnings.push(m.text().slice(0, 1000)); });
    await page.goto(`http://localhost:3000/playground?debug=probe${c.intro ? '' : '&skipLoader'}${c.query}`);
    await page.waitForFunction(() => window.__crystal?.envTarget, undefined, { timeout: 120000 });
    await page.waitForTimeout(c.intro ? 10000 : 6000);
    await page.screenshot({ path: `${out}/${c.name}.png` });
    report.shots.push(await page.evaluate((name) => { const e = window.__crystal; return { name, viewport: [innerWidth, innerHeight, devicePixelRatio], renderScale: e.renderScale, hdr: [e.post.target.width, e.post.target.height], dof: { enabled: e.post.dof.enabled, focus: e.post.dof.gather.uniforms.uFocus.value, aperture: e.post.dof.gather.uniforms.uAperture.value, taps: e.post.dof.gather.defines.DOF_TAPS }, gardenCount: e.garden.planted.length, palaceMeshes: e.pavilion.children.filter((o) => o.isMesh).length, overflow: document.documentElement.scrollWidth > innerWidth }; }, c.name));
    if (c.name === '02-desktop-high') {
      // Obtain the actual renderer for an independent 1px depth readback through the GPU.
      await page.evaluate(() => {
        const e = window.__crystal, original = e.update;
        e.update = function (...args) { window.__palaceRenderer = args[0]; return original.apply(this, args); };
      });
      await page.waitForFunction(() => window.__palaceRenderer);
      report.probes = await page.evaluate(() => {
        const e = window.__crystal, dof = e.post.dof, r = window.__palaceRenderer;
        const target = dof.output.clone();
        target.setSize(1, 1);
        target.texture.type = 1009; // THREE.UnsignedByteType, readback independent of float support.
        const mat = new dof.composite.constructor({ vertexShader: dof.composite.vertexShader, fragmentShader: dof.composite.fragmentShader, uniforms: { ...dof.composite.uniforms }, depthWrite: false, depthTest: false });
        mat.fragmentShader = mat.fragmentShader.slice(0, mat.fragmentShader.indexOf('void main()')) + 'uniform vec2 uProbe; void main() { float z = viewDepth(uProbe); gl_FragColor = vec4(clamp(z / 64.0, 0.0, 1.0), cocAt(z) / 28.0 + 0.5, 0.0, 1.0); }';
        mat.uniforms.uProbe = { value: mat.uniforms.uPixel.value.clone() };
        const previous = r.getRenderTarget();
        const results = [];
        for (const [name, x, y] of [['hero', 820, 370], ['petal', 820, 185], ['rearColumn', 540, 300], ['sky', 900, 90], ['nearFloor', 800, 930], ['nearQuartz', 30, 860], ['nearSphere', 235, 930]]) {
          mat.uniforms.uProbe.value.set(x / 1672, 1 - y / 941);
          e.post.pass(r, mat, target);
          const bytes = new Uint8Array(4);
          r.readRenderTargetPixels(target, 0, 0, 1, 1, bytes);
          results.push({ name, x, y, depthApprox: bytes[0] / 255 * 64, cocApprox: (bytes[1] / 255 - 0.5) * 28 });
        }
        r.setRenderTarget(previous);
        mat.dispose(); target.dispose();
        return results;
      });
      assert(Math.abs(report.probes.find((p) => p.name === 'hero').cocApprox) < 0.3, 'Hero must remain in focus');
      assert(report.probes.find((p) => p.name === 'sky').cocApprox > 1, 'Far background must have a positive CoC');
      if (flourish) assert(report.probes.find((p) => p.name === 'sky').cocApprox < 3.5, 'Far background blur must stay restrained');
      assert(report.probes.find((p) => p.name === 'nearFloor').cocApprox < -0.3, 'Near floor must have a negative CoC');
      assert(Math.min(...report.probes.map((p) => p.cocApprox)) < -2, 'Near crystal must show stronger optical blur');
      await page.evaluate(() => {
        const e = window.__crystal;
        window.__palaceRestore = [e.flower.update, e.garden.update, e.backdrop.update, e.floor.update];
        e.flower.update = e.garden.update = e.backdrop.update = () => {};
        const floorUpdate = e.floor.update.bind(e.floor);
        e.floor.update = (r, s, c) => floorUpdate(r, s, c, 3000);
      });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/08-dof-on.png` });
      await page.evaluate(() => { window.__crystal.post.dof.enabled = false; });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/09-dof-off.png` });
      await page.evaluate(() => { const d = window.__crystal.post.dof; d.enabled = true; d.composite.uniforms.uDebug.value = 1; });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/10-focus-zones.png` });
      await page.evaluate(() => {
        const e = window.__crystal;
        e.post.dof.composite.uniforms.uDebug.value = 0;
        [e.flower.update, e.garden.update, e.backdrop.update, e.floor.update] = window.__palaceRestore;
      });
      if (!quick) {
        await page.mouse.move(1020, 380, { steps: 18 });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `${out}/11-pointer.png` });
        for (const [label, route] of [['About', '/about'], ['Playground', '/playground'], ['Work', '/'], ['Playground', '/playground']]) {
          await page.getByRole('link', { name: label, exact: true }).click();
          await page.waitForURL((url) => url.pathname === route);
          await page.waitForTimeout(4000);
          report.navigation.push({ label, route, title: await page.title() });
        }
        await page.setViewportSize({ width: 1024, height: 768 });
        await page.waitForTimeout(1500);
        report.resize = await page.evaluate(() => ({ hdr: [window.__crystal.post.target.width, window.__crystal.post.target.height], dof: [window.__crystal.post.dof.output.width, window.__crystal.post.dof.output.height], depth: [window.__crystal.post.target.depthTexture.image.width, window.__crystal.post.target.depthTexture.image.height] }));
        assert.deepEqual(report.resize.hdr, report.resize.dof);
        assert.deepEqual(report.resize.hdr, report.resize.depth);
        await page.screenshot({ path: `${out}/12-resize.png` });
      }
    }
    assert(!report.shots.at(-1).overflow, `${c.name}: horizontal overflow`);
    if (c.query.includes('dof=off')) assert.equal(report.shots.at(-1).dof.enabled, false);
    await page.close();
    console.log(c.name);
  }
  const patches = { hero: { left: 750, top: 310, width: 140, height: 110 }, background: { left: 450, top: 200, width: 150, height: 350 }, foreground: { left: 0, top: 790, width: 230, height: 140 } };
  report.imageDifferences = {};
  for (const [name, patch] of Object.entries(patches)) {
    const [a, b] = await Promise.all(['08-dof-on', '09-dof-off'].map((file) => sharp(`${out}/${file}.png`).extract(patch).removeAlpha().raw().toBuffer()));
    report.imageDifferences[name] = a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length;
  }
  assert(report.imageDifferences.background > report.imageDifferences.hero, 'Background must change more than the focused face');
  assert.equal(report.errors.length, 0, 'Browser errors found');
} finally {
  report.warnings = [...new Set(report.warnings)];
  await writeFile(`${out}/runtime.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
