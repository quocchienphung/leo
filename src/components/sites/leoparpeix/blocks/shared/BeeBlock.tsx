"use client";

import gsap from "gsap";
import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import { leo } from "../../core/app";
import { moduleClasses } from "../../core/cx";
import { emitter } from "../../core/emitter";
import { isMobileDevice, isTouch } from "../../core/env";
import { mapClamp, offsetRect } from "../../core/math";
import styles from "../../styles/BeeBlock.module.css";
import { getWebgl } from "../../webgl/instance";
import type { HeroBee } from "../../webgl/top/heroBee";

const cx = moduleClasses(styles);
const FLIP_DURATION = 2; // Fl
const RESET_MOVEMENT_MS = 2600; // vS
const F3D = { force3D: true } as const;

export interface BeeBlockHandle {
  triggerReveal: (delay?: number) => void;
  triggerTitleFlip: () => void;
}

interface BeeBlockProps {
  titles: string[];
  titlesReveal: string[];
  indication?: string;
  isFooter?: boolean;
  revealOnScroll?: boolean;
  /** Override which bee this block drives (playground extra bees). */
  getBee?: () => HeroBee | null;
  interactionEnabled?: boolean;
  onFruitFed?: () => void;
  onDropStart?: () => void;
  className?: string;
  ref?: Ref<BeeBlockHandle>;
  children?: ReactNode;
}

function setHidden(els: Element[]): void {
  els.forEach((el, i) => gsap.set(el, { y: "100%", x: i % 2 ? "-5%" : "5%", ...F3D }));
}

/**
 * Source `BeeBlock` (line ~43812). Huge display titles over the bee layer. Clicking inside
 * the zone drops a fruit the bee chases; each drop flips the titles to the alternate set.
 * While the block is on screen the top camera follows it so the bee stays anchored.
 */
