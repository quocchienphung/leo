import * as THREE from "three";
import { glitterFragmentMain, glitterFragmentPars, glitterVertexMain, glitterVertexPars, milkTransmission, translucencyMain, translucencyPars } from "../../shaders/crystal";
import { traceFragmentMain, traceFragmentPars, traceVertexMain, traceVertexPars } from "../../shaders/crystalTrace";

/*
 * Materials of the crystal pavilion. Colours are sRGB hex converted to linear by three (the scene
 * is lit physically and tone mapped by CrystalPost). Reference samples (7 × 7 px averages):
 * petals in half shade #ccbfb5, centre #f6d6aa → #e9c995 at the rim, eyes #5f4f3e,
 * limestone #efe7d8 lit / #b1a59f shade, lit floor #f8e1c9.
 */
export const COLORS = {
  sun: 0xffd9a8,
  petal: 0xf1efeb,
  petalMilk: 0xfdf7ee,
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
export function captureEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene, position: THREE.Vector3, hide: THREE.Object3D[], size = 256): THREE.WebGLRenderTarget {
  const restore = hide.map((o) => o.visible);
  for (const o of hide) o.visible = false;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0, 0.05, 1500, { size, position });
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
  /** Thin bright rim line, independent of the flakes. */
  uGlitterRim: THREE.IUniform<number>;
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
  /** 1: the whole body glows (orb); 0: only the thick rim does (petals, stem). */
  body: number;
}

interface PhysicalPatch {
  /** `edge`: how much darker the body reads where it is seen through its thick rim. */
  milk?: { color: number; amount: number; edge: number };
  translucency?: TranslucencyOptions;
  glitter?: GlitterUniforms;
  key: string;
}

/** `src.replace(anchor, …)` that says so in development when three's chunk no longer has the anchor. */
function inject(src: string, anchor: string, replacement: string, where: string): string {
  if (!src.includes(anchor) && process.env.NODE_ENV !== "production") console.warn(`crystal material: anchor ${anchor} missing (${where})`);
  return src.replace(anchor, replacement);
}

/**
 * Extends MeshPhysicalMaterial:
 * - milk: the refracted background is whitened by internal scattering (frosted, milky glass);
 * - translucency: sunlight passing through thin glass glows towards the camera;
 * - glitter: fine sparkles in the frosted petals.
 * `userData.uniforms` lists the added uniforms (debug toggles).
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
    uniforms.uTransBody = { value: t.body };
  }
  if (patch.glitter) Object.assign(uniforms, patch.glitter);
  m.userData.uniforms = uniforms;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    let pars = "";
    let main = "";
    if (patch.milk) {
      pars += "uniform vec3 uMilkColor;\nuniform float uMilk;\nuniform float uMilkEdge;\n";
      shader.fragmentShader = inject(shader.fragmentShader, "#include <transmission_fragment>", milkTransmission(THREE.ShaderChunk.transmission_fragment), patch.key);
    }
    if (patch.translucency) {
      pars += translucencyPars;
      main += translucencyMain;
    }
    if (patch.glitter) {
      pars += glitterFragmentPars;
      main += glitterFragmentMain;
      shader.vertexShader = inject(shader.vertexShader, "#include <common>", `#include <common>\n${glitterVertexPars}`, patch.key);
      shader.vertexShader = inject(shader.vertexShader, "#include <begin_vertex>", `#include <begin_vertex>\n${glitterVertexMain}`, patch.key);
    }
    shader.fragmentShader = inject(shader.fragmentShader, "#include <common>", `#include <common>\n${pars}`, patch.key);
    shader.fragmentShader = inject(shader.fragmentShader, "#include <opaque_fragment>", `${main}\n#include <opaque_fragment>`, patch.key);
  };
  m.customProgramCacheKey = () => `crystal-${patch.key}`;
}

/**
 * Frosted crystal of the daisy petals (target: clear rounded crystal with a fine frost, bright
 * selective rims, depth in the body). A smooth clear coat over a lightly frosted, lightly clouded
 * body; the sun glows only along the thick rims; sparse filtered sparkle.
 */
export function frostedGlass(glitter: GlitterUniforms): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: COLORS.petal,
    transmission: 1,
    // Light frost within a polished body; transmission must retain the scene's fine detail.
    roughness: 0.095,
    metalness: 0,
    ior: 1.5,
    thickness: 0.22,
    attenuationColor: new THREE.Color(COLORS.petalAttenuation),
    attenuationDistance: 3,
    clearcoat: 1,
    clearcoatRoughness: 0.015,
    specularIntensity: 1,
    envMapIntensity: 1,
  });
  patchPhysical(m, {
    key: "petal",
    // Negative edge: light piped along the thick rim makes it brighter, as in cast glass.
    milk: { color: COLORS.petalMilk, amount: 0.075, edge: -0.2 },
    translucency: { color: 0xfff6ea, scale: 0.3, power: 2.5, distortion: 0.3, ambient: 0.04, body: 0.16 },
    glitter,
  });
  return m;
}

/** Champagne orb in the middle of the head: warm, satin, softly lit from within. */
export function champagneGlass(): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xf7deaa,
    transmission: 1,
    roughness: 0.08,
    ior: 1.45,
    thickness: 0.9,
    attenuationColor: new THREE.Color(0xf1ca8d),
    attenuationDistance: 2.5,
    clearcoat: 0.9,
    clearcoatRoughness: 0.035,
    specularIntensity: 1,
    envMapIntensity: 1.1,
  });
  patchPhysical(m, {
    key: "champagne",
    milk: { color: 0xf7deaa, amount: 0.16, edge: 0.08 },
    translucency: { color: 0xffdbad, scale: 0.18, power: 2, distortion: 0.4, ambient: 0.09, body: 0.7 },
  });
  return m;
}

