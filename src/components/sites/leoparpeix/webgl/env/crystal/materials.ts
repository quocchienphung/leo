import * as THREE from "three";
import { crystalFireMain, crystalFirePars, crystalVertexMain, crystalVertexPars, facetedTransmission, glitterFragmentMain, glitterFragmentPars, glitterVertexMain, glitterVertexPars, milkTransmission, translucencyMain, translucencyPars } from "../../shaders/crystal";

/*
 * Materials of the crystal pavilion. Colours are sRGB hex converted to linear by three (the scene
 * is lit physically and tone mapped by CrystalPost). Reference samples (7 × 7 px averages):
 * petals in half shade #ccbfb5, centre #f6d6aa → #e9c995 at the rim, eyes #5f4f3e,
 * limestone #efe7d8 lit / #b1a59f shade, lit floor #f8e1c9.
 */
export const COLORS = {
  sun: 0xffd9a8,
  petal: 0xe9e6e1,
  petalMilk: 0xf6f4f1,
  petalAttenuation: 0xf0ebe4,
  champagne: 0xeccb8c,
  champagneDeep: 0xd39a4a,
  ink: 0x76604b,
  limestone: 0xf1e8da,
  bark: 0x5e5446,
  leaf: 0x8e9a5c,
  leafDark: 0x6b7a45,
} as const;

/** Seeded RNG (mulberry32): the pavilion is identical on every load. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Image-based light captured from the pavilion itself (sky, sun disc, ranges, limestone, marble),
 * pre-filtered once. Glass and crystal reflect this; without it they look dead.
 * `hide` are switched off during the capture (the glass would only reflect itself).
 */
export function captureEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene, position: THREE.Vector3, hide: THREE.Object3D[]): THREE.WebGLRenderTarget {
  const restore = hide.map((o) => o.visible);
  for (const o of hide) o.visible = false;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0, 0.05, 1500, { size: 256, position });
  pmrem.dispose();
  hide.forEach((o, i) => (o.visible = restore[i]));
  return target;
}

/** Points the environment-reflecting materials of `root` (optionally filtered) at `env`. */
export function applyEnvironment(root: THREE.Object3D, env: THREE.Texture, accept: (m: THREE.MeshStandardMaterial) => boolean = () => true): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of list) {
      const std = m as THREE.MeshStandardMaterial;
      if (!std.isMeshStandardMaterial || !accept(std)) continue;
      // Same map type and size as before keeps the compiled program; only a first map recompiles.
      if (!std.envMap) std.needsUpdate = true;
      std.envMap = env;
    }
  });
}

export interface GlitterUniforms {
  uGlitterSun: THREE.IUniform<THREE.Vector3>;
  uGlitter: THREE.IUniform<number>;
}

export interface TranslucencyOptions {
  /** Back-lit glow colour (sRGB hex). */
  color: number;
  /** Strength of the light passing through towards the camera. */
  scale: number;
  /** Sharpness of the back-lit lobe. */
  power: number;
  /** Normal distortion of the lobe (how far round the edges the glow wraps). */
  distortion: number;
  /** Glow present whatever the light direction (internal scattering of the sky light). */
  ambient: number;
}

interface PhysicalPatch {
  /** `edge`: how much darker the body reads where it is seen through its thick rim. */
  milk?: { color: number; amount: number; edge: number };
  translucency?: TranslucencyOptions;
  glitter?: GlitterUniforms;
  fire?: number;
  /** Share of one internal bounce (cut crystal brilliance), with `fire`. */
  inner?: number;
  /** How far each facet's refraction direction is scattered (kaleidoscope), with `fire`. */
  scatter?: number;
  /** How much darker the deepest facets read, with `fire`. */
  shade?: number;
  /** Strength and density (cells per unit) of the internal facets, with `fire`. */
  internal?: number;
  cellScale?: number;
  key: string;
}

/**
 * Extends MeshPhysicalMaterial:
 * - milk: the refracted background is whitened by internal scattering (frosted, milky glass);
 * - translucency: sunlight passing through thin glass glows towards the camera;
 * - glitter: fine sparkles in the frosted petals;
 * - fire: per-facet brightness and a restrained spectral tint (cut crystal).
 */
