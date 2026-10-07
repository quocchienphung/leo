import * as THREE from "three";
import { cutSolid, type CutSolid } from "./cut";
import { COLORS, clearGlass, limestone, rng, tracedCrystal } from "./materials";
import { DISTANT_TREES, PROPS } from "./layout";

function boxBetween(min: THREE.Vector3, max: THREE.Vector3, material: THREE.Material, radius = 0.02): THREE.Mesh {
  const size = max.clone().sub(min);
  const m = new THREE.Mesh(roundedBox(size, radius), material);
  m.position.copy(min).add(max).multiplyScalar(0.5);
  return m;
}

/** Box with softly rounded edges (glass blocks catch a bright line on every edge). */
function roundedBox(size: THREE.Vector3, radius: number): THREE.BufferGeometry {
  const r = Math.min(radius, size.x / 2, size.y / 2, size.z / 2);
  const g = new THREE.BoxGeometry(size.x, size.y, size.z, 6, 6, 6);
  const pos = g.attributes.position;
  const half = size.clone().multiplyScalar(0.5);
  const inner = half.clone().subScalar(r);
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    c.set(THREE.MathUtils.clamp(v.x, -inner.x, inner.x), THREE.MathUtils.clamp(v.y, -inner.y, inner.y), THREE.MathUtils.clamp(v.z, -inner.z, inner.z));
    const d = v.clone().sub(c);
    if (d.lengthSq() > 0) v.copy(c).add(d.normalize().multiplyScalar(r));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Glass bowl: thin lathe wall with a rolled rim. */
function bowlGeometry(radius: number, height: number): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  const wall = 0.022;
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 0.5;
    pts.push(new THREE.Vector2(Math.sin(a) * radius + 0.001, height - Math.cos(a) * height));
  }
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI;
    pts.push(new THREE.Vector2(radius - wall / 2 + Math.cos(a) * (wall / 2 + 0.004), height + Math.sin(a) * 0.006));
  }
  for (let i = 24; i >= 0; i--) {
    const a = (i / 24) * Math.PI * 0.5;
    pts.push(new THREE.Vector2(Math.max(0.001, Math.sin(a) * (radius - wall)), height - Math.cos(a) * (height - wall)));
  }
  pts.reverse();
  return new THREE.LatheGeometry(pts, 96);
}

/** Bulbous glass vase: wide rounded body, soft shoulder, narrow neck. */
function vaseGeometry(radius: number, height: number): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  const profile = (t: number) => {
    const body = Math.sin(Math.min(1, t / 0.8) * Math.PI * 0.68 + 0.42) * radius;
    return t > 0.8 ? THREE.MathUtils.lerp(body, radius * 0.22, THREE.MathUtils.smoothstep(t, 0.8, 1)) : body;
  };
  for (let i = 0; i <= 40; i++) pts.push(new THREE.Vector2(profile(i / 40), (i / 40) * height));
  for (let i = 40; i >= 0; i--) pts.push(new THREE.Vector2(Math.max(0.001, profile(i / 40) - 0.018), (i / 40) * height + (i === 0 ? 0.02 : 0)));
  return new THREE.LatheGeometry(pts, 80);
}

/** Cut crystal cube: every edge chamfered and every corner truncated. */
function cutCube(side: number): CutSolid {
  const h = side / 2;
  const c = side * 0.13;
  const pts: THREE.Vector3[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        pts.push(new THREE.Vector3(sx * (h - c), sy * h, sz * (h - c)));
        pts.push(new THREE.Vector3(sx * h, sy * (h - c), sz * (h - c)));
        pts.push(new THREE.Vector3(sx * (h - c), sy * (h - c), sz * h));
      }
    }
  }
  return cutSolid(pts);
}

/** Narrow lanceolate olive leaf. */
function oliveLeafGeometry(length: number, width: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(width * 0.6, length * 0.25, width * 0.5, length * 0.75, 0, length);
  s.bezierCurveTo(-width * 0.5, length * 0.75, -width * 0.6, length * 0.25, 0, 0);
  const g = new THREE.ShapeGeometry(s, 4);
  // A slight fold along the midrib so the leaves catch light unevenly.
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.abs(pos.getX(i)) * 0.5);
  g.computeVertexNormals();
  return g;
}

