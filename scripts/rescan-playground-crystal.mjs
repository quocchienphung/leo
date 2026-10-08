// Read-only source audit. Diagnostic mutations exist only in a disposable browser page.
import { existsSync, readdirSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { chromium } from 'playwright';

const out = 'docs/research/leoparpeix/implementation/playground-crystal/audit-2026-10-08';
await mkdir(`${out}/evidence`, { recursive: true });
await mkdir(`${out}/references`, { recursive: true });
const original = 'C:/Users/quocc/Downloads/ChatGPT Image Oct 7, 2026, 09_49_27 PM-2.png';
await copyFile(original, `${out}/references/00-user-original-target.png`);
const root = join(process.env.LOCALAPPDATA, 'ms-playwright');
const executablePath = readdirSync(root).filter((x) => /^chromium-\d+$/.test(x)).sort().reverse()
  .map((x) => join(root, x, 'chrome-win64', 'chrome.exe')).find(existsSync);
const browser = await chromium.launch({ executablePath, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const report = { date: '2026-10-08', original, originalSha256: createHash('sha256').update(await readFile(original)).digest('hex'), shots: [], errors: [], warnings: [] };

async function open(query, { width = 1672, height = 941, dpr = 1 } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); else if (m.type() === 'warning') report.warnings.push(m.text()); });
  await page.goto(`http://localhost:3000/playground?skipLoader&debug=probe${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__crystal?.envTarget, undefined, { timeout: 90000 });
  return page;
}

async function shot(page, name, explanation) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/evidence/${name}.png` });
  const settings = await page.evaluate(() => {
    const env = window.__crystal;
    return { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, pinned: env.pinned, renderScale: env.renderScale,
      smoothedFrameMs: env.frameMs, hdr: [env.post.target.width, env.post.target.height], mirror: [env.floor.target.width, env.floor.target.height],
      transmissionScale: window.__rescanRenderer?.transmissionResolutionScale ?? (env.pinned ? 1 : (env.lite ? 0.5 : 0.8) * env.renderScale) };
  });
  report.shots.push({ name, explanation, settings });
  console.log(name);
}