function patchPhysical(m: THREE.MeshPhysicalMaterial, patch: PhysicalPatch): void {
  const uniforms: Record<string, THREE.IUniform> = {};
  if (patch.milk) {
    uniforms.uMilkColor = { value: new THREE.Color(patch.milk.color) };
    uniforms.uMilk = { value: patch.milk.amount };
    uniforms.uMilkEdge = { value: patch.milk.edge };
  }
  if (patch.translucency) {
    const t = patch.translucency;
    uniforms.uTransColor = { value: new THREE.Color(t.color) };
    uniforms.uTransScale = { value: t.scale };
    uniforms.uTransPower = { value: t.power };
    uniforms.uTransDistortion = { value: t.distortion };
    uniforms.uTransAmbient = { value: t.ambient };
  }
  if (patch.glitter) Object.assign(uniforms, patch.glitter);
  if (patch.fire !== undefined) {
    uniforms.uFire = { value: patch.fire };
    uniforms.uInner = { value: patch.inner ?? 0 };
    uniforms.uScatter = { value: patch.scatter ?? 0.9 };
    uniforms.uShade = { value: patch.shade ?? 0.1 };
    uniforms.uInternal = { value: patch.internal ?? 0.6 };
    uniforms.uCellScale = { value: patch.cellScale ?? 5 };
  }
  m.userData.uniforms = uniforms;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    let pars = "";
    let main = "";
    if (patch.milk) {
      pars += "uniform vec3 uMilkColor;\nuniform float uMilk;\nuniform float uMilkEdge;\n";
      shader.fragmentShader = shader.fragmentShader.replace("#include <transmission_fragment>", milkTransmission(THREE.ShaderChunk.transmission_fragment));
    }
    if (patch.translucency) {
      pars += translucencyPars;
      main += translucencyMain;
    }
    if (patch.glitter) {
      pars += glitterFragmentPars;
      main += glitterFragmentMain;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${glitterVertexPars}`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>\n${glitterVertexMain}`);
    }
    if (patch.fire !== undefined) {
      pars += crystalFirePars;
      main += crystalFireMain;
      shader.fragmentShader = shader.fragmentShader.replace("#include <transmission_fragment>", facetedTransmission(THREE.ShaderChunk.transmission_fragment));
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${crystalVertexPars}`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>\n${crystalVertexMain}`);
    }
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${pars}`)
      .replace("#include <opaque_fragment>", `${main}\n#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `crystal-${patch.key}`;
}

/** Milky frosted glass of the petals: glossy shell, cloudy body, luminous when back-lit. */
export function frostedGlass(glitter: GlitterUniforms): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: COLORS.petal,
    transmission: 1,
    roughness: 0.32,
    metalness: 0,
    ior: 1.45,
    thickness: 0.6,
    attenuationColor: new THREE.Color(COLORS.petalAttenuation),
    attenuationDistance: 1.6,
    clearcoat: 0.6,
    clearcoatRoughness: 0.03,
    specularIntensity: 0.9,
    envMapIntensity: 0.9,
  });
  patchPhysical(m, {
    key: "petal",
    milk: { color: COLORS.petalMilk, amount: 0.07, edge: 0.5 },
    translucency: { color: 0xf2f1ee, scale: 0.12, power: 2.2, distortion: 0.35, ambient: 0.02 },
    glitter,
  });
  return m;
}

/** Champagne orb in the middle of the head: warm, translucent, lit from within. */
export function champagneGlass(): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: COLORS.champagne,
    transmission: 1,
    roughness: 0.28,
    ior: 1.45,
    thickness: 0.9,
    attenuationColor: new THREE.Color(COLORS.champagneDeep),
    attenuationDistance: 0.8,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    specularIntensity: 0.9,
    envMapIntensity: 1.3,
  });
  patchPhysical(m, {
    key: "champagne",
    milk: { color: COLORS.champagne, amount: 0.62, edge: 0.32 },
    translucency: { color: 0xffd596, scale: 0.6, power: 1.6, distortion: 0.5, ambient: 0.45 },
  });
  return m;
}

/** Cut crystal (leaves, base, sculptures): clear, high index, flat facets, restrained fire. */
export function crystal(opts: { dispersion?: number; thickness?: number; fire?: number; inner?: number; scatter?: number; shade?: number; internal?: number; cellScale?: number } = {}): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 1,
    roughness: 0.03,
    ior: 1.75,
    thickness: opts.thickness ?? 0.5,
    dispersion: opts.dispersion ?? 3,
    specularIntensity: 1,
    // The crystal geometries are non-indexed with one normal per facet already: interpolated
    // normals are exact and stable (derivative-based flat shading flickers on small facets).
    envMapIntensity: 0.75,
  });
  patchPhysical(m, {
    key: "crystal",
    fire: opts.fire ?? 1,
    inner: opts.inner ?? 0.25,
    scatter: opts.scatter ?? 0.9,
    shade: opts.shade ?? 0.1,
    internal: opts.internal ?? 0.6,
    cellScale: opts.cellScale ?? 5,
  });
  return m;
}

/** Solid glass rod (the stem): clear, but it gathers light along its length and glows a little. */
export function glassRod(): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 1,
    roughness: 0.04,
    ior: 1.5,
    thickness: 0.7,
    dispersion: 1.5,
    attenuationColor: new THREE.Color(0xf4ead8),
    attenuationDistance: 2,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    specularIntensity: 1,
    envMapIntensity: 2,
  });
  patchPhysical(m, { key: "rod", translucency: { color: 0xfff4e6, scale: 0.3, power: 3, distortion: 0.2, ambient: 0.1 } });
  return m;
}

/**
 * Per-triangle barycentric coordinates for the crystal's cut-edge lines. Every geometry drawn with
 * `crystal()` needs it (non-indexed, one facet per triangle).
 */
