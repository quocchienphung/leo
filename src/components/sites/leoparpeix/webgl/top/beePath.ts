// Playground content-bee choreography, ported verbatim from the source (bundle ~50179–50590).
// The bee leaves the hero, dives into the media grid following a scroll-driven path, lands,
// then takes off again before the footer. All values are in top-camera world units except
// scroll positions (CSS px).

import { offsetRect } from "../../core/math";
import { isDesktopWidth } from "../../core/env";

export interface ZoneRect {
  top: number;
  y: number;
  height: number;
  width: number;
}

export interface BeeLayout {
  topZoneRect: ZoneRect;
  innerRect: ZoneRect;
  bottomZoneRect: ZoneRect;
  bandHeight: number;
}

function zoneRect(el: HTMLElement): ZoneRect {
  const r = offsetRect(el);
  return { top: r.top, y: r.top, height: r.height > 0 ? r.height : window.innerHeight, width: r.width };
}

/** Source `vW` */
export function measureBeeLayout(top: HTMLElement | null, inner: HTMLElement | null, bottom: HTMLElement | null): BeeLayout | null {
  if (!top || !inner || !bottom) return null;
  const t = zoneRect(top);
  return { topZoneRect: t, innerRect: zoneRect(inner), bottomZoneRect: zoneRect(bottom), bandHeight: t.height > 0 ? t.height : window.innerHeight * 0.5 };
}

const vh = (pct: number) => window.innerHeight * (pct / 100);

export const revealAnimStart = (l: BeeLayout) => l.topZoneRect.top - vh(8); // AI
export const topStart = (l: BeeLayout) => l.topZoneRect.top + vh(6); // _A
export const entryAnimStart = (l: BeeLayout) => l.topZoneRect.top + vh(14); // od
export const revealAnimEnd = (l: BeeLayout) => l.topZoneRect.top + l.bandHeight * 1 + vh(110); // ll
const revealEnd = (l: BeeLayout) => l.topZoneRect.top + l.bandHeight; // bW
export const hideEnd = (l: BeeLayout) => l.innerRect.top + l.innerRect.height; // gI
export const blockStart = (l: BeeLayout) => l.topZoneRect.top; // Lh
const blockEnd = (l: BeeLayout) => l.bottomZoneRect.top + l.bottomZoneRect.height; // xA

function exitBase(l: BeeLayout, footer = Infinity) {
  return Number.isFinite(footer) && footer > 0 ? footer : blockEnd(l); // CW
}
/** Source `vA` */
export function contentBeeEnd(l: BeeLayout, footer = Infinity): number {
  const t = exitBase(l, footer);
  if (!Number.isFinite(t) || t <= 0) return blockEnd(l);
  return t + vh(35);
}
const exitEnd = contentBeeEnd; // yA

const IW = 2.65;
const RW = 2.3;
const BW = 0.25;
const qg = 0.35;
const DW = 6;
const PW = -0.5;
const LW = 1.55;
const OW = 1.75;
const Kd = 0.4;
const Xo = 0.6;
const FW = 0.78;
const NW = 0.52;
const kW = 0.55;
const UW = 0.85;
const GW = 5;
const HW = 0.5;
const CS = -0.9;
const Oh = 0.95;
const QW = -0.35;
const zW = 20;
const VW = 130;
const WW = 0.012;
const yI = 0.16;

function exitSpan(l: BeeLayout, footer = Infinity) {
  const start = topStart(l);
  const end = exitEnd(l, footer);
  const length = end - start;
  return { start, mid: start + length * BW, end, length };
} // C0
const hideStart = (l: BeeLayout, footer = Infinity) => exitSpan(l, footer).mid; // mI / _I

/** Source `vI` */
export const isPastFooterStart = (s: number, footer = Infinity) => Number.isFinite(footer) && footer > 0 && s >= footer;

/** Source `MW`: hero bee hidden once the content zone starts. */
export function heroBeeSuppressed(s: number, l: BeeLayout | null, fallbackStart = 0): boolean {
  if (!isDesktopWidth()) return false;
  const start = isValidLayout(l) ? blockStart(l) : fallbackStart;
  return start ? s >= start : false;
}

