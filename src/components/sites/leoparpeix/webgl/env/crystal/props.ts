import * as THREE from "three";
import { quartzPoint } from "./cut";
import { clearGlass, disposeMaterial, rng, tracedCrystal } from "./materials";
import { PROPS } from "./layout";

/**
 * Glass and crystal accents between the figurines (stage coordinates): clear spheres, and clusters
 * of quartz points drawn with the traced crystal (one instanced draw for every point).
 */
export class Props extends THREE.Group {
  /** Glass objects (hidden while the environment is captured). */
  readonly glass: THREE.Object3D[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];

  constructor() {
    super();
    const random = rng(33);
    const solid = clearGlass({ thickness: 0.6, dispersion: 0.6, ior: 1.5 });
    solid.envMapIntensity = 1.5;
    this.materials.push(solid);

    const sphereGeo = new THREE.SphereGeometry(1, 96, 64);
    this.geometries.push(sphereGeo);
    for (const s of PROPS.spheres) {
      const m = new THREE.Mesh(sphereGeo, solid);
      m.position.copy(s.position);
      m.scale.setScalar(s.radius);
      this.add(m);
      this.glass.push(m);
    }

    // Each cluster: a tall point leaning out of a ring of shorter ones, all from one cut.
    const point = quartzPoint(0.06, 0.42, 5);
    const quartz = tracedCrystal(point.planes, { ior: 1.55, spread: 0.012, backDist: 0.3, sparkle: 1, bounces: 3 });
    this.geometries.push(point.geometry);
    this.materials.push(quartz);
    const placements: THREE.Matrix4[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    for (const c of PROPS.clusters) {
      const count = 6 + (c.seed % 3);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + random() * 0.6;
        const lean = i === 0 ? 0.12 : 0.35 + random() * 0.45;
        const dir = new THREE.Vector3(Math.cos(a) * Math.sin(lean), Math.cos(lean), Math.sin(a) * Math.sin(lean));
        const s = c.scale * (i === 0 ? 1.25 : 0.55 + random() * 0.45);
        const foot = c.position.clone().add(new THREE.Vector3(Math.cos(a) * 0.05 * c.scale, -0.02, Math.sin(a) * 0.05 * c.scale));
        placements.push(new THREE.Matrix4().compose(foot, new THREE.Quaternion().setFromUnitVectors(up, dir), new THREE.Vector3(s, s, s)));
      }
    }
    const points = new THREE.InstancedMesh(point.geometry, quartz, placements.length);
    placements.forEach((p, i) => points.setMatrixAt(i, p));
    points.computeBoundingSphere();
    this.add(points);
    this.glass.push(points);
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) disposeMaterial(m);
  }
}
