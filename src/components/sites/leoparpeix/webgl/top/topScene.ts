import gsap from "gsap";
import * as THREE from "three";
import { leo } from "../../core/app";
import { emitter, type ViewportInfo } from "../../core/emitter";
import { ambientLight } from "../lights";
import type { WebglManager } from "../manager";
import { isDesktopWidth } from "../../core/env";
import { beePose, domToWorldSize, heroBeeSuppressed, type BeeLayout, type BeePose } from "./beePath";
import { ContentBee } from "./contentBee";
import { FOOTER_BEE_PARAMS, HERO_BEE_PARAMS, HeroBee } from "./heroBee";
import { LoaderMask, PageTransition, type TransitionUniforms } from "./overlays";
import { createShadowCatcher } from "./transitionMaterial";

const SHADOW_FACTOR = 2;

/**
 * Top layer scene (`hq`, line ~68352): intro card mask, page transition disc, hero & footer
 * bees with their shadow catchers. The playground content bee plugs in through `extraBees`
 * / `contentBee` (see `contentBee.ts`).
 */
export class TopScene extends THREE.Scene {
  readonly uniforms: TransitionUniforms;
  loaderMask: LoaderMask;
  pageTransition: PageTransition | null = null;
  heroBee: HeroBee | null = null;
  footerBee: HeroBee | null = null;
  readonly heroEnterGroup = new THREE.Group();
  readonly footerEnterGroup = new THREE.Group();
  private heroShadow: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial> | null = null;
  private footerShadow: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial> | null = null;
  private renderHooks = new Set<(et: number, dt: number) => void>();
  private revealFadePlayed = false;
  private revealFade: gsap.core.Timeline | null = null;
  readonly extraBees: HeroBee[] = [];
  readonly contentGroup = new THREE.Group();
  contentBee: ContentBee | null = null;
  private contentShadow: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial> | null = null;
  /** Playground choreography state (source `C.playgroundContentBee*`). */
  readonly playground = {
    layout: null as BeeLayout | null,
    show: false,
    blockStartScroll: 0,
    footerStart: 0,
    suppressHeroUntilReset: false,
  };

  constructor(private manager: WebglManager) {
    super();
    const { width, height, postDpr } = leo.viewport;
    this.uniforms = {
      uTransition: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uViewport: { value: new THREE.Vector2(width * postDpr, height * postDpr) },
      uBeeRevealScale: { value: 0 },
      uFruitRevealScale: { value: 0 },
      uShadowReveal: { value: 0 },
    };
    this.add(ambientLight(0xffffff, 0.5));
    this.add(this.heroEnterGroup, this.footerEnterGroup);
    this.loaderMask = new LoaderMask(manager.planeGeometry);
    this.add(this.loaderMask);
    emitter.on("loaderRevealComplete", () => {
      this.setBeeSceneVisible(true);
      this.setFruitsVisible(true);
      this.playLoadRevealFade();
    });
  }

  onAssetsReady(): void {
    if (this.pageTransition) return;
    const { assets, topCamera, planeGeometry } = this.manager;
    this.pageTransition = new PageTransition(planeGeometry, this.uniforms, assets);
    this.add(this.pageTransition);

    this.heroShadow = createShadowCatcher(planeGeometry, this.uniforms);
    this.heroEnterGroup.add(this.heroShadow);
    this.heroBee = new HeroBee(HERO_BEE_PARAMS, this.uniforms, assets, topCamera);
    this.heroBee.enterScaleGroup.removeFromParent();
    this.heroEnterGroup.add(this.heroBee.enterScaleGroup);
    this.add(this.heroBee);

    this.footerShadow = createShadowCatcher(planeGeometry, this.uniforms);
    this.footerEnterGroup.add(this.footerShadow);
    this.footerBee = new HeroBee(FOOTER_BEE_PARAMS, this.uniforms, assets, topCamera);
    this.add(this.footerBee);

    this.add(this.contentGroup);
    this.contentShadow = createShadowCatcher(planeGeometry, this.uniforms);
    this.contentGroup.add(this.contentShadow);
    this.contentBee = new ContentBee(this.uniforms, assets, topCamera, this.manager.topRenderer.domElement);
    this.contentBee.visible = false;
    this.contentBee.directionalLight.visible = false;
    this.contentGroup.add(this.contentBee);
    this.contentGroup.visible = false;

    this.setBeeSceneVisible(false);
    this.resize(leo.viewport);
  }

