/*
 * Eye + expression + state animation ported from bloub (https://github.com/jeremy-prt/bloub),
 * read from the production bundle `assets/index-DEPWyZKN.js`: `us`, `hs`, `ms`, `ys`, `Cs`, `dc`
 * (states), `tc`, `ks`, `Os`, `lc`, `As`, `Fs`, `Rc` and the `zc` controller.
 *
 * MIT License — Copyright (c) 2026 Jérémy Perret
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software
 * and associated documentation files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions: The above copyright notice
 * and this permission notice shall be included in all copies or substantial portions of the
 * Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
 *
 * Only the eyes are ported: the body silhouette is kept as 64 radii because bloub uses it to place
 * the eyes, but it is never drawn (no body, dots, arcs or notification badge). The base shape is
 * the circle, whose eye offsets (`Pc`) are 0 for every state/expression. Units are bloub "scale"
 * units: face sphere radius 1 × `scale`, +y down (SVG space).
 */

import { CAPSULE, DROP, EGG, HEXAGON, TRIANGLE } from "./bloubShapes";

const TAU = Math.PI * 2; // Y
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v); // X
const lerp = (a: number, b: number, t: number) => a + (b - a) * t; // Z
const easeOutQuint = (t: number) => 1 - (1 - t) ** 5; // Io.easeOutQuint
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2); // Io.easeInOutCubic
const rad = (d: number) => (d * Math.PI) / 180; // cs

/** `Lo`: three-octave periodic noise. */
function wave(t: number, period: number, phase = 0): number {
  const r = (t / period) * TAU;
  return 0.55 * Math.sin(r + phase) + 0.3 * Math.sin(2 * r + phase * 1.7 + 1.1) + 0.15 * Math.sin(3 * r + phase * 2.3 + 2.4);
}

/** `Ro`: seeded PRNG. */
function seeded(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 1831565813) >>> 0;
    let e = Math.imul(t ^ (t >>> 15), 1 | t);
    e = (e + Math.imul(e ^ (e >>> 7), 61 | e)) ^ e;
    return ((e ^ (e >>> 14)) >>> 0) / 4294967296;
  };
}

/** `fs`: blink start times (seed 24301), 18% chance of a double blink. */
const BLINK_TIMES: number[] = (() => {
  const rnd = seeded(24301);
  const out: number[] = [];
  let t = 1.4;
  while (t < 900) {
    out.push(t);
    t += 1.9 + rnd() * 2.7;
    if (rnd() < 0.18) {
      out.push(t);
      t += 0.24;
    }
  }
  return out;
})();
const BLINK_DURATION = 0.18; // ps

/** `ms`: eyelid openness (1 open → 0 closed → 1). */
function lidAt(t: number): number {
  for (const start of BLINK_TIMES) {
    if (t < start) break;
    const r = (t - start) / BLINK_DURATION;
    if (r >= 0 && r <= 1) return r < 0.45 ? 1 - r / 0.45 : (r - 0.45) / 0.55;
  }
  return 1;
}

/** `hs`: idle wander, blink and float. */
function idleMotion(t: number, wander: number, blink: boolean) {
  return {
    dYaw: (wave(t, 11.3, 0.4) * 5.5 + wave(t, 3.7, 2.1) * 1.6) * wander,
    dPitch: (wave(t, 9.1, 1.3) * 4.2 + wave(t, 4.3, 0.7) * 1.3) * wander,
    dRoll: wave(t, 13.7, 3.2) * 2.2 * wander,
    lid: blink ? lidAt(t) : 1,
    driftX: wave(t, 7.9, 1.9) * 0.006,
    driftY: wave(t, 5.3, 0.3) * 0.007,
  };
}

/** `gs`: openness never fully collapses. */
const openScale = (v: number) => 0.06 + 0.94 * clamp01(v);

/* ------------------------------------------------------------------ expressions */