export interface TraceOptions {
  ior?: number;
  /** IOR spread between the red and the blue rays (fire). */
  spread?: number;
  /** Body colour (sRGB) reached after `depth` object-space units inside the stone; omitted → clear. */
  tint?: number;
  depth?: number;
  /** How far behind the stone the refraction buffer is sampled (world units). */
  backDist?: number;
  /** Sun glints seen through the stone. */
  sparkle?: number;
  bounces?: number;
  envGain?: number;
}

/** Loop bounds for the plane count (programs are shared within a bucket). */
const PLANE_BUCKETS = [16, 32, 64, 128, 256] as const;

/** The planes of a solid as a 1-row float texture (shared by every material tracing that solid). */
const planeTextures = new WeakMap<THREE.Vector4[], THREE.DataTexture>();
function planeTexture(planes: THREE.Vector4[]): THREE.DataTexture {
  let tex = planeTextures.get(planes);
  if (tex) return tex;
  const data = new Float32Array(Math.max(1, planes.length) * 4);
  planes.forEach((p, i) => data.set([p.x, p.y, p.z, p.w], i * 4));
  tex = new THREE.DataTexture(data, Math.max(1, planes.length), 1, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  planeTextures.set(planes, tex);
  return tex;
}

/**
 * Cut crystal with real light paths (shaders/crystalTrace.ts) through the convex solid `planes`.
 * Clear by default; `tint` + `depth` give coloured crystal (Beer–Lambert over the traced length):
 * pale where the path is short, saturated where it is long. Dispose the material's
 * `userData.planeTexture` with the solid.
 */
export function tracedCrystal(planes: THREE.Vector4[], opts: TraceOptions = {}): THREE.MeshPhysicalMaterial {
  const size = PLANE_BUCKETS.find((b) => b >= planes.length) ?? PLANE_BUCKETS[PLANE_BUCKETS.length - 1];
  if (planes.length > size && process.env.NODE_ENV !== "production") console.warn(`tracedCrystal: ${planes.length} planes > ${size}`);
  const ior = opts.ior ?? 1.58;
  const absorb = new THREE.Vector3();
  if (opts.tint !== undefined) {
    const c = new THREE.Color(opts.tint);
    const d = opts.depth ?? 0.2;
    absorb.set(-Math.log(Math.max(c.r, 1e-3)) / d, -Math.log(Math.max(c.g, 1e-3)) / d, -Math.log(Math.max(c.b, 1e-3)) / d);
  }
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 1,
    roughness: 0.008,
    metalness: 0,
    ior,
    thickness: 0,
    specularIntensity: 1,
    envMapIntensity: 1,
  });
  const bounces = opts.bounces ?? 4;
  m.defines = { TRACE_PLANES: size, TRACE_BOUNCES: bounces };
  const uniforms: Record<string, THREE.IUniform> = {
    uPlanes: { value: planeTexture(planes) },
    uPlaneCount: { value: planes.length },
    uTraceIor: { value: ior },
    uSpread: { value: opts.spread ?? 0.012 },
    uAbsorb: { value: absorb },
    uBackDist: { value: opts.backDist ?? 0.6 },
    uSparkle: { value: opts.sparkle ?? 1 },
    uEnvGain: { value: opts.envGain ?? 1 },
    uFacetWidth: { value: Math.max(...planes.map((p) => Math.abs(p.w)), 0.001) * 0.0015 },
  };
  m.userData.uniforms = uniforms;
  m.userData.traced = true;
  m.userData.planeTexture = uniforms.uPlanes.value;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = inject(shader.vertexShader, "#include <common>", `#include <common>\n${traceVertexPars}`, "trace");
    shader.vertexShader = inject(shader.vertexShader, "#include <worldpos_vertex>", `#include <worldpos_vertex>\n${traceVertexMain}`, "trace");
    shader.fragmentShader = inject(shader.fragmentShader, "#include <transmission_pars_fragment>", `#include <transmission_pars_fragment>\n${traceFragmentPars}`, "trace");
    shader.fragmentShader = inject(shader.fragmentShader, "#include <transmission_fragment>", traceFragmentMain, "trace");
  };
  m.customProgramCacheKey = () => `crystal-trace-${size}-${bounces}`;
  return m;
}

/** Disposes a material and, for traced crystal, the plane texture it reads. */
export function disposeMaterial(m: THREE.Material): void {
  (m.userData.planeTexture as THREE.Texture | undefined)?.dispose();
  m.dispose();
}

/** Champagne gold-tone metal (Florere stems, calyces, filaments). */
export function goldMetal(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({ color: 0xe6cf98, metalness: 1, roughness: 0.12, envMapIntensity: 1.25, clearcoat: 0.4, clearcoatRoughness: 0.04 });
}

/** Green lacquered metal (Lily of the Valley stems and leaves): opaque glossy paint. */
export function greenLacquer(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({ color: 0x2f8f2c, metalness: 0.15, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1, side: THREE.DoubleSide });
}

/** Solid glass rod (the daisy stem): clear, a little light gathered along its length. */
export function glassRod(): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 1,
    roughness: 0.02,
    ior: 1.5,
    thickness: 0.13,
    dispersion: 0.4,
    attenuationColor: new THREE.Color(0xf6efe2),
    attenuationDistance: 3,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    specularIntensity: 1,
    envMapIntensity: 1.8,
  });
  // Only a thin back-lit rim: the rod reads as clear glass with specular edges, not an ivory stick.
  patchPhysical(m, { key: "rod", translucency: { color: 0xfff4e6, scale: 0.12, power: 3, distortion: 0.2, ambient: 0.02, body: 0 } });
  return m;
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
