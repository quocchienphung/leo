import gsap from "gsap";
import * as THREE from "three";
import { leo } from "../../core/app";
import { emitter } from "../../core/emitter";
import { isTouch } from "../../core/env";
import { damp, lerp, pick } from "../../core/math";
import { sound } from "../../core/sound";
import { beeTexts } from "../../data/playground";
import type { AssetsManager } from "../assets";
import type { TopCamera } from "../cameras";
import { directionalLight } from "../lights";
import type { TransitionUniforms } from "./overlays";
import { bindPageTransition } from "./transitionMaterial";

// Source constants (line ~67217 / 67339).
const HOVER_DELAY_FIRST = 0.4; // M6
const TEXT_HOLD = 2.5; // jw
const TEXT_GAP = 2; // I6
const LEAVE_HIDE = 4; // R6
const CLICK_DEBOUNCE_MS = 300; // B6
const ANCHOR_GAP_TOP = 12; // k6
const ANCHOR_GAP_BOTTOM = 12; // N6
const ANCHOR_REF_HEIGHT = 90; // U6
const BEE_Z = 0.3; // Jw
const FLAP_STRENGTH = 1.5; // Zw
const FLAP_OFFSET = 1; // $w
const FLAP_BASE = 10; // V6
const FLAP_ACCEL_GAIN = 0.0085; // W6
const FLAP_MAX = 5; // Y6
const BASE_ROT_X = Math.PI * 0.5; // X6
const BASE_ROT_Z = Math.PI * 0.5; // q6
const SCROLL_HEADING_GAIN = 0.012; // K6
const MAX_PITCH = 0.42; // eb

const tmp = new THREE.Vector3();
const box = new THREE.Box3();