export interface Gaze {
  yaw: number;
  pitch: number;
  roll: number;
}
export interface EyeShape {
  w: number;
  h: number;
  tilt: number;
  open: number;
}
export type ExpressionId =
  | "neutre" | "attentif" | "surpris" | "excite" | "heureux" | "hilare" | "colere" | "triste"
  | "effraye" | "mefiant" | "confus" | "curieux" | "fier" | "timide" | "blase" | "somnolent";
export interface Expression {
  id: ExpressionId;
  gaze: Gaze;
  split: number;
  eyes: [EyeShape, EyeShape];
}

const eye = (w: number, h: number, tilt = 0, open = 1): EyeShape => ({ w, h, tilt, open }); // _s
const pair = (w: number, h: number, tilt = 0, open = 1): [EyeShape, EyeShape] => [eye(w, h, tilt, open), eye(w, h, -tilt, open)]; // vs
const same = (w: number, h: number): [EyeShape, EyeShape] => [eye(w, h), eye(w, h)]; // ec

const NEUTRAL_GAZE: Gaze = { yaw: 28.49, pitch: 28.62, roll: -13 }; // ss
const NEUTRAL_SPLIT = 15.46; // is

/** `ys`: the 16 expressions, verbatim. */
export const EXPRESSIONS: Expression[] = [
  { id: "neutre", gaze: { ...NEUTRAL_GAZE }, split: NEUTRAL_SPLIT, eyes: [eye(0.186, 0.412), eye(0.186, 0.412)] },
  { id: "attentif", gaze: { yaw: 4, pitch: 5, roll: -4 }, split: 16, eyes: pair(0.21, 0.44) },
  { id: "surpris", gaze: { yaw: 3, pitch: -3, roll: 0 }, split: 19, eyes: pair(0.45, 0.47) },
  { id: "excite", gaze: { yaw: 6, pitch: -14, roll: 0 }, split: 19.5, eyes: pair(0.4, 0.56, -10) },
  { id: "heureux", gaze: { yaw: 5, pitch: 9, roll: 0 }, split: 17, eyes: pair(0.27, 0.17, 14) },
  { id: "hilare", gaze: { yaw: 4, pitch: 14, roll: 0 }, split: 18, eyes: pair(0.34, 0.13, 20) },
  { id: "colere", gaze: { yaw: 3, pitch: 7, roll: 0 }, split: 17, eyes: pair(0.34, 0.15, 30) },
  { id: "triste", gaze: { yaw: 3, pitch: -13, roll: 0 }, split: 16, eyes: pair(0.22, 0.4, -28) },
  { id: "effraye", gaze: { yaw: 2, pitch: -20, roll: 0 }, split: 20.5, eyes: pair(0.4, 0.6) },
  { id: "mefiant", gaze: { yaw: 12, pitch: 6, roll: -6 }, split: 16, eyes: [eye(0.21, 0.4), eye(0.22, 0.15)] },
  { id: "confus", gaze: { yaw: -14, pitch: 3, roll: 8 }, split: 16.5, eyes: [eye(0.2, 0.44, -18), eye(0.28, 0.17, 14)] },
  { id: "curieux", gaze: { yaw: 16, pitch: -9, roll: -15 }, split: 16.5, eyes: [eye(0.24, 0.46, -8), eye(0.2, 0.38, -8)] },
  { id: "fier", gaze: { yaw: 5, pitch: 17, roll: 0 }, split: 17, eyes: pair(0.3, 0.15, 18) },
  { id: "timide", gaze: { yaw: -19, pitch: -14, roll: -7 }, split: 14, eyes: pair(0.17, 0.3) },
  { id: "blase", gaze: { yaw: -22, pitch: 2, roll: 0 }, split: 16, eyes: pair(0.3, 0.12) },
  { id: "somnolent", gaze: { yaw: 6, pitch: -9, roll: -3 }, split: 16, eyes: pair(0.2, 0.42, 0, 0.42) },
];
export const EXPRESSION_BY_ID = new Map(EXPRESSIONS.map((e) => [e.id, e]));

