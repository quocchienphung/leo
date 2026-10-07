import * as THREE from "three";
import { isTabletWidth } from "../../core/env";
import { clamp, lerp, offsetRect } from "../../core/math";
import type { WebglManager } from "../manager";
import { flatColorFragment, flatColorVertex, sliderFragment, sliderVertex } from "../shaders/screen";
import { FlowerField } from "./flowers";
import { sliderConfig, sliderGap, type SliderConfig, type SliderParams } from "./sliderConfig";

/** Interface layer index (`ql`). */
export const SHARP_LAYER = 1;

const COVER_BLEED = 1.05;

interface MediaEntry {
  index: number;
  projectIndex: number;
  dom: HTMLElement;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  rect: DOMRect;
}

interface BackgroundEntry {
  index: number;
  dom: HTMLElement;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  disableOverscan: boolean;
}

/** Section colours (`_colors`, line ~60289). */
const PAGE_COLORS = {
  home: new THREE.Color(0.9686, 0.9686, 0.9686),
  about: new THREE.Color(0.031, 0.239, 0.165),
  playground: new THREE.Color(0.965, 0.878, 0.086),
} as const;
const PLANE_OVERSCAN = 1.02; // DY

interface ActiveSlider {
  params: SliderParams;
  delta: { x: number; y: number };
  config: SliderConfig;
}

/**
 * DOM-synced plane scene (`qY`, line ~60273). Coordinates are CSS pixels: a plane placed at
 * `(-left + w/2 …)` lines up with its DOM placeholder when the camera sits at `y = -scroll`.
 */
export class InterfaceScene extends THREE.Scene {
  private mediaGeometry = new THREE.PlaneGeometry(1, 1, 16, 16);
  private projects: THREE.Group[] = [];
  private medias: MediaEntry[] = [];
  private sliders = new Map<number, ActiveSlider>();
  private backgrounds: BackgroundEntry[] = [];
  readonly flowers: FlowerField;

  constructor(private manager: WebglManager) {
    super();
    this.flowers = new FlowerField(this, manager);
  }

  onAssetsReady(): void {
    this.flowers.onAssetsReady();
  }

  private placeFromRect(mesh: THREE.Object3D, r: DOMRect): void {
    mesh.position.x = r.left - window.innerWidth / 2 + r.width / 2;
    mesh.position.y = -r.top + window.innerHeight / 2 - r.height / 2;
  }

  private parallaxX(x: number): number {
    return (x / (window.innerWidth * 0.5)) * sliderConfig().parallaxXMultiplier;
  }

  /**
   * Source `addBackgrounds`: a flat colour plane behind a DOM section. Used where the DOM is
   * transparent because WebGL content (sliders) is drawn underneath it.
   */
  addBackground(dom: HTMLElement, index: number, page: keyof typeof PAGE_COLORS, disableOverscan = false): void {
    if (this.backgrounds.some((b) => b.index === index)) return;
    const mesh = new THREE.Mesh(
      this.manager.planeGeometry,
      new THREE.ShaderMaterial({
        vertexShader: flatColorVertex,
        fragmentShader: flatColorFragment,
        uniforms: { uColor: { value: PAGE_COLORS[page] } },
        depthTest: false,
      }),
    );
    mesh.renderOrder = -1;
    this.add(mesh);
    const entry = { index, dom, mesh, disableOverscan };
    this.backgrounds.push(entry);
    this.layoutBackground(entry);
  }

  private layoutBackground(b: BackgroundEntry): void {
    const r = offsetRect(b.dom);
    const k = b.disableOverscan ? 1 : PLANE_OVERSCAN;
    b.mesh.scale.set(r.width * k, r.height * k, k);
    this.placeFromRect(b.mesh, r);
  }

  refreshBackground(index: number): void {
    const b = this.backgrounds.find((e) => e.index === index);
    if (b) this.layoutBackground(b);
  }

  removeBackground(index: number): void {
    const i = this.backgrounds.findIndex((e) => e.index === index);
    if (i === -1) return;
    const b = this.backgrounds[i];
    b.mesh.material.dispose();
    this.remove(b.mesh);
    this.backgrounds.splice(i, 1);
  }