/** Source `TG`: sentence-case phrases while keeping proper nouns. */
const KEEP = ["About", "Playground", "Home", "Work", "Lab", "Navbar", "Tuesday", "Instagram", "Linkedin", "Footer", "Hero"];
function sentenceCase(text: string): string {
  if (!text || (/[a-z]/.test(text) === false && /[A-Z]/.test(text))) return text;
  const words = new Set(KEEP);
  for (const m of text.matchAll(/\b[A-Z]{2,}\b/g)) words.add(m[0]);
  for (const m of text.matchAll(/\b[A-Z][a-z]+(?:'[a-z]+)?\b/g)) words.add(m[0]);
  const sorted = [...words].sort((a, b) => b.length - a.length);
  let t = text.toLowerCase().replace(/(^|[.!?…]\s+|\n+)([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
  for (const [re, rep] of [
    [/\bi'm\b/g, "I'm"],
    [/\bi've\b/g, "I've"],
    [/\bi'll\b/g, "I'll"],
    [/\bi'd\b/g, "I'd"],
    [/\bi\b/g, "I"],
  ] as const)
    t = t.replace(re, rep);
  for (const w of sorted) {
    if (w === "I" || /^I'/.test(w)) continue;
    t = t.replace(new RegExp(`\\b${w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), w);
  }
  return t;
}
export { sentenceCase };

/**
 * Playground content bee (`J6`, line ~67351): follows the scroll path computed in `beePath.ts`,
 * banks into its heading, flaps faster when the scroll accelerates, teases with idle lines,
 * reacts to hover and runs click conversations through `BeeTextIndication`.
 */
export class ContentBee extends THREE.Object3D {
  readonly directionalLight: THREE.DirectionalLight;
  private bee: THREE.Object3D;
  private wings: THREE.Object3D[] = [];
  private torso: THREE.Mesh[] = [];
  private targets: THREE.Mesh[] = [];
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private lastScroll = 0;
  private scrollVelocity = 0;
  private flapBoost = 0;
  private scrollSign = 1;
  private scrollDirectionY = 0;
  private pathHeading = 0;
  private pathPitch = 0;
  private lastGroup = { x: 0, y: 0 };
  private headingFromPath: number | null = null;
  private pitchFromPath: number | null = null;
  private landPitchFromPath: number | null = null;
  private hovered = false;
  private textVisible = false;
  private mode: "generic" | "conversation" | null = null;
  private lastGeneric: string | null = null;
  private lastHover: string | null = null;
  private placement: "top" | "bottomLeft" | null = null;
  private scheduleCall: gsap.core.Tween | null = null;
  private hideCall: gsap.core.Tween | null = null;
  private leaveCall: gsap.core.Tween | null = null;
  private clicked = false;
  private teasers = false;
  private thread: { id: string; lines: string[] } | null = null;
  private step = -1;
  private lastClick = 0;
  private bounce: gsap.core.Timeline | null = null;
  private suppressed = false;

  constructor(
    private uniforms: TransitionUniforms,
    assets: AssetsManager,
    private camera: TopCamera,
    private canvas: HTMLCanvasElement,
  ) {
    super();
    this.lastScroll = leo.scroll;
    this.directionalLight = directionalLight(0xffffff, 0.5);
    this.directionalLight.position.z = 5;
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.set(2048, 2048);
    this.directionalLight.shadow.camera.near = 0.05;
    this.directionalLight.shadow.camera.far = 6;
    this.add(this.directionalLight);
    this.syncShadowFrustum(camera.dimensions);
    this.bee = this.createBee(assets);
    emitter.on("beeTextHideAll", () => {
      this.suppressed = true;
      this.resetHover(false);
    });
    emitter.on("pointerMove", ({ webgl }) => this.onPointerMove(webgl.x, webgl.y));
    emitter.on("pointerDown", ({ webgl }) => this.onPointerDown(webgl.x, webgl.y));
  }

  syncShadowFrustum(d: { width: number; height: number }): void {
    const c = this.directionalLight.shadow.camera;
    c.top = d.height * 0.5 * 2;
    c.right = d.width * 0.5;
    c.bottom = -d.height * 0.5 * 2;
    c.left = -d.width * 0.5;
    c.updateProjectionMatrix();
  }

  setCastShadowEnabled(v: boolean): void {
    this.directionalLight.castShadow = v;
    this.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = v;
    });
  }

  private createBee(assets: AssetsManager): THREE.Object3D {
    const model = assets.get<THREE.Group>("beeModel");
    const tex = assets.get<THREE.Texture>("beeTex");
    const bee = model ? model.clone() : new THREE.Group();
    bee.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (m.name.includes("bee")) {
        const mat = new THREE.MeshPhongMaterial({ map: tex ?? null });
        bindPageTransition(mat, this.uniforms, { revealScale: this.uniforms.uBeeRevealScale });
        m.material = mat;
        m.castShadow = true;
        this.torso.push(m);
      } else if (m.name.includes("aile")) {
        const mat = new THREE.MeshPhongMaterial({ transparent: true, opacity: 0.7 });
        bindPageTransition(mat, this.uniforms, { revealScale: this.uniforms.uBeeRevealScale });
        m.material = mat;
        m.castShadow = true;
      }
    });
    if (bee.children[0]?.name.includes("aile") && bee.children[1]?.name.includes("aile")) this.wings = [bee.children[0], bee.children[1]];
    else bee.traverse((o) => (o as THREE.Mesh).isMesh && o.name.includes("aile") && this.wings.push(o));
    bee.position.z = BEE_Z;
    this.add(bee);
    bee.traverse((o) => (o as THREE.Mesh).isMesh && this.targets.push(o as THREE.Mesh));
    return bee;
  }

  setPathMotion(p: { heading?: number | null; pitch?: number | null; landPitch?: number | null; skyZ?: number }): void {
    this.headingFromPath = typeof p.heading === "number" ? p.heading : null;
    this.pitchFromPath = typeof p.pitch === "number" ? p.pitch : null;
    this.landPitchFromPath = typeof p.landPitch === "number" ? p.landPitch : null;
    this.bee.position.z = BEE_Z + (p.skyZ ?? 0);
  }

  resetMotion(): void {
    const g = this.parent;
    this.lastScroll = leo.scroll;
    this.scrollVelocity = 0;
    this.flapBoost = 0;
    this.resetHover(false);
    this.suppressed = false;
    this.scrollSign = 1;
    this.scrollDirectionY = 0;
    this.pathHeading = 0;
    this.pathPitch = 0;
    this.lastGroup = { x: g?.position.x ?? 0, y: g?.position.y ?? 0 };
    this.setPathMotion({ heading: null, pitch: null, landPitch: null, skyZ: 0 });
  }

  // ---- Speech bubble -------------------------------------------------------------------
  private placementNow(): "top" | "bottomLeft" {
    return this.scrollSign >= 0 ? "bottomLeft" : "top";
  }

  private anchor(): void {
    if (!this.textVisible || !this.visible || !this.torso.length) return;
    const rect = this.canvas.getBoundingClientRect();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    this.updateWorldMatrix(true, true);
    for (const m of this.torso) {
      box.setFromObject(m);
      if (box.isEmpty()) continue;
      for (const x of [box.min.x, box.max.x])
        for (const y of [box.min.y, box.max.y])
          for (const z of [box.min.z, box.max.z]) {
            tmp.set(x, y, z).project(this.camera);
            const sx = rect.left + (tmp.x * 0.5 + 0.5) * rect.width;
            const sy = rect.top + (-tmp.y * 0.5 + 0.5) * rect.height;
            minX = Math.min(minX, sx);
            maxX = Math.max(maxX, sx);
            minY = Math.min(minY, sy);
            maxY = Math.max(maxY, sy);
          }
    }
    if (!Number.isFinite(minX) || maxY - minY < 1) return;
    const placement = this.placementNow();
    const x = (minX + maxX) * 0.5;
    const y = placement === "top" ? minY - ANCHOR_GAP_TOP : maxY + ANCHOR_GAP_BOTTOM;
    emitter.emit("beeAnchorUpdate", { x, y, scale: (maxY - minY) / ANCHOR_REF_HEIGHT, placement });
  }

  private show(text: string): void {
    if (this.suppressed) return;
    this.textVisible = true;
    this.placement = this.placementNow();
    emitter.emit("beeTextChange", sentenceCase(text), true, { placement: this.placement, mode: this.mode ?? "generic" });
    this.anchor();
  }

  private hide(): void {
    this.hideCall?.kill();
    this.hideCall = null;
    this.leaveCall?.kill();
    this.leaveCall = null;
    if (!this.textVisible) {
      this.mode = null;
      return;
    }
    const mode = this.mode ?? "generic";
    this.textVisible = false;
    this.mode = null;
    this.placement = null;
    emitter.emit("beeTextChange", null, false, { mode });
  }

  private killTimers(): void {
    this.scheduleCall?.kill();
    this.scheduleCall = null;
    this.hideCall?.kill();
    this.hideCall = null;
  }

  private revealGeneric(text: string): void {
    this.mode = "generic";
    this.show(text);
    this.hideCall?.kill();
    this.hideCall = gsap.delayedCall(TEXT_HOLD, () => {
      this.hideCall = null;
      if (this.mode !== "generic" || this.clicked) return;
      this.hide();
      if (this.visible && !this.clicked && !this.hovered) this.scheduleGeneric();
      else if (this.visible && !this.clicked && this.hovered) {
        this.teasers = false;
        this.revealHover();
      }
    });
  }

  private scheduleGeneric(first = false): void {
    if (this.clicked || !this.visible) {
      this.teasers = false;
      return;
    }
    this.scheduleCall?.kill();
    this.scheduleCall = gsap.delayedCall(first ? HOVER_DELAY_FIRST : TEXT_GAP, () => {
      this.scheduleCall = null;
      if (this.clicked || !this.visible) {
        this.teasers = false;
        return;
      }
      if (this.suppressed) {
        this.teasers = false;
        this.scheduleGeneric();
        return;
      }
      const t = pick(beeTexts.idle, this.lastGeneric);
      this.lastGeneric = t;
      this.revealGeneric(t);
    });
  }

  private revealHover(): void {
    if (this.suppressed || this.clicked || !this.visible || this.mode === "conversation") return;
    this.killTimers();
    const t = pick(beeTexts.hover, this.lastHover);
    this.lastHover = t;
    this.revealGeneric(t);
  }

  private ensureTeasers(): void {
    if (this.suppressed || this.clicked || this.teasers || !this.visible) return;
    this.teasers = true;
    this.scheduleGeneric(true);
  }

  private closeConversation(): void {
    this.leaveCall?.kill();
    this.leaveCall = null;
    this.thread = null;
    this.step = -1;
    this.clicked = false;
    this.hide();
    this.teasers = false;
    if (this.hovered) this.revealHover();
    else this.ensureTeasers();
  }

  private scheduleLeaveHide(): void {
    if (!this.textVisible) return;
    this.leaveCall?.kill();
    this.leaveCall = gsap.delayedCall(LEAVE_HIDE, () => {
      this.leaveCall = null;
      if (this.mode === "conversation") {
        this.closeConversation();
        return;
      }
      this.clicked = false;
      this.hide();
      this.teasers = false;
      this.ensureTeasers();
    });
  }

  private playBounce(): void {
    this.bounce?.kill();
    gsap.killTweensOf(this.bee.scale);
    gsap.killTweensOf(this.bee.position);
    this.bee.scale.set(1, 1, 1);
    this.bee.position.y = 0;
    const tl = gsap.timeline({ onComplete: () => (this.bounce = null) });
    tl.to(this.bee.scale, { x: 0.9, y: 0.9, z: 0.9, duration: 0.06, ease: "power2.in" }, 0);
    tl.to(this.bee.position, { y: -0.025, duration: 0.06, ease: "power2.in" }, 0);
    tl.to(this.bee.scale, { x: 1.07, y: 1.07, z: 1.07, duration: 0.1, ease: "power2.out" });
    tl.to(this.bee.position, { y: 0.045, duration: 0.1, ease: "power2.out" }, "-=0.1");
    tl.to(this.bee.scale, { x: 1, y: 1, z: 1, duration: 0.32, ease: "elastic.out(1, 0.7)" });
    tl.to(this.bee.position, { y: 0, duration: 0.32, ease: "elastic.out(1, 0.7)" }, "-=0.32");
    this.bounce = tl;
  }

  private advanceConversation(): void {
    if (this.suppressed) return;
    this.teasers = false;
    this.killTimers();
    this.clicked = true;
    const lines = this.thread?.lines;
    if (this.thread && lines && this.step >= 0 && this.step < lines.length - 1) this.step += 1;
    else {
      const id = this.thread?.id ?? null;
      const pool = id ? beeTexts.conversation.filter((c) => c.id !== id) : beeTexts.conversation;
      this.thread = pool.length ? pool[Math.floor(Math.random() * pool.length)] : (beeTexts.conversation[0] ?? { id: "fallback", lines: ["Bzzzzz."] });
      this.step = 0;
    }
    this.mode = "conversation";
    this.show(this.thread.lines[this.step]);
  }

  private hit(x: number, y: number): boolean {
    if (!this.visible || !this.targets.length) return false;
    this.ndc.set(x, y);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster.intersectObjects(this.targets, false).length > 0;
  }

  private onPointerMove(x: number, y: number): void {
    if (isTouch()) return;
    if (!this.visible || !this.targets.length) {
      if (this.hovered) {
        this.hovered = false;
        this.onLeave();
      }
      return;
    }
    const over = this.hit(x, y);
    if (over === this.hovered) return;
    this.hovered = over;
    if (over) this.onEnter();
    else this.onLeave();
  }

  private onEnter(): void {
    if (!isTouch()) document.body.style.cursor = "pointer";
    this.leaveCall?.kill();
    this.leaveCall = null;
    if (this.mode === "conversation") return;
    sound.playSfx("fruit2");
    this.playBounce();
    this.revealHover();
  }

  private onLeave(): void {
    if (!isTouch()) document.body.style.cursor = "";
    this.scheduleLeaveHide();
  }

  private onPointerDown(x: number, y: number): void {
    if (isTouch()) return;
    if (this.hit(x, y)) {
      if (!this.visible) return;
      const now = performance.now();
      if (now - this.lastClick < CLICK_DEBOUNCE_MS) return;
      this.lastClick = now;
      this.leaveCall?.kill();
      this.leaveCall = null;
      this.playBounce();
      sound.playSfx("fruit1");
      this.advanceConversation();
      return;
    }
    if (this.mode === "conversation" && this.textVisible) this.closeConversation();
  }

  private resetHover(emit: boolean): void {
    this.hovered = false;
    if (!isTouch()) document.body.style.cursor = "";
    this.killTimers();
    this.leaveCall?.kill();
    this.leaveCall = null;
    this.teasers = false;
    this.thread = null;
    this.step = -1;
    this.clicked = false;
    this.lastClick = 0;
    this.bounce?.kill();
    this.bounce = null;
    gsap.killTweensOf(this.bee.scale);
    gsap.killTweensOf(this.bee.position);
    this.bee.scale.set(1, 1, 1);
    this.bee.position.y = 0;
    const was = this.textVisible;
    const mode = this.mode ?? "generic";
    this.textVisible = false;
    this.mode = null;
    this.placement = null;
    if (was && emit) emitter.emit("beeTextChange", null, false, { mode });
  }

  /** Called every frame while the content bee owns the top layer. */
  tick(): void {
    if (isTouch()) return;
    if (!this.visible) {
      if (this.hovered) {
        this.hovered = false;
        this.onLeave();
      }
      this.teasers = false;
      this.killTimers();
      if (this.textVisible) this.hide();
      return;
    }
    if (this.suppressed && leo.isLoaderRevealComplete && !leo.isTransitioning) {
      this.suppressed = false;
      this.teasers = false;
    }
    if (!this.suppressed) {
      this.ensureTeasers();
      if (this.textVisible) this.anchor();
    }
  }

  render(et: number, dt: number): void {
    const s = leo.scroll;
    const ds = s - this.lastScroll;
    this.lastScroll = s;
    if (Math.abs(ds) > 0.01) this.scrollSign = Math.sign(ds);
    const v = Math.abs(ds) / Math.max(dt, 0.001);
    const prev = this.scrollVelocity;
    this.scrollVelocity = lerp(this.scrollVelocity, v, damp(12, dt));
    const accel = (this.scrollVelocity - prev) / Math.max(dt, 0.001);
    const boost = accel > 0 ? Math.min(accel * FLAP_ACCEL_GAIN, FLAP_MAX) : 0;
    this.flapBoost = lerp(this.flapBoost, boost, damp(18, dt));
    const g = this.parent;
    const gx = g ? g.position.x - this.lastGroup.x : 0;
    const gy = g ? g.position.y - this.lastGroup.y : 0;
    if (g) this.lastGroup = { x: g.position.x, y: g.position.y };
    this.scrollDirectionY = lerp(this.scrollDirectionY, this.scrollSign > 0 ? 0 : Math.PI, damp(12, dt));
    const k = damp(14, dt);
    if (this.headingFromPath !== null) this.pathHeading = lerp(this.pathHeading, this.headingFromPath, k);
    else {
      const ay = gy + ds * SCROLL_HEADING_GAIN;
      if (Math.hypot(gx, ay) > 8e-5) this.pathHeading = lerp(this.pathHeading, Math.atan2(gx, ay), k);
    }
    let target = 0;
    if (this.pitchFromPath !== null && Math.abs(this.pitchFromPath) > 1e-5) target = -this.pitchFromPath;
    else if (this.landPitchFromPath !== null) target = -this.landPitchFromPath;
    this.pathPitch = lerp(this.pathPitch, Math.min(MAX_PITCH, Math.max(-MAX_PITCH, target)), damp(14, dt));
    this.bee.rotation.set(BASE_ROT_X + this.pathPitch, this.pathHeading + this.scrollDirectionY, BASE_ROT_Z);
    const t = et * 0.001;
    const f = FLAP_BASE + this.flapBoost;
    if (this.wings[0]) this.wings[0].rotation.z = Math.abs(Math.sin(t * f)) * FLAP_STRENGTH - FLAP_OFFSET;
    if (this.wings[1]) this.wings[1].rotation.z = Math.abs(Math.cos(t * f)) * FLAP_STRENGTH - FLAP_OFFSET;
    if (this.textVisible) {
      const p = this.placementNow();
      if (this.placement !== p) {
        this.placement = p;
        if (this.mode === "generic") {
          this.hideCall?.kill();
          this.hideCall = gsap.delayedCall(TEXT_HOLD, () => {
            this.hideCall = null;
            if (this.mode !== "generic") return;
            this.hide();
            if (this.visible && !this.clicked && !this.hovered) this.scheduleGeneric();
            else if (this.visible && !this.clicked && this.hovered) {
              this.teasers = false;
              this.revealHover();
            }
          });
        }
      }
      this.anchor();
    }
  }
}