  addRenderHook(fn: (et: number, dt: number) => void): () => void {
    this.renderHooks.add(fn);
    return () => this.renderHooks.delete(fn);
  }

  private setFruitsVisible(v: boolean): void {
    this.heroBee?.setFruitsVisible(v);
    this.footerBee?.setFruitsVisible(v);
  }

  private setAllCastShadow(v: boolean): void {
    this.heroBee?.setCastShadowEnabled(v);
    this.footerBee?.setCastShadowEnabled(v);
    this.contentBee?.setCastShadowEnabled(v);
  }

  isContentBeeDisplayed(): boolean {
    return isDesktopWidth() && this.playground.show;
  }

  /** Source `updateContentBeeLayout`: shadow catcher sized to the media grid. */
  updateContentBeeLayout(inner: { width: number; height: number }): void {
    const s = domToWorldSize(inner, this.manager.topCamera.dimensions);
    this.contentShadow?.scale.set(s.width, s.height, 1e-5);
  }

  private applyContentPose(p: BeePose): void {
    this.contentGroup.position.set(p.x, p.y, p.z);
    this.contentBee?.setPathMotion({ heading: p.heading, pitch: p.pitch, landPitch: p.landPitch, skyZ: p.skyZ });
  }

  setContentBeeGroupScroll(cameraY: number, p: BeePose): void {
    this.applyContentPose(p);
    this.setOverlayY(cameraY);
  }

  setContentBeeGroupPosition(p: BeePose): void {
    this.applyContentPose(p);
  }

  resetContentBee(): void {
    this.contentGroup.position.set(0, 0, 0);
  }

  poseAt(scroll: number, layout: BeeLayout, footer: number): BeePose {
    return beePose(scroll, layout, this.manager.topCamera.dimensions.height, footer);
  }

  /** Source `_playLoadRevealFade`: bee scale → shadow → fruits, .6s each, .1s apart. */
  private playLoadRevealFade(): void {
    if (this.revealFadePlayed) return;
    this.revealFadePlayed = true;
    this.setAllCastShadow(false);
    const { uBeeRevealScale, uFruitRevealScale, uShadowReveal } = this.uniforms;
    this.revealFade?.kill();
    this.revealFade = gsap
      .timeline()
      .to(uBeeRevealScale, { value: 1, duration: 0.6, ease: "power2.out" })
      .to(
        uShadowReveal,
        {
          value: 1,
          duration: 0.6,
          ease: "power2.out",
          onStart: () => this.setAllCastShadow(true),
          onUpdate: () => this.syncBeeVisibility(),
        },
        "+=0.1",
      )
      .to(uFruitRevealScale, { value: 1, duration: 0.6, ease: "power2.out" }, "+=0.1");
  }

  private setBeeSceneVisible(v: boolean): void {
    if (this.pageTransition) this.pageTransition.visible = true;
    if (!v) {
      this.heroEnterGroup.visible = false;
      this.footerEnterGroup.visible = false;
      if (this.heroBee) {
        this.heroBee.visible = false;
        this.heroBee.directionalLight.visible = false;
      }
      if (this.footerBee) {
        this.footerBee.visible = false;
        this.footerBee.directionalLight.visible = false;
      }
      this.setFruitsVisible(false);
      this.setAllCastShadow(false);
      if (this.heroShadow) this.heroShadow.visible = false;
      if (this.footerShadow) this.footerShadow.visible = false;
      this.uniforms.uShadowReveal.value = 0;
      this.uniforms.uBeeRevealScale.value = 0;
      this.uniforms.uFruitRevealScale.value = 0;
      this.revealFade?.kill();
      this.revealFadePlayed = false;
      return;
    }
    this.syncBeeVisibility();
  }

