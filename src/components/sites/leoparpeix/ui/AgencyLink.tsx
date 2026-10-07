"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";
import { moduleClasses } from "../core/cx";
import styles from "../styles/AgencyLink.module.css";

const cx = moduleClasses(styles);

// Source constants (line ~47857).
const BASE = 0.4; // SS
const PEAK = 1; // f4
const STAGGER = 0.05; // p4
const UP = 0.15; // Yg
const DOWN = 0.3; // A4
const REPEAT_DELAY = 0.4; // g4
const FADE_OUT = 0.3; // m4
const DESKTOP_MIN = 1025; // _4

/**
 * Source `AgencyLink` (line ~47867): "@Agency" link whose characters sit at .4 opacity and
 * ripple to 1 in a looping wave while hovered (desktop only).
 */
export function AgencyLink({ name, url }: { name: string; url: string }) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let chars: HTMLSpanElement[] = [];
    let values: { value: number }[] = [];
    const master = { value: 0 };
    let loop: gsap.core.Timeline | null = null;
    let fade: gsap.core.Tween | null = null;

    const opacity = (v: number) => BASE + (PEAK - BASE) * v * master.value;
    const paint = () => chars.forEach((c, i) => (c.style.opacity = String(opacity(values[i]?.value ?? 0))));
    const split = () => {
      el.replaceChildren();
      chars = [...name].map((ch) => {
        const s = document.createElement("span");
        s.className = cx("agency-char");
        s.textContent = ch;
        s.style.display = "inline-block";
        el.appendChild(s);
        return s;
      });
      values = chars.map(() => ({ value: 0 }));
      master.value = 0;
      paint();
    };

    const enter = () => {
      if (window.innerWidth < DESKTOP_MIN) return;
      fade?.kill();
      fade = null;
      gsap.killTweensOf(master);
      if (master.value < 1) gsap.to(master, { value: 1, duration: UP, ease: "power2.out", onUpdate: paint });
      else master.value = 1;
      if (loop) return;
      const tl = gsap.timeline({ repeat: -1, repeatDelay: REPEAT_DELAY, onUpdate: paint });
      chars.forEach((_, i) => {
        const t = i * STAGGER;
        tl.to(values[i], { value: 1, duration: UP, ease: "sine.inOut" }, t);
        tl.to(values[i], { value: 0, duration: DOWN, ease: "sine.inOut" }, t + UP);
      });
      loop = tl;
      paint();
    };
    const leave = () => {
      if (window.innerWidth < DESKTOP_MIN) return;
      fade?.kill();
      gsap.killTweensOf(master);
      fade = gsap.to(master, {
        value: 0,
        duration: FADE_OUT,
        ease: "power2.out",
        onUpdate: paint,
        onComplete: () => {
          fade = null;
          loop?.kill();
          loop = null;
          values.forEach((v) => (v.value = 0));
          paint();
        },
      });
    };

    let cancelled = false;
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (!cancelled) split();
    });
    el.addEventListener("mouseenter", enter);
    el.addEventListener("mouseleave", leave);
    return () => {
      cancelled = true;
      el.removeEventListener("mouseenter", enter);
      el.removeEventListener("mouseleave", leave);
      loop?.kill();
      fade?.kill();
      gsap.killTweensOf(master);
    };
  }, [name]);

  return (
    <a ref={ref} className={cx("agencyLink")} href={url} target="_blank" rel="noopener noreferrer">
      {name}
    </a>
  );
}