const lerpEye = (a: EyeShape, b: EyeShape, t: number): EyeShape => ({
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
  tilt: lerp(a.tilt, b.tilt, t),
  open: lerp(a.open, b.open, t),
}); // Ss / Lc
const lerpGaze = (a: Gaze, b: Gaze, t: number): Gaze => ({ yaw: lerp(a.yaw, b.yaw, t), pitch: lerp(a.pitch, b.pitch, t), roll: lerp(a.roll, b.roll, t) });

/** `Cs`. */
function lerpExpression(a: Expression, b: Expression, t: number): Expression {
  return { id: b.id, gaze: lerpGaze(a.gaze, b.gaze, t), split: lerp(a.split, b.split, t), eyes: [lerpEye(a.eyes[0], b.eyes[0], t), lerpEye(a.eyes[1], b.eyes[1], t)] };
}

/* ------------------------------------------------------------------ silhouettes + poses */

interface Silhouette {
  radii: readonly number[];
  rot: number;
}
const CIRCLE: readonly number[] = new Array(64).fill(1);
const circle = (k: number, rot = 0): Silhouette => ({ radii: new Array(64).fill(k), rot }); // ks
const triangle = (rot: number): Silhouette => ({ radii: TRIANGLE, rot }); // lc

/** `As` (radii + shortest rotation; centre/scale do not affect the eyes). */
function lerpSilhouette(a: Silhouette, b: Silhouette, t: number): Silhouette {
  const radii = new Array<number>(64);
  for (let i = 0; i < 64; i++) radii[i] = lerp(a.radii[i] ?? 1, b.radii[i] ?? 1, t);
  let d = b.rot - a.rot;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return { radii, rot: a.rot + d * t };
}

/** `Fs`: silhouette radius at an angle. */
function radiusAt(radii: readonly number[], angle: number): number {
  const n = radii.length;
  const r = (((angle / TAU) % 1) + 1) % 1 * n;
  const i = Math.floor(r);
  return lerp(radii[i % n] ?? 1, radii[(i + 1) % n] ?? 1, r - i);
}

/** The eye-relevant part of a bloub pose (`tc`). */
interface Pose {
  sil: Silhouette;
  gaze: Gaze;
  split: number;
  eyes: [EyeShape, EyeShape];
  eyeAlpha: number;
}
const pose = (p: Partial<Pose> = {}): Pose => ({
  sil: circle(1),
  gaze: { ...NEUTRAL_GAZE },
  split: NEUTRAL_SPLIT,
  eyes: same(0.186, 0.412),
  eyeAlpha: 1,
  ...p,
});

/** `Rc` (eye-relevant fields). */
function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    sil: lerpSilhouette(a.sil, b.sil, t),
    gaze: lerpGaze(a.gaze, b.gaze, t),
    split: lerp(a.split, b.split, t),
    eyes: [lerpEye(a.eyes[0], b.eyes[0], t), lerpEye(a.eyes[1], b.eyes[1], t)],
    eyeAlpha: lerp(a.eyeAlpha, b.eyeAlpha, t),
  };
}

export type StateId =
  | "idle" | "thinking" | "wink" | "wide" | "alert" | "notify" | "exclaim" | "sleep" | "egg"
  | "hexagon" | "play" | "orbit" | "swirl" | "burst" | "comet";
interface StateDef {
  id: StateId;
  duration: number;
  minDuration?: number;
  morph: number;
  blinkIn: boolean;
  baseFace: boolean;
  baseBody: boolean;
  pose: (t: number) => Pose;
}

/** `uc`: the thinking dots' pulse. */
function pulse(t: number, k: number): number {
  const n = ((((t - k * 0.5) / 1.5) % 1) + 1) % 1;
  return clamp01((n < 0.5 ? 0.5 - 0.5 * Math.cos(n * TAU) : 0) * 2);
}
const THINK_DOT = 0.165; // Go
const THINK_GROW = 1.25; // Ko
const COMET_MIN = 0.129; // Qo

