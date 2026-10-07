// Device / viewport predicates mirrored from the source bundle.

export const BREAKPOINTS = { tablet: 768, desktop: 1025 } as const;

/** Source `gn()`: layout switches to the 8-column "tablet/mobile" branch below 1025px. */
export function isTabletWidth(): boolean {
  return typeof window !== "undefined" && window.innerWidth < BREAKPOINTS.desktop;
}

/** Source `ii()`: coarse pointer, falling back to touch capability. */
export function isTouch(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(pointer: coarse)").matches) return true;
  if (window.matchMedia("(pointer: fine)").matches) return false;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

/** Source `WM()`/`YM()`: handheld device detection (UA + pointer). */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (
    /iPad/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ||
    /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)
  ) {
    return true;
  }
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) return false;
  return isTouch();
}

/** Source `w0()` */
export function isTouchTablet(): boolean {
  return isTouch() && isTabletWidth();
}

/** Source `b0()`: Safari (non-Chromium) detection, used for fruit ground height. */
export function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS/.test(ua);
}

/** Source `Ph()`: playground content bee only exists on desktop widths. */
export function isDesktopWidth(): boolean {
  return !isTabletWidth();
}

/** Source `N_()`: design px (base 14) → current rem px. */
export function designPx(px: number): number {
  if (typeof window === "undefined") return px;
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return (px / 14) * root;
}
