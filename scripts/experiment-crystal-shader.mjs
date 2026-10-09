import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { buildPlaneBvh } from '../src/components/sites/leoparpeix/webgl/env/crystal/planeBvh.ts';
import { planeBvhFragment } from '../src/components/sites/leoparpeix/webgl/shaders/crystalPlaneBvh.ts';

// Development-only, browser-memory experiments. Never replaces application materials.
const phase = process.env.AUDIT_EXPERIMENT ?? 'shader-experiment';
assert(/^[a-z0-9-]+$/.test(phase));
const out = `docs/research/leoparpeix/performance/${phase}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.AUDIT_BROWSER ?? 'chrome', headless: true });
const report = { samples: [], differences: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
  await page.goto('http://localhost:3000/playground?skipLoader&debug=probe');
  await page.waitForFunction(() => window.__crystal?.envTarget, undefined, { timeout: 120000 });
  await page.evaluate(() => {
    const env = window.__crystal;
    env.pinned = true;
    // Eye expressions have their own accumulated clock; freeze them separately.
    env.flower.face.update = () => {};
    const original = env.update;
    env.update = function (r, s, c, et) {
      window.__auditRenderer = r;
      window.__auditCamera = c;
      return original.call(this, r, s, c, window.__auditFreeze ? 12000 : et);
    };
    const post = env.post.render;
    env.post.render = function (r, output) {
      window.__auditOutput = output;
      return post.call(this, r, output);
    };
    const materials = new Map();
    env.traverse((o) => {
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
        if (m.userData.traced) materials.set(m, o.geometry);
      }
    });
    window.__auditMaterials = [...materials].map(([m, geometry]) => ({ m, geometry, compile: m.onBeforeCompile, key: m.customProgramCacheKey }));
    window.__auditSetMode = (mode) => {
      for (const { m, compile, key } of window.__auditMaterials) {
        m.onBeforeCompile = function (shader, renderer) {
          compile.call(this, shader, renderer);
          if (mode.includes('bvh')) {
            const bvh = window.__auditBvhs[window.__auditMaterials.findIndex((entry) => entry.m === m)];
            if (bvh) {
              // Reuse the existing float DataTexture's class without importing Three into the page.
              const texture = m.userData.planeTexture.clone();
              texture.image = { data: new Float32Array(bvh.data), width: bvh.nodeCount * 3, height: 1 };
              texture.needsUpdate = true;
              shader.uniforms.uPlaneBvh = { value: texture };
              shader.uniforms.uPlaneBvhNodes = { value: bvh.nodeCount };
              const start = shader.fragmentShader.indexOf('float traceExit(vec3 p, vec3 d, out vec3 nOut) {');
              const end = shader.fragmentShader.indexOf('// Unpolarised', start);
              shader.fragmentShader = `#define TRACE_BVH_STEPS ${bvh.nodeCount}\n` + shader.fragmentShader.slice(0, start) + window.__auditBvhShader + shader.fragmentShader.slice(end);
            }
          }
          if (mode.includes('uniform')) {
            const bucket = mode.includes('constant') || mode.includes('unroll') ? m.userData.uniforms.uPlaneCount.value : m.defines.TRACE_PLANES;
            assertBudget: {
              if (renderer.capabilities.maxFragmentUniforms < bucket + 128) break assertBudget;
              const data = new Float32Array(bucket * 4);
              data.set(m.userData.planeTexture.image.data);
              shader.uniforms.uPlaneData = { value: data };
              shader.fragmentShader = shader.fragmentShader
                .replace('uniform sampler2D uPlanes;', 'uniform vec4 uPlaneData[TRACE_PLANES];')
                .replace('texelFetch(uPlanes, ivec2(i, 0), 0)', 'uPlaneData[i]');
              if (mode.includes('constant') || mode.includes('unroll')) {
                shader.fragmentShader = `#undef TRACE_PLANES\n#define TRACE_PLANES ${bucket}\n${shader.fragmentShader}`;
                shader.fragmentShader = shader.fragmentShader.replace('    if (i >= uPlaneCount) break;\n', '');
              }
              if (mode.includes('unroll')) {
                const start = shader.fragmentShader.indexOf('float traceExit(vec3 p, vec3 d, out vec3 nOut) {');
                const end = shader.fragmentShader.indexOf('// Unpolarised', start);
                const body = Array.from({ length: bucket }, (_, i) => `{
                  vec4 pl = uPlaneData[${i}];
                  float denom = dot(pl.xyz, d);
                  if (denom > 1e-5) {
                    float t = (pl.w - dot(pl.xyz, p)) / denom;
                    if (t > 1e-5 && t < tMin) { tMin = t; nOut = pl.xyz; }
                  }
                }`).join('\n');
                shader.fragmentShader = shader.fragmentShader.slice(0, start) + `float traceExit(vec3 p, vec3 d, out vec3 nOut) {
                  float tMin = 1e4; nOut = d;
                  ${body}
                  return tMin < 1e3 ? tMin : 0.0;
                }\n` + shader.fragmentShader.slice(end);
              }
            }
          }
          if (mode.includes('branch')) {
            shader.fragmentShader = shader.fragmentShader.replace(
              'vec3 seen = traceEnv(dirW);\n  if (inside) seen = getTransmissionSample(uv, 0.0, uTraceIor).rgb;\n  return seen;',
              'if (inside) return getTransmissionSample(uv, 0.0, uTraceIor).rgb;\n  return traceEnv(dirW);',
            );
          }
        };
        m.customProgramCacheKey = () => `${key.call(m)}-experiment-${mode}-${m.userData.uniforms.uPlaneCount.value}`;
        m.needsUpdate = true;
      }
    };
  });
  await page.waitForFunction(() => window.__auditRenderer);
  const solids = await page.evaluate(() => window.__auditMaterials.map(({ m, geometry }) => ({
    planes: Array.from(m.userData.planeTexture.image.data),
    positions: Array.from(geometry.getAttribute('position').array),
  })));
  await writeFile(`${out}/solids.json`, JSON.stringify(solids));
  const bvhs = solids.map(({ planes, positions }) => {
    const vectors = Array.from({ length: planes.length / 4 }, (_, i) => ({ x: planes[i * 4], y: planes[i * 4 + 1], z: planes[i * 4 + 2], w: planes[i * 4 + 3] }));
    const bvh = buildPlaneBvh(vectors, positions);
    return bvh ? { nodeCount: bvh.nodeCount, data: Array.from(bvh.data) } : null;
  });
  await page.evaluate(({ bvhs, shader }) => { window.__auditBvhs = bvhs; window.__auditBvhShader = shader; }, { bvhs, shader: planeBvhFragment });
  report.bvh = { built: bvhs.filter(Boolean).length, skipped: bvhs.filter((b) => !b).length, nodeCounts: bvhs.map((b) => b?.nodeCount ?? 0) };
  report.capabilities = await page.evaluate(() => ({
    maxFragmentUniformVectors: window.__auditRenderer.capabilities.maxFragmentUniforms,
    planes: window.__auditMaterials.map(({ m }) => ({ count: m.userData.uniforms.uPlaneCount.value, bucket: m.defines.TRACE_PLANES, bounces: m.defines.TRACE_BOUNCES })),
  }));
  const capture = async (mode, y) => {
    await page.evaluate((y) => {
      window.__auditFreeze = true;
      window.__crystal.backdrop.dirty = true;
      window.scrollTo(0, y);
    }, y);
    await page.waitForTimeout(800);
    const frame = await page.evaluate(() => {
      const r = window.__auditRenderer;
      const target = window.__auditOutput;
      const pixels = new Uint8Array(target.width * target.height * 4);
      r.readRenderTargetPixels(target, 0, 0, target.width, target.height, pixels);
      const canvas = document.createElement('canvas');
      canvas.width = target.width;
      canvas.height = target.height;
      canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer), target.width, target.height), 0, 0);
      return { width: target.width, height: target.height, png: canvas.toDataURL('image/png').split(',')[1] };
    });
    const png = Buffer.from(frame.png, 'base64');
    const pixels = await sharp(png).ensureAlpha().raw().toBuffer();
    await sharp(png).flip().png().toFile(`${out}/${mode}-${y}.png`);
    await page.evaluate(() => { window.__auditFreeze = false; });
    return pixels;
  };
  const baseline = new Map();
  for (const mode of (process.env.AUDIT_MODES ?? 'baseline,uniform,branch,uniform-branch').split(',')) {
    await page.evaluate((mode) => window.__auditSetMode(mode), mode);
    await page.evaluate(async () => {
      const env = window.__crystal;
      await window.__auditRenderer.compileAsync(env.parent, window.__auditCamera);
    });
    await page.waitForTimeout(5000);
    const sample = await page.evaluate(async () => {
      const start = performance.now();
      const intervals = [];
      let last = 0;
      await new Promise((resolve) => {
        const tick = (now) => {
          if (last) intervals.push(now - last);
          last = now;
          window.scrollTo(0, 180 + Math.sin((now - start) / 600) * 160);
          if (now - start >= 10000) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const sorted = [...intervals].sort((a, b) => a - b);
      return { fps: intervals.length * 1000 / intervals.reduce((sum, n) => sum + n, 0), p95Ms: sorted[Math.floor(sorted.length * .95)], over25ms: intervals.filter((n) => n > 25).length, over50ms: intervals.filter((n) => n > 50).length, maxMs: Math.max(...intervals), frames: intervals.length };
    });
    report.samples.push({ mode, ...sample });
    console.log(JSON.stringify(report.samples.at(-1)));
    for (const y of [0, 600, 1200]) {
      const pixels = await capture(mode, y);
      if (mode === 'baseline') { baseline.set(y, pixels); continue; }
      const before = baseline.get(y);
      let sum = 0, max = 0, changed = 0;
      for (let i = 0; i < pixels.length; i++) {
        if (i % 4 === 3) continue;
        const difference = Math.abs(pixels[i] - before[i]);
        sum += difference;
        max = Math.max(max, difference);
        if (difference > 2) changed++;
      }
      report.differences.push({ mode, scroll: y, meanAbsoluteChannelDifference: sum / (pixels.length / 4 * 3), maxChannelDifference: max, channelsChangedOver2Percent: changed / (pixels.length / 4 * 3) * 100 });
      console.log(JSON.stringify(report.differences.at(-1)));
    }
  }
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
} finally {
  await writeFile(`${out}/results.json`, `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
