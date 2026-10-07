"use client";

import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { createElement, useEffect, useImperativeHandle, useRef, type MouseEventHandler, type Ref } from "react";
import { leo } from "../core/app";
import { moduleClasses } from "../core/cx";
import { emitter } from "../core/emitter";
import { isMobileDevice } from "../core/env";
import { mapClamp } from "../core/math";
import styles from "../styles/TextComponent.module.css";

const cx = moduleClasses(styles);
const FORCE_3D = { force3D: true } as const;

export interface TextHandle {
  /** Source `textRevealTL` */
  reveal: (opts?: { reuseSplit?: boolean }) => gsap.core.Timeline;
  /** Source `textHideTL` */
  hide: () => gsap.core.Timeline;
  element: () => HTMLElement | null;
}

interface TextComponentProps {
  content: string;
  tag?: string;
  className?: string;
  stagger?: number;
  revealDelay?: number;
  revealOnScroll?: boolean;
  onlyOneLine?: boolean;
  duration?: number;
  hideDuration?: number;
  isFromToReveal?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  ref?: Ref<TextHandle>;
}

function willChange(els: Element[], on: boolean): void {
  for (const el of els) {
    const s = (el as HTMLElement).style;
    if (on) s.willChange = "transform";
    else s.removeProperty("will-change");
  }
}

/**
 * Port of the source `TextComponent` (line ~40646): splits into masked lines with SplitText
 * and reveals them (`yPercent 110 → 0`, 1.125s, ease "reveal", stagger .1) when the block
 * enters the viewport, or on demand through the imperative handle.
 */
