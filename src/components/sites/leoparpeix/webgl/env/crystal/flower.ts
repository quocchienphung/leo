import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { cutLeaf, ringGem, type CutSolid } from "./cut";
import { COLORS, champagneGlass, clearGlass, frostedGlass, glassRod, rng, tracedCrystal, type GlitterUniforms } from "./materials";
import { FLOWER, SUN_WORLD } from "./layout";

/*
 * The crystal daisy, built procedurally in the stage frame (origin on the floor under it, x right,
 * y up, z towards the camera). Proportions from docs/REFERENCE_MEASUREMENTS.md (≈ 181 px per unit
 * at the flower): 11 paddle petals (one straight up, a gap at the bottom where the stem shows), head 2.62 wide, champagne orb Ø 0.94, glass stem, two cut
 * crystal leaves, a cut crystal cluster on a thin glass disc.
 */

const deg = THREE.MathUtils.degToRad;

const PETAL = { count: 11, root: 0.3, length: 1.01, rootHalfWidth: 0.15, halfWidth: 0.29, halfThickness: 0.13, cup: 0.13 } as const;
const ORB = { radius: 0.47, depth: 0.82, z: 0.1 } as const;
/**
 * Eyes ≈ 17 × 34 px, centres (816, 365) and (860, 357) on an orb centred (820, 370). The orb's
 * front is closer to the camera (which looks up at it), so it reads ≈ 12 px higher than its centre.
 */
const EYES = [
  { x: -0.022, y: -0.035, roll: deg(4) },
  { x: 0.218, y: 0.004, roll: deg(-3) },
] as const;
const EYE = { radius: 0.041, length: 0.105 } as const;

// ------------------------------------------------------------------------------------ geometry

/** End cap: 1 in the body, rounding to 0 over `cap` at the end. */
function cap(t: number, capLength: number): number {
  if (t >= capLength) return 1;
  const u = (capLength - t) / capLength;
  return Math.sqrt(Math.max(0, 1 - u * u));
}

/**
 * Inflated paddle: narrow rounded root, fuller outer third, semicircular tip, pillow-like cross
 * section. Built by reshaping a dense sphere, so it is smooth everywhere (no facets).
 * Local frame: root at y 0, tip at y `length`, width on x, thickness on z (towards the camera).
 */
function petalGeometry(): THREE.BufferGeometry {
  const sphere = new THREE.SphereGeometry(1, 56, 72);
  const pos = sphere.attributes.position;
  const L = PETAL.length;
  const tipCap = PETAL.halfWidth / L;
  for (let i = 0; i < pos.count; i++) {
    const sx = pos.getX(i);
    const sy = pos.getY(i);
    const sz = pos.getZ(i);
    const t = (sy + 1) / 2;
    const rho = Math.hypot(sx, sz) || 1;
    // Inflated, almost elliptical cross-section: the volume gives the glass its shading.
    const cx = Math.sign(sx) * Math.abs(sx / rho) ** 0.95;
    const cz = Math.sign(sz) * Math.abs(sz / rho) ** 0.9;
    const body = PETAL.rootHalfWidth + (PETAL.halfWidth - PETAL.rootHalfWidth) * THREE.MathUtils.smoothstep(t, 0, 0.74);
    const ends = cap(t, 0.09) * cap(1 - t, tipCap);
    const hw = body * ends;
    const ht = PETAL.halfThickness * (0.72 + 0.28 * THREE.MathUtils.smoothstep(t, 0, 0.55)) * ends;
    pos.setXYZ(i, cx * hw, t * L, cz * ht + PETAL.cup * t ** 1.7);
  }
  sphere.deleteAttribute("uv");
  sphere.deleteAttribute("normal");
  const g = mergeVertices(sphere, 1e-6);
  sphere.dispose();
  g.computeVertexNormals();
  return g;
}

/** Tube along a curve with a tapering radius. */
export function taperedTube(curve: THREE.Curve<THREE.Vector3>, segments: number, radial: number, r0: number, r1: number): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(segments, false);
  const positions: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const r = THREE.MathUtils.lerp(r0, r1, t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const n = frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a));
      positions.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r);
      if (i < segments && j < radial) {
        const a0 = i * (radial + 1) + j;
        const b0 = a0 + radial + 1;
        index.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  const merged = mergeVertices(g, 1e-6);
  g.dispose();
  merged.computeVertexNormals();
  return merged;
}

/**
 * The daisy's crystal base: one broad cushion-cut stone (girdle low, crown stepping in to a small
 * table under the stem) with two small stones at its foot. Stage units, foot on the floor.
 */