try {
  const adaptive = await open('');
  await adaptive.waitForTimeout(8000);
  await shot(adaptive, '01-current-adaptive', 'Default quality, idle after 8 seconds; no pointer input.');
  await adaptive.close();

  const page = await open('&quality=high');
  await page.waitForTimeout(1800);
  const inventory = await page.evaluate(() => {
    const env = window.__crystal;
    const all = new Set();
    env.traverse((o) => { if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) all.add(m); });
    const materials = [...all].map((m) => ({ m, roughness: m.roughness,
      numeric: Object.fromEntries(Object.entries(m.userData.uniforms ?? {}).filter(([, u]) => typeof u.value === 'number').map(([k, u]) => [k, u.value])) }));
    const post = Object.fromEntries(Object.entries(env.post.finalMat.uniforms).filter(([, u]) => typeof u.value === 'number' || u.value?.isVector3).map(([k, u]) => [k, u.value?.clone ? u.value.clone() : u.value]));
    window.__rescanRestore = () => {
      for (const { m, roughness, numeric } of materials) { m.roughness = roughness; for (const [k, v] of Object.entries(numeric)) m.userData.uniforms[k].value = v; }
      for (const [k, v] of Object.entries(post)) { const u = env.post.finalMat.uniforms[k]; if (u.value?.copy) u.value.copy(v); else u.value = v; }
    };
    const update = env.update.bind(env);
    env.update = (r, s, c) => { window.__rescanRenderer = r; update(r, s, c, 12000); env.backdrop.update = () => {}; };
    const branches = env.props.children.map((o, i) => ({ index: i, type: o.type, children: o.children.length,
      material: o.material?.type, color: o.material?.color?.getHexString(), vertexColors: o.material?.vertexColors,
      position: o.position.toArray(), geometry: o.geometry?.type }));
    return { materials: materials.map(({ m, roughness, numeric }) => ({ type: m.type, key: m.customProgramCacheKey(), roughness, transmission: m.transmission, thickness: m.thickness, traced: !!m.userData.traced, numeric })),
      propsBranches: branches, florereNames: env.garden.planted.map((p) => p.figurine.name) };
  });
  report.inventory = inventory;
  await shot(page, '02-high-quality', 'Full HDR/transmission/mirror, frozen environment time 12s; material baseline.');
  await page.evaluate(() => {
    const u = window.__crystal.post.finalMat.uniforms;
    u.uBloom.value.set(0, 0, 0); u.uStreak.value = 0; u.uRayStrength.value = 0; u.uGlare.value.z = 0;
    u.uSharpen.value = 0; u.uAberration.value = 0;
    window.__crystal.shafts.visible = false;
  });
  await shot(page, '03-post-optical-effects-off', 'Only post bloom/streaks/rays/glare/sharpen/aberration and geometric shafts disabled. Tone mapping and material patches retained.');
  await page.evaluate(() => {
    window.__rescanRestore(); window.__crystal.shafts.visible = true;
    window.__crystal.flower.traverse((o) => {
      const m = o.material;
      if (!m || m.customProgramCacheKey() !== 'crystal-petal') return;
      const u = m.userData.uniforms;
      for (const k of ['uMilk', 'uMilkEdge', 'uTransScale', 'uTransAmbient', 'uGlitter']) if (u[k]) u[k].value = 0;
    });
  });
  await shot(page, '04-petal-additions-off', 'Petal-only milk/rim multiplier/translucency/glitter uniform disabled as a group; roughness unchanged. The unconditional glitter rimLine term remains. Diagnostic, not a proposed final material.');
  await page.evaluate(() => {
    window.__rescanRestore();
    window.__crystal.flower.traverse((o) => { if (o.material?.customProgramCacheKey() === 'crystal-petal') o.material.roughness = 0.08; });
  });
  await shot(page, '05-petal-roughness-008', 'Only petal roughness changed from 0.24 to 0.08; patches and all post settings restored.');
  await page.evaluate(() => {
    window.__rescanRestore();
    window.__crystal.flower.traverse((o) => {
      if (o.material?.customProgramCacheKey() !== 'crystal-rod') return;
      const u = o.material.userData.uniforms; u.uTransScale.value = 0; u.uTransAmbient.value = 0;
    });
  });
  await shot(page, '06-stem-glow-off', 'Only central stem additive translucency glow disabled; diameter/roughness unchanged.');
  for (const [name, keys, explanation] of [
    ['11-petal-glow-only-off', ['uTransScale', 'uTransAmbient'], 'Petal-only additive translucency glow disabled; milk/rim/glitter/roughness/post unchanged.'],
    ['12-petal-glitter-only-off', ['uGlitter'], 'Petal-only glitter uniform disabled; unconditional rimLine term remains. Milk/rim multiplier/translucency/roughness/post unchanged.'],
    ['13-petal-milk-rim-only-off', ['uMilk', 'uMilkEdge'], 'Petal-only milk desaturation and rim multiplier disabled together; translucency/glitter/roughness/post unchanged.'],
  ]) {
    await page.evaluate((keys) => {
      window.__rescanRestore();
      window.__crystal.flower.traverse((o) => {
        if (o.material?.customProgramCacheKey() !== 'crystal-petal') return;
        for (const k of keys) o.material.userData.uniforms[k].value = 0;
      });
    }, keys);
    await shot(page, name, explanation);
  }
  const hidden = await page.evaluate(() => {
    window.__rescanRestore();
    const env = window.__crystal;
    const ids = [];
    env.props.children.forEach((o, i) => {
      const soil = o.material?.color?.getHexString() === '4a3a2a';
      const cypress = o.isMesh && o.material?.vertexColors === true;
      if (o.isGroup || soil || cypress) { o.visible = false; ids.push(i); }
    });
    env.envTarget.dispose(); env.envTarget = null; env.shadowsBaked = false;
    return ids;
  });
  report.hiddenNaturalBranches = hidden;
  await shot(page, '07-crystal-only-preview', 'Confirmed natural Props groups + soil + cypress hidden; environment and shadows regenerated. Crystal figurines and their gold/green parts retained. Browser-only preview, not implemented.');
  await page.close();

  const retina = await open('&quality=high', { dpr: 2 });
  await retina.waitForTimeout(1500);
  await shot(retina, '08-high-quality-dpr2', 'Full quality, 1672x941 CSS pixels at DPR 2, unmodified source.');
  await retina.close();
  const wide = await open('', { width: 2559, height: 1276 });
  await wide.waitForTimeout(8000);
  await shot(wide, '09-current-wide-adaptive', 'Matches user screenshot dimensions; default adaptive quality.');
  await wide.close();
  const mobile = await open('', { width: 390, height: 844, dpr: 2 });
  await mobile.waitForTimeout(6000);
  await shot(mobile, '10-current-mobile-adaptive', 'Current portrait mobile viewport, default adaptive quality; emulation only.');
  await mobile.close();
} finally {
  await writeFile(`${out}/runtime-rescan.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
