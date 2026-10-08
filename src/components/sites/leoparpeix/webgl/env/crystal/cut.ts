import * as THREE from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";
import { rng } from "./materials";

/*
 * Designed crystal cuts. Every solid here is the convex hull of points placed on purpose (rings,
 * rows, outlines), so its facets follow a cut pattern instead of random jitter. ConvexGeometry is
 * non-indexed with one normal per face: facets shade flat and exactly. `planes` are the solid's
 * faces (object space, outward normal, n·x = w) for the traced crystal material.
 */

export interface CutSolid {
  geometry: THREE.BufferGeometry;
  planes: THREE.Vector4[];
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Distinct face planes of a convex, non-indexed geometry (coplanar triangles merged). */
export function facePlanes(geometry: THREE.BufferGeometry): THREE.Vector4[] {
  const pos = geometry.getAttribute("position");
  const planes: THREE.Vector4[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const centroid = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) centroid.add(a.fromBufferAttribute(pos, i));
  centroid.divideScalar(Math.max(1, pos.count));
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.subVectors(c, b).cross(a.clone().sub(b));
    const area = n.length();
    if (area < 1e-9) continue;
    n.divideScalar(area);
    let w = n.dot(a);
    // Outward: the centroid is inside.
    if (n.dot(centroid) > w) {
      n.negate();
      w = -w;
    }
    if (planes.some((p) => p.x * n.x + p.y * n.y + p.z * n.z > 0.99995 && Math.abs(p.w - w) < 1e-4)) continue;
    planes.push(new THREE.Vector4(n.x, n.y, n.z, w));
  }
  return planes;
}

export function cutSolid(points: THREE.Vector3[]): CutSolid {
  const geometry = new ConvexGeometry(points);
  const planes = facePlanes(geometry);
  if (process.env.NODE_ENV !== "production") {
    // Every vertex must lie inside every plane: the tracer relies on it.
    const pos = geometry.getAttribute("position");
    const p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      if (planes.some((pl) => pl.x * p.x + pl.y * p.y + pl.z * p.z - pl.w > 1e-3)) {
        console.warn("cutSolid: hull is not convex", planes.length);
        break;
      }
    }
  }
  return { geometry, planes };
}

export interface Ring {
  y: number;
  r: number;
  n: number;
  /** Rotation in steps of the ring (0.5 = staggered). */
  phase?: number;
}

/**
 * Gem from horizontal rings (girdle, crown, table…): staggered rings make kite and triangle facets
 * in a regular pattern. `depth` squashes z; `wobble` (≤ 0.06) gives a hand-cut irregularity that is
 * fixed per stone (seed), never per frame.
 */
export function ringGem(rings: Ring[], opts: { depth?: number; wobble?: number; seed?: number; apexTop?: number; apexBottom?: number } = {}): CutSolid {
  const random = rng(opts.seed ?? 1);
  const wobble = opts.wobble ?? 0;
  const depth = opts.depth ?? 1;
  const pts: THREE.Vector3[] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.n; i++) {
      const a = ((i + (ring.phase ?? 0)) / ring.n) * Math.PI * 2;
      const r = ring.r * (1 + (random() - 0.5) * 2 * wobble);
      pts.push(v3(Math.cos(a) * r, ring.y + (random() - 0.5) * wobble * 0.3 * ring.r, Math.sin(a) * r * depth));
    }
  }
  if (opts.apexTop !== undefined) pts.push(v3(0, opts.apexTop, 0));
  if (opts.apexBottom !== undefined) pts.push(v3(0, opts.apexBottom, 0));
  return cutSolid(pts);
}

/**
 * Cut leaf (marquise-like): rows along the length, each with a girdle, a crown row and the midrib,
 * front higher than back. Local frame: base at the origin, tip at +y, width on x, front +z.
 * `bend` tilts the rows back along the length so the leaf arcs (the hull stays convex).
 */
export function cutLeaf(length: number, width: number, thickness: number, opts: { rows?: number; asym?: number; bend?: number } = {}): CutSolid {
  const rows = opts.rows ?? 6;
  const asym = opts.asym ?? 0.1;
  const pts: THREE.Vector3[] = [v3(0, 0, 0), v3(0, length, -(opts.bend ?? 0))];
  const g = thickness * 0.08;
  for (let k = 1; k < rows; k++) {
    const s = k / rows;
    const y = s * length;
    const half = (width / 2) * Math.sin(Math.PI * s) ** 0.75 * (1 + asym * Math.sin(Math.PI * 2 * s - 0.8));
    const ridge = (thickness / 2) * Math.sin(Math.PI * s) ** 0.6;
    const zb = -(opts.bend ?? 0) * s * s;
    for (const side of [-1, 1]) {
      pts.push(v3(side * half, y, zb + g), v3(side * half, y, zb - g));
      pts.push(v3(side * half * 0.56, y + length * 0.02, zb + g + ridge * 0.62), v3(side * half * 0.56, y + length * 0.02, zb - g - ridge * 0.45));
    }
    pts.push(v3(0, y, zb + g + ridge), v3(0, y, zb - g - ridge * 0.75));
  }
  return cutSolid(pts);
}

