import * as THREE from "three";
import { blurFragment, brightFragment, finalFragment, quadVertex } from "../../shaders/crystal";

/** Bloom levels (divisor of the drawing buffer): a tight glow and two wide, soft halos. */
const LEVELS = [4, 8, 16] as const;

interface BloomLevel {
  divisor: number;
  a: THREE.WebGLRenderTarget;
  b: THREE.WebGLRenderTarget;
}

/**
 * HDR pipeline of the crystal pavilion: the scene renders linear into a multisampled half-float
 * target; this pass adds a multi-scale bloom (sunlit glass and stone glow softly, as in the
 * reference), ACES filmic, a barely visible chromatic fringe and sRGB encoding, and writes the
 * display image into the manager's main target (grain/fluid follow).
 */
export class CrystalPost {
  readonly target: THREE.WebGLRenderTarget;
  private readonly levels: BloomLevel[];
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly brightMat: THREE.ShaderMaterial;
  private readonly blurMat: THREE.ShaderMaterial;
  readonly finalMat: THREE.ShaderMaterial;

  constructor(samples: number) {
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples, depthBuffer: true });
    const small = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.levels = LEVELS.map((divisor) => ({ divisor, a: small(), b: small() }));
    this.brightMat = new THREE.ShaderMaterial({ vertexShader: quadVertex, fragmentShader: brightFragment, uniforms: { tInput: { value: null }, uThreshold: { value: 1.25 } }, depthTest: false, depthWrite: false });
    this.blurMat = new THREE.ShaderMaterial({ vertexShader: quadVertex, fragmentShader: blurFragment, uniforms: { tInput: { value: null }, uDirection: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false });
    this.finalMat = new THREE.ShaderMaterial({
      vertexShader: quadVertex,
      fragmentShader: finalFragment,
      uniforms: {
        tInput: { value: this.target.texture },
        tBloom0: { value: this.levels[0].b.texture },
        tBloom1: { value: this.levels[1].b.texture },
        tBloom2: { value: this.levels[2].b.texture },
        uBloom: { value: new THREE.Vector3(0.1, 0.09, 0.08) },
        uExposure: { value: 0.88 },
        uAspect: { value: 16 / 9 },
        uGlowColor: { value: new THREE.Color(1.0, 0.86, 0.66) },
        uAberration: { value: 0.0005 },
        uVignette: { value: 0.12 },
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
    this.finalMat.uniforms.uAspect.value = width / Math.max(1, height);
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
    // Each level starts from the previous one (bright pass for the first), then a separable blur.
    let source: THREE.Texture = this.target.texture;
    this.levels.forEach((l, i) => {
      if (i === 0) {
        this.brightMat.uniforms.tInput.value = source;
        this.pass(renderer, this.brightMat, l.a);
      } else {
        // Downsample: a blur pass reading the previous level writes this level's `a`.
        this.blurMat.uniforms.tInput.value = source;
        this.blurMat.uniforms.uDirection.value.set(0, 0);
        this.pass(renderer, this.blurMat, l.a);
      }
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
    });
    this.pass(renderer, this.finalMat, output);
  }

  dispose(): void {
    this.target.dispose();
    for (const l of this.levels) {
      l.a.dispose();
      l.b.dispose();
    }
    this.brightMat.dispose();
    this.blurMat.dispose();
    this.finalMat.dispose();
    this.quad.geometry.dispose();
  }
}
