import * as THREE from "three";
import { leo } from "../../core/app";
import { emitter } from "../../core/emitter";
import { BloubEyes, FOLLOW_TOUR, blockDuration, followLook, type ExpressionId, type StateId } from "./bloubEyes";

/*
 * Both daisies (home workshop `scene_v9.glb`, about landscape `scene_v15.glb`, mesh `TexFleur`) are
 * the same sculpt: a 161-vertex heart dome with a face made of four decal components on its front
 * (eyes 2×108 vertices, moustache 2×80). The face is also painted into the dome's baked texture,
 * so the decals are removed and the shell below repaints that area from its surroundings, then
 * draws the bloub eyes on the dome surface.
 *
 * Every value below was measured by decoding the Draco meshes (local mesh space):
 * - centre: dome front point; radius: half the in-plane extent (= bloub's body radius 1);
 * - down: from the eye decals' midpoint to the moustache's; right: between the eye decals, signed
 *   so that right × up points out of the face;
 * - in face coordinates b = (dot(p − centre, right), dot(p − centre, down)) / radius the original
 *   eyes sit at (±0.116, −0.047) and the moustache at (0, 0.06) on both flowers;
 * - dome UVs near the face are planar in b: least squares over the 65 dome vertices within
 *   |b| < 0.6 gives uv = uv0 + b.x·uvX + b.y·uvY (max residual 0.51 texel home, 0.67 about).
 */
export interface FaceConfig {
  /** Local boxes used to recognise the dome and the four face decals. */
  domeMin: THREE.Vector3;
  domeMax: THREE.Vector3;
  decalMin: THREE.Vector3;
  decalMax: THREE.Vector3;
  centre: THREE.Vector3;
  right: THREE.Vector3;
  down: THREE.Vector3;
  radius: number;
  uv0: THREE.Vector2;
  uvX: THREE.Vector2;
  uvY: THREE.Vector2;
}

/** Home workshop daisy: faces +X (camera looks down −X), no node transform. */
export const HOME_FACE: FaceConfig = {
  domeMin: new THREE.Vector3(2.69, 2.4, -0.45),
  domeMax: new THREE.Vector3(2.945, 3.3, 0.45),
  decalMin: new THREE.Vector3(2.93, 2.79, -0.12),
  decalMax: new THREE.Vector3(2.95, 2.9, 0.12),
  centre: new THREE.Vector3(2.937613, 2.851011, -0.001568),
  right: new THREE.Vector3(0, 0, -1),
  down: new THREE.Vector3(0, -1, 0),
  radius: 0.4427,
  uv0: new THREE.Vector2(0.106888, 0.317972),
  uvX: new THREE.Vector2(-0.05224, 0.027145),
  uvY: new THREE.Vector2(-0.027151, -0.052306),
};

/** About potted daisy: faces local +Y; its node rotation/scale turn it towards the camera. */
export const ABOUT_FACE: FaceConfig = {
  domeMin: new THREE.Vector3(-1.2, 0.08, 1.12),
  domeMax: new THREE.Vector3(-0.3, 0.335, 2.02),
  decalMin: new THREE.Vector3(-0.83, 0.32, 1.48),
  decalMax: new THREE.Vector3(-0.64, 0.34, 1.64),
  centre: new THREE.Vector3(-0.750757, 0.327834, 1.572851),
  right: new THREE.Vector3(-0.79453, 0, -0.607225),
  down: new THREE.Vector3(0.607225, 0, -0.79453),
  radius: 0.4419,
  uv0: new THREE.Vector2(0.175193, 0.877481),
  uvX: new THREE.Vector2(0.040488, 0.078094),
  uvY: new THREE.Vector2(-0.078129, 0.040435),
};

/** Painted face area to repaint (ellipse in b units) and one of its ink eyes (same on both). */
const PAINT_CENTER = new THREE.Vector2(0, -0.03);
const PAINT_RADII = new THREE.Vector2(0.42, 0.2);
const INK_SPOT = new THREE.Vector2(0.116, -0.048);

/**
 * Expressions rotate like bloub's Settings mode (`b.value === 'reglages'`): through `fl` every
 * `qp` = 4.2s, starting from the default (`xs` = neutre). They show in the face states (idle, swirl).
 */
const EXPRESSION_CYCLE: ExpressionId[] = ["surpris", "heureux", "hilare", "excite", "fier", "blase"]; // fl
const EXPRESSION_MS = 4200; // qp
/** bloub's follow base (−26°, 10°) aims at its own layout; the flower looks straight ahead. */
const FOLLOW_BASE = { yaw: 0, pitch: 0 };
/**
 * bloub's default montage (`mc`) plus `swirl`, played like its player (`Ql`), keeping every state
 * that shows eyes. `thinking`, `alert`, `exclaim` and `sleep` are left out: their poses set
 * `eyeAlpha: 0` for the whole block (the body turns into dots / a drop / a ball), so on the daisy
 * they would only blank the face. The idle block is lengthened (bloub blocks are editable up to
 * 10s) so the expression cycle has time to show.
 */
