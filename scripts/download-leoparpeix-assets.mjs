// Downloads the assets used by https://www.leoparpeix.com into public/sites/leoparpeix/.
// The CDN rejects requests without a site Referer, so every request carries the page's
// own Referer/Origin like a normal browser visit. Paths mirror the source tree to avoid
// basename collisions (e.g. home/TexFleur vs about/TexFleur).
//
// Usage: node scripts/download-leoparpeix-assets.mjs [--force]

import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "sites", "leoparpeix");
const MANIFEST = join(ROOT, "docs", "research", "leoparpeix", "implementation", "asset-manifest.json");
const CDN = "https://cdn.leoparpeix.com";
const SITE = "https://www.leoparpeix.com";
const FORCE = process.argv.includes("--force");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
  Referer: `${SITE}/`,
  Origin: SITE,
  Accept: "*/*",
};

const homeTex = ["TexFleur", "TexProps", "TexMobilier", "TexDecor", "TexTableaux", "TexBibli", "TexFloor", "TexWalls"];
const aboutTex = ["TexBook", "TexFleur", "TexGround", "TexRock", "TexProps", "TexDecor", "TexMobilier", "TexArbresFront", "TexArbresBack"];
const projectCounts = { project1: 12, project2: 12, project3: 11, project4: 9, project5: 10, project6: 11 };

/** @type {{ path: string; use: string; optional?: boolean; origin?: string }[]} */
const assets = [];
const add = (path, use, optional = false, origin = CDN) => assets.push({ path, use, optional, origin });

// Fonts are served by the site origin, not the CDN.
add("assets/fonts/monumentgrotesk-regular.woff2", "font:text", false, SITE);
add("assets/fonts/avantt-variable.ttf", "font:title", false, SITE);

// Models
for (const m of [
  "models/home/scene_v9.glb",
  "models/about/scene_v15.glb",
  "models/global/flower/flower_v2.glb",
  "models/global/bee/bee_v4.glb",
  "models/global/fruits/orange.glb",
  "models/global/fruits/raisin.glb",
]) add(`assets/${m}`, "webgl:model");

// Scene textures: 4096 on desktop >= 1600px, 2048 below.
for (const size of [4096, 2048]) {
  for (const t of homeTex) add(`assets/textures/home/scene-ktx/${size}/${t}.ktx2`, "webgl:home-env");
  for (const t of aboutTex) add(`assets/textures/about/scene-ktx/${size}/${t}.ktx2`, "webgl:about-env");
}

// Global KTX textures (desktop / mobile tiers)
for (const [dir, base, d, m] of [
  ["global/flower-ktx", "flower", 1024, 512],
  ["global/bee-ktx", "bee", 1024, 512],
  ["global/noise-ktx", "noise", 512, 256],
  ["global/waterDeformation-ktx", "waterDeformation", 1024, 512],
]) for (const s of [d, m]) add(`assets/textures/${dir}/${s}/${base}.ktx2`, `webgl:${base}`);
for (const s of [512, 256]) for (const b of ["roughness", "ao", "diffuse"]) add(`assets/textures/about/ground-ktx/${s}/${b}.ktx2`, "webgl:about-ground");

// WebP textures
for (const s of [256, 128]) add(`assets/textures/about/leaves-webp/${s}/leaves.webp`, "webgl:about-leaves");
for (const s of [512, 256]) add(`assets/textures/about/ground-webp/${s}/normal.webp`, "webgl:about-ground");
add("assets/textures/about/scene/texMontagne.png", "webgl:about-mountain");
for (let i = 1; i <= 6; i++) add(`assets/textures/global/clouds/cloud${i}.png`, "webgl:clouds");

// Project slider textures (rendered in WebGL by the source) + webp fallbacks.
for (const [p, n] of Object.entries(projectCounts)) {
  for (let i = 1; i <= n; i++) {
    for (const s of [2048, 1024]) {
      add(`assets/medias/home/projects/${p}-ktx/${s}/${i}.ktx2`, `home:${p}`);
      add(`assets/medias/home/projects/${p}-webp/${s}/${i}.webp`, `home:${p}`, true);
    }
  }
}

// Showreel
for (const v of ["desktop", "mobile", "preview"]) add(`assets/medias/home/showreel-compressed/${v}/showreel.mp4`, "home:showreel", v === "mobile");
add("assets/medias/home/showreel-base/showreel-poster.webp", "home:showreel-poster");
add("assets/medias/home/showreel-compressed/desktop/showreel-poster.webp", "home:showreel-poster", true);

// Archives
const archiveVideos = [
  "7-PortfolioGab", "8-Unity-2025", "9-Pangaia", "11-Merrel", "13-Tougo", "14-DrakeHotel", "15-Vooban",
  "17-Unity-2024", "18-TheHayAdams", "19-PrisonBoss", "20-Palosanto", "21-Longines", "23-ImmersiveGarden",
  "24-LonginesDolceVita", "25-Omega", "26-Aleph", "28-TourDeFrance", "29-Manza",
];
for (const a of archiveVideos) {
  add(`assets/medias/home/archives-compressed/${a}.mp4`, "home:archive");
  add(`assets/medias/home/archives-compressed/${a}-poster.webp`, "home:archive");
}
for (const a of ["dna", "16-AubergerLaChatelaine", "27-Omexom", "10-IsseyMiyake", "12-Loreal", "22-JMM"]) {
  add(`assets/medias/home/archives-compressed/${a}.webp`, "home:archive", !["dna", "16-AubergerLaChatelaine", "27-Omexom"].includes(a));
}