  ensureProjectGroup(projectIndex: number): THREE.Group {
    let g = this.projects[projectIndex];
    if (!g) {
      g = new THREE.Group();
      g.visible = false;
      this.add(g);
      this.projects[projectIndex] = g;
    }
    return g;
  }

  addMedia(dom: HTMLElement, index: number, projectIndex: number, texture: THREE.Texture): void {
    const rect = offsetRect(dom);
    const group = this.ensureProjectGroup(projectIndex);
    const img = texture.image as { width?: number; height?: number } | undefined;
    const material = new THREE.ShaderMaterial({
      vertexShader: sliderVertex,
      fragmentShader: sliderFragment,
      uniforms: {
        uTime: this.manager.time,
        uTexture: { value: texture },
        uPlaneSizes: { value: new THREE.Vector2(rect.width, rect.height) },
        uTextureSizes: { value: new THREE.Vector2(img?.width ?? 1, img?.height ?? 1) },
        uDragForce: { value: 0 },
        uCoverBleed: { value: isTabletWidth() ? COVER_BLEED * 1.1 : COVER_BLEED },
        uDragScaleStrength: { value: 75e-6 },
        uDragScaleStrengthZ: { value: isTabletWidth() ? 0.5 : 1.5 },
        uDragColorStrength: { value: 35e-5 },
        uScrollDeformationDirection: { value: index % 2 },
        uParallaxProgress: { value: 0 },
        uParallaxX: { value: 0 },
      },
    });
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const mesh = new THREE.Mesh(this.mediaGeometry, material);
    mesh.layers.set(SHARP_LAYER);
    group.add(mesh);
    this.placeFromRect(mesh, rect);
    mesh.scale.set(rect.width, rect.height, 1);
    material.uniforms.uParallaxX.value = this.parallaxX(mesh.position.x);
    this.medias.push({ index, projectIndex, dom, mesh, rect });
  }

  refreshMediaLayout(dom: HTMLElement): void {
    const m = this.medias.find((e) => e.dom === dom);
    if (!m) return;
    m.rect = offsetRect(dom);
    m.mesh.scale.set(m.rect.width, m.rect.height, 1);
    this.placeFromRect(m.mesh, m.rect);
    m.mesh.material.uniforms.uParallaxX.value = this.parallaxX(m.mesh.position.x);
    m.mesh.material.uniforms.uPlaneSizes.value.set(m.rect.width, m.rect.height);
  }

  setParallaxUniforms(projectIndex: number, progress: number): void {
    const g = this.projects[projectIndex];
    g?.children.forEach((c) => {
      const mesh = c as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
      mesh.material.uniforms.uParallaxProgress.value = progress;
    });
  }

  revealProjectGroup(projectIndex: number): void {
    const g = this.projects[projectIndex];
    if (g) g.visible = true;
  }

  registerSlider(projectIndex: number, params: SliderParams, delta: { x: number; y: number }, config: SliderConfig): void {
    this.sliders.set(projectIndex, { params, delta, config });
  }

  setSliderConfig(projectIndex: number, config: SliderConfig): void {
    const s = this.sliders.get(projectIndex);
    if (s) s.config = config;
  }

  updateSliderDelta(projectIndex: number, delta: { x: number; y: number }): void {
    const s = this.sliders.get(projectIndex);
    if (s) s.delta = { ...delta };
  }

  private planeWidth(projectIndex: number): number {
    const g = this.projects[projectIndex];
    return g && g.children.length ? g.children[0].scale.x + sliderGap() : 0;
  }

  private wrap(x: number, total: number): number {
    const half = total / 2;
    return ((((x + half) % total) + total) % total) - half;
  }

