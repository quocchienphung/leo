import gsap from "gsap";
import * as THREE from "three";
import { leo } from "../core/app";
import { isTabletWidth, isTouch } from "../core/env";
import { clamp, damp, degToRad, lerp, mapClamp } from "../core/math";
import type { RouteName } from "../core/emitter";
import type { CameraParams } from "../data/types";
import type { AssetsManager } from "./assets";
import { RIG_CAMERA } from "./env/crystal/layout";

/**
 * Reads the `camera` node of a route GLB (position/rotation/fov). The playground has no GLB of its
 * own: its rig is solved from the crystal pavilion sketch (env/crystal/layout.ts).
 */
function modelCameraNode(assets: AssetsManager, route: RouteName): THREE.PerspectiveCamera | null {
  if (route === "playground") return RIG_CAMERA;
  const model = assets.get<THREE.Group>(`${route}Model`);
  const cam = model?.getObjectByName("camera") as THREE.PerspectiveCamera | undefined;
  return cam ?? null;
}

/**
 * Outer camera rig (`XX`, line ~63034): copies the GLB camera and animates the intro dolly
 * on X (`show`) and the route exit (`hide`).
 */
export class ModelCamera extends THREE.PerspectiveCamera {
  constructor(private assets: AssetsManager) {
    super(22.9, 1, 0.01, 500);
  }

  setModelCameraProperties(route: RouteName): void {
    const cam = modelCameraNode(this.assets, route);
    if (!cam) return;
    this.position.copy(cam.position);
    this.rotation.copy(cam.rotation);
    this.fov = cam.fov;
    this.near = cam.near;
    this.far = cam.far;
    this.updateProjectionMatrix();
  }

  show(route: RouteName, initial = false): gsap.core.Timeline {
    const tl = gsap.timeline();
    const cam = modelCameraNode(this.assets, route);
    if (!cam) return tl;
    if (leo.skipLoader) {
      this.setModelCameraProperties(route);
      return tl;
    }
    const duration = initial ? 2.5 : 2;
    const ease = initial ? "expo.inOut" : "expo.out";
    if (route === "home" || route === "playground") {
      tl.fromTo(this.position, { x: cam.position.x + (initial ? 7 : 5) }, { x: cam.position.x, duration, ease });
    } else {
      tl.fromTo(this.position, { x: cam.position.x + 8 }, { x: cam.position.x, duration, ease });
    }
    return tl;
  }

  hide(route: RouteName): gsap.core.Timeline {
    const tl = gsap.timeline();
    const cam = modelCameraNode(this.assets, route);
    if (!cam) return tl;
    if (route === "home" || route === "playground") tl.to(this.position, { x: cam.position.x + 6, duration: 0.5, ease: "sine.out" });
    else tl.to(this.position, { x: cam.position.x - 4, duration: 0.5, ease: "sine.out" });
    return tl;
  }

  resize(ratio: number): void {
    this.aspect = ratio;
    this.updateProjectionMatrix();
  }
}

/** Pointer parallax group (`qX`, line ~63099). */
export class PointerCamera extends THREE.Object3D {
  private rotateForceX = 0.2;
  private rotateForceY = 0.75;
  private rotateCoef = 2;
  private targetX = 0;
  private targetY = 0;

  onPointerMove(x: number, y: number): void {
    if (isTouch()) return;
    this.targetX = degToRad(y * this.rotateForceX);
    this.targetY = degToRad(-x * this.rotateForceY);
  }

  tick(dt: number): void {
    if (isTouch()) return;
    const t = damp(this.rotateCoef, dt);
    if (this.rotation.x !== this.targetX) this.rotation.x = lerp(this.rotation.x, this.targetX, t);
    if (this.rotation.y !== this.targetY) this.rotation.y = lerp(this.rotation.y, this.targetY, t);
  }
}

/** Innermost render camera (`jY`, line ~61089): scroll offsets for header / sections. */
export class MainCamera extends THREE.PerspectiveCamera {
  constructor(private assets: AssetsManager) {
    super(22.9, 1, 0.01, 500);
  }