export function TextComponent({
  content,
  tag = "p",
  className,
  stagger = 0.1,
  revealDelay = 0,
  revealOnScroll = true,
  onlyOneLine = false,
  duration = 1.125,
  isFromToReveal = true,
  onClick,
  ref,
}: TextComponentProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLElement>(null);
  const state = useRef({
    split: null as SplitText | null,
    tl: null as gsap.core.Timeline | null,
    revealed: false,
    completed: false,
    rect: null as DOMRect | null,
  });

  const targets = (): Element[] => {
    const s = state.current.split;
    if (s) return [...(s.lines ?? []), ...((s as unknown as { masks?: Element[] }).masks ?? [])];
    return textRef.current ? [textRef.current] : [];
  };

  const revertSplit = () => {
    const s = state.current.split;
    if (!s) return;
    gsap.killTweensOf(targets());
    s.revert();
    state.current.split = null;
  };

  const measure = () => {
    const el = rootRef.current;
    if (!el) return;
    const b = el.getBoundingClientRect();
    state.current.rect = new DOMRect(b.x, b.y + leo.scroll, b.width, b.height);
  };

  const markComplete = (tl: gsap.core.Timeline) => {
    if (revealOnScroll) return;
    const prev = tl.eventCallback("onComplete");
    tl.eventCallback("onComplete", () => {
      prev?.();
      state.current.completed = true;
    });
  };

  const reveal = ({ reuseSplit = false }: { reuseSplit?: boolean } = {}): gsap.core.Timeline => {
    const el = textRef.current;
    const st = state.current;
    if (!el) return gsap.timeline();
    st.tl?.kill();
    willChange(targets(), false);
    st.completed = false;
    const to = { yPercent: 0, duration, ease: "reveal", stagger, ...FORCE_3D };
    if (reuseSplit && st.split?.lines?.length) {
      const tl = gsap.timeline();
      tl.fromTo(st.split.lines, { yPercent: 110 }, to, revealDelay);
      markComplete(tl);
      st.tl = tl;
      return tl;
    }
    if (st.split) revertSplit();
    const tl = gsap.timeline({
      onStart: () => willChange(targets(), true),
      onComplete: () => willChange(targets(), false),
      onInterrupt: () => willChange(targets(), false),
    });
    if (onlyOneLine) {
      tl.fromTo(el, { yPercent: 110 }, { yPercent: 0, duration, ease: "reveal", ...FORCE_3D }, revealDelay);
    } else {
      gsap.set(el, { opacity: 0, yPercent: 0, clearProps: "transform" });
      st.split = SplitText.create(el, {
        type: "lines",
        linesClass: "line",
        autoSplit: true,
        mask: "lines",
        onSplit: (self) => {
          if (!textRef.current || !st.split) return;
          const lines = self.lines;
          gsap.set(textRef.current, { opacity: 1 });
          if (st.completed) {
            gsap.set(lines, { yPercent: 0, ...FORCE_3D });
            return;
          }
          gsap.set(lines, { yPercent: 110, ...FORCE_3D });
          if (isFromToReveal) tl.fromTo(lines, { yPercent: 110 }, to, revealDelay);
          else tl.to(lines, to, revealDelay);
        },
      });
      if (st.split.lines?.length && !tl.getChildren().length) {
        gsap.set(el, { opacity: 1 });
        gsap.set(st.split.lines, { yPercent: 110, ...FORCE_3D });
        if (isFromToReveal) tl.fromTo(st.split.lines, { yPercent: 110 }, to, revealDelay);
        else tl.to(st.split.lines, to, revealDelay);
      }
    }
    st.tl = tl;
    markComplete(tl);
    return tl;
  };

  const hide = (): gsap.core.Timeline => {
    const st = state.current;
    st.tl?.kill();
    willChange(targets(), false);
    if (st.split?.lines?.length) gsap.set(st.split.lines, { yPercent: 110, ...FORCE_3D });
    else if (textRef.current) {
      gsap.set(textRef.current, { opacity: 1, clearProps: "transform" });
      gsap.set(textRef.current, { yPercent: 110, ...FORCE_3D });
    }
    st.tl = gsap.timeline();
    return st.tl;
  };

  useImperativeHandle(ref, () => ({ reveal, hide, element: () => textRef.current }));

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.innerHTML = content;
    if (isFromToReveal) {
      if (!revealOnScroll) {
        gsap.set(el, { opacity: 1, clearProps: "transform" });
        gsap.set(el, { yPercent: 110, ...FORCE_3D });
      }
    } else {
      gsap.set(el, { yPercent: 110, ...FORCE_3D });
    }
    measure();
    const st = state.current;

    const onScroll = () => {
      const r = st.rect;
      if (!r) return;
      const p = Number(mapClamp(leo.scroll, [r.top - window.innerHeight, r.top + r.height], [0, 1]).toFixed(5));
      if (p > 0 && !st.revealed) {
        reveal();
        st.revealed = true;
      }
      if (p <= 0) st.revealed = false;
    };
    const onResize = () => {
      measure();
      if (!revealOnScroll && st.completed) {
        if (st.split?.lines?.length) {
          gsap.set(el, { opacity: 1, clearProps: "transform" });
          gsap.set(st.split.lines, { yPercent: 0, ...FORCE_3D });
        } else gsap.set(el, { yPercent: 0, opacity: 1, clearProps: "transform" });
      }
      if (!isMobileDevice() && revealOnScroll && st.rect) {
        revertSplit();
        const r = st.rect;
        const p = Number(mapClamp(leo.scroll, [r.top - window.innerHeight, r.top + r.height], [0, 1]).toFixed(5));
        const was = st.revealed;
        st.revealed = false;
        if (was && p > 0) {
          reveal();
          st.revealed = true;
        }
      }
    };
    const offResize = emitter.on("resize", onResize);
    if (revealOnScroll) leo.lenis?.on("scroll", onScroll);
    return () => {
      offResize();
      if (revealOnScroll) leo.lenis?.off("scroll", onScroll);
      st.tl?.kill();
      revertSplit();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  return (
    <div ref={rootRef} className={`${cx("textComponent")}${className ? ` ${className}` : ""}`}>
      {createElement(tag, { ref: textRef, className: "textComponent__content", onClick })}
    </div>
  );
}