/** `dc`: every bloub state, verbatim (eye-relevant fields only). */
export const STATES: StateDef[] = [
  { id: "idle", duration: 2.4, morph: 0.45, blinkIn: false, baseFace: true, baseBody: true, pose: () => pose() },
  {
    id: "thinking", duration: 2.6, morph: 0.4, baseFace: false, baseBody: false, blinkIn: true,
    pose: (e) => pose({ sil: circle(THINK_DOT * (1 + (THINK_GROW - 1) * pulse(e, 1))), eyeAlpha: 0 }),
  },
  {
    id: "wink", duration: 1.6, morph: 0.3, blinkIn: true, baseFace: false, baseBody: true,
    pose: () => pose({ gaze: { yaw: -5.37, pitch: 4.55, roll: 6.7 }, split: 16.25, eyes: [eye(0.236, 0.464), eye(0.447, 0.089)] }),
  },
  {
    id: "wide", duration: 1.8, morph: 0.55, blinkIn: true, baseFace: false, baseBody: true,
    pose: () => pose({ gaze: { yaw: 6.92, pitch: -21.96, roll: 11.6 }, split: 18.43, eyes: same(0.356, 0.875) }),
  },
  {
    id: "alert", duration: 2.4, minDuration: 2, morph: 0.45, baseFace: false, baseBody: false, blinkIn: false,
    pose: () => pose({ sil: { radii: CAPSULE, rot: (17.7 * Math.PI) / 180 }, eyeAlpha: 0 }),
  },
  {
    id: "notify", duration: 2.2, morph: 0.5, blinkIn: true, baseFace: false, baseBody: true,
    pose: () => pose({ gaze: { yaw: -21.94, pitch: -5.82, roll: -12.2 }, split: 18.89, eyes: same(0.505, 0.498) }),
  },
  { id: "exclaim", duration: 2, morph: 0.45, baseFace: false, baseBody: false, blinkIn: false, pose: () => pose({ sil: { radii: DROP, rot: 0 }, eyeAlpha: 0 }) },
  { id: "sleep", duration: 2.4, morph: 0.5, baseFace: false, baseBody: false, blinkIn: false, pose: () => pose({ sil: circle(0.1585), eyeAlpha: 0 }) },
  {
    id: "egg", duration: 1.8, morph: 0.4, baseFace: false, baseBody: false, blinkIn: true,
    pose: () => pose({ sil: { radii: EGG, rot: 0 }, gaze: { yaw: 19.97, pitch: 26.01, roll: -17.1 }, split: 11.07, eyes: same(0.164, 0.385) }),
  },
  {
    id: "hexagon", duration: 1.6, morph: 0.4, baseFace: false, baseBody: false, blinkIn: true,
    pose: () => pose({ sil: { radii: HEXAGON, rot: 0 }, gaze: { yaw: 23.11, pitch: 24.42, roll: -13.3 }, split: 13.37, eyes: same(0.177, 0.411) }),
  },
  {
    id: "play", duration: 2, morph: 0.5, baseFace: false, baseBody: false, blinkIn: true,
    pose: () => pose({ sil: triangle(0), gaze: { yaw: 12, pitch: -8, roll: -6 }, split: 15, eyes: same(0.18, 0.34) }),
  },
  {
    id: "orbit", duration: 3.4, minDuration: 2.5, morph: 0.6, baseFace: false, baseBody: false, blinkIn: false,
    pose: (e) => {
      const t = easeInOutCubic(clamp01(e / 0.35));
      const n = -TAU * 1.25 * e * t;
      const r = easeInOutCubic(clamp01((e - 1.6) / 0.9));
      const radii = TRIANGLE.map((v) => v + (1 - v) * r); // lc(n) → ks(1) by r
      return pose({
        sil: { radii, rot: n },
        gaze: { yaw: NEUTRAL_GAZE.yaw + Math.sin(e * 6.5) * 65 * (1 - r), pitch: -4 + r * 32, roll: -13 },
        eyes: same(0.18, 0.34 + r * 0.07),
      });
    },
  },
  { id: "swirl", duration: 1.3, minDuration: 1.3, morph: 0.3, baseFace: true, baseBody: true, blinkIn: true, pose: () => pose() },
  {
    id: "burst", duration: 2.6, minDuration: 2.4, morph: 0.4, baseFace: false, baseBody: false, blinkIn: false,
    pose: (e) => {
      const t = 1 - 0.834 * easeOutQuint(clamp01(e / 0.7));
      const n = easeOutQuint(clamp01((e - 1.7) / 0.7));
      return pose({ sil: circle(t + (1 - t) * n), eyeAlpha: clamp01((e - 1.85) / 0.4) });
    },
  },
  {
    id: "comet", duration: 2.4, minDuration: 2.4, morph: 0.45, baseFace: false, baseBody: false, blinkIn: false,
    pose: (e) => {
      const t = 1 - (1 - COMET_MIN) * easeOutQuint(clamp01(e / 0.55));
      const n = easeOutQuint(clamp01((e - 1.85) / 0.6));
      return pose({ sil: circle(t + (1 - t) * n), eyeAlpha: clamp01((e - 2) / 0.35) });
    },
  },
];
export const STATE_BY_ID = new Map(STATES.map((s) => [s.id, s]));
const MAX_MORPH = Math.max(...STATES.map((s) => s.morph)); // gl

