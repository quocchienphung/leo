import * as THREE from "three";
import { blurFragment, brightFragment, finalFragment, quadVertex } from "../../shaders/crystal";
import { glintFragment } from "../../shaders/crystalGlints";
import { CrystalDepthOfField } from "./depthOfField";

/** Bloom levels (divisor of the drawing buffer): a tight glow and two wide, soft halos. */
const LEVELS = [4, 8, 16] as const;

interface BloomLevel {
  divisor: number;
  a: THREE.WebGLRenderTarget;
  b: THREE.WebGLRenderTarget;
}

/**
 * HDR pipeline of the crystal pavilion: the scene renders linear into a multisampled half-float
 * target; this pass extracts what is far brighter than sunlit marble or clouds (glints, the sun) at half
 * resolution and blooms it at three scales, then ACES filmic, a contrast-adaptive sharpen, grade
 * and sRGB into the manager's main target.
 */
export class CrystalPost {
  readonly target: THREE.WebGLRenderTarget;
  readonly dof: CrystalDepthOfField;
  private readonly bright: THREE.WebGLRenderTarget;
  private readonly glints: THREE.WebGLRenderTarget;
  private readonly glintMat: THREE.ShaderMaterial;
  private readonly levels: BloomLevel[];
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly brightMat: THREE.ShaderMaterial;
  private readonly blurMat: THREE.ShaderMaterial;
  readonly finalMat: THREE.ShaderMaterial;

  constructor(samples: number, lite: boolean) {
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples, depthBuffer: true });
    this.target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    this.dof = new CrystalDepthOfField(this.target, lite);
    const small = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.bright = small();
    this.glints = small();
    this.glintMat = new THREE.ShaderMaterial({ vertexShader: quadVertex, fragmentShader: glintFragment, uniforms: { tBright: { value: this.bright.texture }, uStep: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false });
    this.levels = LEVELS.map((divisor) => ({ divisor, a: small(), b: small() }));
    this.brightMat = new THREE.ShaderMaterial({ vertexShader: quadVertex, fragmentShader: brightFragment, uniforms: { tInput: { value: null }, uThreshold: { value: 3.8 } }, depthTest: false, depthWrite: false });
    this.blurMat = new THREE.ShaderMaterial({ vertexShader: quadVertex, fragmentShader: blurFragment, uniforms: { tInput: { value: null }, uDirection: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false });
    this.finalMat = new THREE.ShaderMaterial({
      vertexShader: quadVertex,
      fragmentShader: finalFragment,
      uniforms: {
        tInput: { value: this.target.texture },
        tBloom0: { value: this.levels[0].b.texture },
        tBloom1: { value: this.levels[1].b.texture },
        tBloom2: { value: this.levels[2].b.texture },
        tGlints: { value: this.glints.texture },
        uGlints: { value: lite ? 0.06 : 0.12 },
        uBloom: { value: new THREE.Vector3(0.14, 0.06, 0.02) },
        uTexel: { value: new THREE.Vector2(1, 1) },
        uSharpen: { value: lite ? 0 : 0.3 },
        uExposure: { value: 0.8 },
        uAspect: { value: 16 / 9 },
        uGlowColor: { value: new THREE.Color(1.0, 0.86, 0.66) },
        /** Glare centre (uv) and strength: the sun just beyond the right pier. */
        uGlare: { value: new THREE.Vector3(0.93, 0.97, 0.38) },
        uAberration: { value: 0.0005 },
        uVignette: { value: 0.2 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.brightMat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  setSize(width: number, height: number): void {
    this.target.setSize(width, height);
    this.dof.setSize(width, height);
    this.bright.setSize(Math.max(1, Math.round(width / 2)), Math.max(1, Math.round(height / 2)));
    this.glints.setSize(Math.max(1, Math.round(width / 4)), Math.max(1, Math.round(height / 4)));
    this.glintMat.uniforms.uStep.value.set(height / width / 941, 1 / 941);
    const u = this.finalMat.uniforms;
    u.uAspect.value = width / Math.max(1, height);
    u.uTexel.value.set(1 / width, 1 / height);
    for (const l of this.levels) {
      const w = Math.max(1, Math.round(width / l.divisor));
      const h = Math.max(1, Math.round(height / l.divisor));
      l.a.setSize(w, h);
      l.b.setSize(w, h);
    }
  }

  private pass(renderer: THREE.WebGLRenderer, material: THREE.ShaderMaterial, output: THREE.WebGLRenderTarget | null): void {
    this.quad.material = material;
    renderer.setRenderTarget(output);
    renderer.clear();
    renderer.render(this.scene, this.camera);
  }

  /** `target` (scene) → `output` (display-referred). */
  render(renderer: THREE.WebGLRenderer, output: THREE.WebGLRenderTarget): void {
    if (this.dof.enabled) this.dof.render(renderer, (r, m, t) => this.pass(r, m, t));
    const input = this.dof.enabled ? this.dof.output.texture : this.target.texture;
    this.finalMat.uniforms.tInput.value = input;
    this.brightMat.uniforms.tInput.value = input;
    this.pass(renderer, this.brightMat, this.bright);
    this.pass(renderer, this.glintMat, this.glints);
    // Each level downsamples the previous one (the bright pass for the first), then a separable blur.
    let source: THREE.Texture = this.bright.texture;
    for (const l of this.levels) {
      this.blurMat.uniforms.tInput.value = source;
      this.blurMat.uniforms.uDirection.value.set(0, 0);
      this.pass(renderer, this.blurMat, l.a);
      this.blurMat.uniforms.tInput.value = l.a.texture;
      this.blurMat.uniforms.uDirection.value.set(1.5 / l.a.width, 0);
      this.pass(renderer, this.blurMat, l.b);
      this.blurMat.uniforms.tInput.value = l.b.texture;
      this.blurMat.uniforms.uDirection.value.set(0, 1.5 / l.a.height);
      this.pass(renderer, this.blurMat, l.a);
      this.blurMat.uniforms.tInput.value = l.a.texture;
      this.blurMat.uniforms.uDirection.value.set(1.5 / l.a.width, 1.5 / l.a.height);
      this.pass(renderer, this.blurMat, l.b);
      source = l.b.texture;
    }
    this.pass(renderer, this.finalMat, output);
  }

  dispose(): void {
    this.target.dispose();
    this.dof.dispose();
    this.bright.dispose();
    this.glints.dispose();
    for (const l of this.levels) {
      l.a.dispose();
      l.b.dispose();
    }
    this.brightMat.dispose();
    this.glintMat.dispose();
    this.blurMat.dispose();
    this.finalMat.dispose();
    this.quad.geometry.dispose();
  }
}
