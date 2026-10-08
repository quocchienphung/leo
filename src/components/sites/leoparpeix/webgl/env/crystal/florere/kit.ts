import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { CutSolid } from "../cut";
import { taperedTube } from "../flower";
import { disposeMaterial, tracedCrystal, type TraceOptions } from "../materials";

/*
 * Building blocks of the Florere figurines. Each species is modelled in "product units": the
 * figurine stands 1 tall, its base foot centred on the origin, front towards +z. Gold and lacquer
 * tubes of one figurine merge into a single mesh; repeated crystal parts (petals, bells) are one
 * InstancedMesh each. Crystal parts are convex cut solids drawn with the traced material.
 */

export type Vec = [number, number, number];
export const vec = (p: Vec) => new THREE.Vector3(...p);

/** Orthonormal frame with +z along `normal` and +y as close as possible to `up`. */
export function frame(normal: THREE.Vector3, up = new THREE.Vector3(0, 1, 0)): THREE.Quaternion {
  const z = normal.clone().normalize();
  let x = new THREE.Vector3().crossVectors(up, z);
  if (x.lengthSq() < 1e-6) x = new THREE.Vector3(1, 0, 0);
  x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/** Frame with +y along `dir` and +z turned towards `facing`. */
export function along(dir: THREE.Vector3, facing = new THREE.Vector3(0, 0, 1)): THREE.Quaternion {
  const y = dir.clone().normalize();
  const z = facing.clone().addScaledVector(y, -facing.dot(y));
  if (z.lengthSq() < 1e-6) z.set(1, 0, 0).addScaledVector(y, -y.x);
  z.normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

export function compose(position: THREE.Vector3, q: THREE.Quaternion, scale = 1): THREE.Matrix4 {
  return new THREE.Matrix4().compose(position, q, new THREE.Vector3(scale, scale, scale));
}

/**
 * Radial petals in a flower frame (+z = the flower's face): petal i points outwards at angle
 * `offset + i·2π/count`, tilted `tilt` rad towards the face (0 = flat, π/2 = closed).
 */
export function corolla(center: THREE.Matrix4, count: number, opts: { tilt: number; root: number; offset?: number; jitter?: (i: number) => { tilt?: number; turn?: number; scale?: number } }): THREE.Matrix4[] {
  const out: THREE.Matrix4[] = [];
  for (let i = 0; i < count; i++) {
    const j = opts.jitter?.(i) ?? {};
    const a = (opts.offset ?? 0) + (i / count) * Math.PI * 2 + (j.turn ?? 0);
    const radial = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a - Math.PI / 2);
    const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), opts.tilt + (j.tilt ?? 0));
    const q = radial.multiply(tilt);
    const p = new THREE.Vector3(Math.cos(a), Math.sin(a), 0).multiplyScalar(opts.root);
    out.push(center.clone().multiply(compose(p, q, j.scale ?? 1)));
  }
  return out;
}

export interface Kit {
  gold: THREE.Material;
  lacquer: THREE.Material;
}

/** One figurine under construction (product units), then a finished group. */
export class Figurine extends THREE.Group {
  readonly geometries: THREE.BufferGeometry[] = [];
  readonly materials: THREE.Material[] = [];
  private readonly metal = new Map<THREE.Material, THREE.BufferGeometry[]>();

  constructor(
    readonly kit: Kit,
    name: string,
  ) {
    super();
    this.name = name;
  }

  /** Metal wire through `points` (smooth curve), radius r0 → r1. */
  wire(points: Vec[], r0: number, r1 = r0, material = this.kit.gold, radial = 8): THREE.CatmullRomCurve3 {
    const curve = new THREE.CatmullRomCurve3(points.map(vec), false, "centripetal");
    const segments = Math.max(16, Math.round(curve.getLength() * 260));
    this.metalGeometry(taperedTube(curve, segments, radial, r0, r1), material);
    return curve;
  }

  /** Any metal geometry, transformed and merged with the figurine's other metal. */
  metalGeometry(g: THREE.BufferGeometry, material = this.kit.gold, matrix?: THREE.Matrix4): void {
    const geo = g.index ? g.toNonIndexed() : g;
    if (geo !== g) g.dispose();
    for (const k of Object.keys(geo.attributes)) if (k !== "position" && k !== "normal") geo.deleteAttribute(k);
    if (!geo.getAttribute("normal")) geo.computeVertexNormals();
    if (matrix) geo.applyMatrix4(matrix);
    const list = this.metal.get(material) ?? [];
    list.push(geo);
    this.metal.set(material, list);
  }

  /** Traced crystal part(s): one mesh, or one InstancedMesh for several placements. */
  crystal(solid: CutSolid, opts: TraceOptions, placements: THREE.Matrix4[]): THREE.MeshPhysicalMaterial {
    const material = tracedCrystal(solid.planes, opts);
    this.materials.push(material);
    this.geometries.push(solid.geometry);
    this.place(solid.geometry, material, placements);
    return material;
  }

  /** A part with its own material (bells, pearls). */
  place(geometry: THREE.BufferGeometry, material: THREE.Material, placements: THREE.Matrix4[]): THREE.Mesh {
    if (!this.geometries.includes(geometry)) this.geometries.push(geometry);
    if (placements.length === 1) {
      const m = new THREE.Mesh(geometry, material);
      placements[0].decompose(m.position, m.quaternion, m.scale);
      this.add(m);
      return m;
    }
    const m = new THREE.InstancedMesh(geometry, material, placements.length);
    placements.forEach((p, i) => m.setMatrixAt(i, p));
    m.computeBoundingSphere();
    this.add(m);
    return m;
  }

  /** Merge the metal into one mesh per material. Call once, after the last part. */
  finish(): this {
    for (const [material, list] of this.metal) {
      const merged = mergeGeometries(list);
      for (const g of list) g.dispose();
      if (!merged) continue;
      this.geometries.push(merged);
      const m = new THREE.Mesh(merged, material);
      m.castShadow = true;
      this.add(m);
    }
    this.metal.clear();
    return this;
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) disposeMaterial(m);
  }
}

/**
 * The gold wire wound round a natural base (every gold-stem Florere): from the stem's foot it
 * circles the rock low down once, rising and dipping a little, and tucks under at the front.
 */
export function baseWrap(width: number, depth: number, seed: number, from: number): Vec[] {
  const pts: Vec[] = [];
  const turns = 1.08;
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const a = from + t * turns * Math.PI * 2;
    const r = 1 + 0.06 * Math.sin(t * 9 + seed);
    const y = 0.05 + 0.07 * Math.sin(t * Math.PI) + 0.025 * Math.sin(t * 11 + seed * 2);
    pts.push([Math.cos(a) * width * 0.56 * r, y, Math.sin(a) * depth * 0.6 * r]);
  }
  return pts;
}