/** `bl(state, duration)`: timeline block length (0.1 s steps, ≥ the state's minimum, ≤ 10 s). */
export function blockDuration(id: StateId, seconds = STATE_BY_ID.get(id)?.duration ?? 2): number {
  const min = Math.max(MAX_MORPH, STATE_BY_ID.get(id)?.minDuration ?? MAX_MORPH);
  const snapped = Math.round(seconds / 0.1) * 0.1;
  return Math.round(Math.min(10, Math.max(min, snapped)) * 100) / 100;
}

/* ------------------------------------------------------------------ projection */

type Vec3 = [number, number, number];
/** `ls`: rotate the (e, t) basis pair by n radians. */
function rotatePair(e: Vec3, t: Vec3, n: number): [Vec3, Vec3] {
  const c = Math.cos(n);
  const s = Math.sin(n);
  return [
    [e[0] * c + t[0] * s, e[1] * c + t[1] * s, e[2] * c + t[2] * s],
    [t[0] * c - e[0] * s, t[1] * c - e[1] * s, t[2] * c - e[2] * s],
  ];
}

interface EyeFrame {
  x: number;
  y: number;
  a: number;
  b: number;
  c: number;
  d: number;
  depth: number;
}
/** `us`: both eye centres on the sphere + their projected tangent basis. */
function eyeFrames(g: Gaze, scale: number, split: number): [EyeFrame, EyeFrame] {
  let fwd: Vec3 = [0, 0, 1];
  let right: Vec3 = [1, 0, 0];
  let up: Vec3 = [0, 1, 0];
  [fwd, right] = rotatePair(fwd, right, rad(g.yaw));
  [up, fwd] = rotatePair(up, fwd, rad(g.pitch));
  [right, up] = rotatePair(right, up, rad(g.roll));
  const at = (side: number): EyeFrame => {
    const [p, tangent] = rotatePair(fwd, right, rad(split * side));
    return { x: p[0] * scale, y: p[1] * scale, a: tangent[0], b: tangent[1], c: up[0], d: up[1], depth: p[2] };
  };
  return [at(-1), at(1)];
}

/* ------------------------------------------------------------------ look */

