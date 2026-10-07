"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";
import { leo } from "../core/app";
import { emitter } from "../core/emitter";
import { useClientValue } from "../core/useClient";
import { isTabletWidth, isTouch } from "../core/env";
import { globalContent } from "../data/global";
import { GridWrapper } from "../ui/GridWrapper";
import { CursorIndication } from "./CursorIndication";

/** Seconds before the loader texts reveal (source `RS`). */
export const LOADER_REVEAL_DELAY = 1.5;
/** Extra hold before the loader hides once assets are ready (source `$5`). */
export const LOADER_HOLD = 2.25;

/**
 * Source `LoaderBlock` (line ~51761). Styles are global (`.loaderBlock` in globals.css).
 * Texts slide up (1s "reveal", stagger .15) after 1.5s; when the app is loaded they slide
 * out (.45s power2.out) and the block fades (.35s) after `RS + $5` = 3.75s.
 */
export function LoaderBlock() {
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const infosRef = useRef<HTMLHeadingElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const indicationRef = useRef<HTMLDivElement>(null);
  // Source: the static "Click — to enable sound" pill only exists on touch tablets/phones.
  const touchLoader = useClientValue(() => isTabletWidth() && isTouch(), false);

  useEffect(() => {
    if (leo.skipLoader) {
      gsap.set(rootRef.current, { display: "none" });
      return;
    }
    const step = 0.15;
    const reveal = gsap.timeline({ delay: LOADER_REVEAL_DELAY });
    reveal.to(titleRef.current, { y: 0, rotate: 0, duration: 1, ease: "reveal" }, 0);
    reveal.to(infosRef.current, { y: 0, rotate: 0, duration: 1, ease: "reveal" }, step);
    reveal.to(progressRef.current, { y: 0, rotate: 0, duration: 1, ease: "reveal" }, step * 2);
    const pill = () => indicationRef.current?.querySelector(".cursorIndication__text") ?? null;
    if (pill()) {
      gsap.set(pill(), { opacity: 0, scale: 1 });
      reveal.to(pill(), { opacity: 1, duration: 1, ease: "reveal" }, step * 2);
    }
    const offSuppress = emitter.on("cursorSoundIndicationSuppress", (v) => {
      if (v && pill()) gsap.to(pill(), { opacity: 0, duration: 0.3, ease: "power2.in" });
    });

    const off = emitter.on("appLoaded", () => {
      const tl = gsap.timeline({ delay: LOADER_REVEAL_DELAY + LOADER_HOLD });
      for (const el of [titleRef.current, infosRef.current, progressRef.current]) {
        tl.to(el, { transform: "translateY(-100%)", duration: 0.45, ease: "power2.out" }, 0);
      }
      tl.to(rootRef.current, { opacity: 0, duration: 0.35, ease: "power2.out" }, 0);
    });
    return () => {
      off();
      offSuppress();
      reveal.kill();
    };
  }, []);

  return (
    <div ref={rootRef} className="loaderBlock">
      <GridWrapper className="loaderBlock__container">
        <div className="container__title">
          <h2 ref={titleRef} className="title__content">
            {globalContent.title}
          </h2>
        </div>
        <div className="container__infos">
          <h3 ref={infosRef} className="infos__content">
            {globalContent.infos}
          </h3>
        </div>
        <div className="container__bottom">
          {touchLoader ? (
            <div ref={indicationRef} className="bottom__indication">
              <CursorIndication initial={globalContent.loader.cursorIndication} isStatic />
            </div>
          ) : null}
          <div className="bottom__progress">
            <div ref={progressRef} className="progress__content">
              <svg className="progress__circle" width="8" height="8" viewBox="0 0 8 8" fill="none">
                <circle className="circle--inactive" opacity="0.2" cx="4" cy="4" r="3.25" stroke="black" strokeWidth="1" />
                <g transform="rotate(-90 4 4)">
                  <circle className="circle--animated" cx="4" cy="4" r="3.25" stroke="black" strokeWidth="1" />
                </g>
              </svg>
              <p className="progress__text">{globalContent.loader.progressText}</p>
            </div>
          </div>
        </div>
      </GridWrapper>
    </div>
  );
}