const easeOutCubic = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3; // Tp
const mix = (a: number, b: number, t: number) => a + (b - a) * t; // Mu
function smootherstep(t: number) {
  const e = Math.min(1, Math.max(0, t));
  return e * e * e * (e * (e * 6 - 15) + 10);
} // Er
const powClamp = (t: number, e = 3) => Math.min(1, Math.max(0, t)) ** e; // XW
function exitDiveCurve(t: number) {
  const e = Math.min(1, Math.max(0, t));
  if (e <= qg) return 0;
  return powClamp((e - qg) / (1 - qg), DW);
} // qW
function entryProgress(s: number, l: BeeLayout) {
  const a = entryAnimStart(l);
  const b = revealAnimEnd(l);
  return s <= a ? 0 : s >= b ? 1 : (s - a) / (b - a);
} // EA
function exitProgress(s: number, l: BeeLayout, footer = Infinity) {
  const { mid, end } = exitSpan(l, footer);
  const r = end - mid;
  return r <= 0 ? (s >= end ? 1 : 0) : s <= mid ? 0 : s >= end ? 1 : (s - mid) / r;
} // M0
const pathEndScroll = (l: BeeLayout, footer = Infinity) => {
  const { start, length } = exitSpan(l, footer);
  return start + length * FW;
}; // xI
function pathProgress(s: number, l: BeeLayout, footer = Infinity) {
  const a = revealAnimEnd(l);
  const b = pathEndScroll(l, footer);
  return b <= a || s <= a ? 0 : s >= b ? 1 : (s - a) / (b - a);
} // I0
function approachCurve(t: number) {
  if (t <= NW) return smootherstep(t / NW);
  if (t <= kW) return 1;
  if (t <= UW) return smootherstep((UW - t) / (UW - kW));
  return 0;
} // Y_
function landCurve(t: number) {
  if (t <= Xo) return 0;
  if (t >= Oh) return 1;
  return smootherstep((t - Xo) / (Oh - Xo));
} // jW
const landBlend = (t: number, takeoff: number) => (takeoff > 0 ? 1 - takeoff : landCurve(t)); // EI
function pathWeight(s: number, l: BeeLayout, footer = Infinity) {
  const n = entryAnimStart(l);
  const sEnd = revealAnimEnd(l);
  const r = hideStart(l, footer);
  const o = exitEnd(l, footer);
  if (s < n) return 0;
  if (s < sEnd) return smootherstep(easeOutCubic(entryProgress(s, l)));
  if (s < r) return 1;
  if (s >= o) return 0;
  return smootherstep(1 - easeOutCubic(exitProgress(s, l, footer)));
} // R0
function landScroll(l: BeeLayout, footer = Infinity) {
  const a = revealAnimEnd(l);
  const b = pathEndScroll(l, footer);
  const span = b - a;
  return span <= 0 ? b : a + span * Oh;
} // KW
function takeoffProgress(s: number, l: BeeLayout, footer = Infinity) {
  const start = landScroll(l, footer) + vh(zW);
  const dur = vh(VW);
  if (dur <= 0 || s <= start) return 0;
  if (s >= start + dur) return 1;
  return smootherstep(smootherstep((s - start) / dur));
} // SI
function pathShape(t: number, half: number) {
  const n = Math.min(1, Math.max(0, t));
  const s = PW * half;
  const r = LW * half;
  const o = OW * half;
  const a = approachCurve(n);
  let x: number;
  let post = 0;
  if (n <= Kd) x = mix(s, r, smootherstep(n / Kd));
  else if (n <= Xo) x = mix(r, o, smootherstep((n - Kd) / (Xo - Kd)));
  else if (n <= Oh) {
    const d = smootherstep((n - Xo) / (Oh - Xo));
    const target = mix(o, CS * half, d);
    x = mix(o, 0, d);
    post = target - x;
  } else {
    x = 0;
    post = CS * half;
  }
  return { x, postLandOffsetX: post, skyZ: GW * a, approach: a };
} // JW
function cameraOffset(s: number, l: BeeLayout, camH: number) {
  if (!isValidLayout(l)) return 0;
  const half = camH / 2;
  if (s < entryAnimStart(l)) return half;
  if (s < revealAnimEnd(l)) return half * (1 - easeOutCubic(entryProgress(s, l)));
  return 0;
} // ZW

function beeY(s: number, l: BeeLayout, half: number, footer = Infinity) {
  if (!isValidLayout(l)) return 0;
  const start = blockStart(l);
  const end = exitEnd(l, footer);
  const o = entryAnimStart(l);
  const a = revealAnimEnd(l);
  const mid = hideStart(l, footer);
  const h = blockEnd(l) - start;
  const up = half * IW;
  const down = half * RW;
  if (h <= 0 || a - o <= 0) return 0;
  if (s <= o) return up;
  if (s >= end) return -down;
  if (s >= mid && end - mid > 0) return -down * exitDiveCurve(exitProgress(s, l, footer));
  if (s < a) return up * (1 - easeOutCubic(entryProgress(s, l)));
  return 0;
} // e5