const MONTAGE: { state: StateId; duration: number }[] = [
  { state: "idle", duration: blockDuration("idle", 8.4) },
  ...(["wink", "wide", "notify", "egg", "hexagon", "play", "orbit", "burst", "comet", "swirl"] as StateId[]).map((state) => ({
    state,
    duration: blockDuration(state),
  })),
];
/** Baked shading carried onto the ink: dome brightness relative to the face centre, clamped. */
const SHADE_RANGE = new THREE.Vector2(0.6, 1.15);

interface Component {
  vertices: number[];
  min: THREE.Vector3;
  max: THREE.Vector3;
}

function components(geometry: THREE.BufferGeometry): Component[] {
  const pos = geometry.getAttribute("position");
  const index = geometry.getIndex();
  if (!index) return [];
  const parent = new Int32Array(pos.count);
  for (let i = 0; i < parent.length; i++) parent[i] = i;
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  for (let i = 0; i < index.count; i += 3) {
    const a = find(index.getX(i));
    parent[find(index.getX(i + 1))] = a;
    parent[find(index.getX(i + 2))] = a;
  }
  const groups = new Map<number, Component>();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const root = find(i);
    let c = groups.get(root);
    if (!c) {
      c = { vertices: [], min: new THREE.Vector3(Infinity, Infinity, Infinity), max: new THREE.Vector3(-Infinity, -Infinity, -Infinity) };
      groups.set(root, c);
    }
    c.vertices.push(i);
    v.fromBufferAttribute(pos, i);
    c.min.min(v);
    c.max.max(v);
  }
  return [...groups.values()];
}

const inside = (c: Component, min: THREE.Vector3, max: THREE.Vector3) =>
  c.min.x >= min.x && c.min.y >= min.y && c.min.z >= min.z && c.max.x <= max.x && c.max.y <= max.y && c.max.z <= max.z;

/** Removes the sculpted face decals and returns the dome triangles, or null when not recognised. */
function stripFace(geometry: THREE.BufferGeometry, cfg: FaceConfig): THREE.BufferGeometry | null {
  const comps = components(geometry);
  const decals = comps.filter((c) => inside(c, cfg.decalMin, cfg.decalMax));
  const dome = comps.find((c) => c.vertices.length > 120 && inside(c, cfg.domeMin, cfg.domeMax));
  if (decals.length !== 4 || !dome) return null;

  const drop = new Uint8Array(geometry.getAttribute("position").count);
  for (const c of decals) for (const i of c.vertices) drop[i] = 1;
  const inDome = new Uint8Array(drop.length);
  for (const i of dome.vertices) inDome[i] = 1;

  const index = geometry.getIndex() as THREE.BufferAttribute;
  const kept: number[] = [];
  const domeTris: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    if (drop[a]) continue;
    kept.push(a, b, c);
    if (inDome[a]) domeTris.push(a, b, c);
  }
  geometry.setIndex(kept);

  // Shell over the dome: the exact same vertices, drawn with a polygon offset.
  const shell = new THREE.BufferGeometry();
  shell.setAttribute("position", geometry.getAttribute("position"));
  shell.setIndex(domeTris);
  shell.computeBoundingSphere();
  return shell;
}

const vertex = /* glsl */ `out vec3 vPos;
void main() {
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragment = /* glsl */ `precision highp float;
uniform sampler2D uTexture;
uniform vec3 uCenter;
uniform vec3 uRight;
uniform vec3 uDown;
uniform float uRadius;
uniform vec2 uUv0;
uniform vec2 uUvX;
uniform vec2 uUvY;
uniform vec2 uPaintCenter;
uniform vec2 uPaintRadii;
uniform vec2 uInkSpot;
uniform vec2 uShade;
uniform vec4 uInv[2]; // column-major inverse eye matrix
uniform vec2 uOffset[2];
uniform vec2 uSize[2];
uniform float uAlpha[2];
in vec3 vPos;
out vec4 fragColor;

vec3 dome(vec2 b) {
  return texture(uTexture, uUv0 + b.x * uUvX + b.y * uUvY).rgb;
}