  syncBeeVisibility(): void {
    if (!this.heroBee || !this.footerBee) return;
    const content = this.isContentBeeDisplayed();
    const footer = leo.showFooterBee && !content;
    const pg = this.playground;
    const heroHidden =
      (this.manager.isPlaygroundPageActive && heroBeeSuppressed(leo.scroll, pg.layout, pg.blockStartScroll)) || pg.suppressHeroUntilReset;
    const hero = !content && !footer && !heroHidden;
    this.contentGroup.visible = content;
    if (this.contentBee) {
      this.contentBee.visible = content;
      this.contentBee.directionalLight.visible = content;
    }
    if (this.contentShadow) this.contentShadow.visible = content && this.uniforms.uShadowReveal.value > 0.001;
    this.heroEnterGroup.visible = hero;
    this.heroBee.visible = hero;
    this.heroBee.directionalLight.visible = hero;
    this.footerEnterGroup.visible = footer;
    this.footerBee.visible = footer;
    this.footerBee.directionalLight.visible = footer;
    const shadows = this.uniforms.uShadowReveal.value > 0.001;
    if (this.heroShadow) this.heroShadow.visible = hero && shadows;
    if (this.footerShadow) this.footerShadow.visible = footer && shadows;
  }

  resetBeeInteractions(): void {
    this.heroBee?.resetInteraction();
    this.footerBee?.resetInteraction();
    Object.assign(this.playground, { layout: null, show: false, blockStartScroll: 0, footerStart: 0, suppressHeroUntilReset: false });
    this.resetContentBee();
    this.contentBee?.resetMotion();
    this.syncBeeVisibility();
  }

  /** Overlays follow the scroll camera so they always cover the viewport. */
  setOverlayY(y: number): void {
    if (this.pageTransition) this.pageTransition.position.y = y;
    this.loaderMask.position.y = y;
  }

  render(et: number, dt: number): void {
    this.setOverlayY(this.manager.topCamera.position.y);
    for (const fn of this.renderHooks) fn(et, dt);
    if (!leo.isLoaderRevealComplete) return;
    const content = this.isContentBeeDisplayed();
    if (content) {
      this.contentBee?.render(et, dt);
      this.contentBee?.tick();
    } else {
      this.contentBee?.tick();
      if (leo.showFooterBee) this.footerBee?.render(et, dt);
      else this.heroBee?.render(et, dt);
    }
    for (const b of this.extraBees) b.render(et + b.phaseOffset, dt);
    this.syncBeeVisibility();
  }

  hide(onCovered?: () => void): gsap.core.Timeline {
    const tl = gsap.timeline();
    if (this.pageTransition) tl.add(this.pageTransition.hide(onCovered), 0);
    else tl.call(() => onCovered?.(), undefined, 0);
    return tl;
  }

  show(): gsap.core.Timeline {
    const tl = gsap.timeline();
    if (this.pageTransition) tl.add(this.pageTransition.show(), 0);
    return tl;
  }

  resize(vp: ViewportInfo): void {
    const { width, height } = this.manager.topCamera.dimensions;
    this.uniforms.uResolution.value.set(width, height);
    this.uniforms.uViewport.value.set(vp.width * vp.postDpr, vp.height * vp.postDpr);
    this.loaderMask.resize(width, height);
    this.pageTransition?.resize(width, height);
    this.heroShadow?.scale.set(width, height * SHADOW_FACTOR, 1e-5);
    this.footerShadow?.scale.set(width, height * SHADOW_FACTOR, 1e-5);
    this.heroBee?.syncShadowFrustum(this.manager.topCamera.dimensions);
    this.footerBee?.syncShadowFrustum(this.manager.topCamera.dimensions);
    this.contentBee?.syncShadowFrustum(this.manager.topCamera.dimensions);
    for (const b of this.extraBees) b.syncShadowFrustum(this.manager.topCamera.dimensions);
  }
}
