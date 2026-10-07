"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { leo } from "../core/app";
import { moduleClasses } from "../core/cx";
import { emitter, type CursorIndicationOptions } from "../core/emitter";
import { designPx, isTabletWidth, isTouch } from "../core/env";
import { damp, lerp, offsetRect } from "../core/math";
import styles from "../styles/CursorIndication.module.css";

const cx = moduleClasses(styles);
const COPIED = "Copied";
const MOVE_RESET_MS = 50; // fG
const CLIPBOARD_SWAP = 0.25; // kg

type Label = string | string[] | null;
type Variant = "default" | "clipboard";

function offsetsFor(label: Label): { xPercent: number; yPercent: number } {
  return label === "Drag" ? { xPercent: 10, yPercent: -112 } : { xPercent: 0, yPercent: -100 };
}

/**
 * Source `CursorIndication` (line ~37756). A pill that trails the pointer (lerp 12, tilt
 * from pointer speed) and pops in/out with `elastic.out(0.75)` / `expo.out`.
 * `isStatic` renders the mobile loader variant ("Click — to enable sound").
 */
export function CursorIndication({ initial, isStatic = false }: { initial: string[]; isStatic?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const defaultLabelRef = useRef<HTMLSpanElement>(null);
  const copiedLabelRef = useRef<HTMLSpanElement>(null);
  const [label, setLabel] = useState<Label>(initial);
  const [variant, setVariant] = useState<Variant>("default");
  const [clipTheme, setClipTheme] = useState<"default" | "white">("default");
  const [clipText, setClipText] = useState("Copy to clipboard");
  const labelRef = useRef<Label>(initial);
  const playPauseRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const iconInnerRef = useRef<HTMLDivElement>(null);
  const [showreel, setShowreel] = useState(false);
  const soundHidden = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (isStatic) {
      gsap.set(textRef.current, { opacity: 0, scale: 1 });
      return;
    }
    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2, z: 0 };
    const current = { ...target };
    const last = { x: target.x, y: target.y };
    let lastMove = 0;
    let hasMoved = false;
    let soundShown = false;
    let tween: gsap.core.Timeline | null = null;
    let heroTop: number | null = null;
    let revealComplete = leo.isLoaderRevealComplete;
    root.style.transform = "translate(-100%, -100%) scale(1) rotate(0deg)";

    const canShow = () => !(isTabletWidth() && isTouch());
    // No audio onboarding over the playground's crystal pavilion: sound stays opt-in via the navbar.
    const canShowSound = () => canShow() && !window.location.pathname.startsWith("/playground");

    const animate = (next: Label, show: boolean, done?: () => void) => {
      const el = textRef.current;
      if (!el) return;
      tween?.kill();
      if (show && next) {
        labelRef.current = next;
        setLabel(next);
      }
      const { xPercent, yPercent } = offsetsFor(next ?? labelRef.current);
      gsap.set(el, { transformOrigin: "0% 100%", xPercent, yPercent });
      const tl = gsap.timeline();
      if (show) tl.set(el, { scale: 0, opacity: 1 }, 0);
      tl.to(el, { scale: show ? 1 : 0, duration: show ? 0.65 : 0.3, ease: show ? "elastic.out(0.75)" : "expo.out" }, 0);
      if (done) tl.eventCallback("onComplete", done);
      tween = tl;
    };

    const hideSound = () => {
      if (soundHidden.current) return;
      soundHidden.current = true;
      if (Array.isArray(labelRef.current)) animate(labelRef.current, false);
    };

    const measureHero = () => {
      const hero = document.querySelector<HTMLElement>(".webglBg__content.heroBlock");
      heroTop = hero ? offsetRect(hero).top : null;
    };

    const checkHero = () => {
      if (soundHidden.current || !leo.firstClick || !revealComplete || !Array.isArray(labelRef.current) || !hasMoved || heroTop === null) return;
      if (heroTop - leo.scroll <= target.y) hideSound();
    };

    // Initial state for the array label.
    gsap.set(textRef.current, { scale: 0, transformOrigin: "0% 100%", ...offsetsFor(initial) });

    const onMove = (e: PointerEvent) => {
      if (!hasMoved) {
        hasMoved = true;
        if (canShowSound() && !soundHidden.current && !soundShown && Array.isArray(labelRef.current)) {
          soundShown = true;
          animate(labelRef.current, true);
        }
      }
      lastMove = Date.now();
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const signed = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? dist : -dist) : dy > 0 ? dist : -dist;
      if (dist > 0) target.z = Math.max(-1, Math.min(signed * 0.02, 1));
      target.x = e.clientX;
      target.y = e.clientY;
      last.x = e.clientX;
      last.y = e.clientY;
      checkHero();
    };

    const offRender = emitter.on("render", ({ dt }) => {
      if (Date.now() - lastMove > MOVE_RESET_MS) target.z = 0;
      const k = damp(12, dt);
      current.x = lerp(current.x, target.x, k);
      current.y = lerp(current.y, target.y, k);
      current.z = lerp(current.z, target.z, damp(6, dt));
      if (showreelActive && (showreelMode === "timeline" || showreelMode === "timelineDrag")) {
        current.x = clampToProgress(current.x);
        const cy = progressCenterY();
        if (cy !== null) current.y = lerp(current.y, cy, damp(6, dt));
        root.style.transform = `translate(${current.x}px, ${current.y}px) scale(1) rotate(0deg)`;
        return;
      }
      root.style.transform = hasMoved
        ? `translate(${current.x}px, ${current.y}px) scale(${1 + Math.abs(current.z)}) rotate(${current.z * 40}deg)`
        : "translate(-100%, -100%) scale(1) rotate(0deg)";
    });

    const offChange = emitter.on("cursorIndicationChange", (text, visible, opts?: CursorIndicationOptions) => {
      if (!canShow()) return;
      if (visible) {
        if (opts?.variant === "clipboard") {
          setVariant("clipboard");
          setClipTheme(opts.clipboardTheme === "white" ? "white" : "default");
          if (typeof text === "string") setClipText(text);
          requestAnimationFrame(() => {
            gsap.set(defaultLabelRef.current, { yPercent: 0, opacity: 1 });
            gsap.set(copiedLabelRef.current, { yPercent: 100 });
            if (textRef.current) gsap.set(textRef.current, { clearProps: "width,overflow" });
            animate(text, true);
          });
          return;
        }
        setVariant("default");
        if (Array.isArray(text)) soundHidden.current = false;
        animate(text, true);
        return;
      }
      if (Array.isArray(labelRef.current)) soundHidden.current = true;
      animate(text, false, () => {
        setVariant("default");
        setClipTheme("default");
      });
    });

    const offCopied = emitter.on("cursorClipboardCopied", () => {
      const el = textRef.current;
      if (!el || !defaultLabelRef.current || !copiedLabelRef.current) return;
      const from = el.offsetWidth;
      const probe = copiedLabelRef.current.cloneNode(false) as HTMLSpanElement;
      probe.textContent = COPIED;
      probe.style.cssText = "visibility:hidden;position:absolute;left:0;top:0;white-space:nowrap;pointer-events:none;";
      el.appendChild(probe);
      const cs = getComputedStyle(el);
      const to = probe.offsetWidth + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      el.removeChild(probe);
      gsap.set(el, { width: from, overflow: "hidden" });
      const tl = gsap.timeline();
      tl.to(defaultLabelRef.current, { yPercent: -100, opacity: 0, duration: CLIPBOARD_SWAP, ease: "power2.out" }, 0);
      tl.fromTo(copiedLabelRef.current, { yPercent: 100 }, { yPercent: 0, duration: CLIPBOARD_SWAP, ease: "power2.out" }, 0);
      tl.to(el, { width: to, duration: CLIPBOARD_SWAP, ease: "power2.out" }, 0);
    });

    // Showreel cursor (source `Pn` / `ge`): play/pause bubble, timeline pill on the progress bar.
    let showreelMode = "default";
    let showreelActive = false;
    const progressCenterY = () => {
      const el = document.querySelector<HTMLElement>(".videoPlayer__progress");
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return b.top + b.height / 2 - designPx(27);
    };
    const clampToProgress = (x: number) => {
      const el = document.querySelector<HTMLElement>(".videoPlayer__progress");
      if (!el) return x;
      const b = el.getBoundingClientRect();
      const half = (timelineRef.current?.offsetWidth ?? 44) / 2;
      return Math.min(b.right - half, Math.max(b.left + half, x));
    };
    const pop = (el: HTMLElement | null, show: boolean) => {
      if (!el) return;
      gsap.killTweensOf(el, "scale");
      gsap.to(el, show ? { scale: 1, duration: 0.65, ease: "elastic.out(0.75)" } : { scale: 0, duration: 0.3, ease: "expo.out" });
    };
    const setIcon = (playing: boolean, animate: boolean) => {
      const el = iconInnerRef.current;
      if (el) gsap.to(el, { yPercent: playing ? 0 : -50, duration: animate ? 0.35 : 0, ease: "power3.out" });
    };
    const offShowreel = emitter.on("showreelPlayerChange", (st) => {
      if (!canShow()) return;
      if (!st.active) {
        if (showreelActive) {
          pop(playPauseRef.current, false);
          pop(timelineRef.current, false);
        }
        showreelActive = false;
        showreelMode = "default";
        setShowreel(false);
        // Source `wt()`: clear the default label (scale 0) then let hovered blocks restore it.
        labelRef.current = "";
        setLabel("");
        if (textRef.current) gsap.set(textRef.current, { scale: 0, opacity: 1, transformOrigin: "0% 100%", xPercent: 0, yPercent: -100 });
        requestAnimationFrame(() => emitter.emit("showreelCursorRestore"));
        return;
      }
      if (!showreelActive) {
        showreelActive = true;
        setShowreel(true);
        tween?.kill();
        if (textRef.current) gsap.set(textRef.current, { scale: 0 });
        gsap.set(playPauseRef.current, { scale: 0, xPercent: 0, yPercent: -100, transformOrigin: "0% 100%" });
        gsap.set(timelineRef.current, { scale: 0, xPercent: -50, yPercent: -50, transformOrigin: "50% 50%" });
      }
      const mode = st.cursorMode ?? "default";
      setIcon(st.isPlaying ?? true, false);
      if (mode === showreelMode) return;
      const wasTimeline = showreelMode === "timeline" || showreelMode === "timelineDrag";
      const isTimeline = mode === "timeline" || mode === "timelineDrag";
      showreelMode = mode;
      if (mode === "hidden") {
        pop(playPauseRef.current, false);
        pop(timelineRef.current, false);
      } else if (isTimeline && !wasTimeline) {
        pop(playPauseRef.current, false);
        pop(timelineRef.current, true);
      } else if (!isTimeline) {
        pop(timelineRef.current, false);
        pop(playPauseRef.current, true);
      }
    });
    const offIcon = emitter.on("showreelIconToggle", (playing) => {
      if (!showreelActive) return;
      const el = playPauseRef.current;
      if (el && showreelMode === "default") {
        gsap.timeline().to(el, { scale: 1.12, duration: 0.08, ease: "power2.out" }).to(el, { scale: 1, duration: 0.85, ease: "elastic.out(1.6, 0.35)" });
      }
      setIcon(playing, true);
    });

    const offSuppress = emitter.on("cursorSoundIndicationSuppress", (v) => v && hideSound());
    const offReveal = emitter.on("loaderRevealComplete", () => {
      revealComplete = true;
      measureHero();
    });
    const offResize = emitter.on("resize", measureHero);
    const onScroll = () => checkHero();
    window.addEventListener("pointermove", onMove, { passive: true });
    leo.lenis?.on("scroll", onScroll);
    measureHero();

    return () => {
      tween?.kill();
      offRender();
      offChange();
      offCopied();
      offSuppress();
      offShowreel();
      offIcon();
      offReveal();
      offResize();
      window.removeEventListener("pointermove", onMove);
      leo.lenis?.off("scroll", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isArray = Array.isArray(label);
  return (
    <div
      ref={rootRef}
      className={cx("cursorIndication", { "cursorIndication--static": isStatic, "cursorIndication--showreel": showreel })}
      aria-hidden="true"
    >
      <div
        ref={playPauseRef}
        className={cx("cursorIndication__text", "cursorIndication__text--showreel", "showreel__bubble", "showreel__bubble--playPause")}
        style={{ display: showreel ? undefined : "none" }}
      >
        <div className={cx("showreel__iconTrack")}>
          <div ref={iconInnerRef} className={cx("showreel__iconInner")}>
            <div className={cx("showreel__iconLine")}>
              <span className={cx("showreel__icon", "showreel__icon--pause")}>
                <span className={cx("showreel__pauseBar")} />
                <span className={cx("showreel__pauseBar")} />
              </span>
            </div>
            <div className={cx("showreel__iconLine")}>
              <svg className={cx("showreel__icon", "showreel__icon--play")} viewBox="0 0 9 11" fill="none">
                <path d="M0 0L9 5.5L0 11V0Z" fill="currentColor" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div
        ref={timelineRef}
        className={cx("cursorIndication__text", "cursorIndication__text--showreelTimeline", "showreel__bubble", "showreel__bubble--timeline")}
        style={{ display: showreel ? undefined : "none" }}
      >
        <div className={cx("showreel__timelineArrows")}>
          <svg className={cx("showreel__arrow", "showreel__arrow--left")} viewBox="0 0 5 8" fill="none">
            <path d="M4 1L1 4L4 7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <svg className={cx("showreel__arrow", "showreel__arrow--right")} viewBox="0 0 5 8" fill="none">
            <path d="M1 1L4 4L1 7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <div
        ref={textRef}
        style={{ display: showreel ? "none" : undefined }}
        className={cx("cursorIndication__text", {
          "cursorIndication__text--array": isArray,
          "cursorIndication__text--clipboard": variant === "clipboard" && clipTheme === "default",
          "cursorIndication__text--clipboardWhite": variant === "clipboard" && clipTheme === "white",
        })}
      >
        {isArray ? (
          <>
            <span>{label[0]}</span>
            <span className={cx("text__separator")} aria-hidden="true" />
            <span>{label[1]}</span>
          </>
        ) : variant === "clipboard" ? (
          <div className={cx("cursorIndication__track", "cursorIndication__track--clipboard")}>
            <div className={cx("cursorIndication__lineWrap")}>
              <span ref={defaultLabelRef} className={cx("cursorIndication__label")}>
                {clipText}
              </span>
            </div>
            <div className={cx("cursorIndication__lineWrap", "cursorIndication__lineWrap--copied")}>
              <span ref={copiedLabelRef} className={cx("cursorIndication__label", "cursorIndication__label--initial")}>
                {COPIED}
              </span>
            </div>
          </div>
        ) : (
          <div className={cx("cursorIndication__track")}>
            <span className={cx("cursorIndication__label")}>{label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
