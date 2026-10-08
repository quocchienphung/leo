import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { clearGlass } from "./materials";
import { GranitePalette } from "./stone";
import { PARAPET, SIDE_COLONNADE, WALL } from "./layout";

function archHole(left: number, right: number, bottom: number, spring: number): THREE.Path {
  const r = (right - left) / 2;
  const p = new THREE.Path();
  p.moveTo(left, bottom);
  p.lineTo(left, spring);
  p.absarc(left + r, spring, r, Math.PI, 0, true);
  p.lineTo(right, bottom);
  p.lineTo(left, bottom);
  return p;
}

function box(min: [number, number, number], max: [number, number, number], material: THREE.Material): THREE.Mesh {
  const g = new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  const m = new THREE.Mesh(g, material);
  m.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Colonnade, parapet, steps and tall glass panels (stage coordinates). */
export class Pavilion extends THREE.Group {
  /** Glass (hidden while the environment is captured). */
  readonly glass: THREE.Object3D[] = [];
  private readonly materials: THREE.Material[] = [];

  constructor(granite: GranitePalette) {
    super();
    const stone = granite.material("honed", true);
    this.materials.push(stone);

    // Arched wall: semi-circular openings, the plinth runs under them.
    const shape = new THREE.Shape();
    shape.moveTo(WALL.left, 0);
    shape.lineTo(WALL.right, 0);
    shape.lineTo(WALL.right, WALL.top);
    shape.lineTo(WALL.left, WALL.top);
    shape.lineTo(WALL.left, 0);
    for (const a of [WALL.arch, WALL.leftArch, WALL.farArch]) shape.holes.push(archHole(a.left, a.right, WALL.plinth, a.spring));
    const wallGeo = new THREE.ExtrudeGeometry(shape, { depth: WALL.depth, curveSegments: 96, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 4 });
    const wall = new THREE.Mesh(wallGeo, stone);
    wall.position.z = WALL.z - WALL.depth;
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.add(wall);

    // Dressed arch edging: shallow real bevels catch the low sun, unlike a painted outline.
    const dressed = granite.material("polished");
    this.materials.push(dressed);
    const archBlocks: THREE.BufferGeometry[] = [];
    for (const a of [WALL.arch, WALL.leftArch, WALL.farArch]) {
      const center = (a.left + a.right) / 2;
      const inner = (a.right - a.left) / 2;
      const outer = inner + 0.13;
      const divisions = Math.max(10, Math.ceil(inner * 8));
      for (let i = 0; i < divisions; i++) {
        const start = (i / divisions) * Math.PI + 0.001;
        const end = ((i + 1) / divisions) * Math.PI - 0.001;
        const wedge = new THREE.Shape();
        wedge.moveTo(Math.cos(start) * inner, Math.sin(start) * inner);
        wedge.absarc(0, 0, inner, start, end, false);
        wedge.lineTo(Math.cos(end) * outer, Math.sin(end) * outer);
        wedge.absarc(0, 0, outer, end, start, true);
        wedge.closePath();
        const geo = new THREE.ExtrudeGeometry(wedge, { depth: 0.035, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 6 });
        geo.translate(center, a.spring, WALL.z + 0.006);
        archBlocks.push(geo);
      }
      this.add(box([a.left - 0.13, WALL.plinth, WALL.z], [a.left - 0.008, a.spring, WALL.z + 0.045], dressed));
      this.add(box([a.right + 0.008, WALL.plinth, WALL.z], [a.right + 0.13, a.spring, WALL.z + 0.045], dressed));
    }
    const archGeometry = mergeGeometries(archBlocks);
    for (const geo of archBlocks) geo.dispose();
    if (!archGeometry) throw new Error("Could not assemble pavilion arch blocks");
    const archEdging = new THREE.Mesh(archGeometry, dressed);
    archEdging.castShadow = archEdging.receiveShadow = true;
    this.add(archEdging);

    // Parapet across the openings and on along the terrace, with a slightly wider cap.
    const back = PARAPET.z - PARAPET.depth;
    this.add(box([WALL.left, 0, back], [PARAPET.right, PARAPET.height - 0.06, PARAPET.z], stone));
    this.add(box([WALL.left, PARAPET.height - 0.08, back - 0.04], [PARAPET.right, PARAPET.height, PARAPET.z + 0.05], stone));

    // Off-frame side colonnade (right): only its shadows are seen, as sun bands on the floor.
    const c = SIDE_COLONNADE;
    for (let z = c.from; z <= c.to; z += c.step) this.add(box([c.x, 0, z - c.depth / 2], [c.x + c.width, c.height, z + c.depth / 2], stone));
    this.add(box([c.x - 0.2, c.height, c.from - 1.5], [c.x + c.width + 0.2, c.height + 0.8, c.to + 1.5], stone));

    // Steps up to the left arch (u 420 → 650, v 650 → 740).
    this.add(box([-3.6, 0, -5.0], [-1.3, 0.15, -4.3], stone));
    this.add(box([-3.6, 0, -5.5], [-1.3, 0.3, -4.9], stone));
    this.add(box([-3.6, 0, -6.0], [-1.3, 0.45, -5.4], stone));

    // Tall glass panel on the right pier (it carries the sun glare).
    const panelMat = clearGlass({ thickness: 0.06, dispersion: 2.5, ior: 1.52 });
    this.materials.push(panelMat);
    const panel = (x: number, z: number, width: number, height: number, yaw: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.03), panelMat);
      m.position.set(x, height / 2, z);
      m.rotation.y = yaw;
      this.add(m);
      this.glass.push(m);
    };
    panel(5.2, -5.0, 0.46, 9.2, 0.5);
  }

  dispose(): void {
    this.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
  }
}