/**
 * Petal chip: a thick faceted piece of crystal cut to a 2D outline (x, y; root at the origin).
 * Girdle on the outline, a crown row at 60 % and a table at 25 %, rising to `front` (+z) and
 * `back` (−z). `cup` lifts the outline edges forward (cupped petal; the back fills in convex).
 */
export function petalChip(outline: THREE.Vector2[], front: number, back: number, cup = 0): CutSolid {
  const c = new THREE.Vector2();
  for (const p of outline) c.add(p);
  c.divideScalar(outline.length);
  const pts: THREE.Vector3[] = [];
  const rMax = Math.max(...outline.map((p) => p.distanceTo(c)));
  const lift = (p: THREE.Vector2) => cup * (p.distanceTo(c) / rMax) ** 2;
  outline.forEach((p, i) => {
    const z = lift(p);
    pts.push(v3(p.x, p.y, z + front * 0.12), v3(p.x, p.y, z - back * 0.12));
    if (i % 2 === 0) {
      const q = c.clone().lerp(p, 0.6);
      pts.push(v3(q.x, q.y, lift(q) + front * 0.78), v3(q.x, q.y, lift(q) - back * 0.7));
    }
  });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const q = c.clone().add(new THREE.Vector2(Math.cos(a), Math.sin(a)).multiplyScalar(rMax * 0.22));
    pts.push(v3(q.x, q.y, lift(q) + front), v3(q.x, q.y, lift(q) - back));
  }
  return cutSolid(pts);
}

/** Closed outline from a polar radius function r(θ), θ from 0 (root, −y) round to 2π. */
export function polarOutline(r: (t: number) => number, segments: number, center: THREE.Vector2): THREE.Vector2[] {
  const out: THREE.Vector2[] = [];
  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const a = -Math.PI / 2 + t * Math.PI * 2;
    out.push(new THREE.Vector2(center.x + Math.cos(a) * r(t), center.y + Math.sin(a) * r(t)));
  }
  return out;
}

/** Outline of a pointed oval (leaf, tepal, petal) from root (0,0) to tip (0, length). */
export function ovalOutline(length: number, width: number, opts: { segments?: number; point?: number; belly?: number } = {}): THREE.Vector2[] {
  const segments = opts.segments ?? 14;
  const point = opts.point ?? 0.8;
  const belly = opts.belly ?? 0.45;
  const out: THREE.Vector2[] = [];
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i <= segments / 2; i++) {
      const s = side === 0 ? i / (segments / 2) : 1 - i / (segments / 2);
      if (side === 1 && (i === 0 || i === segments / 2)) continue;
      // Widest at `belly`, pointed (or round, point → 0.5) at the tip.
      const k = s < belly ? Math.sin((s / belly) * Math.PI * 0.5) : Math.cos(((s - belly) / (1 - belly)) * Math.PI * 0.5) ** point;
      out.push(new THREE.Vector2((side === 0 ? 1 : -1) * (width / 2) * Math.max(k, 0.04), s * length));
    }
  }
  return out;
}

/** Briolette (faceted teardrop): rounded bottom, pointed top. Base at y 0, tip at y `length`. */
export function briolette(length: number, radius: number, around = 8, rows = 5): CutSolid {
  const rings: Ring[] = [];
  for (let k = 0; k < rows; k++) {
    const s = (k + 0.5) / rows;
    const r = radius * Math.sin(Math.min(1, s / 0.38) * Math.PI * 0.5) * (s > 0.38 ? Math.cos(((s - 0.38) / 0.62) * Math.PI * 0.5) ** 0.8 : 1);
    rings.push({ y: s * length, r: Math.max(r, radius * 0.12), n: around, phase: k % 2 ? 0.5 : 0 });
  }
  return ringGem(rings, { apexTop: length, apexBottom: 0 });
}

/** Small faceted bead (flower centres, anthers). */
export function bead(radius: number, around = 8): CutSolid {
  return ringGem(
    [
      { y: -radius * 0.55, r: radius * 0.75, n: around },
      { y: 0, r: radius, n: around, phase: 0.5 },
      { y: radius * 0.55, r: radius * 0.75, n: around },
    ],
    { apexTop: radius, apexBottom: -radius },
  );
}

/**
 * Natural crystal base (Florere): an unfaceted, water-worn rock with a peaked ridge, broad sloping
 * faces and a flat foot. Footprint `width` × `depth`, ridge at `height`. Seeded per species.
 */
