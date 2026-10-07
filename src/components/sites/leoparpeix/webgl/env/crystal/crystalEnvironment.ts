import gsap from "gsap";
import * as THREE from "three";
import { leo } from "../../../core/app";
import { isTabletWidth } from "../../../core/env";
import { Pavilion } from "./architecture";
import { Backdrop } from "./backdrop";
import { MirrorFloor } from "./floor";
import { CrystalFlower } from "./flower";
import { FlorereGarden } from "./florere/garden";
import { COLORS, applyEnvironment, captureEnvironment } from "./materials";
import { CrystalPost } from "./post";
import { Props } from "./props";
import { FLOWER, RIG_CAMERA, STAGE_ORIGIN, SUN_STAGE, stageToWorld } from "./layout";
import { createJewelEnvironment, createLightformers, disposeLightformers } from "./lightformers";
import { SunShafts } from "./world";

/**
 * Adaptive resolution of the pavilion's HDR pass: refraction re-renders the scene behind the glass,
 * so on integrated GPUs the pass follows the frame time between ≈ 0.85× CSS pixels and the full DPR,
 * upscaled by the tone-map pass. `?quality=high` pins it to full resolution (visual QA).
 */
const ADAPT = { slowMs: 24, fastMs: 15, step: 0.08, everyMs: 900 } as const;

function pinnedQuality(): boolean {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("quality") === "high";
}

/** Surroundings reflected inside traced crystal: the pavilion capture or the jewel studio. */
const TRACED_ENV = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("crystalEnv") === "jewel" ? "jewel" : "pavilion";

/** `?debug=backdrop | lighting | composition | sun | glass | probe` (development only). */
function debugMode(): string | null {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("debug");
}

/**
 * Playground 3D header: a frosted crystal daisy in a sunlit glass pavilion over clouds and
 * mountains (docs/design-references/playground-crystal-reference.png).
 * Component map: docs/research/leoparpeix/implementation/playground-crystal/SCENE_COMPONENT_MAP.md.
 */
export class PlaygroundEnvironment extends THREE.Group {
  readonly post: CrystalPost;
  readonly flower: CrystalFlower;
  private readonly stage = new THREE.Group();
  private readonly backdrop: Backdrop;
  private readonly floor: MirrorFloor;
  private readonly pavilion: Pavilion;
  private readonly props: Props;
  private readonly garden: FlorereGarden;
  private readonly shafts: SunShafts;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private readonly jewelTarget: THREE.WebGLRenderTarget;
  private viewKey = "";
  private shadowsBaked = false;
  private readonly lite = isTabletWidth();
  private readonly bufferSize = new THREE.Vector2(1, 1);
  private readonly pinned = pinnedQuality();
  private renderScale = 1;
  private frameMs = 16;
  private lastEt = -1;
  private lastAdapt = 0;
  private openTl: gsap.core.Timeline | null = null;
  private readonly debug = debugMode();