interface BeeFrame {
  x: number;
  y: number;
  z: number;
  skyZ: number;
  pathSkyZ: number;
  landSkyZ: number;
  landSkyApproach: number;
  approach: number;
  pathProgress: number;
  pathBlend: number;
}

function frame(s: number, l: BeeLayout, camH: number, footer = Infinity, freezePathBlend = false): BeeFrame {
  const half = camH / 2;
  const y = beeY(s, l, half, footer);
  const blend = freezePathBlend ? 1 : pathWeight(s, l, footer);
  const pp = pathProgress(s, l, footer);
  const shape = pathShape(pp, half);
  const xPath = shape.x * blend + shape.postLandOffsetX;
  const takeoff = takeoffProgress(s, l, footer);
  const land = landBlend(pp, takeoff);
  const x = mix(xPath, QW * half, takeoff);
  const pathSky = shape.skyZ * blend;
  const landSky = land * HW;
  return {
    x,
    y,
    z: 0,
    skyZ: pathSky + landSky,
    pathSkyZ: pathSky,
    landSkyZ: landSky,
    landSkyApproach: land,
    approach: Math.min(1, shape.approach * blend + land),
    pathProgress: pp,
    pathBlend: blend,
  };
} // X_

function heading(s: number, l: BeeLayout, camH: number, footer = Infinity) {
  const d = Math.max(1, window.innerHeight * 0.002);
  const a = frame(s, l, camH, footer);
  const b = frame(s + d, l, camH, footer);
  const dx = b.x - a.x;
  const dy = b.y - a.y + d * WW;
  return Math.hypot(dx, dy) < 1e-8 ? 0 : Math.atan2(dx, dy);
} // t5
function approachSlope(t: number) {
  const e = Math.min(1, Math.max(0, t));
  const k = 0.001;
  const d = (approachCurve(Math.min(1, e + k)) - approachCurve(e)) / k;
  return Math.abs(d) < 1e-6 ? 0 : d;
} // n5
function landSlope(t: number, takeoff: number) {
  const n = landBlend(t, takeoff);
  if (takeoff > 0) return (landBlend(t, Math.min(1, takeoff + 0.001)) - n) / 0.001;
  return t <= Xo ? 0 : (landBlend(Math.min(1, t + 0.001), 0) - n) / 0.001;
} // i5
function pitch(s: number, l: BeeLayout, footer = Infinity) {
  const r = approachSlope(pathProgress(s, l, footer));
  return Math.abs(r) < 1e-8 ? 0 : r * yI * pathWeight(s, l, footer);
} // s5
function landPitch(s: number, l: BeeLayout, footer = Infinity) {
  const o = landSlope(pathProgress(s, l, footer), takeoffProgress(s, l, footer));
  return Math.abs(o) < 1e-8 ? 0 : o * yI * pathWeight(s, l, footer);
} // r5

export interface BeePose extends BeeFrame {
  heading: number;
  pitch: number;
  landPitch: number;
}

/** Source `wI` */
export function beePose(s: number, l: BeeLayout, camH: number, footer = Infinity, freezePathBlend = false): BeePose {
  return { ...frame(s, l, camH, footer, freezePathBlend), heading: heading(s, l, camH, footer), pitch: pitch(s, l, footer), landPitch: landPitch(s, l, footer) };
}

/** Source `q_`: content bee visible. */
export const contentBeeVisible = (s: number, l: BeeLayout, footer = Infinity) => s >= topStart(l) && s < contentBeeEnd(l, footer);

/** Source `o5`: camera tracks the bee. */
export function contentBeeCameraActive(s: number, l: BeeLayout, footer = Infinity): boolean {
  if (s < topStart(l) || isPastFooterStart(s, footer)) return false;
  return s < contentBeeEnd(l, footer);
}

/** Source `qc` */
export function isValidLayout(l: BeeLayout | null | undefined): l is BeeLayout {
  return !!l && !!l.topZoneRect && !!l.innerRect && !!l.bottomZoneRect && l.bandHeight > 0 && l.innerRect.height > 0;
}

/** Source `$W` (only the camera Y is consumed by the top camera). */
export function contentBeeCameraY(s: number, l: BeeLayout, camH: number): number | null {
  if (!isValidLayout(l)) return null;
  return cameraOffset(s, l, camH);
}

/** Source `a5`: DOM rect → top-camera world size. */
export function domToWorldSize(rect: { width: number; height: number }, dims: { width: number; height: number }) {
  return { width: (rect.width / window.innerWidth) * dims.width, height: (rect.height / window.innerHeight) * dims.height };
}

export { blockEnd, revealEnd };