interface TreeSpec {
  leaves: number;
  height: number;
  spread: number;
  trunk: number;
  leafLength: number;
  palette: number[];
}

/**
 * Slender ornamental olive: a thin trunk that forks into a few graceful branches, small narrow
 * leaves gathered in loose clusters along the outer twigs (instanced, per-leaf tone).
 */
function oliveTree(random: () => number, spec: TreeSpec, bark: THREE.Material, leafMat: THREE.Material, leafGeo: THREE.BufferGeometry): THREE.Group {
  const tree = new THREE.Group();
  const twigs: { p: THREE.Vector3; d: THREE.Vector3 }[] = [];
  const grow = (start: THREE.Vector3, dir: THREE.Vector3, length: number, radius: number, depth: number) => {
    const pts = [start.clone()];
    const p = start.clone();
    const d = dir.clone();
    for (let i = 0; i < 5; i++) {
      d.add(new THREE.Vector3((random() - 0.5) * 0.22, 0.06, (random() - 0.5) * 0.18)).normalize();
      p.addScaledVector(d, length / 5);
      pts.push(p.clone());
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(curve, 16, radius, 6, false);
    const m = new THREE.Mesh(g, bark);
    m.castShadow = true;
    tree.add(m);
    for (let i = 2; i <= 5; i++) twigs.push({ p: pts[i].clone(), d: d.clone() });
    if (depth === 0) return;
    const n = depth >= 2 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const t = 0.4 + (i / n) * 0.5 + random() * 0.08;
      const from = curve.getPoint(t);
      const side = new THREE.Vector3((random() - 0.5) * 2, 0.5 + random() * 0.6, (random() - 0.5) * 0.9).normalize();
      grow(from, d.clone().lerp(side, 0.55).normalize(), length * (0.55 + random() * 0.2), radius * 0.62, depth - 1);
    }
  };
  grow(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.04, 1, 0.02), spec.height * 0.42, spec.trunk, 3);

  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, spec.leaves);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < spec.leaves; i++) {
    const tw = twigs[Math.floor(random() * twigs.length)];
    dummy.position.copy(tw.p).add(new THREE.Vector3((random() - 0.5) * spec.spread, (random() - 0.35) * spec.spread * 0.8, (random() - 0.5) * spec.spread * 0.7));
    // Leaves point outwards and up, with a natural droop.
    dummy.lookAt(dummy.position.clone().add(new THREE.Vector3(random() - 0.5, random() - 0.3, random() - 0.5)));
    dummy.rotateX(-Math.PI / 2 + (random() - 0.5) * 0.9);
    dummy.rotateZ((random() - 0.5) * 1.2);
    dummy.scale.setScalar(spec.leafLength * (0.7 + random() * 0.6));
    dummy.updateMatrix();
    leaves.setMatrixAt(i, dummy.matrix);
    leaves.setColorAt(i, color.setHex(spec.palette[Math.floor(random() * spec.palette.length)]).multiplyScalar(0.8 + random() * 0.35));
  }
  leaves.castShadow = true;
  tree.add(leaves);
  return tree;
}

