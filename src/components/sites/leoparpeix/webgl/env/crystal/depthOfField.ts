import * as THREE from "three";
import { quadVertex } from "../../shaders/crystal";
import { dofCompositeFragment, dofGatherFragment } from "../../shaders/crystalDof";

type Pass = (renderer: THREE.WebGLRenderer, material: THREE.ShaderMaterial, output: THREE.WebGLRenderTarget) => void;

/** Half-resolution optical blur, followed by a depth-aware full-resolution composite. */
export class CrystalDepthOfField {
  enabled: boolean;
  readonly output: THREE.WebGLRenderTarget;
  readonly gather: THREE.ShaderMaterial;
  readonly composite: THREE.ShaderMaterial;
  private readonly blur: THREE.WebGLRenderTarget;
  private readonly focusView = new THREE.Vector3();

  constructor(input: THREE.WebGLRenderTarget, lite: boolean) {
    const params = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
    this.enabled = params.get("dof") !== "off";
    const target = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.output = target();
    this.blur = target();
    const uniforms = {
      tInput: { value: input.texture },
      tDepth: { value: input.depthTexture },
      uNearFar: { value: new THREE.Vector2(0.05, 1200) },
      uFocus: { value: 8 },
      uAperture: { value: lite ? 5 : 7 },
      uMaxBlur: { value: lite ? 10 : 14 },
      uFarBlurScale: { value: lite ? 0.45 : 0.42 },
      uNearBlurScale: { value: 0.35 },
      uFocusBand: { value: 2.0 },
      uPixel: { value: new THREE.Vector2() },
    };
    this.gather = new THREE.ShaderMaterial({ vertexShader: quadVertex, fragmentShader: dofGatherFragment, uniforms, defines: { DOF_TAPS: lite ? 16 : 28 }, depthTest: false, depthWrite: false });
    this.composite = new THREE.ShaderMaterial({ vertexShader: quadVertex, fragmentShader: dofCompositeFragment, uniforms: {
      ...uniforms,
      tBlur: { value: this.blur.texture },
      uBlurTexel: { value: new THREE.Vector2() },
      uDebug: { value: process.env.NODE_ENV !== "production" && params.get("debug") === "depth" ? 1 : 0 },
    }, depthTest: false, depthWrite: false });
  }

  focus(camera: THREE.PerspectiveCamera, point: THREE.Vector3): void {
    this.focusView.copy(point).applyMatrix4(camera.matrixWorldInverse);
    this.gather.uniforms.uFocus.value = Math.max(camera.near + 0.1, -this.focusView.z);
    this.gather.uniforms.uNearFar.value.set(camera.near, camera.far);
  }

  setSize(width: number, height: number): void {
    this.output.setSize(width, height);
    this.blur.setSize(Math.max(1, Math.ceil(width / 2)), Math.max(1, Math.ceil(height / 2)));
    this.gather.uniforms.uPixel.value.set(height / width / 941, 1 / 941);
    this.composite.uniforms.uBlurTexel.value.set(1 / this.blur.width, 1 / this.blur.height);
  }

  render(renderer: THREE.WebGLRenderer, pass: Pass): void {
    pass(renderer, this.gather, this.blur);
    pass(renderer, this.composite, this.output);
  }

  dispose(): void {
    this.blur.dispose();
    this.output.dispose();
    this.gather.dispose();
    this.composite.dispose();
  }
}
