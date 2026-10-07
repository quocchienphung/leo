// Visual QA: render the playground hero at the reference viewport and save qa/current.png.
// Usage: npm run screenshot [-- <url> <out.png>]   (default http://localhost:3000/playground?skipLoader&quality=high)
// `quality=high` pins the playground's adaptive resolution to full size (slow QA GPUs would lower it).
// The WebGL scene needs a real GPU: Chromium is launched with ANGLE (D3D11 on Windows, default elsewhere).
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

const url = process.argv[2] ?? process.env.QA_URL ?? "http://localhost:3000/playground?skipLoader&quality=high";
const out = process.argv[3] ?? "qa/current.png";
const width = Number(process.env.QA_WIDTH ?? 1672);
const height = Number(process.env.QA_HEIGHT ?? 941);
const settle = Number(process.env.QA_SETTLE_MS ?? 12000);

/** Any already-installed Playwright Chromium (avoids a download when versions differ). */
function installedChromium() {
  const root = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "ms-playwright") : null;
  if (!root || !existsSync(root)) return undefined;
  for (const dir of readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
    const exe = join(root, dir, "chrome-win64", "chrome.exe");
    if (existsSync(exe)) return exe;
  }
  return undefined;
}

const args = ["--enable-gpu", "--ignore-gpu-blocklist", ...(process.platform === "win32" ? ["--use-angle=d3d11"] : [])];
let browser;
try {
  browser = await chromium.launch({ args });
} catch {
  browser = await chromium.launch({ args, executablePath: installedChromium() });
}
const page = await browser.newPage({ viewport: { width, height } });
const problems = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`);
});
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(settle);
mkdirSync(dirname(out), { recursive: true });
await page.screenshot({ path: out });
await browser.close();
console.log(`saved ${out} (${width}×${height})`);
if (problems.length) console.log(problems.slice(0, 20).join("\n"));
