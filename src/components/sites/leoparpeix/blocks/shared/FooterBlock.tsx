"use client";

import gsap from "gsap";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { leo } from "../../core/app";
import { moduleClasses } from "../../core/cx";
import { emitter } from "../../core/emitter";
import { isSafari, isTabletWidth, isTouch } from "../../core/env";
import { offsetRect } from "../../core/math";
import { routeFromPath } from "../../core/navigation";
import type { GlobalContent } from "../../data/types";
import styles from "../../styles/FooterBlock.module.css";
import { MainButton } from "../../ui/buttons";
import { WebglBg } from "../../ui/WebglBg";
import { BeeBlock } from "./BeeBlock";

const cx = moduleClasses(styles);

// Source constants (line ~44562).
const COPY_LABEL = "Copy to clipboard";
const OPEN_DURATION = 1.25; // qd
const BASE_DURATION = 0.85; // Ms
const TEXT_FADE = 0.5; // yS
const TEXT_DELAY = 0.4; // lV
const SMALL_MAX = 700; // cV
const SCROLL_CLOSE_DELTA = 2; // uV
const TOUCH_CLOSE_DELTA = 8; // hV
const RESIZE_GRACE_MS = 1500; // dV

type Theme = "white" | "green" | "yellow";

function CrossIcon({ className }: { className?: string }) {
  return (
    <svg className={`svg-cross${className ? ` ${className}` : ""}`} width="11" height="11" viewBox="0 0 11 11" fill="none">
      <rect y="5" width="11" height="1" />
      <rect x="5" y="11" width="11" height="1" transform="rotate(-90 5 11)" />
    </svg>
  );
}

/**
 * Source `FooterBlock` (line ~44572): footer bee titles, credits button opening the yellow
 * "About this portfolio" panel (slides diagonally in, closes on scroll-up / overlay / cross),
 * social links and an email that copies to the clipboard on desktop.
 */
