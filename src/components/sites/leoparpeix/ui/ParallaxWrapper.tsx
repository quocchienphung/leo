"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { leo } from "../core/app";
import { moduleClasses } from "../core/cx";
import { emitter } from "../core/emitter";
import { isTabletWidth } from "../core/env";
import { mapClamp } from "../core/math";
import styles from "../styles/ParallaxWrapper.module.css";

const cx = moduleClasses(styles);
const VIEW_MARGIN = 200;

/** Source `ParallaxWrapperComponent` (line ~42926): vertical scroll parallax (desktop only). */
export function ParallaxWrapper({ parallaxAmount = -200, className, children }: { parallaxAmount?: number; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let rect: DOMRect | null = null;
    const measure = () => {
      const b = el.getBoundingClientRect();
      rect = new DOMRect(b.x, b.y + leo.scroll, b.width, b.height);
    };
    const apply = (s: number) => {
      if (!rect) return;
      const visible = rect.bottom > s - VIEW_MARGIN && rect.top < s + window.innerHeight + VIEW_MARGIN;
      if (isTabletWidth() || !visible) {
        el.style.transform = "";
        return;
      }
      const y = mapClamp(s, [rect.top - window.innerHeight, rect.top + rect.height], [-1, 1]) * parallaxAmount;
      el.style.transform = `translate3d(0, ${y}px, 0)`;
    };
    const onScroll = () => apply(leo.scroll);
    const onResize = () => {
      if (!isTabletWidth()) {
        const prev = el.style.transform;
        el.style.transform = "";
        measure();
        el.style.transform = prev;
      }
      apply(leo.scroll);
    };
    measure();
    apply(leo.scroll);
    leo.lenis?.on("scroll", onScroll);
    const off = emitter.on("resize", onResize);
    return () => {
      leo.lenis?.off("scroll", onScroll);
      off();
    };
  }, [parallaxAmount]);

  return (
    <div ref={ref} className={`${cx("parallaxComponent")}${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}
