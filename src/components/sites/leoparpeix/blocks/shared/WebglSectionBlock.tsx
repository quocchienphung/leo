"use client";

import gsap from "gsap";
import { useEffect, useRef, type ReactNode } from "react";
import { leo } from "../../core/app";
import { moduleClasses } from "../../core/cx";
import { emitter } from "../../core/emitter";
import { isTabletWidth } from "../../core/env";
import { mapClamp } from "../../core/math";
import { setRef } from "../../core/refs";
import type { CameraParams } from "../../data/types";
import styles from "../../styles/WebglSectionBlock.module.css";
import { GridWrapper } from "../../ui/GridWrapper";
import { getWebgl } from "../../webgl/instance";

const cx = moduleClasses(styles);

// Source constants (line ~45544).
const BASE_OPACITY = 0.15; // xS
const SPREAD = 0.72; // LV
const CHAR_WINDOW = 8; // OV
const START_VH = 0.9; // FV
const END_VH_DESKTOP = 0; // NV
const END_VH_MOBILE = 0.35; // kV

interface WebglSectionBlockProps {
  textLines?: string[];
  cameraParams: CameraParams;
  /** Receives the scoped `webglSectionBlock__card` class (Vue class fallthrough). */
  card?: (className: string) => ReactNode;
  className?: string;
  sectionRef?: React.Ref<HTMLDivElement>;
}

function splitChars(p: HTMLElement | null): HTMLElement[] {
  if (!p) return [];
  const out: HTMLElement[] = [];
  for (const line of p.querySelectorAll<HTMLElement>(".text__line")) {
    const text = line.dataset.text ?? line.textContent ?? "";
    line.dataset.text = text;
    line.replaceChildren();
    for (const ch of text) {
      const span = document.createElement("span");
      span.className = "webglSection-char";
      span.textContent = ch;
      span.style.display = "inline-block";
      line.appendChild(span);
      out.push(span);
    }
  }
  return out;
}

/**
 * Source `WebglSectionBlock` (line ~45551): transparent 200dvh window onto the 3D scene with a
 * per-character scroll reveal (base layer at .15 opacity, reveal layer 0→1 char by char).
 * Drives the camera with `setScrollSectionPositions` every frame.
 */
export function WebglSectionBlock({ textLines = [], cameraParams, card, className, sectionRef }: WebglSectionBlockProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLParagraphElement>(null);
  const revealRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const webgl = getWebgl();
    const root = rootRef.current;
    if (!webgl || !root) return;
    const docRect = (el: HTMLElement) => {
      const b = el.getBoundingClientRect();
      return new DOMRect(b.x, b.y + window.scrollY, b.width, b.height);
    };
    let rect = docRect(root);
    let textRect = wrapperRef.current ? docRect(wrapperRef.current) : null;
    let revealChars: HTMLElement[] = [];
    webgl.setWebglSectionScrollRect({ y: rect.y, height: rect.height });

    const setup = () => {
      const base = splitChars(baseRef.current);
      revealChars = splitChars(revealRef.current);
      gsap.set(base, { opacity: BASE_OPACITY, display: "inline-block" });
      gsap.set(revealChars, { opacity: 0, display: "inline-block" });
    };

    const progress = (scroll: number) => {
      if (!textRect) return 0;
      const h = window.innerHeight;
      const end = isTabletWidth() ? END_VH_MOBILE : END_VH_DESKTOP;
      return mapClamp(scroll, [textRect.top - h * START_VH, textRect.top - h * end], [0, 1]);
    };

    const apply = (p: number) => {
      const n = revealChars.length;
      if (!n) return;
      const k = gsap.utils.clamp(0, 1, p);
      const w = (1 / n) * CHAR_WINDOW;
      revealChars.forEach((c, i) => {
        const a = (i / n) * SPREAD;
        const v = gsap.utils.mapRange(a, a + w, 0, 1, k);
        gsap.set(c, { opacity: gsap.utils.clamp(0, 1, v) });
      });
    };

    const onScroll = () => apply(progress(leo.scroll));
    const onRender = () => webgl.camera.setScrollSectionPositions(leo.scroll, rect, cameraParams);
    const onResize = () => {
      rect = docRect(root);
      textRect = wrapperRef.current ? docRect(wrapperRef.current) : null;
      webgl.setWebglSectionScrollRect({ y: rect.y, height: rect.height });
      apply(progress(leo.scroll));
    };

    let cancelled = false;
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (cancelled) return;
      setup();
      apply(progress(leo.scroll));
    });
    const offRender = emitter.on("render", onRender);
    const offResize = emitter.on("resize", onResize);
    const offReveal = emitter.on("loaderRevealComplete", onResize);
    leo.lenis?.on("scroll", onScroll);
    return () => {
      cancelled = true;
      offRender();
      offResize();
      offReveal();
      leo.lenis?.off("scroll", onScroll);
      webgl.setWebglSectionScrollRect(null);
    };
  }, [cameraParams]);

  return (
    <GridWrapper
      ref={(el) => {
        rootRef.current = el;
        setRef(sectionRef, el);
      }}
      className={`${cx("webglSectionBlock")}${className ? ` ${className}` : ""}`}>
      {card?.(cx("webglSectionBlock__card"))}
      {textLines.length > 0 && (
        <div ref={wrapperRef} className={cx("webglSectionBlock__textWrapper")}>
          <div className={cx("textWrapper__inner")}>
            <p ref={baseRef} className={cx("webglSectionBlock__text", "webglSectionBlock__text--base")}>
              {textLines.map((l, i) => (
                <span key={`base-${i}`} className={cx("text__line")}>
                  {l}
                </span>
              ))}
            </p>
            <p ref={revealRef} className={cx("webglSectionBlock__text", "webglSectionBlock__text--reveal")} aria-hidden="true">
              {textLines.map((l, i) => (
                <span key={`reveal-${i}`} className={cx("text__line")}>
                  {l}
                </span>
              ))}
            </p>
          </div>
        </div>
      )}
    </GridWrapper>
  );
}