// Repaint the baked face: blend the horizontal and vertical interpolations between the colours
// just outside the ellipse, each weighted by how close its edge is.
vec3 repaint(vec2 b, out float inside) {
  vec2 q = (b - uPaintCenter) / uPaintRadii;
  float r = length(q);
  inside = 1.0 - smoothstep(0.92, 1.0, r);
  if (inside <= 0.0) return vec3(0.0);
  const float margin = 0.03;
  float hx = uPaintRadii.x * sqrt(max(1.0 - q.y * q.y, 0.0));
  float vy = uPaintRadii.y * sqrt(max(1.0 - q.x * q.x, 0.0));
  float xL = uPaintCenter.x - hx, xR = uPaintCenter.x + hx;
  float yT = uPaintCenter.y - vy, yB = uPaintCenter.y + vy;
  vec3 h = mix(dome(vec2(xL - margin, b.y)), dome(vec2(xR + margin, b.y)), clamp((b.x - xL) / max(xR - xL, 1e-4), 0.0, 1.0));
  vec3 v = mix(dome(vec2(b.x, yT - margin)), dome(vec2(b.x, yB + margin)), clamp((b.y - yT) / max(yB - yT, 1e-4), 0.0, 1.0));
  float wh = 1.0 / (min(b.x - xL, xR - b.x) + margin);
  float wv = 1.0 / (min(b.y - yT, yB - b.y) + margin);
  return (h * wh + v * wv) / (wh + wv);
}

// Ink of the original painted eyes: darkest texel around one of them.
vec3 ink() {
  vec3 best = vec3(1.0);
  float lum = 1e9;
  for (int j = -4; j <= 4; j++) {
    for (int i = -4; i <= 4; i++) {
      vec3 c = dome(uInkSpot + vec2(float(i), float(j)) * 0.012);
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      if (l < lum) { lum = l; best = c; }
    }
  }
  return best;
}

