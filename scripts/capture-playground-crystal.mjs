// After-implementation evidence for the crystal playground (dev server on :3000, development build).
// Writes docs/research/leoparpeix/implementation/playground-crystal/audit-2026-10-08/after/.
// Same browser setup as scripts/rescan-playground-crystal.mjs (Windows, ANGLE D3D11).
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const out = 'docs/research/leoparpeix/implementation/playground-crystal/audit-2026-10-08/after';
await mkdir(`${out}/sequence`, { recursive: true });
const browserRoot = join(process.env.LOCALAPPDATA, 'ms-playwright');
const executablePath = readdirSync(browserRoot).filter((x) => /^chromium-\d+$/.test(x)).sort().reverse()
  .map((x) => join(browserRoot, x, 'chrome-win64', 'chrome.exe')).find(existsSync);
const browser = await chromium.launch({ executablePath, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const report = { shots: [], console: [], inventory: null, navigation: [] };

/** Native 1:1 crops at 1672 × 941 (x, y, w, h). */
const CROPS = {
  hero: [572, 120, 500, 790],
  petals: [760, 160, 320, 260],
  stem: [740, 430, 200, 330],
  rose: [290, 300, 210, 420],
  lily: [1140, 330, 240, 450],
  lotv: [1430, 400, 240, 420],
};

function settings() {
  const e = window.__crystal;
  const r = window.__auditRenderer;
  return {
    renderScale: e.renderScale, pinned: e.pinned, lite: e.lite,
    hdr: [e.post.target.width, e.post.target.height], mirror: [e.floor.target.width, e.floor.target.height],
    transmissionScale: r?.transmissionResolutionScale ?? null,
  };
}

async function open(query, { width = 1672, height = 941, dpr = 1, label }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
  page.on('pageerror', (e) => report.console.push(`${label} pageerror: ${e.message}`));
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) report.console.push(`${label} ${m.type()}: ${m.text().slice(0, 240)}`); });
  await page.goto(`http://localhost:3000/playground?${query}`);
  await page.waitForFunction(() => window.__crystal?.envTarget, undefined, { timeout: 120000 });
  await page.evaluate(() => {
    const env = window.__crystal;
    const update = env.update.bind(env);
    env.update = (r, s, c, t) => { window.__auditRenderer = r; update(r, s, c, t); };
  });
  return page;
}