/** Crystal and glass objects distributed around the daisy (stage coordinates). */
export class Props extends THREE.Group {
  /** Glass objects (hidden while the environment is captured). */
  readonly glass: THREE.Object3D[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly tree: THREE.Group;

  constructor(lite: boolean) {
    super();
    const random = rng(33);
    const block = clearGlass({ thickness: 0.35, dispersion: 3, ior: 1.52 });
    block.envMapIntensity = 1.3;
    const thinGlass = clearGlass({ thickness: 0.05, dispersion: 0.6 });
    const solid = clearGlass({ thickness: 1.6, dispersion: 1.5, ior: 1.5 });
    solid.envMapIntensity = 1.5;
    const cubeCut = cutCube(PROPS.cube.size);
    const gem = tracedCrystal(cubeCut.planes, { backDist: 1, sparkle: 1 });
    const stone = limestone();
    stone.roughness = 0.35;
    this.materials.push(block, thinGlass, solid, gem, stone);
    const glass = <T extends THREE.Object3D>(o: T): T => {
      this.add(o);
      this.glass.push(o);
      return o;
    };

    const sphere = (p: THREE.Vector3, r: number) => {
      const m = glass(new THREE.Mesh(new THREE.SphereGeometry(r, 96, 64), solid));
      m.position.copy(p);
    };
    sphere(PROPS.bigSphere.position, PROPS.bigSphere.radius);
    sphere(PROPS.floorOrb.position, PROPS.floorOrb.radius);
    sphere(PROPS.smallOrb.position, PROPS.smallOrb.radius);

    // Marble ledge on two glass blocks, with the small orb, the prism and the vase on it.
    const l = PROPS.ledge;
    const ledge = boxBetween(new THREE.Vector3(l.left, l.top - l.thickness, l.back), new THREE.Vector3(l.right, l.top, l.front), stone, 0.02);
    ledge.castShadow = true;
    ledge.receiveShadow = true;
    this.add(ledge);
    for (const b of PROPS.ledgeBlocks) glass(boxBetween(b.min, b.max, block, 0.03));
    const prism = glass(new THREE.Mesh(roundedBox(PROPS.prism.size, 0.025), block));
    prism.position.copy(PROPS.prism.position);
    prism.rotation.y = 0.2;

    // Right: glass pedestal and the cut crystal cube balanced on an edge.
    const ped = PROPS.pedestal;
    glass(boxBetween(ped.position.clone().add(new THREE.Vector3(-ped.size.x / 2, 0, -ped.size.z / 2)), ped.position.clone().add(new THREE.Vector3(ped.size.x / 2, ped.size.y, ped.size.z / 2)), block, 0.03));
    const cube = glass(new THREE.Mesh(cubeCut.geometry, gem));
    cube.position.copy(PROPS.cube.position);
    // Balanced on an edge: a diamond outline, one face nearly square to the camera.
    cube.rotation.set(THREE.MathUtils.degToRad(8), THREE.MathUtils.degToRad(16), Math.PI / 4, "YXZ");

    // Lower right: glass blocks with the bowl.
    for (const b of PROPS.blocks) glass(boxBetween(b.min, b.max, block, 0.03));
    const bowl = glass(new THREE.Mesh(bowlGeometry(PROPS.bowl.radius, PROPS.bowl.height), thinGlass));
    bowl.position.copy(PROPS.bowl.position);

    // Vase + olive tree.
    const vase = glass(new THREE.Mesh(vaseGeometry(PROPS.vase.radius, PROPS.vase.height), thinGlass));
    vase.position.copy(PROPS.vase.position);
    const bark = new THREE.MeshStandardMaterial({ color: COLORS.bark, roughness: 0.85 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide, envMapIntensity: 0.5 });
    const leafGeo = oliveLeafGeometry(1, 0.2);
    this.materials.push(bark, leafMat);
    const palette = [COLORS.leaf, COLORS.leafDark, 0xa9b26e, 0x7d8a4e, 0xbcbf7c, 0x96a05f];
    this.tree = oliveTree(random, { leaves: lite ? 1200 : 2800, height: 2.9, spread: 0.3, trunk: 0.024, leafLength: 0.09, palette }, bark, leafMat, leafGeo);
    this.tree.position.copy(PROPS.vase.position).add(new THREE.Vector3(0.05, 0.02, 0));
    this.add(this.tree);

    // Olive trees beyond the terrace (right of the right pier), same build, larger and denser.
    for (const t of DISTANT_TREES) {
      const far = oliveTree(random, { leaves: lite ? 900 : 2600, height: 2.4, spread: 0.85, trunk: 0.05, leafLength: 0.24, palette: [0x5f7238, 0x4c5e2c, 0x7a8a48, 0x3f5026, 0x6c7f3c] }, bark, leafMat, leafGeo);
      far.position.set(t.position.x, 0, t.position.z);
      far.scale.setScalar(t.radius * 1.5);
      this.add(far);
    }
  }

  render(et: number): void {
    // The tree barely breathes.
    this.tree.rotation.z = Math.sin((et / 1000) * 0.5) * 0.004;
  }

  dispose(): void {
    const geometries = new Set<THREE.BufferGeometry>();
    this.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) geometries.add(m.geometry);
    });
    for (const g of geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
