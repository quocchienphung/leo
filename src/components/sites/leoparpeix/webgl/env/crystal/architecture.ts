import * as THREE from "three";
import { clearGlass, limestone } from "./materials";
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

/** Colonnade, parapet, steps, glass panels and sheer curtains (stage coordinates). */
export class Pavilion extends THREE.Group {
  /** Glass and sheer fabric (hidden while the environment is captured). */
  readonly glass: THREE.Object3D[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly curtainUniforms = { uTime: { value: 0 } };

  constructor(curtainSegments: number) {
    super();
    const stone = limestone();
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

    // Tall glass panels: two on the left (rainbow streaks), one on the right pier.
    const panelMat = clearGlass({ thickness: 0.06, dispersion: 2.5, ior: 1.52 });
    this.materials.push(panelMat);
    const panel = (x: number, z: number, width: number, height: number, yaw: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.03), panelMat);
      m.position.set(x, height / 2, z);
      m.rotation.y = yaw;
      this.add(m);
      this.glass.push(m);
    };
    panel(-1.55, -3.0, 1.1, 8.6, 0.12);
    panel(-3.45, -2.0, 0.42, 8.2, -0.3);
    panel(5.2, -5.0, 0.46, 9.2, 0.5);

    // Sheer curtains on the far left, almost still: light fabric, not glass (no refraction pass).
    const curtainMat = new THREE.MeshPhysicalMaterial({
      color: 0xfffcf6,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      roughness: 0.85,
      sheen: 1,
      sheenColor: new THREE.Color(0xfff6e8),
      // Back-lit voile glows.
      emissive: new THREE.Color(0xfff1dc),
      emissiveIntensity: 0.2,
      side: THREE.DoubleSide,
      envMapIntensity: 0.8,
    });
    curtainMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.curtainUniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          float hang = clamp(1.0 - uv.y, 0.0, 1.0);
          transformed.z += sin(uTime * 0.35 + position.x * 2.6 + position.y * 0.25) * 0.018 * hang;`,
        );
      // Voile is denser where a fold turns away from the eye: the folds read as soft lines.
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `diffuseColor.a *= mix(0.55, 1.35, pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 1.6));
        #include <opaque_fragment>`,
      );
    };
    curtainMat.customProgramCacheKey = () => "crystal-curtain";
    this.materials.push(curtainMat);
    const curtain = (x: number, z: number, width: number, phase: number) => {
      const g = new THREE.PlaneGeometry(width, 9.6, curtainSegments, 16);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i);
        const py = pos.getY(i);
        // Deep, irregular vertical folds; the hem flares a little on the floor.
      pos.setZ(i, Math.sin(px * 9.0 + phase) * 0.09 + Math.sin(px * 3.7 + phase * 2) * 0.08 + Math.sin(px * 17.0 + phase * 3) * 0.025 + (py < -4.4 ? (py + 4.4) * 0.05 : 0));
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, curtainMat);
      m.position.set(x, 4.8, z);
      this.add(m);
      this.glass.push(m);
    };
    // Reference: sheer voile filling u 0 → 330, in front of the left arch, behind the olive tree.
    curtain(-5.25, -2.7, 2.9, 0);
    curtain(-4.85, -1.7, 2.4, 1.7);
  }

  render(et: number): void {
    this.curtainUniforms.uTime.value = et / 1000;
  }

  dispose(): void {
    this.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
  }
}
