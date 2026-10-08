import * as THREE from "three";
import { FaceDriver, createEyeUniforms, eyeSdfChunk, type EyeUniforms } from "./faceDriver";

/*
 * The bloub eyes of the home/about daisies (eyes/flowerFace.ts), inked on the front of an orb: the
 * playground crystal daisy's champagne centre. Same montage, expressions, blinks and pointer
 * follow; the face space is the orb's front seen head-on (radius 1 = the orb radius, +y down).
 * The shell sits just outside the orb and draws only the eyes.
 */

const vertex = /* glsl */ `out vec3 vPos;
out vec3 vNormal;
out vec3 vView;
void main() {
  vPos = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const fragment = /* glsl */ `precision highp float;
uniform float uRadius;
uniform vec3 uInk;
${eyeSdfChunk}
in vec3 vPos;
in vec3 vNormal;
in vec3 vView;
out vec4 fragColor;
void main() {
  vec2 b = vec2(vPos.x, -vPos.y) / uRadius;
  float a = eyes(b);
  if (a <= 0.001) discard;
  // Enamel ink on glass: a little darker where the orb turns away, a soft gloss on top.
  float ndv = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
  vec3 col = uInk * mix(0.65, 1.0, ndv) + vec3(0.05) * pow(1.0 - ndv, 3.0);
  fragColor = vec4(col, a);
}`;

export class OrbFace extends THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> {
  private readonly driver = new FaceDriver();
  private readonly centre: THREE.Vector3;
  private readonly centreWorld = new THREE.Vector3();
  private readonly eyeUniforms: EyeUniforms;

  /**
   * `radius` and `depth` (z scale) of the orb, centred on this mesh's origin and facing +z.
   * `ink`: linear colour of the eyes.
   */
  constructor(radius: number, depth: number, ink: THREE.Color) {
    // Front half of the orb, a hair outside it.
    const geometry = new THREE.SphereGeometry(radius * 1.004, 96, 48, 0, Math.PI, 0, Math.PI);
    geometry.scale(1, 1, depth);
    const eyeUniforms = createEyeUniforms();
    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uRadius: { value: radius }, uInk: { value: ink }, ...eyeUniforms },
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
    });
    super(geometry, material);
    this.name = "OrbFace";
    this.renderOrder = 1;
    this.centre = new THREE.Vector3(0, 0, radius * depth);
    this.eyeUniforms = eyeUniforms;
  }

  /** `et` in ms (app ticker). */
  update(et: number, camera: THREE.Camera): void {
    this.localToWorld(this.centreWorld.copy(this.centre));
    this.driver.update(et, camera, this.centreWorld, this.eyeUniforms);
  }

  dispose(): void {
    this.driver.dispose();
    this.material.dispose();
    this.geometry.dispose();
  }
}