export function BeeBlock({
  titles,
  titlesReveal,
  indication,
  isFooter = false,
  revealOnScroll = true,
  getBee,
  interactionEnabled = true,
  onFruitFed,
  onDropStart,
  className,
  ref,
  children,
}: BeeBlockProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const defaultWrappers = useRef<(HTMLDivElement | null)[]>([]);
  const revealWrappers = useRef<(HTMLDivElement | null)[]>([]);
  const defaultTitles = useRef<(HTMLHeadingElement | null)[]>([]);
  const revealTitles = useRef<(HTMLHeadingElement | null)[]>([]);
  const [inZone, setInZone] = useState(false);
  const [holding, setHolding] = useState(false);
  const api = useRef<BeeBlockHandle>({ triggerReveal: () => {}, triggerTitleFlip: () => {} });

  useImperativeHandle(ref, () => ({
    triggerReveal: (d) => api.current.triggerReveal(d),
    triggerTitleFlip: () => api.current.triggerTitleFlip(),
  }));

  useEffect(() => {
    const root = rootRef.current;
    const container = containerRef.current;
    if (!root || !container) return;
    const webgl = getWebgl();
    const touch = isTouch();
    const mobile = isMobileDevice();
    const bee = () => getBee?.() ?? (isFooter ? webgl?.topScene.footerBee : webgl?.topScene.heroBee) ?? null;
    const pointer: { x: number | null; y: number | null } = { x: null, y: null };
    let rootRect = offsetRect(root);
    let containerRect = offsetRect(container);
    let revealed = false;
    let flipped = false;
    let flipTl: gsap.core.Timeline | null = null;
    let revealTl: gsap.core.Timeline | null = null;
    let chasing = false;
    let dropping = false;
    let hiding = false;
    let holdingFruit = false;
    let resetTimer: number | undefined;
    let dropToken = 0;

    const dW = () => defaultWrappers.current.filter(Boolean) as HTMLElement[];
    const rW = () => revealWrappers.current.filter(Boolean) as HTMLElement[];
    const rT = () => revealTitles.current.filter(Boolean) as HTMLElement[];
    const dT = () => defaultTitles.current.filter(Boolean) as HTMLElement[];

    const setHold = (v: boolean) => {
      holdingFruit = v;
      setHolding(v);
    };

    const insideRect = (x: number, y: number) => {
      const b = container.getBoundingClientRect();
      return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
    };
    const inView = () => {
      if (!revealOnScroll) return true;
      const s = leo.scroll;
      return rootRect.top + rootRect.height > s && rootRect.top < s + window.innerHeight;
    };
    const overZone = (x: number, y: number) => {
      if (!leo.isLoaderRevealComplete || !inView() || !insideRect(x, y)) return false;
      const el = document.elementFromPoint(x, y);
      return !!el && container.contains(el);
    };
    const locked = () => chasing || dropping || hiding || (bee()?.isInteractionLocked() ?? false);
    const update = (x: number, y: number, skip = false) => {
      if (locked()) return;
      bee()?.updatePointer(x, y, { skipVelocity: skip });
    };

    const hideFruit = () => {
      const b = bee();
      if (!b || (!holdingFruit && !hiding)) return;
      hiding = true;
      b.hideCursorFruit(() => {
        hiding = false;
        setHold(false);
      });
    };

    const evaluate = (x: number | null, y: number | null, positionOnly = false) => {
      if (!interactionEnabled || x == null || y == null) return;
      const visible = inView();
      const over = insideRect(x, y);
      setInZone(visible && over);
      if (!visible) {
        setInZone(false);
        if (holdingFruit || hiding) hideFruit();
        return;
      }
      if (overZone(x, y)) {
        if (hiding) return;
        if (!holdingFruit && !locked()) {
          const b = bee();
          b?.enterZone();
          update(x, y, positionOnly);
          if (!touch) {
            b?.showCursorFruit();
            setHold(true);
          }
        } else if (holdingFruit) update(x, y, positionOnly);
      } else if (holdingFruit) hideFruit();
      else setInZone(over);
    };

    const flip = () => {
      flipped = !flipped;
      flipTl?.kill();
      const tl = gsap.timeline();
      const defs = dT();
      const revs = rT();
      defs.forEach((d, i) => {
        const r = revs[i];
        if (!r) return;
        const odd = i % 2;
        if (flipped) {
          tl.to(d, { y: "100%", x: odd ? "-5%" : "5%", ease: "power4.inOut", duration: FLIP_DURATION * 0.75, ...F3D }, i * 0.115);
          tl.to(r, { y: "0%", x: "0%", ease: "reveal", duration: FLIP_DURATION, ...F3D }, i * 0.1 + FLIP_DURATION * 0.315);
        } else {
          tl.to(r, { y: "100%", x: odd ? "5%" : "-5%", ease: "power4.inOut", duration: FLIP_DURATION * 0.75, ...F3D }, i * 0.115);
          tl.to(d, { y: "0%", x: "0%", ease: "reveal", duration: FLIP_DURATION, ...F3D }, i * 0.1 + FLIP_DURATION * 0.315);
        }
      });
      flipTl = tl;
    };

    const revealSet = (els: HTMLElement[], delay = 0) => {
      const tl = gsap.timeline({ delay: delay + 0.115 });
      els.forEach((el, i) => {
        tl.fromTo(el, { y: "100%", x: i % 2 ? "-5%" : "5%" }, { y: "0%", x: "0%", ease: "reveal", duration: 1, ...F3D }, i * 0.115);
      });
      return tl;
    };

    api.current = {
      triggerReveal: (delay = 0) => {
        const go = () => {
          if (!dW().length) {
            requestAnimationFrame(go);
            return;
          }
          revealTl?.kill();
          revealTl = revealSet(dW(), delay);
          revealed = true;
        };
        go();
      },
      triggerTitleFlip: flip,
    };

    const resetMovement = () => {
      bee()?.resetDefaultMovement();
      chasing = false;
    };

    const drop = (b: HeroBee, fromTouch = false) => {
      const token = ++dropToken;
      const done = () => {
        if (token !== dropToken) return;
        onFruitFed?.();
        dropping = false;
        if (touch) {
          setInZone(pointer.x != null && pointer.y != null && insideRect(pointer.x, pointer.y));
          return;
        }
        requestAnimationFrame(() => evaluate(pointer.x, pointer.y));
      };
      if (fromTouch) b.showCursorFruit({ hidden: true });
      dropping = true;
      setHold(false);
      const ok = fromTouch ? b.dropFruit(done, { spawnWhileFalling: true }) : b.dropFruit(done);
      if (!ok) {
        dropping = false;
        requestAnimationFrame(() => evaluate(pointer.x, pointer.y));
      }
    };

    const onClick = (e: MouseEvent) => {
      if (!interactionEnabled || !inView()) return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      const b = bee();
      if (!b || !overZone(e.clientX, e.clientY) || locked()) return;
      if (touch) {
        if (!b.canPlaceFruit() || chasing) return;
        b.updatePointer(e.clientX, e.clientY);
        setInZone(true);
        b.enterZone();
        flip();
        onDropStart?.();
        drop(b, true);
        window.clearTimeout(resetTimer);
        resetTimer = window.setTimeout(resetMovement, RESET_MOVEMENT_MS);
        chasing = true;
        return;
      }
      if (!(holdingFruit && b.canDropHeldFruit())) return;
      b.updatePointer(e.clientX, e.clientY);
      setInZone(insideRect(e.clientX, e.clientY));
      drop(b);
      onDropStart?.();
      const first = !chasing;
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(resetMovement, RESET_MOVEMENT_MS);
      chasing = true;
      if (first) flip();
    };

    const onWindowMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      evaluate(e.clientX, e.clientY);
    };
    const onEnter = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      evaluate(e.clientX, e.clientY);
    };
    const onLeave = () => evaluate(pointer.x, pointer.y);

    const onScrollReveal = () => {
      if (!revealOnScroll) return;
      const p = mapClamp(leo.scroll, [containerRect.top - window.innerHeight, containerRect.top + containerRect.height], [0, 1]);
      if (p > 0 && !revealed) {
        revealTl?.kill();
        revealTl = flipped ? revealSet(rW()) : revealSet(dW());
        revealed = true;
      }
      if (p <= 0) {
        if (revealed && flipped) setHidden(rW());
        revealed = false;
      }
    };

    const syncZone = () => {
      const b = bee();
      if (!leo.isLoaderRevealComplete) {
        b?.leaveZone();
        return;
      }
      if (!inView()) {
        b?.leaveZone();
        if (holdingFruit || hiding) hideFruit();
        return;
      }
      b?.enterZone();
    };

    const onRender = () => {
      if (!leo.isLoaderRevealComplete || !webgl) return;
      if (isFooter) {
        const start = rootRect.y - window.innerHeight;
        webgl.topScene.playground.footerStart = start;
        if (leo.scroll >= start) {
          const y = webgl.topCamera.setScrollPosition(leo.scroll, rootRect);
          webgl.topScene.setOverlayY(y);
          leo.showFooterBee = true;
        } else leo.showFooterBee = false;
      } else if (!leo.showFooterBee && !webgl.topScene.isContentBeeDisplayed()) {
        const y = webgl.topCamera.setScrollPosition(leo.scroll, rootRect);
        webgl.topScene.setOverlayY(y);
      }
      syncZone();
      evaluate(pointer.x, pointer.y, true);
    };

    const onResize = () => {
      rootRect = offsetRect(root);
      if (!mobile) containerRect = offsetRect(container);
      evaluate(pointer.x, pointer.y, true);
    };

    // Initial states (source `pe()`).
    setHidden(dW());
    rW().forEach((el) => gsap.set(el, { y: "0%", x: "0%", ...F3D }));
    setHidden(rT());

    container.addEventListener("pointerenter", onEnter);
    container.addEventListener("pointerleave", onLeave);
    container.addEventListener("click", onClick);
    window.addEventListener("pointermove", onWindowMove);
    if (revealOnScroll) leo.lenis?.on("scroll", onScrollReveal);
    const offRender = emitter.on("render", onRender);
    const offResize = emitter.on("resize", onResize);
    const offLayout = emitter.on("layoutRefresh", onResize);
    syncZone();

    return () => {
      container.removeEventListener("pointerenter", onEnter);
      container.removeEventListener("pointerleave", onLeave);
      container.removeEventListener("click", onClick);
      window.removeEventListener("pointermove", onWindowMove);
      leo.lenis?.off("scroll", onScrollReveal);
      offRender();
      offResize();
      offLayout();
      flipTl?.kill();
      revealTl?.kill();
      window.clearTimeout(resetTimer);
      if (isFooter) leo.showFooterBee = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFooter, revealOnScroll, interactionEnabled]);

  return (
    <div ref={rootRef} className={`${cx("beeBlock", { isFooter, isInZone: inZone, isHoldingFruit: holding })}${className ? ` ${className}` : ""}`}>
      <div ref={containerRef} className={cx("beeBlock__container")}>
        <div className={cx("container__titles--default")}>
          {titles.map((t, i) => (
            <div key={`d-${i}`} className={cx("titles__wrapper")}>
              <div
                ref={(el) => {
                  defaultWrappers.current[i] = el;
                }}
                className={cx("wrapper")}
              >
                <h2
                  ref={(el) => {
                    defaultTitles.current[i] = el;
                  }}
                  className={cx("title")}
                >
                  {t}
                </h2>
              </div>
            </div>
          ))}
        </div>
        <div className={cx("container__titles--reveal")}>
          {titlesReveal.map((t, i) => (
            <div key={`r-${i}`} className={cx("titles__wrapper")}>
              <div
                ref={(el) => {
                  revealWrappers.current[i] = el;
                }}
                className={cx("wrapper")}
              >
                <h2
                  ref={(el) => {
                    revealTitles.current[i] = el;
                  }}
                  className={cx("title", `title--${i + 1}`)}
                >
                  {t}
                </h2>
              </div>
            </div>
          ))}
        </div>
      </div>
      {indication ? <span className={cx("indication")}>{indication}</span> : null}
      {children}
    </div>
  );
}
