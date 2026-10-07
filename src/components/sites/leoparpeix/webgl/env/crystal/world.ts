import * as THREE from "three";
import { shaftFragment, shaftVertex } from "../../shaders/crystal";

interface Shaft {
  from: [number, number, number];
  to: [number, number, number];
  width: number;
  intensity: number;
}

/**
 * Glare from the low sun on the right: the vertical blaze on the right pier's glass (u 1360 → 1430),
 * the streak on the tall panel by the left pier (u 560 → 600, v 50 → 150), and soft beams slanting
 * in from the right opening across the pool.
 */
const SHAFTS: Shaft[] = [
  { from: [5.4, 10, -5.9], to: [5.4, 0.3, -5.9], width: 1.0, intensity: 4.5 },
  { from: [5.15, 10, -5.85], to: [5.15, 0.3, -5.85], width: 0.3, intensity: 4.5 },
  { from: [-1.5, 9.5, -2.95], to: [-1.5, 1.0, -2.95], width: 0.35, intensity: 2.5 },
  { from: [9.5, 7.5, -3.5], to: [1.0, 0.0, -1.0], width: 2.4, intensity: 0.35 },
  { from: [10.5, 7.5, -5.0], to: [3.0, 0.0, -2.6], width: 1.6, intensity: 0.3 },
];

export class SunShafts extends THREE.Group {
  private readonly material: THREE.ShaderMaterial;

  constructor(color: THREE.Color) {
    super();
    this.material = new THREE.ShaderMaterial({
      vertexShader: shaftVertex,
      fragmentShader: shaftFragment,
      uniforms: { uColor: { value: color }, uIntensity: { value: 1 }, uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const towardCamera = new THREE.Vector3(0, 0, 1);
    for (const s of SHAFTS) {
      const a = new THREE.Vector3(...s.from);
      const b = new THREE.Vector3(...s.to);
      const y = a.clone().sub(b);
      const length = y.length();
      y.normalize();
      const z = towardCamera.clone().addScaledVector(y, -towardCamera.dot(y)).normalize();
      const x = new THREE.Vector3().crossVectors(y, z);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(s.width, length), this.material.clone());
      m.material.uniforms.uIntensity.value = s.intensity;
      m.material.uniforms.uColor = this.material.uniforms.uColor;
      m.material.uniforms.uTime = this.material.uniforms.uTime;
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.renderOrder = 5;
      this.add(m);
    }
  }

  render(et: number): void {
    this.material.uniforms.uTime.value = et / 1000;
  }

  dispose(): void {
    this.traverse((o) => {
      const m = o as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
      if (m.isMesh) {
        m.geometry.dispose();
        m.material.dispose();
      }
    });
    this.material.dispose();
  }
}