function baseStones(): { solid: CutSolid; position: [number, number, number]; rotation: number }[] {
  const main = ringGem(
    [
      { y: 0, r: 0.6, n: 9 },
      { y: 0.17, r: 0.74, n: 9, phase: 0.5 },
      { y: 0.43, r: 0.69, n: 9 },
      { y: 0.64, r: 0.5, n: 8, phase: 0.5 },
      { y: 0.79, r: 0.24, n: 6 },
    ],
    { depth: 0.82, wobble: 0.035, seed: 4 },
  );
  const small = (r: number, seed: number) =>
    ringGem(
      [
        { y: 0, r: r * 0.8, n: 7 },
        { y: r * 0.45, r, n: 7, phase: 0.5 },
        { y: r * 0.95, r: r * 0.55, n: 6 },
      ],
      { depth: 0.85, wobble: 0.05, seed, apexTop: r * 1.25 },
    );
  return [
    { solid: main, position: [0, 0, 0], rotation: 0.35 },
    { solid: small(0.22, 8), position: [0.62, 0, 0.3], rotation: 0.5 },
    { solid: small(0.19, 11), position: [-0.66, 0, 0.22], rotation: 1.1 },
  ];
}

// ------------------------------------------------------------------------------------ flower

interface PetalRig {
  pivot: THREE.Object3D;
  hinge: THREE.Object3D;
  mesh: THREE.Mesh;
  phase: number;
  delay: number;
}

