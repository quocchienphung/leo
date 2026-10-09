import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const phase = process.argv[2] ?? 'translation';
const verify = phase === 'translation' || phase === 'after';
assert(/^[a-z0-9-]+$/.test(phase));
const out = `docs/research/leoparpeix/implementation/playground-crystal/scroll-2026-10-09/${phase}`;
await mkdir(out, { recursive: true });
const cache = join(process.env.LOCALAPPDATA, 'ms-playwright');
const executablePath = readdirSync(cache).filter((x) => /^chromium-\d+$/.test(x)).sort().reverse().map((x) => join(cache, x, 'chrome-win64', 'chrome.exe')).find(existsSync);
const browser = await chromium.launch({ executablePath, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const report = { shots: [], errors: [] };
try {
  const views = [['desktop', 1672, 941, 1], ...(verify ? [['wide', 2559, 1276, 1], ['mobile', 390, 844, 2]] : [])];
  for (const [name, width, height, dpr] of views) {
    const mobile = name === 'mobile';
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: mobile, isMobile: mobile });
    const input = mobile ? await page.context().newCDPSession(page) : null;
    const scrollTo = async (target) => {
      for (let attempt = 0; attempt < (mobile ? 8 : 3); attempt++) {
        const delta = target - await page.evaluate(() => scrollY);
        if (Math.abs(delta) < 2) break;
        if (input) {
          const viewport = page.viewportSize();
          // Swipe beyond the top boundary when returning; tiny native gestures can stay
          // inside Chromium's touch slop and leave the page a few pixels short of the top.
          const distance = Math.abs(delta) + (target === 0 ? 60 : 0);
          const travel = Math.sign(delta) * Math.min(distance, viewport.height * .35);
          const x = viewport.width / 2, startY = viewport.height * (delta > 0 ? .75 : .25);
          const finger = (y) => [{ x, y, id: 1, radiusX: 5, radiusY: 5, force: 1 }];
          await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: finger(startY) });
          for (let step = 1; step <= 8; step++) {
            await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: finger(startY - travel * step / 8) });
            await page.waitForTimeout(35);
          }
          // End with a stationary finger so Lenis does not add a fling to the measured target.
          await page.waitForTimeout(100);
          await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: finger(startY - travel) });
          await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } else {
          await page.mouse.wheel(0, delta);
        }
        await page.waitForTimeout(1600);
      }
      const actual = await page.evaluate(() => scrollY);
      assert(Math.abs(actual - target) < 3, `Visitor input must reach ${target}, got ${actual}`);
    };
    page.on('pageerror', (e) => report.errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
    await page.goto('http://localhost:3000/playground?skipLoader&debug=probe');
    await page.waitForFunction(() => window.__crystal?.envTarget, undefined, { timeout: 120000 });
    await page.evaluate(() => {
      const e = window.__crystal, update = e.update;
      e.update = function (...args) { window.__scrollCamera = args[2]; return update.apply(this, args); };
    });
    await page.waitForFunction(() => window.__scrollCamera);
    await page.mouse.move(width / 2, height / 2);
    await page.waitForTimeout(4000);
    const headerHeight = await page.locator('[class*="headerBlock"]').first().evaluate((el) => el.getBoundingClientRect().height);
    const scrolls = name === 'desktop' ? [0, 200, 452, 753, 941, 1317, 1694, 0] : [0, Math.round(headerHeight * .24), Math.round(headerHeight * .4), Math.round(headerHeight * .5), Math.round(headerHeight * .9), 0];
    const shots = [];
    for (const scroll of scrolls) {
      await scrollTo(scroll);
      await page.waitForTimeout(400);
      const suffix = scroll === 0 && shots.length ? 'return' : scroll;
      await page.screenshot({ path: `${out}/${name}-${suffix}.png` });
      report.shots.push(await page.evaluate(({ name, scroll }) => {
        const e = window.__crystal, c = window.__scrollCamera;
        const world = c.getWorldPosition(c.position.clone());
        const direction = c.getWorldDirection(c.position.clone());
        // Stage coordinates: x = -world.z, z = world.x - 2.75.
        const project = (x, y, z) => {
          const p = c.position.clone().set(2.75 + z, y, -x).project(c);
          return [(p.x + 1) / 2, (1 - p.y) / 2, p.z];
        };
        return { name, requestedScroll: scroll, scroll: scrollY, local: c.position.toArray(), rotation: c.rotation.toArray().slice(0, 3), world: world.toArray(), direction: direction.toArray(), visible: e.visible, poolFront: project(0, 0.006, .85), floorNear: project(0, 0, 4.5), overflow: document.documentElement.scrollWidth > innerWidth };
      }, { name, scroll }));
      shots.push(report.shots.at(-1));
    }
    if (verify) {
      assert(shots.every((s) => !s.overflow && s.visible));
      assert(shots.every((s) => s.rotation.every((v) => Math.abs(v) < 1e-8)), 'Scrolling must never rotate the camera');
      assert(shots.every((s) => s.direction.every((v, i) => Math.abs(v - shots[0].direction[i]) < 1e-6)), 'World viewing direction stays fixed');
      assert(shots.every((s) => s.world[1] > .1), 'Camera stays above the floor');
      for (const s of shots) {
        const p = Math.min(s.scroll / headerHeight, .92);
        assert(Math.abs(s.local[1] + 2.4 * p) < .002 && Math.abs(s.local[2] + 4 * p) < .002, 'Playground uses the measured Work translation');
      }
      for (let i = 1; i < shots.length - 1; i++) assert(shots[i].poolFront[1] < shots[i - 1].poolFront[1], 'Scroll must expose increasing foreground distance');
      assert(shots.at(-2).floorNear[1] < 1, 'Floor at stage z=4.5 must enter the frame');
      assert.deepEqual(shots.at(-1).local, shots[0].local, 'Reverse scroll restores the starting camera');
      assert.deepEqual(shots.at(-1).rotation, shots[0].rotation);
      await scrollTo(Math.round(headerHeight * .4));
      await page.setViewportSize({ width: mobile ? 430 : 1024, height: mobile ? 932 : 768 });
      await page.waitForTimeout(2000);
      const resized = await page.evaluate(() => {
        const c = window.__scrollCamera;
        return { viewport: [innerWidth, innerHeight], aspect: c.aspect, zoom: c.zoom, local: c.position.toArray(), world: c.getWorldPosition(c.position.clone()).toArray() };
      });
      assert(Math.abs(resized.aspect - resized.viewport[0] / resized.viewport[1]) < .0001);
      assert.equal(resized.zoom, .62);
      assert(resized.world[1] > .1);
      report[`${name}Resize`] = resized;
      await page.screenshot({ path: `${out}/${name}-resized.png` });
      // Verify the scene releases to the existing bee hero, and can be revisited.
      await scrollTo(await page.locator('[class*="headerBlock"]').first().evaluate((el) => el.getBoundingClientRect().height) + 150);
      assert.equal(await page.evaluate(() => window.__crystal.visible), false);
      assert(await page.evaluate(() => window.__scrollCamera.getWorldPosition(window.__scrollCamera.position.clone()).y > .1), 'End of path never crosses the floor');
      await page.screenshot({ path: `${out}/${name}-hero-handoff.png` });
      await scrollTo(0);
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => window.__crystal.visible), true);
      report[`${name}HandoffReturn`] = await page.evaluate(() => ({ scroll: scrollY, rotation: window.__scrollCamera.rotation.toArray().slice(0, 3) }));
      assert(report[`${name}HandoffReturn`].rotation.every((v) => Math.abs(v) < (mobile ? .002 : 1e-8)), JSON.stringify(report[`${name}HandoffReturn`]));
      if (name === 'desktop') {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(1200);
        await scrollTo(450);
        await page.getByRole('link', { name: 'Work', exact: true }).click();
        await page.waitForURL((url) => url.pathname === '/');
        await page.waitForTimeout(4000);
        await scrollTo(200);
        report.work = await page.evaluate(() => ({ scroll: scrollY, local: window.__scrollCamera.position.toArray(), rotation: window.__scrollCamera.rotation.toArray().slice(0, 3) }));
        assert(Math.abs(report.work.local[1] + 200 / (height * 2) * 2.4) < .01);
        assert(Math.abs(report.work.local[2] + 200 / (height * 2) * 4) < .01);
        assert(report.work.rotation.every((v) => Math.abs(v) < 1e-8), 'Work retains its original scroll trajectory');
        await page.screenshot({ path: `${out}/work-scroll.png` });
        await page.getByRole('link', { name: 'Playground', exact: true }).click();
        await page.waitForURL((url) => url.pathname === '/playground');
        await page.waitForTimeout(4500);
        report.routeReturn = await page.evaluate(() => ({ scroll: scrollY, local: window.__scrollCamera.position.toArray(), rotation: window.__scrollCamera.rotation.toArray().slice(0, 3), visible: window.__crystal.visible }));
        assert(report.routeReturn.local.every((v) => Math.abs(v) < 1e-8));
        assert(report.routeReturn.rotation.every((v) => Math.abs(v) < 1e-8));
        assert(report.routeReturn.visible);
        await page.screenshot({ path: `${out}/route-return.png` });
      }
    }
    await page.close();
    console.log(`${phase}: ${name}`);
  }
  assert.equal(report.errors.length, 0);
  if (verify) {
    const frames = await Promise.all(['0', '452', '941'].map((s) => sharp(`${out}/desktop-${s}.png`).resize({ width: 640 }).toBuffer()));
    const meta = await sharp(frames[0]).metadata();
    await sharp({ create: { width: 1920, height: meta.height, channels: 3, background: '#eee' } }).composite(frames.map((input, i) => ({ input, left: i * 640, top: 0 }))).png().toFile(`${out}/scroll-sequence.png`);
  }
} finally {
  await writeFile(`${out}/runtime.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