export function FooterBlock({ theme, ...footer }: GlobalContent["footer"] & { theme: Theme }) {
  const pathname = usePathname();
  const page = routeFromPath(pathname);
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const creditsBtnRef = useRef<HTMLDivElement>(null);
  const creditsWrapRef = useRef<HTMLButtonElement>(null);
  const leftRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rightRefs = useRef<(HTMLDivElement | null)[]>([]);
  const crossRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  // Rendered client-side only (routes mount after the loader), so the live year is safe.
  const [year] = useState(() => new Date().getFullYear());
  const api = useRef({
    hoverIn: () => {},
    hoverOut: () => {},
    open: () => {},
    close: (_o?: { force?: boolean }) => {},
    copy: (_v: string) => {},
    emailEnter: () => {},
    emailLeave: () => {},
    touchStart: (_e: React.TouchEvent) => {},
    touchMove: (_e: React.TouchEvent) => {},
  });

  useEffect(() => {
    let isOpen = false;
    let closing = false;
    let copied = false;
    let tl: gsap.core.Timeline | null = null;
    let lastScroll = leo.lenis?.scroll ?? window.scrollY;
    let graceUntil = 0;
    let touchY = 0;
    const texts = () => [...leftRefs.current, ...rightRefs.current].filter(Boolean) as HTMLElement[];
    const resetTexts = () => gsap.set(texts(), { clearProps: "transform,y", opacity: 0 });
    const small = () => window.innerWidth <= SMALL_MAX;
    const restColor = theme === "green" ? "#eed6c8" : "#000000";
    const grace = (ms = RESIZE_GRACE_MS) => {
      graceUntil = performance.now() + ms;
      lastScroll = leo.scroll;
    };
    const inGrace = () => performance.now() < graceUntil;
    const clipboardOpts = () => ({ variant: "clipboard" as const, clipboardTheme: theme === "yellow" ? ("white" as const) : ("default" as const) });

    const settleClosed = () => {
      tl?.kill();
      tl = null;
      closing = false;
      gsap.set(popupRef.current, { pointerEvents: "none" });
      gsap.set(overlayRef.current, { pointerEvents: "none", opacity: 0 });
      gsap.set(creditsWrapRef.current, { cursor: "pointer", pointerEvents: "auto" });
      gsap.set(outerRef.current, { clearProps: "transform,translate,x,y,xPercent,yPercent,scale" });
      gsap.set(innerRef.current, { clearProps: "transform,translate,x,y,xPercent,yPercent,scale" });
      gsap.set(creditsBtnRef.current, { clearProps: "transform,translate,x,y,xPercent,yPercent,opacity,color" });
      gsap.set(crossRef.current, { clearProps: "transform,scale" });
      resetTexts();
    };
    const settleOpen = () => {
      gsap.set(popupRef.current, { pointerEvents: "auto" });
      gsap.set(overlayRef.current, { pointerEvents: "auto", opacity: 0.3 });
      gsap.set(creditsWrapRef.current, { cursor: "default", pointerEvents: "none" });
      gsap.set(outerRef.current, { x: 0, y: 0, xPercent: 0, yPercent: 0, transform: "translate(0%, 0%)" });
      gsap.set(innerRef.current, { x: 0, y: 0, xPercent: 0, yPercent: 0, transform: "translate(0%, 0%)" });
      gsap.set(texts(), { opacity: 1, clearProps: "transform,y" });
      gsap.set(crossRef.current, { scale: 1 });
      gsap.set(creditsBtnRef.current, { opacity: 0, ...(small() ? { clearProps: "y" } : { y: "50%" }) });
    };

    api.current.hoverIn = () => {
      if (isOpen || closing) return;
      tl?.kill();
      tl = gsap.timeline();
      tl.to(outerRef.current, { transform: "translate(-85%, 85%)", duration: BASE_DURATION, ease: "reveal" }, 0);
      tl.to(innerRef.current, { transform: "translate(85%, -85%)", duration: BASE_DURATION, ease: "reveal" }, 0);
      tl.to(creditsBtnRef.current, { color: "#000000", duration: BASE_DURATION, ease: "reveal" }, 0);
      resetTexts();
    };
    api.current.hoverOut = () => {
      if (isOpen || closing) return;
      tl?.kill();
      tl = gsap.timeline();
      tl.to(outerRef.current, { transform: "translate(-100%, 100%)", duration: BASE_DURATION, ease: "reveal" }, 0);
      tl.to(innerRef.current, { transform: "translate(100%, -100%)", duration: BASE_DURATION, ease: "reveal" }, 0);
      tl.to(creditsBtnRef.current, { color: restColor, duration: BASE_DURATION, ease: "reveal" }, 0);
    };
    api.current.open = () => {
      if (isOpen || closing) return;
      isOpen = true;
      tl?.kill();
      const t = gsap.timeline();
      tl = t;
      t.set(popupRef.current, { pointerEvents: "auto" }, 0);
      t.set(overlayRef.current, { pointerEvents: "auto" }, 0);
      t.set(creditsWrapRef.current, { cursor: "default", pointerEvents: "none" }, 0);
      t.to(creditsBtnRef.current, { opacity: 0, duration: 0.2, ease: "power2.out" }, 0);
      if (!small()) t.to(creditsBtnRef.current, { y: "50%", duration: OPEN_DURATION * 0.5, ease: "expo.out" }, 0);
      t.to(outerRef.current, { transform: "translate(0%, 0%)", duration: OPEN_DURATION, ease: "expo.out" }, 0);
      t.fromTo(innerRef.current, { transform: "translate(85%, -85%)" }, { transform: "translate(0%, 0%)", duration: OPEN_DURATION, ease: "expo.out" }, 0);
      t.to(overlayRef.current, { opacity: 0.3, duration: OPEN_DURATION, ease: "sine.out" }, 0);
      resetTexts();
      t.to(texts(), { opacity: 1, duration: TEXT_FADE, ease: "power1.inOut" }, TEXT_DELAY);
      t.fromTo(crossRef.current, { scale: "0" }, { scale: "1", duration: 0.75, ease: "reveal" }, 0.5);
    };
    api.current.close = ({ force = false } = {}) => {
      if (!isOpen) return;
      if (!force && inGrace()) {
        lastScroll = leo.scroll;
        return;
      }
      isOpen = false;
      closing = true;
      tl?.kill();
      const t = gsap.timeline({ onComplete: () => !isOpen && settleClosed() });
      tl = t;
      t.set(popupRef.current, { pointerEvents: "none" }, 0);
      t.to(overlayRef.current, { opacity: 0, duration: BASE_DURATION * 0.5, ease: "power1.inOut" }, 0);
      t.set(overlayRef.current, { pointerEvents: "none" }, 0);
      t.set(creditsWrapRef.current, { cursor: "default", pointerEvents: "none" }, 0);
      t.to(texts(), { opacity: 0, duration: TEXT_FADE, ease: "power1.in" }, 0);
      t.to(outerRef.current, { transform: "translate(-100%, 100%)", duration: BASE_DURATION, ease: "hide" }, 0);
      t.to(innerRef.current, { transform: "translate(100%, -100%)", duration: BASE_DURATION, ease: "hide" }, 0);
      if (small()) t.fromTo(creditsBtnRef.current, { opacity: 0 }, { opacity: 1, duration: BASE_DURATION, ease: "hide" }, 0.15);
      else {
        t.fromTo(creditsBtnRef.current, { opacity: 0 }, { opacity: 1, duration: BASE_DURATION * 0.85, ease: "sine.inOut" }, 0.5);
        t.set(creditsBtnRef.current, { y: "0%" }, 0);
      }
      t.to(creditsBtnRef.current, { color: restColor, duration: BASE_DURATION, ease: "hide" }, 0.15);
      t.to(crossRef.current, { scale: "0", duration: 0.6, ease: "hide" }, 0);
    };
    api.current.copy = async (value: string) => {
      if (isTouch()) {
        window.location.href = `mailto:${value}`;
        return;
      }
      if (copied) return;
      try {
        await navigator.clipboard.writeText(value);
        copied = true;
        emitter.emit("cursorClipboardCopied");
      } catch {
        // clipboard permission denied: keep the label unchanged
      }
    };
    api.current.emailEnter = () => {
      copied = false;
      emitter.emit("cursorIndicationChange", COPY_LABEL, true, clipboardOpts());
    };
    api.current.emailLeave = () => {
      copied = false;
      emitter.emit("cursorIndicationChange", null, false);
    };
    api.current.touchStart = (e) => {
      touchY = e.touches[0]?.clientY ?? 0;
    };
    api.current.touchMove = (e) => {
      if (!isOpen || !isTabletWidth()) return;
      const y = e.touches[0]?.clientY ?? touchY;
      if (touchY - y > TOUCH_CLOSE_DELTA) api.current.close({ force: true });
    };

    const onScroll = () => {
      const s = leo.scroll;
      if (!isOpen || inGrace()) {
        lastScroll = s;
        return;
      }
      if (s < lastScroll - SCROLL_CLOSE_DELTA) {
        api.current.close();
        return;
      }
      lastScroll = s;
    };
    const footerInView = () => {
      const host = popupRef.current?.closest(".webglBg") ?? popupRef.current?.closest(".footerBlock");
      if (!host) return true;
      return leo.scroll >= offsetRect(host as HTMLElement).top - window.innerHeight;
    };
    const onLayout = () => {
      grace();
      if (!isOpen) {
        settleClosed();
        return;
      }
      if (!footerInView()) {
        api.current.close({ force: true });
        return;
      }
      tl?.kill();
      tl = null;
      settleOpen();
    };
    const onWindowResize = () => grace();
    const offRestore = emitter.on("showreelCursorRestore", () => {
      const el = document.querySelector(".footerBlock .networks__link--email");
      if (el?.matches(":hover")) api.current.emailEnter();
    });
    const offResize = emitter.on("resize", onLayout);
    const offLayout = emitter.on("layoutRefresh", onLayout);
    leo.lenis?.on("scroll", onScroll);
    window.addEventListener("resize", onWindowResize, { capture: true });
    return () => {
      tl?.kill();
      offRestore();
      offResize();
      offLayout();
      leo.lenis?.off("scroll", onScroll);
      window.removeEventListener("resize", onWindowResize, { capture: true });
    };
  }, [theme]);

  return (
    <WebglBg isGridWrapper={false} index={9} currentPage={page} isFooter className={cx("footerBlock", theme)}>
      <BeeBlock className={cx("footerBlock__webglBee")} titles={footer.titles} titlesReveal={footer.titlesReveal} isFooter />
      <div className={cx("footerBlock__bottom")}>
        <button
          ref={creditsWrapRef}
          type="button"
          className={cx("bottom__credits")}
          onMouseEnter={() => api.current.hoverIn()}
          onMouseLeave={() => api.current.hoverOut()}
          onClick={() => api.current.open()}
        >
          <div ref={creditsBtnRef} className={cx("credits__button")}>
            {footer.creditsBtn}
          </div>
        </button>
        <div className={cx("bottom__networks")}>
          {footer.networks.map((n) =>
            n.url ? (
              <MainButton key={n.name} className={cx("networks__link", theme)} text={n.name} url={n.url} />
            ) : (
              <p
                key={n.name}
                className={cx("networks__link", "networks__link--email", theme)}
                data-cursor-indication-preserve=""
                onMouseEnter={() => api.current.emailEnter()}
                onMouseLeave={() => api.current.emailLeave()}
                onClick={() => api.current.copy(n.name)}
              >
                <span className={cx("networks__emailHit")} aria-hidden="true" /> {n.name}
              </p>
            ),
          )}
        </div>
        <p className={cx("bottom__copyright")}>© {year}</p>
      </div>
      <div ref={popupRef} className={cx("footerBlock__popup", theme)}>
        <div ref={outerRef} className={cx("popup__transitionWrapper--outer")}>
          <div ref={innerRef} className={cx("popup__transitionWrapper--inner")}>
            <div className={cx("popup__top")}>
              <p className={cx("top__star")}>*</p>
              <p className={cx("top__infos")}>{footer.infos}</p>
              <div
                ref={crossRef}
                className={cx("top__cross", theme, { "top__cross--safari": typeof window !== "undefined" && isSafari() })}
                onClick={() => api.current.close({ force: true })}
              >
                <CrossIcon className={cx("cross__icon")} />
              </div>
            </div>
            <div className={cx("popup__content")}>
              <div className={cx("content__left")}>
                <div className={cx("left__content")}>
                  {footer.smallTexts.map((lines, k) => (
                    <div
                      key={k}
                      ref={(el) => {
                        leftRefs.current[k] = el;
                      }}
                      className={cx("content__textWrapper")}
                    >
                      {lines.map((html, j) => (
                        <p key={j} className={cx("wrapper__text")} dangerouslySetInnerHTML={{ __html: html }} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className={cx("content__right")}>
                {footer.bigTexts.map((html, k) => (
                  <div
                    key={k}
                    ref={(el) => {
                      rightRefs.current[k] = el;
                    }}
                    className={cx("right__textBlock")}
                  >
                    <p className={cx("right__text")} dangerouslySetInnerHTML={{ __html: html }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        ref={overlayRef}
        className={cx("footerBlock__overlay")}
        onClick={() => api.current.close({ force: true })}
        onTouchStart={(e) => api.current.touchStart(e)}
        onTouchMove={(e) => api.current.touchMove(e)}
      />
    </WebglBg>
  );
}
