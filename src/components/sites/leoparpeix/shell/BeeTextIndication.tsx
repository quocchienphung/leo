"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { moduleClasses } from "../core/cx";
import { emitter, type BeeAnchor } from "../core/emitter";
import { isTabletWidth, isTouch } from "../core/env";
import styles from "../styles/BeeTextIndication.module.css";

const cx = moduleClasses(styles);

/**
 * Source `BeeTextIndication` (line ~38850): the bee's speech pill. Anchored below-left or
 * above the bee's projected bounds, scaled with the bee's on-screen size (`--bee-scale`) and
 * popped with an elastic `--reveal` CSS variable.
 */
export function BeeTextIndication() {
  const rootRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<"generic" | "conversation">("generic");
  const [theme, setTheme] = useState("white");

  useEffect(() => {
    const root = rootRef.current;
    const text = textRef.current;
    if (!root || !text) return;
    let visible = false;
    let hiding = false;
    let locked = false;
    let swapping = false;
    let anchored = false;
    let placement: "top" | "bottomLeft" = "bottomLeft";
    let scale = 1;
    const pos = { x: 0, y: 0 };
    let tl: gsap.core.Animation | null = null;
    const enabled = () => !isTabletWidth() && !isTouch();
    const origin = () => (placement === "top" ? "50% 100%" : "50% 0%");
    const transform = () => {
      if (!anchored) return "translate(-100%, -100%)";
      const t = placement === "top" ? "translate(-50%, -100%)" : "translate(-50%, 0)";
      return `translate(${pos.x}px, ${pos.y}px) ${t}`;
    };
    const applyScale = () => text.style.setProperty("--bee-scale", String(scale));
    const prep = () => {
      applyScale();
      gsap.set(text, { clipPath: "none", clearProps: "scale,transformOrigin,xPercent,yPercent" });
    };
    const resetAnchor = () => {
      anchored = false;
      pos.x = 0;
      pos.y = 0;
    };
    const place = (a: BeeAnchor) => {
      placement = a.placement === "top" ? "top" : "bottomLeft";
      scale = a.scale ?? 1;
      prep();
      pos.x = a.x;
      pos.y = a.y;
      anchored = true;
      applyScale();
      root.style.transformOrigin = origin();
      root.style.transform = transform();
    };
    const reveal = (t: string) => {
      tl?.kill();
      hiding = false;
      setLabel(t);
      prep();
      const x = gsap.timeline();
      x.set(text, { "--reveal": 0, opacity: 1 }, 0);
      x.to(text, { "--reveal": 1, duration: 0.65, ease: "elastic.out(0.75)" }, 0);
      tl = x;
    };
    const conceal = (done?: () => void) => {
      tl?.kill();
      hiding = true;
      prep();
      tl = gsap.to(text, {
        "--reveal": 0,
        duration: 0.3,
        ease: "expo.out",
        onComplete: () => {
          hiding = false;
          tl = null;
          done?.();
        },
      });
    };
    const swap = (t: string, m: "generic" | "conversation") => {
      tl?.kill();
      hiding = false;
      prep();
      const x = gsap.timeline();
      x.to(text, { "--reveal": 0, duration: 0.22, ease: "expo.in" });
      x.call(() => {
        setLabel(t);
        setMode(m);
      });
      x.to(text, { "--reveal": 1, duration: 0.65, ease: "elastic.out(0.75)" });
      tl = x;
    };

    const offChange = emitter.on("beeTextChange", (t, show, opts = {}) => {
      if (!enabled()) return;
      if (show && t) {
        if (locked) {
          tl?.kill();
          locked = false;
        }
        tl?.kill();
        hiding = false;
        const was = visible;
        const m = opts.mode === "conversation" ? "conversation" : "generic";
        visible = true;
        placement = opts.placement === "top" ? "top" : "bottomLeft";
        setTheme(opts.theme ?? "white");
        if (!was) {
          setMode(m);
          resetAnchor();
          reveal(t);
          return;
        }
        swap(t, m);
        return;
      }
      if (locked || (!visible && !hiding)) return;
      swapping = false;
      tl?.kill();
      conceal(() => {
        visible = false;
        setMode("generic");
        setTheme("white");
        resetAnchor();
      });
    });
    const offAnchor = emitter.on("beeAnchorUpdate", (a) => {
      if (locked || (!visible && !hiding) || swapping || !Number.isFinite(a.x) || !Number.isFinite(a.y)) return;
      const next = a.placement === "top" ? "top" : "bottomLeft";
      if (anchored && placement !== next) {
        if (!visible) return;
        tl?.kill();
        swapping = true;
        const x = gsap.timeline({ onComplete: () => (swapping = false) });
        x.to(text, { "--reveal": 0, duration: 0.3, ease: "expo.out" });
        x.call(() => {
          resetAnchor();
          place(a);
          swapping = false;
        });
        x.to(text, { "--reveal": 1, duration: 0.65, ease: "elastic.out(0.75)" });
        tl = x;
        return;
      }
      place(a);
    });
    const offHideAll = emitter.on("beeTextHideAll", () => {
      if (!visible && !hiding) return;
      locked = true;
      swapping = false;
      tl?.kill();
      conceal(() => {
        visible = false;
        locked = false;
        setMode("generic");
        setTheme("white");
        resetAnchor();
      });
    });
    const offRender = emitter.on("render", () => {
      if (!visible && !hiding) return;
      if (!anchored) {
        root.style.transform = "translate(-100%, -100%)";
        return;
      }
      applyScale();
      root.style.transformOrigin = origin();
      root.style.transform = transform();
    });
    root.style.transform = "translate(-100%, -100%)";
    text.style.setProperty("--reveal", "1");
    return () => {
      tl?.kill();
      gsap.killTweensOf(text);
      offChange();
      offAnchor();
      offHideAll();
      offRender();
    };
  }, []);

  return (
    <div ref={rootRef} className={cx("beeTextIndication", `beeTextIndication--theme-${theme}`, { "beeTextIndication--conversation": mode === "conversation" })}>
      <div ref={textRef} className={cx("beeTextIndication__text")}>
        <span className={cx("beeTextIndication__label")}>{label}</span>
      </div>
    </div>
  );
}