  /** Lay out the slides around the drag position (source `update`). */
  update(projectIndex: number, params: SliderParams): void {
    const g = this.projects[projectIndex];
    if (!g || !g.children.length) return;
    const count = g.children.length;
    const infinite = this.sliders.get(projectIndex)?.config.infiniteDrag ?? false;
    let best = -1;
    let bestDist = Infinity;
    g.children.forEach((c, i) => {
      const mesh = c as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
      const w = mesh.scale.x + sliderGap();
      let x = i * w - params.smoothCurrentDrag;
      if (infinite) x = this.wrap(x, count * w);
      mesh.position.x = x;
      mesh.material.uniforms.uParallaxX.value = this.parallaxX(x);
      mesh.material.uniforms.uDragForce.value = params.smoothDragForce;
      const d = Math.abs(x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    if (best !== -1) params.targetIndex = best;
  }

  render(et: number, dt: number): void {
    this.flowers.render(et, dt);
    if (this.manager.isPlaygroundPageActive || this.sliders.size === 0) return;
    const f = dt * 60;
    const ease = (a: number, b: number, k: number) => lerp(a, b, 1 - Math.exp(-k * f));
    this.sliders.forEach(({ params: o, delta: a, config: l }, projectIndex) => {
      const w = this.planeWidth(projectIndex);
      if (!w) return;
      const maxIndex = Math.max(0, (this.projects[projectIndex]?.children.length ?? 1) - 1);
      const infinite = l.infiniteDrag ?? false;
      const clampDrag = (v: number) => clamp(v, 0, maxIndex * w);
      o.currentDrag += a.x * l.dragMultiplier;
      if (!infinite) o.currentDrag = clampDrag(o.currentDrag);
      a.x *= l.deltaDecay;
      a.y *= l.deltaDecay;
      o.rawDragInput = ease(o.rawDragInput, Math.abs(a.x), l.dragForceDecay);
      o.dragForce = clamp(o.rawDragInput * l.dragForceMultiplier, 0, l.dragForceMax);
      o.smoothDragForce = ease(o.smoothDragForce, o.dragForce, l.dragForceSmooth);
      if (o.isDragging) o.smoothDragForce = Math.max(o.smoothDragForce, o.snapThreshold + 1);
      if (!o.isDragging && o.smoothDragForce < o.snapThreshold) {
        let idx = Math.round(o.smoothCurrentDrag / w);
        if (o.forcedSnapIndex != null) idx = o.forcedSnapIndex;
        else if (!infinite) idx = clamp(Math.round(idx), 0, maxIndex);
        o.snapTarget = idx * w;
        o.smoothCurrentDrag = ease(o.smoothCurrentDrag, o.snapTarget, l.snapLerp);
        o.currentDrag = ease(o.currentDrag, o.snapTarget, l.snapLerp * 0.85);
        if (!infinite) {
          o.smoothCurrentDrag = clampDrag(o.smoothCurrentDrag);
          o.currentDrag = clampDrag(o.currentDrag);
        }
        if (o.forcedSnapIndex != null && Math.abs(o.smoothCurrentDrag - o.snapTarget) < w * 0.01) o.forcedSnapIndex = null;
      } else {
        o.smoothCurrentDrag = ease(o.smoothCurrentDrag, o.currentDrag, l.dragFollowLerp);
        if (!infinite) o.smoothCurrentDrag = clampDrag(o.smoothCurrentDrag);
      }
      this.update(projectIndex, o);
    });
  }

  resize(): void {
    for (const b of this.backgrounds) this.layoutBackground(b);
    for (const m of this.medias) this.refreshMediaLayout(m.dom);
    this.flowers.resize();
  }

  /** Drop every slider/flower plane when a route unmounts (source `cleanup`). */
  cleanup(): void {
    for (const b of this.backgrounds) {
      b.mesh.material.dispose();
      this.remove(b.mesh);
    }
    this.backgrounds = [];
    for (const m of this.medias) m.mesh.material.dispose();
    this.medias = [];
    for (const g of this.projects) if (g) this.remove(g);
    this.projects = [];
    this.sliders.clear();
    this.flowers.cleanup();
  }

  removeProject(projectIndex: number): void {
    const g = this.projects[projectIndex];
    if (g) {
      this.remove(g);
      delete this.projects[projectIndex];
    }
    this.medias = this.medias.filter((m) => {
      if (m.projectIndex !== projectIndex) return true;
      m.mesh.material.dispose();
      return false;
    });
    this.sliders.delete(projectIndex);
  }
}
