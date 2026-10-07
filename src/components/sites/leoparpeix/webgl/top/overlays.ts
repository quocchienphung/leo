import gsap from "gsap";
import * as THREE from "three";
import type { AssetsManager } from "../assets";
import { loaderMaskFragment, quadVertex, transitionFragment } from "../shaders/screen";

const HOME_BG = new THREE.Color(0.9686274509803922, 0.9686274509803922, 0.9686274509803922);
const ABOUT_BG = new THREE.Color(0.031, 0.239, 0.165);

export interface TransitionUniforms {
  uTransition: THREE.IUniform<number>;
  uResolution: THREE.IUniform<THREE.Vector2>;
  uViewport: THREE.IUniform<THREE.Vector2>;
  uBeeRevealScale: THREE.IUniform<number>;
  uFruitRevealScale: THREE.IUniform<number>;
  uShadowReveal: THREE.IUniform<number>;
}

/** Intro card mask (`iq`, line ~68072): opaque #F7F7F7 outside a rotating rounded card. */
export class LoaderMask extends THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  constructor(geometry: THREE.PlaneGeometry) {
    super(
      geometry,
      new THREE.ShaderMaterial({
        vertexShader: quadVertex,
        fragmentShader: loaderMaskFragment,
        uniforms: {
          uResolution: { value: new THREE.Vector2(1, 1) },
          uGlobalProgress: { value: 0 },
          uScaleProgress: { value: 0 },
          uFinalProgress: { value: 0 },
          uColor: { value: HOME_BG.clone() },
        },
        transparent: true,
        depthWrite: false,
      }),
    );
  }

  show(): gsap.core.Timeline {
    const u = this.material.uniforms;
    const tl = gsap.timeline();
    tl.fromTo(u.uGlobalProgress, { value: 0 }, { value: 1, duration: 1.75, ease: "expo.out" }, 0);
    tl.fromTo(u.uScaleProgress, { value: 0 }, { value: 1, duration: 2.25, ease: "expo.out" }, 0);
    tl.fromTo(u.uFinalProgress, { value: 0 }, { value: 1, duration: 1.4, ease: "power4.inOut" }, 0.45);
    return tl;
  }

  skip(): void {
    const u = this.material.uniforms;
    u.uGlobalProgress.value = 1;
    u.uScaleProgress.value = 1;
    u.uFinalProgress.value = 1;
    this.visible = false;
  }

  resize(width: number, height: number): void {
    this.scale.set(width, height, 1e-5);
    this.material.uniforms.uResolution.value.set(width, height);
  }
}

/** Route change disc with a spinning daisy (`uq`, line ~68190). */
export class PageTransition extends THREE.Group {
  private flower: THREE.Group | null = null;
  private background: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private spin: gsap.core.Tween | null = null;
  private dims = { width: 1, height: 1 };

  constructor(
    geometry: THREE.PlaneGeometry,
    private uniforms: TransitionUniforms,
    assets: AssetsManager,
  ) {
    super();
    const model = assets.get<THREE.Group>("flowerModel");
    const tex = assets.get<THREE.Texture>("flowerTex");
    if (model && tex) {
      tex.flipY = false;
      const flower = model.clone();
      flower.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.material = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
        mesh.renderOrder = 2;
        mesh.geometry = mesh.geometry.clone();
        mesh.geometry.scale(0.125, 0.125, 0.125);
      });
      flower.scale.set(0, 0, 0);
      flower.position.z = 1;
      this.add(flower);
      this.flower = flower;
      this.spin = gsap.to(flower.rotation, { z: `+=${Math.PI * 2}`, duration: Math.PI, ease: "none", repeat: -1 });
    }
    this.background = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        vertexShader: quadVertex,
        fragmentShader: transitionFragment,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uResolution: uniforms.uResolution,
          uTransition: uniforms.uTransition,
          uColor: { value: ABOUT_BG.clone() },
        },
      }),
    );
    this.background.renderOrder = 1;
    this.add(this.background);
  }

  /** Source `m6`: radius that covers the whole screen. */
  private coverRadius(): number {
    const r = this.dims.width / this.dims.height;
    return 0.5 * Math.sqrt(r * r + 1) * 1.08;
  }

  hide(onCovered?: () => void): gsap.core.Timeline {
    const tl = gsap.timeline();
    const d = 0.75;
    tl.fromTo(this.uniforms.uTransition, { value: 0 }, { value: this.coverRadius(), duration: d, ease: "expo.out" }, 0);
    if (this.flower) {
      tl.fromTo(this.flower.scale, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1, duration: d, ease: "expo.out" }, 0);
      tl.fromTo(this.flower.rotation, { x: Math.PI * 0.25, y: Math.PI * 0.5 }, { x: 0, y: 0, duration: d, ease: "expo.out" }, 0);
    }
    tl.call(() => onCovered?.(), undefined, d);
    return tl;
  }

  show(): gsap.core.Timeline {
    const tl = gsap.timeline();
    tl.to(this.uniforms.uTransition, { value: 0, duration: 0.65, ease: "power3.inOut" }, 0);
    if (this.flower) {
      tl.to(this.flower.scale, { x: 0, y: 0, z: 0, duration: 0.65, ease: "power3.inOut" }, 0);
      tl.to(this.flower.rotation, { x: -Math.PI * 0.25, y: -Math.PI * 0.5, duration: 0.65, ease: "power3.inOut" }, 0);
    }
    return tl;
  }

  resize(width: number, height: number): void {
    this.dims = { width, height };
    this.background.scale.set(width, height, 1e-5);
  }

  dispose(): void {
    this.spin?.kill();
  }
}