// About
add("assets/medias/about/intro-webp/intro.webp", "about:intro");
add("assets/medias/about/content-webp/content.webp", "about:content");

// Playground
for (const n of [1, 2, 3, 4, 5, 9, 11, 14, 15]) {
  add(`assets/medias/playground/${n}.webm`, "playground:video");
  add(`assets/medias/playground/${n}.mp4`, "playground:video", true);
  add(`assets/medias/playground/${n}-poster.webp`, "playground:poster", true);
}
for (const n of [6, 7, 8, 10, 12, 13]) add(`assets/medias/playground-webp/${n}.webp`, "playground:image");

// Sounds
for (const s of ["ambient", "fruit1", "fruit2", "pageTransition"]) add(`assets/sounds/compressed/${s}.aac`, "sound");

function sniff(buf) {
  const h = buf.subarray(0, 16);
  const ascii = h.toString("latin1");
  if (ascii.startsWith("glTF")) return "model/gltf-binary";
  if (h[0] === 0xab && ascii.slice(1, 7) === "KTX 20") return "image/ktx2";
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return "image/webp";
  if (h[0] === 0x89 && ascii.slice(1, 4) === "PNG") return "image/png";
  if (h[0] === 0xff && h[1] === 0xd8) return "image/jpeg";
  if (ascii.slice(4, 8) === "ftyp") return ascii.slice(8, 12).startsWith("avif") ? "image/avif" : "video/mp4";
  if (h[0] === 0x1a && h[1] === 0x45 && h[2] === 0xdf && h[3] === 0xa3) return "video/webm";
  if (ascii.startsWith("wOF2")) return "font/woff2";
  if (h[0] === 0 && h[1] === 1 && h[2] === 0 && h[3] === 0) return "font/ttf";
  if (h[0] === 0xff && (h[1] & 0xf6) === 0xf0) return "audio/aac";
  if (ascii.startsWith("ID3")) return "audio/mpeg";
  if (ascii.trimStart().startsWith("<")) return "text/html";
  return "application/octet-stream";
}

function dims(buf, type) {
  if (type === "image/png") return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (type === "image/ktx2") return { width: buf.readUInt32LE(20), height: buf.readUInt32LE(24) };
  if (type === "image/webp") {
    const chunk = buf.toString("latin1", 12, 16);
    if (chunk === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") {
      const b = buf.readUInt32LE(21);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
  }
  return undefined;
}

async function fetchOne(a) {
  const url = `${a.origin}/${a.path}`;
  const dest = join(OUT, a.path);
  if (!FORCE) {
    try {
      const s = await stat(dest);
      if (s.size > 0) {
        const buf = await readFile(dest);
        const type = sniff(buf);
        return { ...a, url, local: `/sites/leoparpeix/${a.path}`, status: "cached", bytes: s.size, type, ...dims(buf, type), sha256: createHash("sha256").update(buf).digest("hex") };
      }
    } catch {
      // not cached yet
    }
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) return { ...a, url, status: `http-${res.status}` };
      const buf = Buffer.from(await res.arrayBuffer());
      const type = sniff(buf);
      if (type === "text/html") return { ...a, url, status: "html-error-page", bytes: buf.length };
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, buf);
      return {
        ...a,
        url,
        local: `/sites/leoparpeix/${a.path}`,
        status: "downloaded",
        bytes: buf.length,
        type,
        headerType: res.headers.get("content-type"),
        ...dims(buf, type),
        sha256: createHash("sha256").update(buf).digest("hex"),
      };
    } catch (err) {
      if (attempt === 2) return { ...a, url, status: `error: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
  return { ...a, url, status: "error" };
}

const results = [];
let next = 0;
async function worker() {
  while (next < assets.length) {
    const a = assets[next++];
    const r = await fetchOne(a);
    results.push(r);
    const flag = r.status === "downloaded" || r.status === "cached" ? "ok " : a.optional ? "-- " : "ERR";
    console.log(`${flag} ${r.status.padEnd(16)} ${a.path}`);
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
results.sort((x, y) => x.path.localeCompare(y.path));
await mkdir(dirname(MANIFEST), { recursive: true });
await writeFile(
  MANIFEST,
  JSON.stringify(
    results.map(({ origin: _origin, ...r }) => ({ ...r, optional: r.optional || undefined })),
    null,
    2,
  ),
);
const failed = results.filter((r) => !["downloaded", "cached"].includes(r.status) && !r.optional);
console.log(`\n${results.length} assets, ${failed.length} required failures`);
for (const f of failed) console.log("FAILED", f.status, f.url);

// Decoders: use the versions shipped with the installed three.js so they match its loaders.
import { copyFile } from "node:fs/promises";
const THREE_LIBS = join(ROOT, "node_modules", "three", "examples", "jsm", "libs");
for (const [dir, files] of [
  ["basis", ["basis_transcoder.js", "basis_transcoder.wasm"]],
  ["draco", ["draco_decoder.js", "draco_decoder.wasm", "draco_wasm_wrapper.js"]],
]) {
  await mkdir(join(OUT, "decoders", dir), { recursive: true });
  for (const f of files) await copyFile(join(THREE_LIBS, dir, f), join(OUT, "decoders", dir, f));
}
console.log("decoders copied to public/sites/leoparpeix/decoders");