async function shot(name, query, { width = 1672, height = 941, dpr = 1, prepare, off, crops = false } = {}) {
  const page = await open(query, { width, height, dpr, label: name });
  if (prepare) await page.evaluate(prepare);
  if (off) await page.evaluate(uniformsOff, off);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}/${name}.png` });
  if (crops) {
    for (const [k, [x, y, w, h]] of Object.entries(CROPS)) await page.screenshot({ path: `${out}/${name}-crop-${k}.png`, clip: { x, y, width: w, height: h } });
  }
  report.shots.push({ name, url: `/playground?${query}`, width, height, dpr, ...(await page.evaluate(settings)) });
  await page.close();
}

function uniformsOff(keys) {
  window.__crystal.traverse((o) => {
    const u = o.material?.userData?.uniforms;
    if (!u) return;
    for (const k of keys) if (u[k]) u[k].value = 0;
  });
}

try {
  await shot('01-default', 'skipLoader&debug=probe', { crops: true });
  await shot('02-high', 'skipLoader&quality=high&debug=probe', { crops: true });
  // Only the post pass: bloom and the corner glare off (no drawn beams or streaks exist any more).
  await shot('03-bloom-off', 'skipLoader&quality=high&debug=probe', {
    prepare: () => {
      const u = window.__crystal.post.finalMat.uniforms;
      u.uBloom.value.set(0, 0, 0);
      u.uGlare.value.z = 0;
    },
  });
  await shot('04-petal-glow-off', 'skipLoader&quality=high&debug=probe', { prepare: () => { const f = window.__crystal.flower; f.traverse((o) => { const u = o.material?.userData?.uniforms; if (u?.uGlitter && u.uTransScale) { u.uTransScale.value = 0; u.uTransAmbient.value = 0; } }); } });
  await shot('05-petal-glitter-off', 'skipLoader&quality=high&debug=probe', { off: ['uGlitter'] });
  await shot('06-petal-rim-off', 'skipLoader&quality=high&debug=probe', { off: ['uGlitterRim'] });
  await shot('07-debug-glass', 'skipLoader&quality=high&debug=glass');
  await shot('08-debug-unpatched', 'skipLoader&quality=high&debug=unpatched');
  await shot('09-florere-lineup', 'skipLoader&quality=high&debug=florere', { dpr: 2 });
  await shot('10-high-dpr2', 'skipLoader&quality=high&debug=probe', { dpr: 2 });
  await shot('11-wide-2559', 'skipLoader&debug=probe', { width: 2559, height: 1276 });
  await shot('12-mobile', 'skipLoader&debug=probe', { width: 390, height: 844, dpr: 2 });
  await shot('13-tablet', 'skipLoader&debug=probe', { width: 1024, height: 768 });

  // Scene inventory: what the playground is made of (no natural plants).
  {
    const page = await open('skipLoader&debug=probe', { label: 'inventory' });
    report.inventory = await page.evaluate(() => {
      const kinds = {};
      let meshes = 0;
      let instances = 0;
      window.__crystal.traverse((o) => {
        if (!o.isMesh) return;
        meshes++;
        instances += o.count ?? 1;
        const m = o.material;
        const key = `${m.type}${m.userData?.traced ? ' traced' : ''}${m.map ? ' textured' : ''}${o.isInstancedMesh ? ' instanced' : ''}`;
        kinds[key] = (kinds[key] ?? 0) + 1;
      });
      const top = [];
      window.__crystal.traverse((o) => { if (o.isInstancedMesh) top.push(o.count); });
      return { meshes, instances, kinds, largestInstanceCounts: top.sort((a, b) => b - a).slice(0, 6), garden: window.__crystal.garden.children.filter((c) => c.children.length).length };
    });
    await page.close();
  }

  // Intro (no skipLoader): from navigation through the loader, the reveal and the camera dolly.
  {
    const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
    page.on('pageerror', (e) => report.console.push(`intro pageerror: ${e.message}`));
    const t0 = Date.now();
    await page.goto('http://localhost:3000/playground?debug=probe');
    report.intro = { frames: [] };
    for (let i = 0; i < 28; i++) {
      report.intro.frames.push({ i, ms: Date.now() - t0 });
      await page.screenshot({ path: `${out}/sequence/intro-${String(i).padStart(2, '0')}.png` });
      await page.waitForTimeout(400);
    }
    await page.close();
  }

  // Pointer parallax: the hero at native resolution while the pointer sweeps (shimmer / crawl check).
  {
    const page = await open('skipLoader&quality=high&debug=probe', { label: 'pointer' });
    await page.waitForTimeout(2500);
    for (let i = 0; i < 8; i++) {
      await page.mouse.move(200 + i * 180, 300 + (i % 2) * 300, { steps: 6 });
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${out}/sequence/pointer-${String(i).padStart(2, '0')}.png`, clip: { x: 572, y: 120, width: 500, height: 790 } });
    }
    await page.close();
  }

  // Navigation and resize: home → playground → about → playground, then across the 1025 px breakpoint.
  {
    const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
    page.on('pageerror', (e) => report.console.push(`nav pageerror: ${e.message}`));
    await page.goto('http://localhost:3000/?skipLoader');
    await page.waitForTimeout(6000);
    for (const [i, label] of ['Playground', 'About', 'Playground'].entries()) {
      await page.getByRole('link', { name: label, exact: true }).first().click();
      await page.waitForTimeout(9000);
      await page.screenshot({ path: `${out}/sequence/nav-${i}-${label.toLowerCase()}.png` });
      report.navigation.push({ step: i, label, url: page.url() });
    }
    for (const [i, w] of [1100, 1000, 1400].entries()) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${out}/sequence/resize-${i}-${w}.png` });
    }
    await page.close();
  }

  await writeFile(`${out}/capture.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ shots: report.shots.length, console: report.console.length, inventory: report.inventory }));
} finally {
  await browser.close();
}