export class CrystalFlower extends THREE.Group {
  readonly glitter: GlitterUniforms = { uGlitterSun: { value: SUN_WORLD.clone() }, uGlitter: { value: 1 } };
  private readonly head = new THREE.Group();
  private readonly petals: PetalRig[] = [];
  private readonly leaves: THREE.Object3D[] = [];
  private readonly eyes: THREE.Object3D[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private openness = 1;
  private nextBlink = 3.5;

  constructor() {
    super();
    this.name = "CrystalFlower";
    const random = rng(12);

    // Head: faces the camera.
    this.head.position.copy(FLOWER.head);
    this.add(this.head);

    const petalMat = frostedGlass(this.glitter);
    const petalGeo = petalGeometry();
    this.materials.push(petalMat);
    this.geometries.push(petalGeo);
    for (let i = 0; i < PETAL.count; i++) {
      const angle = (i / PETAL.count) * Math.PI * 2 + deg((random() - 0.5) * 2.5);
      const pivot = new THREE.Object3D();
      pivot.rotation.z = angle;
      // Alternate depth so overlapping neighbours layer instead of intersecting.
      pivot.position.z = i % 2 === 0 ? 0.018 : -0.018;
      const hinge = new THREE.Object3D();
      hinge.position.y = PETAL.root;
      pivot.add(hinge);
      const mesh = new THREE.Mesh(petalGeo, petalMat);
      // Angle 0 points up: the lower petals are shorter than the side ones (reference ring).
      const up = Math.cos(angle);
      const reach = THREE.MathUtils.lerp(FLOWER.petalReach.side, up >= 0 ? FLOWER.petalReach.top : FLOWER.petalReach.bottom, up * up);
      mesh.scale.set(1 + (random() - 0.5) * 0.05, reach * (1 + (random() - 0.5) * 0.03), 1);
      mesh.rotation.y = deg((random() - 0.5) * 6);
      hinge.add(mesh);
      this.head.add(pivot);
      this.petals.push({ pivot, hinge, mesh, phase: random() * Math.PI * 2, delay: (i / PETAL.count) * 0.35 });
    }

    // Champagne orb and the two calm vertical eyes inlaid on it.
    const orbGeo = new THREE.SphereGeometry(ORB.radius, 96, 64);
    orbGeo.scale(1, 1, ORB.depth);
    const orbMat = champagneGlass();
    this.geometries.push(orbGeo);
    this.materials.push(orbMat);
    const orb = new THREE.Mesh(orbGeo, orbMat);
    orb.position.z = ORB.z;
    this.head.add(orb);

    const eyeGeo = new THREE.CapsuleGeometry(EYE.radius, EYE.length, 8, 24);
    eyeGeo.scale(1, 1, 0.32);
    const eyeMat = new THREE.MeshPhysicalMaterial({ color: COLORS.ink, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.25, envMapIntensity: 0.5 });
    this.geometries.push(eyeGeo);
    this.materials.push(eyeMat);
    for (const e of EYES) {
      const zr = ORB.radius * ORB.depth;
      const nz = Math.sqrt(Math.max(0, 1 - (e.x / ORB.radius) ** 2 - (e.y / ORB.radius) ** 2));
      const surface = new THREE.Vector3(e.x, e.y, ORB.z + zr * nz);
      // Ellipsoid normal at that point.
      const normal = new THREE.Vector3(e.x / ORB.radius ** 2, e.y / ORB.radius ** 2, (surface.z - ORB.z) / zr ** 2).normalize();
      const pivot = new THREE.Object3D();
      pivot.position.copy(surface).addScaledVector(normal, -0.004);
      pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      pivot.rotateZ(e.roll);
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      pivot.add(eye);
      this.head.add(pivot);
      this.eyes.push(pivot);
    }

    // Glass stem: a slight S from the crystal base up under the orb.
    const stemCurve = new THREE.CatmullRomCurve3(FLOWER.stem.map((p) => new THREE.Vector3(...p)));
    const stemGeo = taperedTube(stemCurve, 96, 32, 0.068, 0.058);
    const stemMat = glassRod();
    this.geometries.push(stemGeo);
    this.materials.push(stemMat);
    this.add(new THREE.Mesh(stemGeo, stemMat));

    // Cut crystal leaves (traced: the facets seen through them are their real back faces).
    for (const spec of FLOWER.leaves) {
      const leaf = cutLeaf(spec.length, spec.width, spec.thickness, { rows: 6, bend: spec.length * 0.06, asym: 0.12 });
      const leafMat = tracedCrystal(leaf.planes, { ior: 1.58, spread: 0.014, backDist: 0.8, sparkle: 1 });
      this.geometries.push(leaf.geometry);
      this.materials.push(leafMat);
      const pivot = new THREE.Object3D();
      pivot.position.set(...spec.base);
      pivot.rotation.set(spec.rotation[0], spec.rotation[1], spec.rotation[2], "ZXY");
      pivot.add(new THREE.Mesh(leaf.geometry, leafMat));
      this.add(pivot);
      this.leaves.push(pivot);
    }

    // Crystal base: a cushion-cut stone and two small ones, each traced against its own faces.
    const base = new THREE.Group();
    base.position.set(...FLOWER.base);
    for (const stone of baseStones()) {
      const mat = tracedCrystal(stone.solid.planes, { ior: 1.58, spread: 0.016, backDist: 1.2, sparkle: 1.2 });
      this.geometries.push(stone.solid.geometry);
      this.materials.push(mat);
      const m = new THREE.Mesh(stone.solid.geometry, mat);
      m.position.set(...stone.position);
      m.rotation.y = stone.rotation;
      base.add(m);
    }
    this.add(base);

    // Thin glass disc in the pool.
    const discGeo = new THREE.CylinderGeometry(FLOWER.discRadius, FLOWER.discRadius, 0.035, 128);
    const discMat = clearGlass({ thickness: 0.035, dispersion: 0.6 });
    discMat.envMapIntensity = 0.7;
    discMat.clearcoat = 0;
    this.geometries.push(discGeo);
    this.materials.push(discMat);
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.set(FLOWER.base[0], 0.0175, FLOWER.base[2]);
    this.add(disc);
  }

  /** 0 = closed bud, 1 = open (intro). */
  get open(): number {
    return this.openness;
  }

  set open(v: number) {
    this.openness = v;
    for (const p of this.petals) {
      const t = THREE.MathUtils.clamp((v - p.delay) / (1 - 0.35), 0, 1);
      const e = 1 - (1 - t) ** 3;
      p.hinge.rotation.x = (1 - e) * 1.25;
      p.hinge.scale.setScalar(0.55 + 0.45 * e);
    }
    this.head.scale.setScalar(0.85 + 0.15 * THREE.MathUtils.smoothstep(v, 0, 0.6));
  }

  /** `et` ms. Meditative idle: float, a slight roll, desynchronised petal breathing, leaf sway, blinks. */
  update(et: number): void {
    const t = et / 1000;
    this.head.position.y = FLOWER.head.y + Math.sin((t * Math.PI * 2) / 7) * 0.018;
    this.head.rotation.z = Math.sin((t * Math.PI * 2) / 9.5) * deg(0.25);
    for (const p of this.petals) p.mesh.scale.z = 1 + Math.sin(t * 0.8 + p.phase) * 0.005;
    this.leaves.forEach((l, i) => (l.rotation.y = FLOWER.leaves[i].rotation[1] + Math.sin(t * 0.5 + i * 1.7) * deg(0.45)));
    // Calm blink every few seconds.
    const since = t - this.nextBlink;
    let lid = 1;
    if (since > 0 && since < 0.16) lid = 0.12 + 0.88 * Math.abs(since / 0.08 - 1);
    else if (since >= 0.16) this.nextBlink = t + 4 + ((Math.sin(t * 12.9898) + 1) / 2) * 3;
    for (const e of this.eyes) e.scale.y = lid;
  }

  dispose(): void {
    for (const m of this.materials) m.dispose();
    for (const g of this.geometries) g.dispose();
  }
}
