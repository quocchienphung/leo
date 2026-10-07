"use client";

import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import { emitter, type PointerCoords, type RouteName, type ViewportInfo } from "./emitter";
import { BREAKPOINTS, isTabletWidth, isTouch } from "./env";

/**
 * Global runtime state, the equivalent of the source singleton `C` (line ~69809).
 * Lives for the whole session; React components read/write it imperatively.
 */
export interface WebglLike {
  usesFluidEffects(): boolean;
}

class LeoApp {
  initialized = false;
  lenis: Lenis | null = null;

  isOnHeader = true;
  showFooterBee = false;
  firstClick = true;
  isLoaderRevealComplete = false;
  skipLoader = false;
  currentRoute: RouteName = "home";
  /** true until the very first route finished its intro */
  initialLoad = true;
  isTransitioning = false;

  viewport: ViewportInfo = { width: 1440, height: 900, dpr: 1, postDpr: 2, ratio: 1.6, device: "desktop" };
  pointer: PointerCoords = { webgl: { x: 0, y: 0 }, dom: { x: 0, y: 0 } };
  previousPointer: PointerCoords = { webgl: { x: 0, y: 0 }, dom: { x: 0, y: 0 } };
  isPointerDown = false;

  private startTime = 0;
  private lastTime = 0;

  init(): void {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;
    gsap.registerPlugin(CustomEase, SplitText);
    // Source: $n.create("reveal", ".4,0,0,1")
    CustomEase.create("reveal", "0.4,0,0,1");

    this.skipLoader = new URLSearchParams(window.location.search).has("skipLoader");
    this.measureViewport();
    this.pointer.dom = { x: this.viewport.width / 2, y: this.viewport.height / 2 };

    this.lenis = new Lenis({
      lerp: isTabletWidth() ? 1 : 0.085,
      smoothWheel: true,
      syncTouch: true,
      wheelMultiplier: 1,
      touchMultiplier: 1,
      infinite: false,
      autoResize: true,
      orientation: "vertical",
      gestureOrientation: "vertical",
      autoRaf: false,
    });
    this.lenis.stop();

    gsap.ticker.lagSmoothing(0);
    this.startTime = performance.now();
    this.lastTime = this.startTime;
    gsap.ticker.add(this.onTick);

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        this.measureViewport();
        emitter.emit("resize", this.viewport);
      }, 200);
    };
    window.addEventListener("resize", onResize);

    window.addEventListener("mousemove", this.onPointerMove);
    window.addEventListener("touchmove", this.onTouchMove, { passive: true });
    window.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("mouseup", this.onPointerUp);
    window.addEventListener("touchend", this.onPointerUp);
  }

  measureViewport(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.viewport = {
      width,
      height,
      dpr: Math.min(2, window.devicePixelRatio || 1),
      postDpr: 2,
      ratio: width / height,
      device: width < BREAKPOINTS.tablet ? "mobile" : width < BREAKPOINTS.desktop ? "tablet" : "desktop",
    };
  }

  get scroll(): number {
    return this.lenis?.animatedScroll ?? (typeof window !== "undefined" ? window.scrollY : 0);
  }

  get hasNoSmoothScroll(): boolean {
    return isTabletWidth() || isTouch();
  }

  private onTick = (time: number) => {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.lenis?.raf(time * 1000);
    const frame = { et: now - this.startTime, dt };
    emitter.emit("tick", frame);
    emitter.emit("render", frame);
  };

  private setPointer(x: number, y: number): void {
    this.previousPointer = {
      webgl: { ...this.pointer.webgl },
      dom: { ...this.pointer.dom },
    };
    this.pointer = {
      webgl: { x: (x / this.viewport.width) * 2 - 1, y: -(y / this.viewport.height) * 2 + 1 },
      dom: { x, y },
    };
  }

  private onPointerMove = (e: MouseEvent) => {
    this.setPointer(e.clientX, e.clientY);
    emitter.emit("pointerMove", this.pointer);
  };

  private onTouchMove = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    this.setPointer(t.clientX, t.clientY);
    emitter.emit("pointerMove", this.pointer);
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.isPointerDown) return;
    this.setPointer(e.clientX, e.clientY);
    this.isPointerDown = true;
    emitter.emit("pointerDown", this.pointer);
  };

  private onPointerUp = () => {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;
    emitter.emit("pointerUp", this.pointer);
  };

  /** Source `resetSmoothScroll()` */
  resetSmoothScroll(): void {
    this.lenis?.resize();
    this.lenis?.scrollTo(0, { immediate: true, force: true });
  }

  refreshScrollLayout(): void {
    requestAnimationFrame(() => {
      this.lenis?.resize();
      this.measureViewport();
      emitter.emit("resize", this.viewport);
    });
  }
}

export const leo = new LeoApp();
