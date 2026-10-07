"use client";

import gsap from "gsap";
import { useEffect, useImperativeHandle, useRef, type MouseEvent, type Ref } from "react";
import { moduleClasses } from "../core/cx";
import { emitter } from "../core/emitter";
import { mapRange } from "../core/math";
import { sound } from "../core/sound";
import arrowStyles from "../styles/ArrowButton.module.css";
import mainStyles from "../styles/MainButton.module.css";
import menuStyles from "../styles/MenuButton.module.css";
import labStyles from "../styles/NavLabButton.module.css";
import soundStyles from "../styles/SoundButton.module.css";

const mainCx = moduleClasses(mainStyles);
const soundCx = moduleClasses(soundStyles);
const menuCx = moduleClasses(menuStyles);
const labCx = moduleClasses(labStyles);
const arrowCx = moduleClasses(arrowStyles);

interface MainButtonProps {
  text: string;
  url?: string;
  isExternal?: boolean;
  underlineOnHover?: boolean;
  className?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}

/** Source `MainButton` (line ~39277): underlined link. */
export function MainButton({ text, url, isExternal = true, underlineOnHover = true, className, onClick }: MainButtonProps) {
  return (
    <a
      className={`${mainCx("mainButton", { "mainButton--noUnderlineHover": !underlineOnHover })}${className ? ` ${className}` : ""}`}
      href={url}
      target={isExternal ? "_blank" : "_self"}
      rel={isExternal ? "noreferrer" : undefined}
      onClick={onClick}
    >
      {text}
    </a>
  );
}

/** Source `NavLabButton` (line ~39996). */
export function NavLabButton({ text = "lab", url, className }: { text?: string; url?: string; className?: string }) {
  return (
    <a className={`${labCx("navLabButton")}${className ? ` ${className}` : ""}`} href={url} target="_blank" rel="noopener noreferrer">
      <span className={labCx("navLabButton__text")}>{text}</span>
      <div className={labCx("navLabButton__arrowWrapper")}>
        <div className={labCx("navLabButton__arrows")}>
          {(["default", "hover"] as const).map((v) => (
            <svg
              key={v}
              className={labCx("navLabButton__arrow", `navLabButton__arrow--${v}`)}
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M7.47503 5.00038H6.47514V1.65681L0.70711 7.42484L2.76905e-06 6.71774L5.71762 1.00011H2.47488V0.000221195H7.47434L7.47503 5.00038Z"
                fill="currentColor"
              />
            </svg>
          ))}
        </div>
      </div>
    </a>
  );
}

/**
 * Source `SoundButton` (line ~40033): four bars whose `scaleY` follows sin waves scaled by
 * the ambient volume factor (tweened 0↔1, .5s power4.out).
 */
export function SoundButton({ className }: { className?: string }) {
  const linesRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const offsets = [0, 1, 2, 3];
    const offTick = emitter.on("tick", ({ et }) => {
      linesRef.current.forEach((line, i) => {
        if (!line) return;
        const s = Math.sin(et * 0.005 + offsets[i]);
        const c = mapRange(s, [-1, 1], [0, 1]);
        line.style.transform = `scaleY(${c * sound.amount + 0.1})`;
      });
    });
    return () => offTick();
  }, []);

  return (
    <button
      type="button"
      aria-label="Toggle sound"
      className={`${soundCx("soundButton")}${className ? ` ${className}` : ""}`}
      onClick={() => sound.toggle()}
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          ref={(el) => {
            linesRef.current[i] = el;
          }}
          className={soundCx("soundButton__line", `soundButton__line--${i}`)}
        />
      ))}
    </button>
  );
}

export interface MenuButtonHandle {
  animateCross: (open: boolean) => gsap.core.Timeline | undefined;
}

