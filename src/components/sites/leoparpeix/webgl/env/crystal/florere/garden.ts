import * as THREE from "three";
import { GARDEN, LINEUP } from "../layout";
import { clearGlass, goldMetal, greenLacquer } from "../materials";
import { GranitePalette } from "../stone";
import { type Figurine, type Kit } from "./kit";
import { SPECIES } from "./species";

/** Box with softly rounded edges. */
function roundedBox(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, 4, 4, 4);
  const pos = g.attributes.position;
  const inner = new THREE.Vector3(w / 2 - r, h / 2 - r, d / 2 - r);
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    c.set(THREE.MathUtils.clamp(v.x, -inner.x, inner.x), THREE.MathUtils.clamp(v.y, -inner.y, inner.y), THREE.MathUtils.clamp(v.z, -inner.z, inner.z));
    const off = v.clone().sub(c);
    if (off.lengthSq() > 0) v.copy(c).add(off.normalize().multiplyScalar(r));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

interface Planted {
  figurine: Figurine;
  pivot: THREE.Object3D;
  phase: number;
}

/**
 * The six Florere figurines around the daisy, each on a marble plinth or a glass block, in depth
 * layers (layout.ts `GARDEN`). `lineup`: the six side by side close to the camera, no plinths
 * (`?debug=florere`, model and material review).
 */
export class FlorereGarden extends THREE.Group {
  /** Glass and crystal (hidden while the environment is captured). */
  readonly glass: THREE.Object3D[] = [];
  private readonly planted: Planted[] = [];
  private readonly kit: Kit;
  private readonly owned: { geometries: THREE.BufferGeometry[]; materials: THREE.Material[]; textures: THREE.Texture[] } = { geometries: [], materials: [], textures: [] };

  /** `lite`: the back-layer repeats are left out. */
  constructor(granite: GranitePalette, lineup = false, lite = false) {
    super();
    this.name = "FlorereGarden";
    this.kit = { gold: goldMetal(), lacquer: greenLacquer() };
    this.owned.materials.push(this.kit.gold, this.kit.lacquer);

    const marble = granite.material("polished");
    const block = clearGlass({ thickness: 0.6, dispersion: 0.8, ior: 1.52 });
    block.envMapIntensity = 1.4;
    this.owned.materials.push(marble, block);

    const spots = lineup ? LINEUP : GARDEN.filter((s) => !(lite && s.repeat));
    spots.forEach((spot, i) => {
      const pivot = new THREE.Object3D();
      pivot.position.set(...spot.at);
      this.add(pivot);
      let top = 0;
      if (!lineup && "plinth" in spot && spot.plinth) {
        const [w, h, d] = spot.plinth.size;
        const geo = roundedBox(w, h, d, spot.plinth.kind === "glass" ? 0.03 : 0.015);
        this.owned.geometries.push(geo);
        const m = new THREE.Mesh(geo, spot.plinth.kind === "glass" ? block : marble);
        m.position.set(spot.at[0], spot.at[1] + h / 2, spot.at[2]);
        m.rotation.y = spot.plinth.yaw ?? 0;
        m.castShadow = m.receiveShadow = spot.plinth.kind !== "glass";
        this.add(m);
        if (spot.plinth.kind === "glass") this.glass.push(m);
        top = h;
      }
      pivot.position.y = spot.at[1] + top;
      const figurine = SPECIES[spot.species](this.kit);
      figurine.scale.setScalar(spot.scale);
      figurine.rotation.y = spot.yaw;
      pivot.add(figurine);
      this.glass.push(figurine);
      this.planted.push({ figurine, pivot, phase: i * 1.7 });
    });
  }

  /** A breath of air: each figurine sways a fraction of a degree about its foot. */
  update(et: number): void {
    const t = et / 1000;
    for (const p of this.planted) {
      p.pivot.rotation.z = Math.sin(t * 0.55 + p.phase) * 0.004;
      p.pivot.rotation.x = Math.sin(t * 0.43 + p.phase * 1.3) * 0.003;
    }
  }

  dispose(): void {
    for (const p of this.planted) p.figurine.dispose();
    for (const g of this.owned.geometries) g.dispose();
    for (const m of this.owned.materials) m.dispose();
    for (const t of this.owned.textures) t.dispose();
  }
}