  constructor(renderer: THREE.WebGLRenderer) {
    super();
    const lite = isTabletWidth();
    this.post = new CrystalPost(lite ? 0 : 4);

    this.backdrop = new Backdrop(RIG_CAMERA.position);
    this.add(this.backdrop);

    this.stage.position.copy(STAGE_ORIGIN);
    this.stage.rotation.y = Math.PI / 2;
    this.add(this.stage);

    this.floor = new MirrorFloor(lite ? 0.4 : 0.6);
    this.stage.add(this.floor);
    this.pavilion = new Pavilion(lite ? 48 : 96);
    this.stage.add(this.pavilion);
    this.props = new Props(lite);
    this.stage.add(this.props);
    this.shafts = new SunShafts(new THREE.Color(COLORS.sun));
    this.stage.add(this.shafts);
    this.flower = new CrystalFlower();
    this.stage.add(this.flower);
    this.garden = new FlorereGarden(this.debug === "florere");
    this.stage.add(this.garden);
    if (this.debug === "florere") this.flower.visible = this.props.visible = false;

    // Sun: warm, from the right and a little behind the colonnade (glare on the right pier,
    // diagonal light through the arches on the floor, back-lit petals and crystals).
    const sun = new THREE.DirectionalLight(COLORS.sun, 9);
    const target = stageToWorld(0.5, 0, -1.5);
    sun.position.copy(new THREE.Vector3(SUN_STAGE.z, SUN_STAGE.y, -SUN_STAGE.x).multiplyScalar(30).add(target));
    sun.target.position.copy(target);
    sun.castShadow = true;
    const map = lite ? 1024 : 4096;
    sun.shadow.mapSize.set(map, map);
    const sc = sun.shadow.camera;
    // Wide enough for the side colonnade whose shadows band the floor.
    sc.left = -16;
    sc.right = 16;
    sc.top = 16;
    sc.bottom = -16;
    sc.near = 1;
    sc.far = 70;
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.025;
    sun.shadow.radius = 3;
    this.add(sun, sun.target);
    // Sky fill (kept low: the environment map does most of the ambient work).
    const hemi = new THREE.HemisphereLight(0xd6e3ee, 0xf0dcc0, 0.24);
    this.add(hemi);
    // Warm bounce from the sunlit marble towards the camera side of everything.
    const bounce = new THREE.DirectionalLight(0xffd9ad, 0.25);
    bounce.position.copy(stageToWorld(-3, 1, 12));
    bounce.target.position.copy(stageToWorld(0, 2.5, -4));
    this.add(bounce, bounce.target);

    // Cut crystal reflects its own jewel surround (dark, with softboxes; see lightformers.ts). Every
    // other material holds it as a placeholder until the pavilion is captured: same map type and
    // size, so swapping in the capture reuses the compiled programs instead of recompiling them all.
    this.jewelTarget = createJewelEnvironment(renderer, SUN_STAGE, new THREE.Color(COLORS.sun));
    applyEnvironment(this.stage, this.jewelTarget.texture);

    if (this.debug === "lighting" || this.debug === "sun") this.applyClay();
    if (this.debug === "sun") hemi.intensity = bounce.intensity = 0;
    if (this.debug === "backdrop") this.stage.visible = false;
    if (this.debug) Object.assign(window, { __crystal: this });
    if (this.debug === "glass") this.plainGlass();
    if (this.debug === "composition") for (const o of [this.flower, this.props, this.garden, this.pavilion]) this.add(new THREE.BoxHelper(o, 0xff0055));
  }

