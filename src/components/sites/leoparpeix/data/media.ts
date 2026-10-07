// Source URL rewriters (bundle lines ~27560–27700) mapped onto the local mirror in
// public/sites/leoparpeix/. Paths keep the CDN tree so home/about textures never collide.

import { BREAKPOINTS } from "../core/env";

export const ASSET_ROOT = "/sites/leoparpeix";

/** Source `Us()`: any `/assets/...` path → local mirror. */
export function asset(path: string): string {
  const clean = path.replace(/^\.?\/+/, "");
  return `${ASSET_ROOT}/${clean}`;
}

const ARCHIVES_BASE = "/archives-base/";
const ARCHIVES_COMPRESSED = "/archives-compressed/";

/** Source `HF()`: archive mp4 → compressed mp4. */
export function archiveVideo(url2: string): string {
  return asset(url2.replace(ARCHIVES_BASE, ARCHIVES_COMPRESSED));
}

/** Source `QF()`: archive mp4 → poster webp. */
export function archivePoster(url2: string): string {
  return asset(url2.replace(ARCHIVES_BASE, ARCHIVES_COMPRESSED).replace(/\.mp4$/i, "-poster.webp"));
}

/** Source `zF()`: archive jpg/png → compressed webp. */
export function archiveImage(url: string): string {
  const file = url.split("/").pop() ?? "";
  return asset(url.replace(ARCHIVES_BASE, ARCHIVES_COMPRESSED).replace(file, file.replace(/\.(jpe?g|png)$/i, ".webp")));
}

/** Source `kF()`: `/assets/medias/<dir>/<name>.jpg` → `/assets/medias/<dir>-webp/<name>.webp`. */
export function mediaWebp(url: string): string {
  const m = url.match(/^\/assets\/medias\/(.+)\/([^/]+)\.(jpe?g|png|webp)$/i);
  if (!m) return asset(url);
  const [, dir, name] = m;
  if (dir.endsWith("-webp")) return asset(url);
  return asset(`/assets/medias/${dir}-webp/${name}.webp`);
}

/** Source `OF()`: showreel base → compressed desktop/mobile variant. */
export function showreelVideo(width: number): string {
  const tier = width < BREAKPOINTS.desktop ? "mobile" : "desktop";
  return asset(`/assets/medias/home/showreel-compressed/${tier}/showreel.mp4`);
}

export const showreelPreview = asset("/assets/medias/home/showreel-compressed/preview/showreel.mp4");
export const showreelPoster = asset("/assets/medias/home/showreel-base/showreel-poster.webp");

/** Source `yT()`: project texture tier. */
export function projectTextureSize(width: number): 1024 | 2048 {
  return width < BREAKPOINTS.desktop ? 1024 : 2048;
}

export function projectTexture(projectIndex: number, slide: number, width: number): string {
  return asset(`/assets/medias/home/projects/project${projectIndex + 1}-ktx/${projectTextureSize(width)}/${slide + 1}.ktx2`);
}

/** Source `rN()`: environment atlas tier — 2048 below 1600px wide (or tablet), else 4096. */
export function sceneTextureSize(width: number): 2048 | 4096 {
  return width < BREAKPOINTS.desktop || width < 1600 ? 2048 : 4096;
}

export function sceneTexture(route: "home" | "about", name: string, width: number): string {
  return asset(`/assets/textures/${route}/scene-ktx/${sceneTextureSize(width)}/${name}.ktx2`);
}

/** Global KTX textures with desktop/mobile tiers (source `mF`). */
const GLOBAL_KTX = {
  flowerTex: { dir: "global/flower-ktx", file: "flower", desktop: 1024, mobile: 512 },
  beeTex: { dir: "global/bee-ktx", file: "bee", desktop: 1024, mobile: 512 },
  noise: { dir: "global/noise-ktx", file: "noise", desktop: 512, mobile: 256 },
  waterDeformation: { dir: "global/waterDeformation-ktx", file: "waterDeformation", desktop: 1024, mobile: 512 },
  aboutGroundRoughness: { dir: "about/ground-ktx", file: "roughness", desktop: 512, mobile: 256 },
  aboutGroundAo: { dir: "about/ground-ktx", file: "ao", desktop: 512, mobile: 256 },
  aboutGroundDiffuse: { dir: "about/ground-ktx", file: "diffuse", desktop: 512, mobile: 256 },
} as const;

export type GlobalKtxKey = keyof typeof GLOBAL_KTX;

export function globalKtx(key: GlobalKtxKey, width: number): string {
  const t = GLOBAL_KTX[key];
  const size = width < BREAKPOINTS.desktop ? t.mobile : t.desktop;
  return asset(`/assets/textures/${t.dir}/${size}/${t.file}.ktx2`);
}

export function aboutLeaves(width: number): string {
  return asset(`/assets/textures/about/leaves-webp/${width < BREAKPOINTS.desktop ? 128 : 256}/leaves.webp`);
}

export function aboutGroundNormal(width: number): string {
  return asset(`/assets/textures/about/ground-webp/${width < BREAKPOINTS.desktop ? 256 : 512}/normal.webp`);
}

export const aboutMountain = asset("/assets/textures/about/scene/texMontagne.png");

export const cloudTextures = [1, 2, 3, 4, 5, 6].map((i) => asset(`/assets/textures/global/clouds/cloud${i}.png`));

export const models = {
  bee: asset("/assets/models/global/bee/bee_v4.glb"),
  flower: asset("/assets/models/global/flower/flower_v2.glb"),
  orange: asset("/assets/models/global/fruits/orange.glb"),
  raisin: asset("/assets/models/global/fruits/raisin.glb"),
  home: asset("/assets/models/home/scene_v9.glb"),
  about: asset("/assets/models/about/scene_v15.glb"),
} as const;

export const sounds = {
  ambient: { path: asset("/assets/sounds/compressed/ambient.aac"), loop: true, volume: 0.375, fadeDuration: 500 },
  fruit1: { path: asset("/assets/sounds/compressed/fruit1.aac"), volume: 0.25, replay: true },
  fruit2: { path: asset("/assets/sounds/compressed/fruit2.aac"), volume: 0.25, replay: true },
  pageTransition: {
    path: asset("/assets/sounds/compressed/pageTransition.aac"),
    volume: 0.36,
    replay: true,
    startProgress: 0.15,
    fadeInDuration: 700,
  },
} as const;

export const decoders = {
  basis: `${ASSET_ROOT}/decoders/basis/`,
  draco: `${ASSET_ROOT}/decoders/draco/`,
} as const;