export interface Look {
  yaw: number;
  pitch: number;
  mix: number;
  spin: number;
  wander: number;
}
const REST_LOOK: Look = { yaw: 0, pitch: 0, mix: 0, spin: 0, wander: 1 }; // Fc
const lerpLook = (a: Look, b: Look, t: number): Look => ({
  yaw: lerp(a.yaw, b.yaw, t),
  pitch: lerp(a.pitch, b.pitch, t),
  mix: lerp(a.mix, b.mix, t),
  spin: lerp(a.spin, b.spin, t),
  wander: lerp(a.wander, b.wander, t),
}); // Ic

/** bloub `hl` (follow mode): pointer offset in [-1, 1] → look target; `tour` 0→1 spins once. */
export function followLook(nx: number, ny: number, tour: number, pointer: boolean, base: { yaw: number; pitch: number } = { yaw: -26, pitch: 10 }): Look {
  return { yaw: base.yaw + nx * 16, pitch: base.pitch - ny * 13, mix: tour, spin: 360 * (1 - tour), wander: pointer ? 0 : 1 };
}
export const FOLLOW_TOUR = 1.1; // dl

/* ------------------------------------------------------------------ controller */

/** One rendered eye: stadium of size (w, h) in scale units, placed by a 2D affine matrix. */
export interface EyeSample {
  w: number;
  h: number;
  /** SVG `matrix(a, b, c, d, e, f)`: x' = a·x + c·y + e, y' = b·x + d·y + f. */
  m: [number, number, number, number, number, number];
  alpha: number;
}

/** bloub `zc` (eyes only) on a circle body. Times are seconds on the caller's clock. */
export class BloubEyes {
  static readonly SHAPE_MORPH = 0.45;
  static readonly LOOK_MORPH = 0.24;

  private cur: StateId;
  private prev: StateId | null = null;
  private departFige: Pose | null = null;
  private tCur = 0;
  private tPrev = 0;
  private blinkAt = -10;
  private expr: Expression | null;
  private exprPrev: Expression | null = null;
  private exprAt = -10;
  private look: Look = REST_LOOK;
  private lookPrev: Look = REST_LOOK;
  private lookAt = -10;
  private lookMorph = BloubEyes.LOOK_MORPH;

  constructor(
    private readonly scale = 1,
    state: StateId = "idle",
    expression: ExpressionId | null = "neutre",
  ) {
    this.cur = state;
    this.expr = expression ? (EXPRESSION_BY_ID.get(expression) ?? null) : null;
  }

  get state(): StateId {
    return this.cur;
  }
  get expression(): ExpressionId | null {
    return this.expr?.id ?? null;
  }
  /** Whether the current state shows the expression (and so may follow the pointer). */
  get baseFace(): boolean {
    return STATE_BY_ID.get(this.cur)?.baseFace ?? false;
  }

  setExpression(id: ExpressionId, t: number): void {
    const next = EXPRESSION_BY_ID.get(id) ?? null;
    if (next === this.expr) return;
    this.exprPrev = this.expr;
    this.expr = next;
    this.exprAt = t;
  }

  private exprAtTime(t: number): Expression | null {
    const n = this.expr;
    const r = this.exprPrev;
    if (!n || !r) return n;
    const k = (t - this.exprAt) / BloubEyes.SHAPE_MORPH;
    return k >= 1 ? n : lerpExpression(r, n, easeOutQuint(clamp01(k)));
  }

  setLook(look: Look | null, t: number, morph = BloubEyes.LOOK_MORPH): void {
    if (look && !Number.isFinite(look.yaw + look.pitch + look.mix + look.spin + look.wander)) return;
    this.lookPrev = this.lookAtTime(t);
    this.look = look ?? REST_LOOK;
    this.lookAt = t;
    this.lookMorph = morph;
  }

  private lookAtTime(t: number): Look {
    const k = (t - this.lookAt) / this.lookMorph;
    return k >= 1 ? this.look : lerpLook(this.lookPrev, this.look, easeOutQuint(clamp01(k)));
  }