/** Source `MenuButton` (line ~39824): two-line burger morphing to a cross. */
export function MenuButton({ onClick, ref }: { onClick: () => void; ref?: Ref<MenuButtonHandle> }) {
  const defaultRef = useRef<SVGSVGElement>(null);
  const crossRef = useRef<SVGSVGElement>(null);
  const c1 = useRef<SVGPathElement>(null);
  const c2 = useRef<SVGPathElement>(null);
  const d1 = useRef<SVGPathElement>(null);
  const d2 = useRef<SVGPathElement>(null);

  useImperativeHandle(ref, () => ({
    animateCross: (u: boolean) => {
      if (!crossRef.current || !c1.current || !c2.current) return undefined;
      const tl = gsap.timeline();
      tl.to(defaultRef.current, { transform: u ? "translateY(100%)" : "translateY(0%)", duration: 0.75, ease: "reveal" }, 0);
      tl.to(crossRef.current, { transform: u ? "translateY(0)" : "translateY(-100%)", duration: 0.75, ease: "reveal" }, 0);
      tl.to(c1.current, { strokeDashoffset: u ? 0 : 11, duration: 0.75, ease: "reveal" }, u ? 0.1 : 0);
      tl.to(c2.current, { strokeDashoffset: u ? 0 : 11, duration: 0.75, ease: "reveal" }, u ? 0.2 : 0);
      tl.to(d1.current, { strokeDashoffset: u ? -10 : 0, duration: 0.75, ease: "reveal" }, u ? 0 : 0.1);
      tl.to(d2.current, { strokeDashoffset: u ? -10 : 0, duration: 0.75, ease: "reveal" }, u ? 0 : 0.2);
      return tl;
    },
  }));

  return (
    <button type="button" aria-label="Menu" className={menuCx("menuButton")} onClick={onClick}>
      <svg ref={defaultRef} className={menuCx("menuButton__default")} width="12" height="8" viewBox="0 0 12 8" fill="none">
        <path ref={d1} className={menuCx("default__line", "default__line--1")} d="M1 1H11" strokeWidth="2" strokeLinecap="round" />
        <path ref={d2} className={menuCx("default__line", "default__line--2")} d="M1 7H11" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <svg ref={crossRef} className={menuCx("menuButton__cross")} width="40" height="40" viewBox="0 0 40 40" fill="none">
        <path ref={c1} className={menuCx("cross__line", "cross__line--1")} d="M23.5391 16.4729L16.468 23.544" strokeWidth="2" strokeLinecap="round" />
        <path ref={c2} className={menuCx("cross__line", "cross__line--2")} d="M23.5322 23.5439L16.4612 16.4729" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export interface ArrowButtonHandle {
  resetState: () => void;
  revealTL: (at: number) => gsap.core.Timeline;
  hideTL: () => void;
}

const ARROW_RECTS = (
  <>
    <rect className={arrowCx("arrow__rect")} x="6.66797" y="0.819092" width="4.28576" height="1.09424" transform="rotate(90 6.66797 0.819092)" fill="#022016" />
    <rect className={arrowCx("arrow__rect")} x="2.38184" y="0.818359" width="4.28576" height="1.09424" fill="#022016" />
    <rect className={arrowCx("arrow__rect")} x="0.748047" y="6.02832" width="6.61779" height="1.09424" transform="rotate(-45 0.748047 6.02832)" fill="#022016" />
  </>
);

/** Source `ArrowButton` (line ~46666): "Project link ↗" with tilt/slide reveal. */
export function ArrowButton({
  text,
  url,
  alwaysVisible = false,
  className,
  ref,
}: {
  text: string;
  url?: string;
  alwaysVisible?: boolean;
  className?: string;
  ref?: Ref<ArrowButtonHandle>;
}) {
  const rootRef = useRef<HTMLAnchorElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const arrowsRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const resetState = () => {
    const el = rootRef.current;
    if (!el) return;
    tlRef.current?.kill();
    el.classList.remove(...arrowCx("visible").split(" "));
    el.classList.add(...arrowCx("is-resetting").split(" "));
    if (textRef.current) gsap.set(textRef.current, { transform: "scale(1.2) rotate(15deg) translateY(110%)" });
    if (arrowsRef.current) gsap.set(arrowsRef.current, { transform: "translate(-100%, 100%)" });
  };

  useImperativeHandle(ref, () => ({
    resetState,
    revealTL: (at: number) => {
      resetState();
      const tl = gsap.timeline();
      tlRef.current = tl;
      tl.fromTo(
        textRef.current,
        { transform: "scale(1.2) rotate(15deg) translateY(110%)" },
        { transform: "scale(1) rotate(0deg) translateY(0%)", duration: 1.125, ease: "reveal" },
        at,
      );
      tl.fromTo(arrowsRef.current, { transform: "translate(-100%, 100%)" }, { transform: "translate(-0%, 0%)", duration: 1.125, ease: "reveal" }, at + 0.2);
      tl.call(
        () => {
          rootRef.current?.classList.remove(...arrowCx("is-resetting").split(" "));
          rootRef.current?.classList.add(...arrowCx("visible").split(" "));
        },
        undefined,
        at,
      );
      return tl;
    },
    hideTL: () => tlRef.current?.kill(),
  }));

  useEffect(() => () => void tlRef.current?.kill(), []);

  return (
    <a
      ref={rootRef}
      className={`${arrowCx("arrowButton", { alwaysVisible })}${className ? ` ${className}` : ""}`}
      href={url}
      target="_blank"
      rel="noreferrer"
    >
      <div className={arrowCx("arrowButton__text")}>
        <div ref={textRef} className={arrowCx("text")}>
          {text}
        </div>
      </div>
      <div className={arrowCx("arrowButton__wrapper")}>
        <div ref={arrowsRef} className={arrowCx("arrowButton__arrows")}>
          <svg className={arrowCx("arrows__arrow", "arrows__arrow--default")} width="7" height="7" viewBox="0 0 7 7" fill="none">
            {ARROW_RECTS}
          </svg>
          <svg className={arrowCx("arrows__arrow", "arrows__arrow--hover")} width="7" height="7" viewBox="0 0 7 7" fill="none">
            {ARROW_RECTS}
          </svg>
        </div>
      </div>
    </a>
  );
}
