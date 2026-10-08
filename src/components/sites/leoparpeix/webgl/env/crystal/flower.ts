import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { cutLeaf, facetedRock } from "./cut";
import { COLORS, champagneGlass, clearGlass, disposeMaterial, frostedGlass, glassRod, rng, tracedCrystal, type GlitterUniforms } from "./materials";
import { OrbFace } from "../../eyes/orbFace";
import { FLOWER, SUN_WORLD } from "./layout";

/*
 * The crystal daisy, built procedurally in the stage frame (origin on the floor under it, x right,
 * y up, z towards the camera), using the home/about daisy's rig with the fuller crown and glass
 * dome of the supplied pavilion reference (see `FLOWER` in layout.ts): 12 paddle petals around a champagne dome
 * that wears the same bloub eyes, a straight glass stem, two cut crystal leaves, a cut crystal
 * rock on a thin glass disc.
 */

const deg = THREE.MathUtils.degToRad;

/**
 * Petals in the head frame: `root` = distance of the petal root from the dome centre; widths and
 * thickness are halves. The root is hidden under the dome.
 */
const PETAL = { count: 12, root: 0.36, length: 1.08, rootHalfWidth: 0.14, halfWidth: 0.3, widest: 0.63, halfThickness: 0.14, cup: 0.08, z: -0.08 } as const;
/** Champagne dome: radius, front bulge / radius (it is an ellipsoid centred on its rim plane). */
const ORB = { radius: 0.49, depth: 0.82 } as const;

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
    // Straight sides from the narrow root to the widest point, then the round tip.
    const body = PETAL.rootHalfWidth + (PETAL.halfWidth - PETAL.rootHalfWidth) * THREE.MathUtils.clamp(t / PETAL.widest, 0, 1);
    const ends = cap(t, 0.09) * cap(1 - t, tipCap);
    const hw = body * ends;
    const ht = PETAL.halfThickness * (0.65 + 0.35 * THREE.MathUtils.smoothstep(t, 0, 0.6)) * ends;
    pos.setXYZ(i, cx * hw, t * L, cz * ht + PETAL.cup * t ** 1.2);
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

// ------------------------------------------------------------------------------------ flower

interface PetalRig {
  pivot: THREE.Object3D;
  hinge: THREE.Object3D;
  mesh: THREE.Mesh;
  phase: number;
  delay: number;
}

export class CrystalFlower extends THREE.Group {
  readonly glitter: GlitterUniforms = { uGlitterSun: { value: SUN_WORLD.clone() }, uGlitter: { value: 1 }, uGlitterRim: { value: 0.85 } };
  private readonly head = new THREE.Group();
  private readonly petals: PetalRig[] = [];
  private readonly leaves: THREE.Object3D[] = [];
  private readonly face: OrbFace;
  private readonly materials: THREE.Material[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private openness = 1;

  /** `lite`: a coarser cut on the rock (fewer planes to trace). */
  constructor(lite = false) {
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
    // Twelve identical petals, one every 30° from straight up; neighbours just touch at their widest.
    for (let i = 0; i < PETAL.count; i++) {
      const angle = (i / PETAL.count) * Math.PI * 2;
      const pivot = new THREE.Object3D();
      pivot.rotation.z = angle;
      pivot.position.z = PETAL.z;
      const hinge = new THREE.Object3D();
      hinge.position.y = PETAL.root;
      pivot.add(hinge);
      const mesh = new THREE.Mesh(petalGeo, petalMat);
      // The reference crown is taller above the face, with a little room for the stem below.
      mesh.scale.y = 1 + Math.min(0, Math.cos(angle)) * 0.14;
      hinge.add(mesh);
      this.head.add(pivot);
      this.petals.push({ pivot, hinge, mesh, phase: random() * Math.PI * 2, delay: (i / PETAL.count) * 0.35 });
    }

    // Champagne dome, wearing the bloub eyes of the home/about daisies.
    const orbGeo = new THREE.SphereGeometry(ORB.radius, 96, 64);
    orbGeo.scale(1, 1, ORB.depth);
    const orbMat = champagneGlass();
    this.geometries.push(orbGeo);
    this.materials.push(orbMat);
    this.head.add(new THREE.Mesh(orbGeo, orbMat));
    this.face = new OrbFace(ORB.radius, ORB.depth, new THREE.Color(COLORS.ink));
    this.head.add(this.face);

    // Glass stem: straight from the front, from inside the rock up behind the head.
    const stemCurve = new THREE.CatmullRomCurve3(FLOWER.stem.map((p) => new THREE.Vector3(...p)));
    const stemGeo = taperedTube(stemCurve, 96, 24, FLOWER.stemRadius, FLOWER.stemRadius);
    const stemMat = glassRod();
    this.geometries.push(stemGeo);
    this.materials.push(stemMat);
    this.add(new THREE.Mesh(stemGeo, stemMat));

    // Cut crystal leaves (traced: the facets seen through them are their real back faces).
    for (const spec of FLOWER.leaves) {
      const leaf = cutLeaf(spec.length, spec.width, spec.thickness, { rows: 9, bend: spec.length * 0.04 });
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

    // Crystal rock: one faceted stone (≈ 180 facets, ≈ 100 on the lite tier: every facet is a
    // plane the tracer tests).
    const r = FLOWER.rock;
    const rock = facetedRock(r.width, r.height, r.depth, lite ? 64 : 124, 4);
    const rockMat = tracedCrystal(rock.planes, { ior: 1.58, spread: 0.016, backDist: 1.2, sparkle: 1.2 });
    this.geometries.push(rock.geometry);
    this.materials.push(rockMat);
    const base = new THREE.Mesh(rock.geometry, rockMat);
    base.position.set(...FLOWER.base);
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

  /**
   * `et` ms. Meditative idle: float, a slight roll, desynchronised petal breathing, leaf sway; the
   * bloub eyes (montage, expressions, blinks) follow the pointer through `camera`.
   */
  update(et: number, camera: THREE.Camera): void {
    const t = et / 1000;
    this.head.position.y = FLOWER.head.y + Math.sin((t * Math.PI * 2) / 7) * 0.018;
    this.head.rotation.z = Math.sin((t * Math.PI * 2) / 9.5) * deg(0.25);
    for (const p of this.petals) p.mesh.scale.z = 1 + Math.sin(t * 0.8 + p.phase) * 0.005;
    this.leaves.forEach((l, i) => (l.rotation.y = FLOWER.leaves[i].rotation[1] + Math.sin(t * 0.5 + i * 1.7) * deg(0.45)));
    this.face.update(et, camera);
  }

  /** Actual animated crown position, for camera-space optical focus. */
  getFocusPoint(out: THREE.Vector3): THREE.Vector3 {
    return this.head.getWorldPosition(out);
  }

  dispose(): void {
    this.face.dispose();
    for (const m of this.materials) disposeMaterial(m);
    for (const g of this.geometries) g.dispose();
  }
}