export function rockBase(width: number, height: number, depth: number, seed: number): CutSolid {
  const random = rng(seed);
  const pts: THREE.Vector3[] = [];
  const j = (k: number) => 1 + (random() - 0.5) * k;
  const ring = (n: number, y: number, lean: number, spin: number, k: number) => {
    for (let i = 0; i < n; i++) {
      const a = ((i + spin) / n) * Math.PI * 2 + (random() - 0.5) * 0.35;
      pts.push(v3(Math.cos(a) * (width / 2) * lean * j(k), y * j(0.12), Math.sin(a) * (depth / 2) * lean * j(k)));
    }
  };
  // A flat foot, near-vertical lower walls, shoulders rolling in, and a ridge running across the
  // top off-centre: the water-worn rock of the reference bases, not a pyramid.
  ring(9, 0, 1, 0, 0.1);
  ring(8, height * 0.36, 0.97, 0.5, 0.1);
  ring(7, height * 0.66, 0.78, 0.2, 0.14);
  ring(5, height * 0.86, 0.48, 0.7, 0.2);
  const ridge = (t: number, y: number) => v3(-width * (0.22 - t * 0.3), height * y, depth * (0.06 - t * 0.12));
  pts.push(ridge(0, 0.93), ridge(0.45, 1), ridge(0.85, 0.95));
  return cutSolid(pts);
}

/**
 * Convex bell body (closed faceted gem shaped like a bell: narrow rounded crown, widening to the
 * mouth). Hangs from the origin down −y. The flared lobes of the mouth are separate chips.
 */
export function bellBody(length: number, crown: number, mouth: number, around: number): CutSolid {
  const rings: Ring[] = [];
  for (let k = 0; k <= 4; k++) {
    const s = k / 4;
    const r = crown + (mouth - crown) * s ** 1.6;
    rings.push({ y: -0.12 * length - s * length * 0.88, r: k === 0 ? crown * 0.75 : r, n: around, phase: k % 2 ? 0.5 : 0 });
  }
  return ringGem(rings, { apexTop: 0 });
}

/**
 * Quartz point: a hexagonal prism with a six-faced pyramidal termination, foot at the origin,
 * axis +y. Faces are slightly unequal (`seed`), as on natural points.
 */
export function quartzPoint(radius: number, length: number, seed: number): CutSolid {
  const random = rng(seed);
  const pts: THREE.Vector3[] = [];
  const shoulder = length * 0.72;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = radius * (0.92 + random() * 0.16);
    pts.push(v3(Math.cos(a) * r, 0, Math.sin(a) * r), v3(Math.cos(a) * r * 0.97, shoulder + (random() - 0.5) * radius * 0.4, Math.sin(a) * r * 0.97));
  }
  pts.push(v3((random() - 0.5) * radius * 0.25, length, (random() - 0.5) * radius * 0.25));
  return cutSolid(pts);
}

/**
 * Faceted rock (the daisy's base, after the home/about daisy's low-poly stone): a block with a flat
 * foot, short near-vertical walls and a domed faceted crown, pushed in and out
 * by a few smooth seeded bulges. `count` points spread evenly (Fibonacci spiral) give facets of
 * similar size facing every way, never in even bands. Foot at y 0; `width` × `height` × `depth`.
 */
export function facetedRock(width: number, height: number, depth: number, count: number, seed: number): CutSolid {
  const random = rng(seed);
  const bulges = Array.from({ length: 5 }, () => ({ dir: v3(random() - 0.5, random() - 0.3, random() - 0.5).normalize(), amp: 0.05 + random() * 0.07 }));
  const golden = Math.PI * (3 - Math.sqrt(5));
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const sy = 1 - ((i + 0.5) / count) * 2;
    const a = i * golden;
    // Profile by sy: foot (y 0), short wall (to 35 %), rounded crown.
    let y: number;
    let radial: number;
    if (sy < -0.5) {
      y = 0;
      radial = 0.92 * Math.sqrt((sy + 1) / 0.5);
    } else if (sy < 0.15) {
      const u = (sy + 0.5) / 0.65;
      y = 0.35 * u;
      radial = 1 - 0.04 * u;
    } else {
      const u = ((sy - 0.15) / 0.85) * Math.PI * 0.5;
      y = 0.35 + 0.65 * Math.sin(u);
      radial = 0.96 * Math.cos(u) ** 0.85;
    }
    const d = v3(Math.cos(a) * radial, sy, Math.sin(a) * radial);
    let k = 1;
    for (const b of bulges) k += b.amp * Math.max(0, d.clone().normalize().dot(b.dir)) ** 2;
    pts.push(v3(d.x * (width / 2) * k, y * height * (0.94 + 0.06 * k), d.z * (depth / 2) * k));
  }
  return cutSolid(pts);
}
