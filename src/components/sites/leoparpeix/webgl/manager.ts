import gsap from "gsap";
import * as THREE from "three";
import { leo } from "../core/app";
import { emitter, type FrameInfo, type RouteName, type ViewportInfo } from "../core/emitter";
import { isTabletWidth, isTouch } from "../core/env";
import { AssetsManager } from "./assets";
import { DomCamera, MainCamera, ModelCamera, PointerCamera, TopCamera } from "./cameras";
import { AboutEnvironment, HomeEnvironment } from "./env/environments";
import { PlaygroundEnvironment } from "./env/crystal/crystalEnvironment";
import { FLUID_BLUR_FRAG, FLUID_FINAL_FRAG, FluidSimulation } from "./fluid";
import { InterfaceScene, SHARP_LAYER } from "./interface/interfaceScene";
import { grainFragment, quadVertex } from "./shaders/screen";
import { TopScene } from "./top/topScene";

const GRAIN_STRENGTH = 0.07;
/** The crystal pavilion is a clean render: grain almost invisible. */
const PLAYGROUND_GRAIN_STRENGTH = 0.012;

/**
 * Port of the source WebGL manager (`Bq`, line ~69413) and env scene (`YX`).
 *
 * - main canvas (behind the DOM): baked Home/About environment (or the playground crystal
 *   pavilion, lit physically and tone mapped by its own HDR pass, see env/crystal/) → composite
 *   with grain →
 *   DOM-synced planes (section colours, project sliders, About flowers).
 * - top canvas (above the DOM, pointer-events none): bees, fruits, intro card mask and the
 *   page-transition disc.
 */