// bloub stadium (Vs): w × h box with corner radius min(w, h) / 2.
float stadium(vec2 p, vec2 size) {
  vec2 h = max(size, vec2(0.01)) * 0.5;
  float r = min(h.x, h.y);
  vec2 d = abs(p) - h + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

float eye(int i, vec2 b) {
  float sd = stadium(mat2(uInv[i].xy, uInv[i].zw) * (b - uOffset[i]), uSize[i]);
  float aa = fwidth(sd);
  return (1.0 - smoothstep(-aa, aa, sd)) * uAlpha[i];
}

void main() {
  // bloub face space: sphere radius 1, +x screen-right, +y down.
  vec3 d = vPos - uCenter;
  vec2 b = vec2(dot(d, uRight), dot(d, uDown)) / uRadius;
  float a = max(eye(0, b), eye(1, b));
  float inside;
  vec3 base = repaint(b, inside);
  if (a <= 0.001 && inside <= 0.0) discard;
  vec3 eyeColor = vec3(0.0);
  if (a > 0.001) {
    // Painted on the surface: carry the dome's baked light (relative to the face centre) onto the ink.
    vec3 lit = inside > 0.0 ? mix(dome(b), base, inside) : dome(b);
    float centreInside;
    vec3 centre = repaint(uPaintCenter, centreInside);
    const vec3 luma = vec3(0.299, 0.587, 0.114);
    eyeColor = ink() * clamp(dot(lit, luma) / max(dot(centre, luma), 1e-3), uShade.x, uShade.y);
  }
  if (inside > 0.0) {
    // Inside the repainted area the shell is opaque: the baked face underneath is replaced.
    vec3 under = mix(dome(b), base, inside);
    fragColor = vec4(mix(under, eyeColor, a), 1.0);
  } else {
    fragColor = vec4(eyeColor, a);
  }
}`;

export class FlowerFace extends THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> {
  private readonly eyes = new BloubEyes(1, MONTAGE[0].state, "neutre");
  private readonly centerWorld = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();
  private clock = 0;
  private lastEt: number | null = null;
  private pointer: { x: number; y: number } | null = null;
  /** Montage/expression timeline start (the loader reveal), null before. */
  private startedAt: number | null = null;
  private block = 0;
  private blockEnd = Infinity;
  private exprIndex = 0;
  private nextExprAt = Infinity;
  /** bloub `te` / `E`: follow active, and when its spin (`tour`) started. */
  private following = false;
  private tourFrom = 0;
  private readonly offs: (() => void)[] = [];

  static attach(flower: THREE.Mesh, texture: THREE.Texture, cfg: FaceConfig): FlowerFace | null {
    const shell = stripFace(flower.geometry, cfg);
    if (!shell) {
      if (process.env.NODE_ENV !== "production") console.warn("[FlowerFace] TexFleur face/dome not found; face left untouched");
      return null;
    }
    const face = new FlowerFace(shell, cfg, texture);
    flower.add(face);
    return face;
  }

  private constructor(shell: THREE.BufferGeometry, cfg: FaceConfig, texture: THREE.Texture) {
    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        uTexture: { value: texture },
        uCenter: { value: cfg.centre },
        uRight: { value: cfg.right },
        uDown: { value: cfg.down },
        uRadius: { value: cfg.radius },
        uUv0: { value: cfg.uv0 },
        uUvX: { value: cfg.uvX },
        uUvY: { value: cfg.uvY },
        uPaintCenter: { value: PAINT_CENTER },
        uPaintRadii: { value: PAINT_RADII },
        uInkSpot: { value: INK_SPOT },
        uShade: { value: SHADE_RANGE },
        uInv: { value: [new THREE.Vector4(), new THREE.Vector4()] },
        uOffset: { value: [new THREE.Vector2(), new THREE.Vector2()] },
        uSize: { value: [new THREE.Vector2(), new THREE.Vector2()] },
        uAlpha: { value: [0, 0] },
      },
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
    });
    super(shell, material);
    this.name = "FlowerFace";
    this.frustumCulled = false;
    this.renderOrder = 1;
    this.centerWorld.copy(cfg.centre);

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch") this.pointer = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => {
      this.pointer = null;
    };
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    this.offs.push(() => window.removeEventListener("pointermove", onMove), () => document.removeEventListener("pointerleave", onLeave));
    if (leo.isLoaderRevealComplete) this.startFollow();
    else this.offs.push(emitter.on("loaderRevealComplete", () => this.startFollow()));
  }

  /** The loader reveal starts the montage (bloub `playing`) and the expression rotation. */
  private startFollow(): void {
    if (this.startedAt !== null) return;
    this.startedAt = this.clock;
    this.block = 0;
    this.eyes.reset(MONTAGE[0].state, this.clock);
    this.blockEnd = this.clock + MONTAGE[0].duration;
    this.nextExprAt = this.clock + EXPRESSION_MS / 1000;
  }

  /** `et` in ms (app ticker). Mirrors bloub `Ql`'s frame: blocks → follow → sample. */
  update(et: number, camera: THREE.Camera): void {
    const dt = this.lastEt === null ? 0 : Math.min((et - this.lastEt) / 1000, 0.064);
    this.lastEt = et;
    this.clock += dt;
    const t = this.clock;

    // Timeline blocks (`b((r.value + 1) % cycle.length)` → `u.setState(state, _)`).
    while (t >= this.blockEnd) {
      this.block = (this.block + 1) % MONTAGE.length;
      const next = MONTAGE[this.block];
      this.eyes.setState(next.state, t);
      this.blockEnd += next.duration;
    }
    while (t >= this.nextExprAt) {
      this.eyes.setExpression(EXPRESSION_CYCLE[this.exprIndex % EXPRESSION_CYCLE.length], t);
      this.exprIndex++;
      this.nextExprAt += EXPRESSION_MS / 1000;
    }

    if (this.startedAt !== null) this.follow(t, camera);

    const u = this.material.uniforms;
    const inv = u.uInv.value as THREE.Vector4[];
    const off = u.uOffset.value as THREE.Vector2[];
    const size = u.uSize.value as THREE.Vector2[];
    const alpha = u.uAlpha.value as number[];
    alpha[0] = alpha[1] = 0;
    const samples = this.eyes.sample(t);
    samples.forEach((s, i) => {
      const [a, b, c, d, e, f] = s.m;
      const det = a * d - c * b || 1e-6;
      // Inverse of [[a, c], [b, d]], stored column-major for mat2(col0, col1).
      inv[i].set(d / det, -b / det, -c / det, a / det);
      off[i].set(e, f);
      size[i].set(s.w, s.h);
      alpha[i] = s.alpha;
    });
  }

  /**
   * bloub `ie()` / `re()`: only face states follow the pointer. Each time following (re)starts the
   * eyes make one `tour` (360° spin over 1.1s, easeOutQuint); leaving a face state eases back to
   * rest over the same 1.1s.
   */
  private follow(t: number, camera: THREE.Camera): void {
    if (!this.eyes.baseFace) {
      if (this.following) {
        this.eyes.setLook(null, t, FOLLOW_TOUR);
        this.following = false;
      }
      return;
    }
    if (!this.following) this.tourFrom = t;
    // Pointer offset from the face centre, in half-viewports.
    this.projected.copy(this.centerWorld);
    this.localToWorld(this.projected);
    this.projected.project(camera);
    const p = this.pointer;
    const nx = p ? THREE.MathUtils.clamp((p.x / window.innerWidth) * 2 - 1 - this.projected.x, -1, 1) : 0;
    const ny = p ? THREE.MathUtils.clamp(-((-(p.y / window.innerHeight) * 2 + 1) - this.projected.y), -1, 1) : 0;
    const tour = 1 - (1 - THREE.MathUtils.clamp((t - this.tourFrom) / FOLLOW_TOUR, 0, 1)) ** 5;
    this.eyes.setLook(followLook(nx, ny, tour, p !== null, FOLLOW_BASE), t);
    this.following = true;
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
    this.material.dispose();
    this.geometry.dispose();
  }
}
