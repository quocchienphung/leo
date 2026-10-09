import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const phase = process.argv[2] ?? 'baseline';
assert(/^[a-z0-9-]+$/.test(phase));
const baseUrl = process.env.AUDIT_URL ?? 'http://localhost:3100';
const durationMs = Number(process.env.AUDIT_DURATION_MS ?? 30000);
const out = `docs/research/leoparpeix/performance/${phase}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.AUDIT_BROWSER ?? 'chrome', headless: true });
const report = { phase, baseUrl, durationMs, samples: [], errors: [] };
try {
  // Run sequentially: concurrent WebGL pages would compete for the same GPU.
  const devices = [
    ['desktop', 1440, 900, 1, false],
    ['retina', 1440, 900, 2, false],
    ['mobile', 390, 844, 2, true],
  ];
  for (const [name, width, height, dpr, mobile] of devices.filter(([name]) => !process.env.AUDIT_DEVICES || process.env.AUDIT_DEVICES.split(',').includes(name))) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    page.on('pageerror', (e) => report.errors.push(`${name}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(`${name}: ${m.text()}`); });
    // Observe the existing runtime without adding application debug globals to production.
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (...args) {
        const gl = getContext.apply(this, args);
        if (args[0] === 'webgl2' && gl && !window.__auditGl) window.__auditGl = gl;
        return gl;
      };
    });
    await page.goto(`${baseUrl}/playground?skipLoader`);
    await page.waitForFunction(() => document.querySelector('main')?.className.includes('visible') && document.querySelectorAll('canvas').length >= 2, undefined, { timeout: 120000 });
    await page.mouse.move(width / 2, height / 2);
    await page.waitForTimeout(6000);
    const metadata = await page.evaluate(() => {
      const gl = window.__auditGl;
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      return {
        gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER),
        viewport: [innerWidth, innerHeight], dpr: devicePixelRatio,
        maxFragmentUniformVectors: gl?.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
      };
    });
    const sample = async (label, offset = 0) => {
      const result = await page.evaluate(async ({ durationMs, offset }) => {
        const intervals = [];
        let last = 0;
        const start = performance.now();
        let end = start;
        // Native scroll injection is repeatable and exercises scroll + render callbacks;
        // real wheel/gesture navigation is verified separately below.
        await new Promise((resolve) => {
          const tick = (now) => {
            if (last) intervals.push(now - last);
            last = now;
            window.scrollTo(0, offset + innerHeight * (0.35 + Math.sin((now - start) / 1200) * 0.3));
            if (now - start >= durationMs) { end = now; resolve(); }
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        const sorted = [...intervals].sort((a, b) => a - b);
        const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
        return {
          fps: intervals.length * 1000 / intervals.reduce((sum, n) => sum + n, 0),
          durationMs: end - start, frames: intervals.length,
          medianMs: percentile(.5), p95Ms: percentile(.95), p99Ms: percentile(.99),
          over25ms: intervals.filter((n) => n > 25).length,
          over50ms: intervals.filter((n) => n > 50).length,
          maxMs: Math.max(...intervals),
          videosPlaying: [...document.querySelectorAll('video')].filter((v) => !v.paused).length,
        };
      }, { durationMs, offset });
      report.samples.push({ device: name, label, ...metadata, ...result });
      console.log(JSON.stringify(report.samples.at(-1)));
    };
    await sample('playground-header');
    const header = page.locator('[class*="headerBlock"]').first();
    const headerHeight = await header.evaluate((el) => el.getBoundingClientRect().height);
    for (const progress of [0, .4, .8]) {
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(headerHeight * progress));
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${out}/${name}-${progress}.png` });
    }
    if (!mobile) {
      await page.mouse.wheel(0, -10000);
      await page.waitForTimeout(1800);
      assert(await page.evaluate(() => scrollY < 2), 'Wheel returns to header');
      await page.mouse.wheel(0, 600);
      await page.waitForFunction(() => scrollY > 200, undefined, { timeout: 10000 });
      const wheelScroll = await page.evaluate(() => scrollY);
      report.samples.at(-1).wheelScroll = wheelScroll;
      assert(wheelScroll > 200, `Wheel scroll remains functional, actual=${wheelScroll}`);
    }
    if (name === 'desktop') {
      await page.evaluate(() => window.scrollTo(0, 4500));
      await page.waitForTimeout(2000);
      await sample('playground-content', 4500);
      await page.getByRole('link', { name: 'Work', exact: true }).click();
      await page.waitForURL((url) => url.pathname === '/');
      await page.waitForTimeout(4000);
      await sample('work-header');
      await page.getByRole('link', { name: 'Playground', exact: true }).click();
      await page.waitForURL((url) => url.pathname === '/playground');
      await page.waitForTimeout(4000);
      assert(await page.evaluate(() => scrollY < 2), 'Route return resets scroll');
    }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
    await context.close();
  }
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
} catch (error) {
  report.failure = String(error);
  throw error;
} finally {
  await writeFile(`${out}/results.json`, `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