export class WebglManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly topRenderer: THREE.WebGLRenderer;
  readonly assets: AssetsManager;
  readonly time: THREE.IUniform<number> = { value: 0 };

  readonly envScene = new THREE.Scene();
  readonly modelCamera: ModelCamera;
  readonly pointerCamera = new PointerCamera();
  readonly camera: MainCamera;
  homeEnv: HomeEnvironment | null = null;
  aboutEnv: AboutEnvironment | null = null;
  playgroundEnv: PlaygroundEnvironment | null = null;
  private homePromise: Promise<HomeEnvironment> | null = null;
  private aboutPromise: Promise<AboutEnvironment> | null = null;
  private playgroundPromise: Promise<PlaygroundEnvironment> | null = null;

  readonly planeGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);
  readonly interfaceScene: InterfaceScene;
  readonly domCamera = new DomCamera();
  readonly topScene: TopScene;
  readonly topCamera = new TopCamera();

  private mainTarget: THREE.WebGLRenderTarget;
  private fluid: FluidSimulation | null = null;
  private fluidTargetA: THREE.WebGLRenderTarget | null = null;
  private fluidTargetB: THREE.WebGLRenderTarget | null = null;
  private blurScene = new THREE.Scene();
  private blurMaterial: THREE.ShaderMaterial | null = null;
  private finalScene = new THREE.Scene();
  private finalMaterial: THREE.ShaderMaterial | null = null;
  private compScene = new THREE.Scene();
  private compCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1);
  private compMaterial: THREE.ShaderMaterial;

  currentRoute: RouteName | null = null;
  isPlaygroundPageActive = false;
  isHomeAboutGroupsRenderActive = false;
  /** Playground sky header on screen. */
  isPlaygroundGroupsRenderActive = false;
  private prewarmActive = false;
  pageTransitionHidingGroups = false;
  private headerRect: { y: number; height: number } | null = null;
  private webglSectionRect: { y: number; height: number } | null = null;
  private unsubs: (() => void)[] = [];

  constructor(mainContainer: HTMLElement, topContainer: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance",
      alpha: false,
      premultipliedAlpha: false,
    });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.autoClear = false;
    // Only the playground pavilion casts shadows on this renderer (home/about are baked).
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // Production skips the synchronous shader status queries (and the driver's compiler notes).
    this.renderer.debug.checkShaderErrors = process.env.NODE_ENV !== "production";
    mainContainer.prepend(this.renderer.domElement);

    this.topRenderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance",
      alpha: true,
      premultipliedAlpha: false,
    });
    this.topRenderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.topRenderer.shadowMap.enabled = true;
    this.topRenderer.shadowMap.type = THREE.PCFShadowMap; // r153 PCFSoftShadowMap was removed in r186
    this.topRenderer.autoClear = true;
    topContainer.prepend(this.topRenderer.domElement);

    this.assets = new AssetsManager(this.renderer);

    this.modelCamera = new ModelCamera(this.assets);
    this.camera = new MainCamera(this.assets);
    this.modelCamera.add(this.pointerCamera);
    this.pointerCamera.add(this.camera);
    this.envScene.add(this.modelCamera);
    this.envScene.background = new THREE.Color().setHex(0xffffff, THREE.LinearSRGBColorSpace);

    this.mainTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      stencilBuffer: true,
      depthBuffer: true,
      depthTexture: new THREE.DepthTexture(1, 1),
    });
    this.compMaterial = new THREE.ShaderMaterial({
      vertexShader: quadVertex,
      fragmentShader: grainFragment,
      uniforms: {
        tDiffuse: { value: this.mainTarget.texture },
        uNoiseStrength: { value: isTabletWidth() ? 0 : GRAIN_STRENGTH },
        uTime: this.time,
      },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(this.planeGeometry, this.compMaterial);
    quad.scale.set(2, 2, 1);
    this.compScene.add(quad);
    this.compCamera.position.z = 1;

    // Source: the fluid simulation is disabled only for touch + tablet widths.
    if (!(isTouch() && isTabletWidth())) this.createFluid();

    this.interfaceScene = new InterfaceScene(this);
    this.topScene = new TopScene(this);

    this.unsubs.push(
      emitter.on("render", this.onRender),
      emitter.on("resize", this.onResize),
      emitter.on("pointerMove", (p) => this.pointerCamera.onPointerMove(p.webgl.x, p.webgl.y)),
    );
    this.onResize(leo.viewport);
  }

  /** Source `usesFluidEffects`: section colours become WebGL planes so the fluid can warp them. */
  usesFluidEffects(): boolean {
    return this.fluid !== null;
  }

  private createFluid(): void {
    this.fluid = new FluidSimulation(this.renderer);
    const rt = () => new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
    this.fluidTargetA = rt();
    this.fluidTargetB = rt();
    this.blurMaterial = new THREE.ShaderMaterial({
      vertexShader: quadVertex,
      fragmentShader: FLUID_BLUR_FRAG,
      uniforms: {
        tDiffuse: { value: this.fluidTargetA.texture },
        tVelocity: { value: this.fluid.velocity },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uBlurRadius: { value: 0 },
        uDistortionStrength: { value: 0.003 },
        uVelocityBlurScale: { value: 15 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.finalMaterial = new THREE.ShaderMaterial({
      vertexShader: quadVertex,
      fragmentShader: FLUID_FINAL_FRAG,
      uniforms: { tDiffuse: { value: this.fluidTargetB.texture }, tVelocity: { value: this.fluid.velocity } },
      depthTest: false,
      depthWrite: false,
    });
    const blurQuad = new THREE.Mesh(this.planeGeometry, this.blurMaterial);
    blurQuad.scale.set(2, 2, 1);
    this.blurScene.add(blurQuad);
    const finalQuad = new THREE.Mesh(this.planeGeometry, this.finalMaterial);
    finalQuad.scale.set(2, 2, 1);
    this.finalScene.add(finalQuad);
  }

  async loadGlobal(): Promise<void> {
    await this.assets.loadGlobal();
    this.topScene.onAssetsReady();
    this.interfaceScene.onAssetsReady();
  }

  ensureHome(): Promise<HomeEnvironment> {
    if (this.homeEnv) return Promise.resolve(this.homeEnv);
    if (!this.homePromise) {
      this.homePromise = this.assets.ensureHome().then(() => {
        const env = new HomeEnvironment(this.assets, this.time);
        this.homeEnv = env;
        this.envScene.add(env);
        this.syncGroupsVisibility();
        return env;
      });
      this.homePromise.catch(() => (this.homePromise = null));
    }
    return this.homePromise;
  }

  ensureAbout(): Promise<AboutEnvironment> {
    if (this.aboutEnv) return Promise.resolve(this.aboutEnv);
    if (!this.aboutPromise) {
      this.aboutPromise = this.assets.ensureAbout().then(() => {
        const env = new AboutEnvironment(this.assets, this.planeGeometry, this.time);
        this.aboutEnv = env;
        this.envScene.add(env);
        this.syncGroupsVisibility();
        return env;
      });
      this.aboutPromise.catch(() => (this.aboutPromise = null));
    }
    return this.aboutPromise;
  }

  /**
   * The playground pavilion is fully procedural: nothing to download. It is built on first use and
   * only joins the scene once its shaders are compiled (in parallel, off the main thread), so the
   * render loop never stalls on them.
   */
  ensurePlayground(): Promise<PlaygroundEnvironment> {
    if (!this.playgroundPromise) {
      const env = new PlaygroundEnvironment(this.renderer);
      const { width, height, dpr } = leo.viewport;
      env.setSize(width * dpr, height * dpr);
      this.playgroundPromise = env.precompile(this.renderer, this.camera).then(() => {
        this.playgroundEnv = env;
        this.envScene.add(env);
        this.syncGroupsVisibility();
        return env;
      });
    }
    return this.playgroundPromise;
  }

  /** Source `scene.show(route)` + camera setup for the route. */
  async showRoute(route: RouteName): Promise<void> {
    this.currentRoute = route;
    this.isPlaygroundPageActive = route === "playground";
    if (route === "home") await this.ensureHome();
    if (route === "about") await this.ensureAbout();
    if (route === "playground") await this.ensurePlayground();
    this.modelCamera.setModelCameraProperties(route);
    this.camera.setModelCameraFov(route);
    this.camera.position.set(0, 0, 0);
    this.camera.rotation.set(0, 0, 0);
    leo.isOnHeader = true;
    this.camera.resize(leo.viewport.ratio, route);
    this.updateGroupsScrollActive(leo.scroll);
  }

  /**
   * Intro of a route's 3D header: the camera dolly (`ModelCamera.show`) and, on the playground,
   * the crystal daisy opening at the same time.
   */
  enterRoute(route: RouteName, initial: boolean): gsap.core.Timeline {
    const tl = gsap.timeline();
    tl.add(this.modelCamera.show(route, initial), 0);
    if (route === "playground" && this.playgroundEnv) tl.add(this.playgroundEnv.form(initial), 0);
    return tl;
  }

  /** Compile both environments once so the reveal does not hitch (source shader prewarm). */
  prewarm(): void {
    this.prewarmActive = true;
    this.syncGroupsVisibility();
    this.renderer.compile(this.envScene, this.camera);
    this.prewarmActive = false;
    this.syncGroupsVisibility();
  }

  setHeaderScrollRect(rect: { y: number; height: number } | null): void {
    this.headerRect = rect;
    this.updateGroupsScrollActive(leo.scroll);
  }

  setWebglSectionScrollRect(rect: { y: number; height: number } | null): void {
    this.webglSectionRect = rect;
    this.updateGroupsScrollActive(leo.scroll);
  }

  private inHeader(scroll: number): boolean {
    const r = this.headerRect;
    if (!r || !leo.isOnHeader) return false;
    const p = scroll / r.height;
    return p >= 0 && p <= 1;
  }

  private inWebglSection(scroll: number): boolean {
    const r = this.webglSectionRect;
    if (!r) return false;
    return scroll >= r.y - window.innerHeight && scroll <= r.y + r.height;
  }

  updateGroupsScrollActive(scroll: number): void {
    if (this.prewarmActive || this.pageTransitionHidingGroups) return;
    if (this.isPlaygroundPageActive || this.currentRoute === "playground") {
      this.isHomeAboutGroupsRenderActive = false;
      this.isPlaygroundGroupsRenderActive = this.inHeader(scroll);
    } else {
      this.isHomeAboutGroupsRenderActive = this.inHeader(scroll) || this.inWebglSection(scroll);
      this.isPlaygroundGroupsRenderActive = false;
    }
    this.syncGroupsVisibility();
  }

  syncGroupsVisibility(): void {
    if (this.prewarmActive) {
      if (this.homeEnv) this.homeEnv.visible = true;
      if (this.aboutEnv) this.aboutEnv.visible = true;
      if (this.playgroundEnv) this.playgroundEnv.visible = true;
      return;
    }
    if (this.pageTransitionHidingGroups) return;
    const route = this.currentRoute;
    const active = this.isHomeAboutGroupsRenderActive && !this.isPlaygroundPageActive;
    if (this.homeEnv) this.homeEnv.visible = active && route === "home";
    if (this.aboutEnv) this.aboutEnv.visible = active && route === "about";
    if (this.playgroundEnv) this.playgroundEnv.visible = this.isPlaygroundGroupsRenderActive && route === "playground";
  }

  /** Keep the current env visible while the transition disc covers the screen. */
  beginPageTransitionHide(): void {
    this.pageTransitionHidingGroups = true;
  }

  endPageTransitionHide(): void {
    this.pageTransitionHidingGroups = false;
    this.isHomeAboutGroupsRenderActive = false;
    this.isPlaygroundGroupsRenderActive = false;
    this.syncGroupsVisibility();
  }

  private onRender = ({ et, dt }: FrameInfo) => {
    this.time.value = et;
    this.topScene.render(et, dt);
    this.topRenderer.render(this.topScene, this.topCamera);

    this.updateGroupsScrollActive(leo.scroll);
    const headerActive = (this.isHomeAboutGroupsRenderActive && !this.isPlaygroundPageActive) || this.isPlaygroundGroupsRenderActive;
    if (!isTouch() && headerActive) this.pointerCamera.tick(dt);
    if (this.homeEnv?.visible) {
      this.homeEnv.render(et);
      this.homeEnv.renderFace(et, this.camera);
    }
    if (this.aboutEnv?.visible) {
      this.aboutEnv.render(et);
      this.aboutEnv.renderFace(et, this.camera);
    }
    this.domCamera.tick();
    this.interfaceScene.render(et, dt);

    const r = this.renderer;
    if (this.fluid) {
      this.fluid.tickInput();
      this.fluid.update(dt);
    }
    const crystal = this.playgroundEnv?.visible ? this.playgroundEnv : null;
    this.compMaterial.uniforms.uNoiseStrength.value = isTabletWidth() ? 0 : crystal ? PLAYGROUND_GRAIN_STRENGTH : GRAIN_STRENGTH;
    if (crystal) {
      crystal.update(r, this.envScene, this.camera, et);
      r.setRenderTarget(crystal.post.target);
      r.clear();
      r.render(this.envScene, this.camera);
      crystal.post.render(r, this.mainTarget);
    } else {
      r.setRenderTarget(this.mainTarget);
      r.clear();
      r.render(this.envScene, this.camera);
    }
    if (this.fluid && this.fluidTargetA && this.fluidTargetB && this.blurMaterial && this.finalMaterial) {
      // Source composer: comp(grain) → interface layer 0 → fluid distortion → sharp layer → final.
      r.setRenderTarget(this.fluidTargetA);
      r.clear();
      r.render(this.compScene, this.compCamera);
      r.clearDepth();
      this.domCamera.layers.set(0);
      r.render(this.interfaceScene, this.domCamera);
      r.setRenderTarget(this.fluidTargetB);
      r.clear();
      r.render(this.blurScene, this.compCamera);
      r.clearDepth();
      this.domCamera.layers.set(SHARP_LAYER);
      r.render(this.interfaceScene, this.domCamera);
      r.setRenderTarget(null);
      r.clear();
      r.render(this.finalScene, this.compCamera);
      return;
    }
    r.setRenderTarget(null);
    r.clear();
    r.render(this.compScene, this.compCamera);
    // Source composer: interface default layer, then the "sharp" layer (sliders, flowers)
    // in its own pass with a depth clear so drag-pushed planes never sink behind backgrounds.
    r.clearDepth();
    this.domCamera.layers.set(0);
    r.render(this.interfaceScene, this.domCamera);
    r.clearDepth();
    this.domCamera.layers.set(SHARP_LAYER);
    r.render(this.interfaceScene, this.domCamera);
  };

  private onResize = (vp: ViewportInfo) => {
    const { width, height, dpr, postDpr } = vp;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height);
    this.topRenderer.setPixelRatio(postDpr);
    this.topRenderer.setSize(width, height);
    this.mainTarget.setSize(width * dpr, height * dpr);
    this.fluidTargetA?.setSize(width * dpr, height * dpr);
    this.fluidTargetB?.setSize(width * dpr, height * dpr);
    this.playgroundEnv?.setSize(width * dpr, height * dpr);
    this.blurMaterial?.uniforms.uResolution.value.set(width * dpr, height * dpr);
    this.fluid?.resize(width, height);
    this.modelCamera.resize(vp.ratio);
    this.camera.resize(vp.ratio, this.currentRoute ?? "home");
    this.domCamera.resize(width, height);
    this.topCamera.resize(vp.ratio);
    this.homeEnv?.applyGradientScale();
    this.topScene.resize(vp);
    this.interfaceScene.resize();
  };

  dispose(): void {
    for (const u of this.unsubs) u();
    this.homeEnv?.dispose();
    this.aboutEnv?.dispose();
    this.playgroundEnv?.dispose();
    this.mainTarget.dispose();
    this.fluid?.dispose();
    this.fluidTargetA?.dispose();
    this.fluidTargetB?.dispose();
    this.renderer.dispose();
    this.topRenderer.dispose();
    this.assets.dispose();
  }
}