  /** Neutral clay everywhere: reads the light hierarchy alone. */
  private applyClay(): void {
    const clay = new THREE.MeshStandardMaterial({ color: 0xbdbdbd, roughness: 0.8 });
    this.stage.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !(m.material instanceof THREE.ShaderMaterial)) m.material = clay;
    });
  }

  /** Physical glass only: no fire, internal bounce, edge lines or glitter. */
  private plainGlass(): void {
    this.stage.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      const u = m?.userData.uniforms as Record<string, THREE.IUniform> | undefined;
      if (!u) return;
      for (const k of ["uFire", "uInner", "uGlitter"]) if (u[k]) u[k].value = 0;
    });
  }

  /** Before the intro: the daisy is a closed bud. */
  hold(): void {
    this.openTl?.kill();
    this.flower.open = 0;
  }

  /** The daisy opens while the camera dollies in (`ModelCamera.show`). */
  form(initial: boolean): gsap.core.Timeline {
    this.openTl?.kill();
    const tl = gsap.timeline();
    if (leo.skipLoader) {
      this.flower.open = 1;
      return tl;
    }
    tl.fromTo(this.flower, { open: 0 }, { open: 1, duration: initial ? 2.8 : 2.2, ease: initial ? "expo.inOut" : "expo.out" });
    this.openTl = tl;
    return tl;
  }

  /** Drawing-buffer size; the HDR pass renders at `renderScale` of it. */
  setSize(width: number, height: number): void {
    this.bufferSize.set(width, height);
    this.applyScale();
  }

  private applyScale(): void {
    const w = Math.max(1, Math.round(this.bufferSize.x * this.renderScale));
    const h = Math.max(1, Math.round(this.bufferSize.y * this.renderScale));
    this.post.setSize(w, h);
    this.floor.setSize(w, h);
  }

  /** Lower the HDR pass resolution while frames are slow, raise it back when there is headroom. */
  private adapt(et: number): void {
    const dt = this.lastEt < 0 ? 16 : et - this.lastEt;
    this.lastEt = et;
    if (this.pinned || dt <= 0 || dt > 250) return;
    this.frameMs += (dt - this.frameMs) * 0.08;
    if (et - this.lastAdapt < ADAPT.everyMs) return;
    this.lastAdapt = et;
    const minScale = Math.min(1, Math.max(0.5, 0.85 / leo.viewport.dpr));
    let next = this.renderScale;
    if (this.frameMs > ADAPT.slowMs) next = Math.max(minScale, next - ADAPT.step);
    else if (this.frameMs < ADAPT.fastMs) next = Math.min(1, next + ADAPT.step / 2);
    if (next !== this.renderScale) {
      this.renderScale = next;
      this.applyScale();
    }
  }

  /** Bakes the backdrop for the camera's current frustum when it changed (resize, zoom). */
  private syncView(camera: THREE.PerspectiveCamera): void {
    const { width, height, dpr } = leo.viewport;
    const key = `${camera.fov}|${camera.zoom}|${camera.aspect.toFixed(4)}|${width}|${height}|${dpr}`;
    if (key === this.viewKey) return;
    this.viewKey = key;
    this.backdrop.setView(camera, width, height, dpr);
  }

  /**
   * Image-based light from the pavilion itself plus capture-only lightformers, once the sky is
   * baked. The glass is hidden during the capture, and so is everything else in the shared scene.
   */
  private captureEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    const hide: THREE.Object3D[] = [...scene.children.filter((c) => c !== this), this.flower, ...this.props.glass, ...this.garden.glass, ...this.pavilion.glass, this.shafts];
    const studio = createLightformers(new THREE.Color(COLORS.sun));
    this.stage.add(studio);
    this.backdrop.sunDisc = 40;
    this.floor.capturing = true;
    const position = stageToWorld(FLOWER.head.x, FLOWER.head.y, FLOWER.head.z + 0.8);
    this.envTarget = captureEnvironment(renderer, scene, position, hide);
    this.floor.capturing = false;
    this.backdrop.sunDisc = 0;
    this.stage.remove(studio);
    disposeLightformers(studio);
    // Everything but the cut crystal (which keeps the jewel surround) reflects the pavilion.
    applyEnvironment(this.stage, this.envTarget.texture, (m) => !m.userData.traced || TRACED_ENV === "pavilion");
  }

  /**
   * Compiles every program of the pavilion (and the sky bake) without blocking the main thread
   * (KHR_parallel_shader_compile), so the first frame does not stall for seconds on Direct3D.
   */
  async precompile(renderer: THREE.WebGLRenderer, camera: THREE.Camera): Promise<void> {
    const visible = this.visible;
    this.visible = true;
    try {
      await Promise.all([renderer.compileAsync(this, camera), this.backdrop.compile(renderer)]);
    } finally {
      this.visible = visible;
    }
  }

  /** Per frame, before the main pass: sky strip, environment (once), animation, floor reflection. */
  update(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, et: number): void {
    this.adapt(et);
    // Nothing that casts a shadow moves: render the sun's shadow map once.
    renderer.shadowMap.autoUpdate = false;
    if (!this.shadowsBaked) {
      renderer.shadowMap.needsUpdate = true;
      this.shadowsBaked = true;
    }
    // The refraction buffer behind the glass: the frosted petals blur it anyway.
    renderer.transmissionResolutionScale = this.lite ? 0.35 : 0.45;
    this.syncView(camera);
    this.backdrop.update(renderer, et);
    if (!this.envTarget && this.backdrop.ready) this.captureEnvironment(renderer, scene);
    this.pavilion.render(et);
    this.props.render(et);
    this.shafts.render(et);
    this.flower.update(et);
    this.garden.update(et);
    this.floor.update(renderer, scene, camera, et);
  }

  dispose(): void {
    this.openTl?.kill();
    this.flower.dispose();
    this.floor.dispose();
    this.pavilion.dispose();
    this.props.dispose();
    this.garden.dispose();
    this.shafts.dispose();
    this.backdrop.dispose();
    this.post.dispose();
    this.envTarget?.dispose();
    this.jewelTarget.dispose();
  }
}
