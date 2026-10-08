import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { clearGlass } from "./materials";
import { GranitePalette } from "./stone";
import { PALACE } from "./layout";

/** Open monumental loggia: full-size columns and arches repeat into the landscape. */
export class Pavilion extends THREE.Group {
  readonly glass: THREE.Object3D[] = [];
  private readonly materials: THREE.Material[] = [];

  constructor(granite: GranitePalette) {
    super();
    this.name = "PalaceLoggia";
    const stone = granite.material("honed", true);
    const trim = granite.material("polished");
    this.materials.push(stone, trim);
    const masonry: THREE.BufferGeometry[] = [];
    const mouldings: THREE.BufferGeometry[] = [];
    const place = (geometry: THREE.BufferGeometry, x: number, y: number, z: number, polished = false, yaw = 0) => {
      const g = geometry.index ? geometry.toNonIndexed() : geometry;
      if (g !== geometry) geometry.dispose();
      g.rotateY(yaw);
      g.translate(x, y, z);
      (polished ? mouldings : masonry).push(g);
    };
    const box = (x: number, y: number, z: number, w: number, h: number, d: number, polished = false) => place(new THREE.BoxGeometry(w, h, d), x, y, z, polished);
    const ring = (x: number, y: number, z: number, bottom: number, top: number, height: number) => place(new THREE.CylinderGeometry(top, bottom, height, 48), x, y, z, true);

    const column = (x: number, z: number) => {
      const spring = PALACE.spring;
      box(x, 0.13, z, 1.16, 0.26, 1.16, true);
      ring(x, 0.31, z, 0.53, 0.49, 0.1);
      ring(x, 0.43, z, 0.49, 0.4, 0.14);
      const height = spring - 1.02;
      const shaft = new THREE.CylinderGeometry(0.31, 0.4, height, 96, 12);
      const p = shaft.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x0 = p.getX(i), z0 = p.getZ(i);
        const a = Math.atan2(z0, x0);
        const end = Math.sin(Math.PI * THREE.MathUtils.clamp((p.getY(i) + height / 2) / height, 0, 1));
        const flute = 1 - 0.035 * (0.5 + 0.5 * Math.cos(a * 20)) * end;
        p.setXYZ(i, x0 * flute, p.getY(i), z0 * flute);
      }
      shaft.computeVertexNormals();
      place(shaft, x, 0.54 + height / 2, z);
      ring(x, spring - 0.42, z, 0.33, 0.38, 0.12);
      ring(x, spring - 0.26, z, 0.38, 0.54, 0.2);
      box(x, spring - 0.07, z, 1.17, 0.18, 1.17, true);
    };

    const arch = (cx: number, z: number, half: number, yaw: number, top: number) => {
      const spring = PALACE.spring;
      const outer = half + 0.48;
      const s = new THREE.Shape();
      s.moveTo(-outer, spring);
      s.lineTo(-outer, top);
      s.lineTo(outer, top);
      s.lineTo(outer, spring);
      s.lineTo(half, spring);
      s.absarc(0, spring, half, 0, Math.PI, false);
      s.lineTo(-outer, spring);
      const body = new THREE.ExtrudeGeometry(s, { depth: 0.65, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 2, curveSegments: 48 });
      body.translate(0, 0, -0.325);
      place(body, cx, 0, z, false, yaw);
      const blocks = Math.ceil(half * 5);
      for (let i = 0; i < blocks; i++) {
        const a = Math.PI * i / blocks + 0.0012;
        const b = Math.PI * (i + 1) / blocks - 0.0012;
        const wedge = new THREE.Shape();
        wedge.absarc(0, spring, half - 0.025, a, b, false);
        wedge.absarc(0, spring, half + 0.2, b, a, true);
        wedge.closePath();
        const g = new THREE.ExtrudeGeometry(wedge, { depth: 0.76, bevelEnabled: true, bevelSize: 0.009, bevelThickness: 0.009, bevelSegments: 2, curveSegments: 4 });
        g.translate(0, 0, -0.38);
        place(g, cx, 0, z, true, yaw);
      }
    };

    for (const z of PALACE.bays) {
      // Two deep wings frame an open central court, leaving the mountain vista behind the daisy.
      for (const side of [-1, 1]) {
        column(side * PALACE.halfWidth, z);
        column(side * PALACE.outerWidth, z);
        const half = (PALACE.outerWidth - PALACE.halfWidth) / 2;
        const center = side * (PALACE.outerWidth + PALACE.halfWidth) / 2;
        arch(center, z, half, 0, PALACE.cornice);
        box(center, PALACE.cornice + 0.22, z, half * 2 + 1.1, 0.46, 1.1, true);
      }
      // The monumental entrance is the only vault across the central vista.
      if (z === PALACE.bays[0]) {
        arch(0, z, PALACE.halfWidth, 0, PALACE.cornice);
        box(0, PALACE.cornice + 0.22, z, 2 * PALACE.halfWidth + 1.4, 0.46, 1.1, true);
      }
    }
    for (let i = 0; i < PALACE.bays.length - 1; i++) {
      const front = PALACE.bays[i], back = PALACE.bays[i + 1];
      const center = (front + back) / 2;
      for (const side of [-1, 1]) {
        for (const x of [PALACE.halfWidth, PALACE.outerWidth]) {
          arch(side * x, center, (front - back) / 2, Math.PI / 2, PALACE.cornice);
          box(side * x, PALACE.cornice + 0.22, center, 1.1, 0.46, front - back + 1.1, true);
        }
        box(side * PALACE.halfWidth, 0.12, center, 0.72, 0.24, front - back);
        box(side * PALACE.halfWidth, 0.85, center, 0.72, 0.16, front - back, true);
        for (let bz = back + 0.65; bz < front; bz += 1.05) ring(side * PALACE.halfWidth, 0.48, bz, 0.095, 0.095, 0.58);
      }
    }
    // A broad processional terrace behind the pool, not a small enclosed display room.
    for (const [z, level] of [[-13.2, 0.14], [-14.0, 0.28], [-23.2, 0.42], [-24.0, 0.56]] as const) box(0, level / 2, z - 0.4, PALACE.halfWidth * 2 - 0.7, level, 0.8, true);
    box(0, 0.14, -18.6, PALACE.halfWidth * 2 - 0.7, 0.28, 8.4);
    box(0, 0.28, -31.2, PALACE.halfWidth * 2 - 0.7, 0.56, 13.6);

    for (const [geometries, material, name] of [[masonry, stone, "Palace masonry"], [mouldings, trim, "Carved columns, voussoirs and cornices"]] as const) {
      const merged = mergeGeometries(geometries);
      for (const g of geometries) g.dispose();
      if (!merged) throw new Error(`Could not assemble ${name}`);
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = name;
      mesh.castShadow = mesh.receiveShadow = true;
      this.add(mesh);
    }

    const glass = clearGlass({ thickness: 0.05, dispersion: 0.8, ior: 1.5 });
    this.materials.push(glass);
    const geometry = new THREE.BoxGeometry(0.08, 10.5, 0.35);
    for (const side of [-1, 1]) {
      for (const z of [-4.6, -12.6]) {
        const panel = new THREE.Mesh(geometry, glass);
        panel.position.set(side * (PALACE.halfWidth + 0.65), 5.25, z);
        this.add(panel);
        this.glass.push(panel);
      }
    }
  }

  dispose(): void {
    const geometries = new Set<THREE.BufferGeometry>();
    this.traverse((o) => { if (o instanceof THREE.Mesh) geometries.add(o.geometry); });
    for (const g of geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