  private posed(def: StateDef, t: number, expr: Expression | null): Pose {
    let p = def.pose(t);
    if (def.baseBody) p = { ...p, sil: { ...p.sil, radii: CIRCLE } };
    if (def.baseFace && expr) p = { ...p, gaze: expr.gaze, split: expr.split, eyes: expr.eyes };
    return p;
  }

  private origin(t: number, expr: Expression | null): Pose | null {
    if (this.departFige) return this.departFige;
    if (!this.prev) return null;
    return this.posed(STATE_BY_ID.get(this.prev) as StateDef, Math.max(0, t - this.tPrev), expr);
  }

  private composed(t: number): Pose {
    const def = STATE_BY_ID.get(this.cur) as StateDef;
    const expr = this.exprAtTime(t);
    const p = this.posed(def, Math.max(0, t - this.tCur), expr);
    const a = t - this.tCur;
    if (a >= def.morph) return p;
    const o = this.origin(t, expr);
    return o ? lerpPose(o, p, easeOutQuint(clamp01(a / def.morph))) : p;
  }

  /** `setState`: morph from the current (possibly mid-morph, frozen) pose; may blink in. */
  setState(id: StateId, t: number): void {
    if (id === this.cur) return;
    const morph = (STATE_BY_ID.get(this.cur) as StateDef).morph;
    const midMorph = this.prev !== null && t - this.tCur < morph;
    this.departFige = midMorph ? this.composed(t) : null;
    this.prev = this.cur;
    this.tPrev = this.tCur;
    this.cur = id;
    this.tCur = t;
    if (STATE_BY_ID.get(id)?.blinkIn) this.blinkAt = t;
  }

  reset(id: StateId, t: number): void {
    this.cur = id;
    this.prev = null;
    this.departFige = null;
    this.tCur = t;
    this.tPrev = t;
    this.blinkAt = -10;
  }

  sample(t: number): EyeSample[] {
    const s = this.scale;
    const def = STATE_BY_ID.get(this.cur) as StateDef;
    const expr = this.exprAtTime(t);
    let a = this.posed(def, Math.max(0, t - this.tCur), expr);
    const since = t - this.tCur;
    const o = since < def.morph ? this.origin(t, expr) : null;
    if (o) a = lerpPose(o, a, easeOutQuint(clamp01(since / def.morph)));

    const visible = a.eyeAlpha > 0.01;
    const look = this.lookAtTime(t);
    const idle = idleMotion(t, visible ? look.wander : 0, visible);
    const gaze: Gaze = {
      yaw: lerp(a.gaze.yaw, look.yaw, look.mix) + idle.dYaw - look.spin,
      pitch: lerp(a.gaze.pitch, look.pitch, look.mix) + idle.dPitch,
      roll: a.gaze.roll + idle.dRoll,
    };
    const p = clamp01((t - this.blinkAt) / 0.2);
    const blinkIn = p < 1 ? Math.abs(p * 2 - 1) : 1;
    const lid = Math.min(idle.lid, blinkIn);
    const out: EyeSample[] = [];
    if (!visible) return out;
    const frames = eyeFrames(gaze, s, a.split);
    for (let n = 0; n < 2; n++) {
      const r = frames[n];
      if (r.depth <= 0.02) continue;
      const e = a.eyes[n];
      const k = radiusAt(a.sil.radii, Math.atan2(r.y, r.x) - a.sil.rot);
      const c = rad(e.tilt ?? 0);
      const cos = Math.cos(c);
      const sin = Math.sin(c);
      const ma = r.a * cos + r.c * sin;
      const mb = r.b * cos + r.d * sin;
      const mc = -r.a * sin + r.c * cos;
      const md = -r.b * sin + r.d * cos;
      const v = openScale(Math.min(lid, e.open));
      out.push({
        w: e.w * s,
        h: e.h * s,
        m: [ma, mb * v, mc, md * v, r.x * k + idle.driftX * s, r.y * k + idle.driftY * s],
        alpha: a.eyeAlpha * clamp01(r.depth / 0.12),
      });
    }
    return out;
  }
}