export function withFacetEdges<T extends THREE.BufferGeometry>(geometry: T): T {
  const g = geometry.index ? (geometry.toNonIndexed() as T) : geometry;
  const count = g.getAttribute("position").count;
  const bary = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) bary[i * 3 + (i % 3)] = 1;
  g.setAttribute("aBary", new THREE.BufferAttribute(bary, 3));
  return g;
}

/** Clear glass (panels, vase, bowl, blocks, orbs). */
export function clearGlass(opts: { thickness?: number; dispersion?: number; tint?: number; roughness?: number; ior?: number } = {}): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: opts.tint ?? 0xffffff,
    transmission: 1,
    roughness: opts.roughness ?? 0.02,
    ior: opts.ior ?? 1.5,
    thickness: opts.thickness ?? 0.15,
    dispersion: opts.dispersion ?? 0.4,
    specularIntensity: 1,
    // A second, perfectly smooth coat: crisp window highlights and bright rims on every edge.
    clearcoat: 1,
    clearcoatRoughness: 0.01,
    envMapIntensity: 2,
  });
}

/** Tileable value-noise heights → normal map (limestone grain). */
function noiseNormalMap(size: number, freq: number, strength: number, seed: number): THREE.DataTexture {
  const random = rng(seed);
  const grid = Array.from({ length: freq * freq }, () => random());
  const at = (x: number, y: number) => grid[((y % freq) + freq) % freq * freq + (((x % freq) + freq) % freq)];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let h = 0;
      let amp = 1;
      for (let o = 0; o < 4; o++) {
        const s = freq * 2 ** o;
        const fx = (x / size) * s;
        const fy = (y / size) * s;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const tx = smooth(fx - ix);
        const ty = smooth(fy - iy);
        const k = 2 ** o;
        const a = at(ix * k, iy * k);
        const b = at(ix * k + k, iy * k);
        const c = at(ix * k, iy * k + k);
        const d = at(ix * k + k, iy * k + k);
        h += (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty) * amp;
        amp *= 0.5;
      }
      height[y * size + x] = h;
    }
  }
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hl = height[y * size + ((x - 1 + size) % size)];
      const hr = height[y * size + ((x + 1) % size)];
      const hd = height[((y - 1 + size) % size) * size + x];
      const hu = height[((y + 1) % size) * size + x];
      const n = new THREE.Vector3((hl - hr) * strength, (hd - hu) * strength, 1).normalize();
      const i = (y * size + x) * 4;
      data[i] = (n.x * 0.5 + 0.5) * 255;
      data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** Warm mineral plaster / limestone: matte, a whisper of grain. */
export function limestone(): THREE.MeshStandardMaterial {
  const normalMap = noiseNormalMap(256, 8, 4, 7);
  normalMap.repeat.set(2, 2);
  return new THREE.MeshStandardMaterial({
    color: COLORS.limestone,
    roughness: 0.78,
    metalness: 0,
    normalMap,
    normalScale: new THREE.Vector2(0.05, 0.05),
    envMapIntensity: 0.4,
  });
}

/** Polished marble slabs (2 × 2 per texture) with soft warm veins, drawn once on a canvas. */
export function marbleTexture(seed = 3): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const random = rng(seed);
  ctx.fillStyle = "#f2ece2";
  ctx.fillRect(0, 0, size, size);
  // Per-slab tone and a broad cloudy variation.
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      const t = random();
      ctx.fillStyle = `rgba(${236 + 12 * t | 0}, ${228 + 12 * t | 0}, ${216 + 12 * t | 0}, 0.6)`;
      ctx.fillRect(tx * 512, ty * 512, 512, 512);
      for (let k = 0; k < 6; k++) {
        const g = ctx.createRadialGradient(tx * 512 + random() * 512, ty * 512 + random() * 512, 0, tx * 512 + 256, ty * 512 + 256, 200 + random() * 200);
        g.addColorStop(0, `rgba(226, 214, 198, ${0.12 + random() * 0.12})`);
        g.addColorStop(1, "rgba(226, 214, 198, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(tx * 512, ty * 512, 512, 512);
      }
    }
  }
  // Veins: long soft strokes, a few crisp.
  ctx.lineCap = "round";
  for (let i = 0; i < 34; i++) {
    let x = random() * size;
    let y = random() * size;
    let a = random() * Math.PI * 2;
    const crisp = random() < 0.3;
    ctx.strokeStyle = `rgba(${150 + random() * 40 | 0}, ${138 + random() * 35 | 0}, ${122 + random() * 30 | 0}, ${crisp ? 0.18 + random() * 0.14 : 0.06 + random() * 0.08})`;
    ctx.lineWidth = crisp ? 0.6 + random() * 1.2 : 2 + random() * 5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const steps = 30 + random() * 70;
    for (let s = 0; s < steps; s++) {
      a += (random() - 0.5) * 0.45;
      x += Math.cos(a) * 9;
      y += Math.sin(a) * 9;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Fine joints between the slabs.
  ctx.strokeStyle = "rgba(150, 138, 124, 0.9)";
  ctx.lineWidth = 2.5;
  for (const p of [1, 512, 1023]) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}
