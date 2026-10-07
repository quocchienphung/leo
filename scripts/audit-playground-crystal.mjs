import { existsSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const out = 'docs/research/leoparpeix/implementation/playground-crystal/audit-2026-10-07';
await mkdir(`${out}/evidence`, { recursive: true });
const browserRoot = join(process.env.LOCALAPPDATA, 'ms-playwright');
const executablePath = readdirSync(browserRoot).filter((x) => /^chromium-\d+$/.test(x)).sort().reverse()
  .map((x) => join(browserRoot, x, 'chrome-win64', 'chrome.exe')).find(existsSync);
const browser = await chromium.launch({ executablePath, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, deviceScaleFactor: 1 });
const warnings = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) warnings.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => warnings.push(`pageerror: ${e.message}`));
try {
  await page.goto('http://localhost:3000/playground?skipLoader&quality=high&debug=probe');
  await page.waitForFunction(() => window.__crystal?.envTarget, undefined, { timeout: 60000 });
  await page.waitForTimeout(2000);
  const inventory = await page.evaluate(() => {
    const env = window.__crystal;
    const mats = new Map();
    const geometries = new Map();
    let meshes = 0;
    let instances = 0;
    let submittedTriangles = 0;
    env.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      instances += o.count ?? 1;
      const g = o.geometry;
      const triangles = (g.index?.count ?? g.attributes.position.count) / 3;
      geometries.set(g.uuid, triangles);
      submittedTriangles += triangles * (o.count ?? 1);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (mats.has(m.uuid)) { mats.get(m.uuid).uses++; continue; }
        mats.set(m.uuid, {
          type: m.type, key: m.customProgramCacheKey(), uses: 1,
          color: m.color?.getHexString(), roughness: m.roughness, transmission: m.transmission,
          ior: m.ior, thickness: m.thickness, dispersion: m.dispersion,
          uniforms: Object.fromEntries(Object.entries(m.userData.uniforms ?? {}).filter(([, u]) => typeof u.value === 'number').map(([k, u]) => [k, u.value])),
        });
      }
    });
    const update = env.update.bind(env);
    env.update = (renderer, scene, camera) => {
      window.__auditRenderer = renderer;
      update(renderer, scene, camera, 12000);
      // Freeze cloud baking after it has settled for comparable material-only screenshots.
      env.backdrop.update = () => {};
    };
    return { viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, meshes, instances,
      submittedTriangles, uniqueGeometryTriangles: [...geometries.values()].reduce((a, b) => a + b, 0),
      hdr: [env.post.target.width, env.post.target.height], reflection: [env.floor.target.width, env.floor.target.height],
      materials: [...mats.values()] };
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${out}/evidence/01-baseline.png` });
  await page.evaluate(() => window.__crystal.plainGlass());
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/evidence/02-existing-debug-glass.png` });
  await page.evaluate(() => {
    window.__crystal.traverse((o) => {
      const u = o.material?.userData?.uniforms;
      if (!u) return;
      for (const k of ['uFire', 'uInner', 'uScatter', 'uInternal', 'uShade', 'uGlitter']) if (u[k]) u[k].value = 0;
    });
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/evidence/03-all-facet-effects-off.png` });
  await page.evaluate(() => {
    window.__crystal.traverse((o) => {
      const m = o.material;
      if (!m?.userData?.uniforms?.uFire) return;
      m.onBeforeCompile = () => {};
      m.customProgramCacheKey = () => 'audit-unpatched-physical';
      m.dispersion = 0;
      m.thickness = 0.2;
      m.needsUpdate = true;
    });
    const env = window.__crystal;
    const update = env.update.bind(env);
    env.update = (r, s, c, t) => { update(r, s, c, t); r.transmissionResolutionScale = 1; };
  });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${out}/evidence/04-unpatched-crystal-diagnostic.png` });
  const render = await page.evaluate(() => {
    const r = window.__auditRenderer;
    const gl = r.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      programs: r.info.programs.length, geometries: r.info.memory.geometries, textures: r.info.memory.textures,
      note: 'Inventory covers full environment, not visible-only draws. No FPS benchmark. All experimental changes were browser-memory only.' };
  });
  await writeFile(`${out}/runtime-audit.json`, JSON.stringify({ inventory, render, warnings }, null, 2));
  console.log(JSON.stringify({ meshes: inventory.meshes, submittedTriangles: inventory.submittedTriangles, render, warningCount: warnings.length }));
} finally {
  await browser.close();
}
