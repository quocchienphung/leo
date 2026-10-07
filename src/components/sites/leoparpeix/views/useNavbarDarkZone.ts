"use client";

import { useEffect, type RefObject } from "react";
import { leo } from "../core/app";
import { emitter } from "../core/emitter";

function target(ref: RefObject<HTMLElement | null>): HTMLElement | null {
  const el = ref.current;
  if (!el) return null;
  // Wrappers use `display: contents`; measure the real block inside.
  return getComputedStyle(el).display === "contents" ? (el.firstElementChild as HTMLElement | null) : el;
}

/**
 * Source `QV()` / `SQ()` (lines ~46050 / 42320): switch the navbar to its light colour while
 * the navbar's centre line is over the dark WebGL section.
 */
export function useNavbarDarkZone(
  zoneRef: RefObject<HTMLElement | null>,
  endRef?: RefObject<HTMLElement | null>,
  eventName: "navbarDarkMode" | "navbarForceWhite" = "navbarDarkMode",
): void {
  useEffect(() => {
    let zone: { top: number; height: number } | null = null;
    let end: { top: number } | null = null;
    let line: number | null = null;
    let active = false;
    const docRect = (el: HTMLElement) => {
      const b = el.getBoundingClientRect();
      return { top: b.top + window.scrollY, height: b.height };
    };
    const measure = () => {
      const z = target(zoneRef);
      if (!z) return;
      zone = docRect(z);
      const e = endRef ? target(endRef) : null;
      end = e ? docRect(e) : null;
      const nav = document.querySelector<HTMLElement>(".navbarBlock");
      if (!nav) return;
      const title = document.querySelector<HTMLElement>(".navbarBlock .left__title");
      const r = (window.innerWidth <= 500 && title ? title : nav).getBoundingClientRect();
      line = r.top + r.height / 2;
    };
    const set = (v: boolean) => {
      if (active === v) return;
      active = v;
      emitter.emit(eventName, v);
    };
    const update = () => {
      if (!zone || line === null) return;
      const y = window.scrollY + line;
      const inside = end ? y >= zone.top && y < end.top : y >= zone.top && y < zone.top + zone.height;
      set(inside);
    };
    const onResize = () => {
      measure();
      update();
    };
    const raf = requestAnimationFrame(() => {
      measure();
      update();
    });
    leo.lenis?.on("scroll", update);
    const offResize = emitter.on("resize", onResize);
    const offReveal = emitter.on("loaderRevealComplete", onResize);
    return () => {
      cancelAnimationFrame(raf);
      leo.lenis?.off("scroll", update);
      offResize();
      offReveal();
      set(false);
    };
  }, [zoneRef, endRef, eventName]);
}