  setModelCameraFov(route: RouteName): void {
    const cam = modelCameraNode(this.assets, route);
    if (!cam) return;
    this.fov = cam.fov;
    this.near = cam.near;
    this.far = cam.far;
    this.updateProjectionMatrix();
  }

  setZoom(route: RouteName): void {
    // Work and Playground share the same subject framing, including portrait screens.
    if (route === "home" || route === "playground") this.zoom = isTabletWidth() ? 0.67 : 1;
    else if (route === "about") this.zoom = isTabletWidth() ? 0.89 : 1;
    this.updateProjectionMatrix();
  }

  resize(ratio: number, route: RouteName): void {
    this.aspect = ratio;
    this.setZoom(route);
  }

  setScrollHeaderPositions(scroll: number, rectHeight: number, p: CameraParams): void {
    const { scrollRangePosition: r, scrollRangeRotation: rr, scrollOffsetPosition: o, scrollOffsetRotation: or } = p;
    const k = clamp(scroll / rectHeight, 0, p.scrollProgressMax ?? 1);
    if (!leo.isOnHeader) return;
    this.position.set(-clamp(k * r.x, 0, r.x) - o.x, -clamp(k * r.y, 0, r.y) - o.y, -clamp(k * r.z, 0, r.z) - o.z);
    this.rotation.set(-clamp(k * rr.x, 0, rr.x) - or.x, -clamp(k * rr.y, 0, rr.y) - or.y, -clamp(k * rr.z, 0, rr.z) - or.z);
  }

  setScrollSectionPositions(scroll: number, rect: { y: number; height: number }, p: CameraParams): void {
    const { scrollRangePosition: r, scrollRangeRotation: rr, scrollOffsetPosition: o, scrollOffsetRotation: or } = p;
    const progress = mapClamp(scroll, [rect.y - window.innerHeight, rect.y + rect.height], [0, 1]);
    const y = -progress * r.y;
    leo.isOnHeader = y >= 0;
    if (leo.isOnHeader) return;
    this.position.set(-progress * r.x - o.x, y - o.y, -progress * r.z - o.z);
    this.rotation.set(-progress * rr.x - or.x, -progress * rr.y - or.y, -progress * rr.z - or.z);
  }
}

/** Pixel-space camera for DOM-synced planes (`vY`): 1 unit = 1 CSS px at z=2000. */
export class DomCamera extends THREE.PerspectiveCamera {
  private distance = 2000;

  constructor() {
    super(75, 1, 1000, 3500);
    this.position.z = this.distance;
  }

  resize(width: number, height: number): void {
    this.aspect = width / height;
    this.fov = 2 * Math.atan(height / 2 / this.distance) * (180 / Math.PI);
    this.updateProjectionMatrix();
  }

  tick(): void {
    this.position.y = -leo.scroll;
  }
}

/** Camera of the bee/top layer (`KX`): fov 45 at z=5. */
export class TopCamera extends THREE.PerspectiveCamera {
  dimensions = { width: 1, height: 1 };

  constructor() {
    super(45, 1, 0.01, 300);
    this.position.z = 5;
    this.computeDimensions();
  }

  private computeDimensions(): void {
    const h = 2 * this.position.z * Math.tan((this.fov * Math.PI) / 180 / 2);
    this.dimensions = { width: h * this.aspect, height: h };
  }

  /** Source `_computeSectionCameraY`: follow a DOM section through the viewport. */
  sectionCameraY(scroll: number, top: number, height: number): number {
    const center = top + height / 2 - window.innerHeight / 2;
    const v = (scroll - (center - height / 2)) / height;
    return (-(-1 + 2 * v) * this.dimensions.height) / 2;
  }

  setScrollPosition(scroll: number, rect: { y: number; height: number }): number {
    this.position.y = this.sectionCameraY(scroll, rect.y, rect.height);
    return this.position.y;
  }

  resize(ratio: number): void {
    this.aspect = ratio;
    this.updateProjectionMatrix();
    this.computeDimensions();
  }
}
