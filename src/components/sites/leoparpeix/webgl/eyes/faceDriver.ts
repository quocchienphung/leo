import * as THREE from "three";
import { leo } from "../../core/app";
import { emitter } from "../../core/emitter";
import { BloubEyes, FOLLOW_TOUR, blockDuration, followLook, type ExpressionId, type StateId } from "./bloubEyes";

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

/** The two bloub eyes in face space, as shader uniforms (see `eyeSdfChunk`). */
export interface EyeUniforms {
  uInv: THREE.IUniform<THREE.Vector4[]>;
  uOffset: THREE.IUniform<THREE.Vector2[]>;
  uSize: THREE.IUniform<THREE.Vector2[]>;
  uAlpha: THREE.IUniform<number[]>;
}

export function createEyeUniforms(): EyeUniforms {
  return {
    uInv: { value: [new THREE.Vector4(), new THREE.Vector4()] },
    uOffset: { value: [new THREE.Vector2(), new THREE.Vector2()] },
    uSize: { value: [new THREE.Vector2(), new THREE.Vector2()] },
    uAlpha: { value: [0, 0] },
  };
}

/**
 * GLSL: coverage of the two bloub eyes at face point `b` (bloub face space: sphere radius 1,
 * +x screen-right, +y down). Needs `EyeUniforms`.
 */
export const eyeSdfChunk = /* glsl */ `
uniform vec4 uInv[2]; // column-major inverse eye matrix
uniform vec2 uOffset[2];
uniform vec2 uSize[2];
uniform float uAlpha[2];

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

float eyes(vec2 b) {
  return max(eye(0, b), eye(1, b));
}
`;

/**
 * Drives the bloub eyes of a daisy face: the montage of states, the expression rotation and the
 * pointer follow, all started by the loader reveal, and writes them into `EyeUniforms`.
 */
export class FaceDriver {
  private readonly eyes = new BloubEyes(1, MONTAGE[0].state, "neutre");
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

  constructor() {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch") this.pointer = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => {
      this.pointer = null;
    };
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    this.offs.push(() => window.removeEventListener("pointermove", onMove), () => document.removeEventListener("pointerleave", onLeave));
    if (leo.isLoaderRevealComplete) this.start();
    else this.offs.push(emitter.on("loaderRevealComplete", () => this.start()));
  }

  /** The loader reveal starts the montage (bloub `playing`) and the expression rotation. */
  private start(): void {
    if (this.startedAt !== null) return;
    this.startedAt = this.clock;
    this.block = 0;
    this.eyes.reset(MONTAGE[0].state, this.clock);
    this.blockEnd = this.clock + MONTAGE[0].duration;
    this.nextExprAt = this.clock + EXPRESSION_MS / 1000;
  }

  /**
   * `et` in ms (app ticker). Mirrors bloub `Ql`'s frame: blocks → follow → sample.
   * `centreWorld`: the face centre in world space (the eyes look from there towards the pointer).
   */
  update(et: number, camera: THREE.Camera, centreWorld: THREE.Vector3, u: EyeUniforms): void {
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

    if (this.startedAt !== null) this.follow(t, camera, centreWorld);

    const inv = u.uInv.value;
    const off = u.uOffset.value;
    const size = u.uSize.value;
    const alpha = u.uAlpha.value;
    alpha[0] = alpha[1] = 0;
    this.eyes.sample(t).forEach((s, i) => {
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
  private follow(t: number, camera: THREE.Camera, centreWorld: THREE.Vector3): void {
    if (!this.eyes.baseFace) {
      if (this.following) {
        this.eyes.setLook(null, t, FOLLOW_TOUR);
        this.following = false;
      }
      return;
    }
    if (!this.following) this.tourFrom = t;
    // Pointer offset from the face centre, in half-viewports.
    this.projected.copy(centreWorld).project(camera);
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
  }
}
