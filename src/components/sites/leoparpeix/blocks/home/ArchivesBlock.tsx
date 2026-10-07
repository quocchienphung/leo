"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";
import { leo } from "../../core/app";
import { moduleClasses } from "../../core/cx";
import { emitter } from "../../core/emitter";
import { archiveImage, archivePoster, archiveVideo } from "../../data/media";
import type { ArchiveItem } from "../../data/types";
import styles from "../../styles/ArchivesBlock.module.css";
import { ArrowButton, MainButton, type ArrowButtonHandle } from "../../ui/buttons";
import { GridWrapper } from "../../ui/GridWrapper";
import { TextComponent, type TextHandle } from "../../ui/TextComponent";
import { WebglBg } from "../../ui/WebglBg";

const cx = moduleClasses(styles);
const EXPANDED = cx("expanded").split(" ");

// Source constants (line ~46816).
const MASK = 0.35; // jd
const HEIGHT_SETTLE_MS = 1400; // Wg
const VIDEO_PAUSE_MS = 350; // o4
const MEDIA_IN = 1.3; // ES
const MOBILE_MAX = 1023; // a4
const MEDIA_FADE_DELAY = 0.45; // l4
const MEDIA_FADE_OUT = 0.55; // c4

interface ResolvedMedia {
  isVideo: boolean;
  src?: string;
  poster?: string;
}

function resolveMedia(item: ArchiveItem): ResolvedMedia {
  const m = item.media;
  if (m?.isVideo && m.url2) return { isVideo: true, src: archiveVideo(m.url2), poster: archivePoster(m.url2) };
  if (m?.url) return { isVideo: false, src: archiveImage(m.url) };
  return { isVideo: false };
}

const isFreelance = (item: ArchiveItem) => (item.agency?.name ?? "").toLowerCase().includes("freelance");
const isMobileList = () => window.matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches;

/**
 * Source `ArchivesBlock` (line ~46828): 23 expandable rows (projects 7–29). Hover slides a mask
 * in from the side the pointer entered; click expands one row at a time with copy reveal,
 * media slide-in and inline video playback.
 */
export function ArchivesBlock({ title, items, cursorIndication }: { title: string; items: ArchiveItem[]; cursorIndication: string }) {
  const listRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const maskRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mediaRefs = useRef<(HTMLElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const posterRefs = useRef<(HTMLImageElement | null)[]>([]);
  const textRefs = useRef<(TextHandle | null)[][]>([]);
  const arrowRefs = useRef<(ArrowButtonHandle | null)[]>([]);
  const handlers = useRef({
    click: (_e: React.MouseEvent, _i: number) => {},
    enter: (_i: number) => {},
    leave: (_e: React.MouseEvent, _i: number) => {},
    listEnter: () => {},
    listLeave: () => {},
    agencyEnter: () => {},
    agencyLeave: () => {},
  });

  useEffect(() => {
    const list = listRef.current;
    const root = rootRef.current;
    if (!list || !root) return;
    const heights = new Map<number, number>();
    const tokens = new Map<number, number>();
    const timers = new Map<string, number>();
    const tweens = new Map<string, gsap.core.Animation>();
    const revealedOnce = new Set<number>();
    const posterHidden = new Set<number>();
    const videoPauseTimers = new Map<number, number>();
    let open: number | null = null;
    let openTl: gsap.core.Timeline | null = null;
    let animating = false;
    let pendingLayout = false;
    let hoverAgency = 0;
    let overList = false;

    const row = (i: number) => rowRefs.current[i];
    const isExpanded = (el: HTMLElement) => el.classList.contains(EXPANDED[0]);
    const setExpanded = (el: HTMLElement, v: boolean) => (v ? el.classList.add(...EXPANDED) : el.classList.remove(...EXPANDED));
    const bump = (i: number) => {
      const t = (tokens.get(i) ?? 0) + 1;
      tokens.set(i, t);
      return t;
    };
    const current = (i: number, t: number) => tokens.get(i) === t;
    const clearTimer = (i: number, k: string) => {
      const key = `${i}:${k}`;
      const t = timers.get(key);
      if (t) window.clearTimeout(t);
      timers.delete(key);
    };
    const later = (i: number, k: string, fn: () => void, ms: number) => {
      clearTimer(i, k);
      timers.set(`${i}:${k}`, window.setTimeout(fn, ms));
    };
    const killRow = (i: number) => {
      ["close", "height", "scroll", "sync"].forEach((k) => clearTimer(i, k));
      tweens.get(`media-fade-${i}`)?.kill();
      tweens.delete(`media-fade-${i}`);
      const m = maskRefs.current[i];
      const c = mediaRefs.current[i];
      if (m) gsap.killTweensOf(m);
      if (c) gsap.killTweensOf(c);
    };
    const done = () => {
      animating = false;
      if (pendingLayout) {
        pendingLayout = false;
        relayout();
      }
    };

    const withoutTransition = <T,>(el: HTMLElement, fn: () => T): T => {
      const prev = el.style.transition;
      el.style.transition = "none";
      const r = fn();
      void el.offsetHeight;
      if (prev) el.style.transition = prev;
      else el.style.removeProperty("transition");
      return r;
    };
    const expandedHeight = (el: HTMLElement) =>
      withoutTransition(el, () => {
        const was = isExpanded(el);
        const h = el.style.height;
        setExpanded(el, true);
        el.style.height = "auto";
        void el.offsetHeight;
        const sh = el.scrollHeight;
        if (was) el.style.height = h;
        else {
          setExpanded(el, false);
          el.style.height = "";
        }
        return sh;
      });
    const collapsedHeight = (el: HTMLElement) => {
      const parent = el.parentNode as HTMLElement | null;
      if (!parent) return el.offsetHeight;
      const w = el.getBoundingClientRect().width;
      const clone = el.cloneNode(true) as HTMLElement;
      setExpanded(clone, false);
      clone.setAttribute("aria-hidden", "true");
      clone.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;width:${w}px;margin:0;transform:none`;
      parent.appendChild(clone);
      const h = clone.getBoundingClientRect().height || clone.offsetHeight;
      clone.remove();
      return h;
    };

    const maskEnter = (i: number) => {
      const el = row(i);
      const m = maskRefs.current[i];
      if (!el || !m || isExpanded(el)) return;
      tweens.get(`enter-${i}`)?.kill();
      tweens.set(`enter-${i}`, gsap.to(m, { transform: "translateY(0%)", duration: MASK, ease: "expo.out" }));
    };
    const maskLeave = (e: { offsetY: number } | null, i: number, forceUp: boolean) => {
      const el = row(i);
      const m = maskRefs.current[i];
      if (!el || !m || isExpanded(el)) return;
      tweens.get(`leave-${i}`)?.kill();
      const top = e ? e.offsetY < el.clientHeight / 2 : true;
      const to = top || forceUp ? "translateY(-102%)" : "translateY(102%)";
      tweens.set(`leave-${i}`, gsap.to(m, { transform: to, duration: MASK, ease: "expo.out" }));
    };

    const hidePoster = (i: number) => {
      if (posterHidden.has(i)) return;
      posterHidden.add(i);
      const p = posterRefs.current[i];
      if (p) p.style.opacity = "0";
    };
    const playVideo = (i: number) => {
      const v = videoRefs.current[i];
      if (!v) return;
      window.clearTimeout(videoPauseTimers.get(i));
      if (!posterHidden.has(i)) {
        const vv = v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
        if (typeof vv.requestVideoFrameCallback === "function") vv.requestVideoFrameCallback(() => hidePoster(i));
        else v.addEventListener("playing", () => requestAnimationFrame(() => hidePoster(i)), { once: true });
      }
      v.currentTime = 0;
      v.play().catch(() => {});
    };
    const pauseVideo = (i: number, immediate: boolean) => {
      const v = videoRefs.current[i];
      if (!v) return;
      window.clearTimeout(videoPauseTimers.get(i));
      if (immediate) v.pause();
      else videoPauseTimers.set(i, window.setTimeout(() => v.pause(), VIDEO_PAUSE_MS));
    };
    const resetMedia = (i: number) => {
      const c = mediaRefs.current[i];
      if (!c) return;
      gsap.killTweensOf(c);
      gsap.set(c, isMobileList() ? { opacity: 0, transform: "translateY(102%)" } : { transform: "translateY(102%)" });
    };

    const syncHeight = (i: number) => {
      const el = row(i);
      if (!el || !isExpanded(el)) return;
      const target = expandedHeight(el);
      const cur = parseFloat(el.style.height) || el.offsetHeight;
      if (Math.abs(target - cur) <= 1) return;
      heights.set(i, target);
      withoutTransition(el, () => {
        el.style.height = `${target}px`;
      });
      reserveListHeight();
      leo.lenis?.resize();
    };

    const close = (i: number, e: { offsetY: number } | null, opts: { enterMask?: boolean; leaveMask?: boolean; pauseNow?: boolean } = {}) => {
      const el = row(i);
      if (!el || !isExpanded(el)) return;
      const t = bump(i);
      killRow(i);
      animating = true;
      const from = el.getBoundingClientRect().height;
      const to = collapsedHeight(el);
      el.style.transition = "none";
      el.style.height = `${from}px`;
      void el.offsetHeight;
      el.style.removeProperty("transition");
      setExpanded(el, false);
      el.style.height = `${to}px`;
      if (opts.leaveMask) maskLeave(e, i, true);
      else if (opts.enterMask) maskEnter(i);
      const c = mediaRefs.current[i];
      if (c && isMobileList()) {
        const tl = gsap.timeline({ onComplete: () => current(i, t) && !isExpanded(el) && resetMedia(i) });
        tl.to(c, { opacity: 0, duration: MEDIA_FADE_OUT, ease: "hide" }, 0);
        tweens.set(`media-fade-${i}`, tl);
      }
      pauseVideo(i, !!opts.pauseNow);
      later(
        i,
        "close",
        () => {
          if (!current(i, t)) return;
          if (!isExpanded(el)) {
            el.style.height = "";
            resetMedia(i);
          }
          done();
        },
        HEIGHT_SETTLE_MS,
      );
    };

    const openRow = (i: number, tl: gsap.core.Timeline) => {
      const el = row(i);
      if (!el) return;
      const t = bump(i);
      killRow(i);
      emitter.emit("cursorIndicationChange", null, false);
      arrowRefs.current[i]?.resetState();
      const reuse = revealedOnce.has(i);
      (textRefs.current[i] ?? []).forEach((h, k) => {
        if (h) tl.add(h.reveal({ reuseSplit: reuse }), k * 0.125);
      });
      revealedOnce.add(i);
      const target = expandedHeight(el);
      heights.set(i, target);
      el.style.height = `${el.offsetHeight}px`;
      setExpanded(el, true);
      void el.offsetHeight;
      el.style.height = `${target}px`;
      animating = true;
      later(i, "height", () => current(i, t) && done(), HEIGHT_SETTLE_MS);
      const m = maskRefs.current[i];
      if (m) tl.to(m, { transform: "translateY(-102%)", duration: MASK, ease: "expo.out" }, 0);
      const c = mediaRefs.current[i];
      if (c) {
        gsap.killTweensOf(c);
        tl.fromTo(c, { transform: "translateY(102%)" }, { transform: "translateY(0%)", duration: MEDIA_IN, ease: "expo.out" }, 0);
        if (isMobileList()) {
          gsap.set(c, { opacity: 0 });
          tl.to(c, { opacity: 1, duration: MEDIA_IN, ease: "expo.out" }, MEDIA_FADE_DELAY);
        }
        playVideo(i);
        if (c.tagName === "IMG" && !(c as HTMLImageElement).complete)
          c.addEventListener("load", () => current(i, t) && requestAnimationFrame(() => requestAnimationFrame(() => syncHeight(i))), { once: true });
      }
      const arrow = arrowRefs.current[i];
      if (arrow) tl.add(arrow.revealTL(0.5), 0);
      requestAnimationFrame(() => requestAnimationFrame(() => current(i, t) && syncHeight(i)));
      if (isMobileList()) {
        later(
          i,
          "scroll",
          () => {
            if (!current(i, t) || !leo.lenis || !isExpanded(el)) return;
            leo.lenis.resize();
            leo.lenis.scrollTo(el, { duration: 2.5, offset: -window.innerHeight * 0.5 + el.offsetHeight * 0.5 });
          },
          700,
        );
      }
    };

    // Source `He`: reserve the tallest possible expansion so the page height never jumps.
    const reserveListHeight = () => {
      const rows = rowRefs.current;
      const first = rows[0];
      if (!first) return;
      const expanded: { el: HTMLDivElement; i: number; transition: string }[] = [];
      rows.forEach((el, i) => {
        if (el && isExpanded(el)) {
          expanded.push({ el, i, transition: el.style.transition });
          setExpanded(el, false);
          el.style.transition = "none";
          el.style.height = "";
          void el.offsetHeight;
        }
      });
      root.style.height = "";
      const rowH = first.getBoundingClientRect().height || 45;
      const total = root.scrollHeight;
      let extra = Math.max((heights.get(0) ?? expandedHeight(first)) - rowH, 0);
      for (const { i } of expanded) {
        const h = heights.get(i) ?? expandedHeight(rows[i] as HTMLDivElement);
        heights.set(i, h);
        extra = Math.max(extra, h - rowH);
      }
      root.style.height = `${total + extra}px`;
      for (const { el, i, transition } of expanded) {
        setExpanded(el, true);
        const h = heights.get(i);
        el.style.height = h != null ? `${h}px` : "";
        requestAnimationFrame(() => {
          if (transition) el.style.transition = transition;
          else el.style.removeProperty("transition");
        });
      }
    };

    const relayout = () => {
      if (animating) {
        pendingLayout = true;
        return;
      }
      rowRefs.current.forEach((el, i) => {
        if (!el || isExpanded(el)) return;
        el.style.height = "";
        const m = maskRefs.current[i];
        if (m) {
          gsap.killTweensOf(m);
          gsap.set(m, { transform: "translateY(102%)" });
        }
      });
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (animating) {
            pendingLayout = true;
            return;
          }
          rowRefs.current.forEach((el, i) => el && heights.set(i, expandedHeight(el)));
          rowRefs.current.forEach((el, i) => {
            if (el && isExpanded(el)) {
              const h = expandedHeight(el);
              heights.set(i, h);
              withoutTransition(el, () => {
                el.style.height = `${h}px`;
              });
            }
          });
          reserveListHeight();
          requestAnimationFrame(() => {
            leo.lenis?.resize();
            emitter.emit("layoutRefresh");
          });
        }),
      );
    };

    const showCursor = () => {
      if (open !== null || !cursorIndication) return;
      emitter.emit("cursorIndicationChange", cursorIndication, true);
    };
    const hideCursor = () => emitter.emit("cursorIndicationChange", null, false);

    handlers.current = {
      click: (e, i) => {
        const el = row(i);
        if (!el) return;
        const ev = { offsetY: e.nativeEvent.offsetY };
        const wasOpen = isExpanded(el);
        if (open !== null && open !== i) {
          openTl?.kill();
          close(open, ev, { leaveMask: true, pauseNow: true });
        }
        if (wasOpen) {
          openTl?.kill();
          close(i, ev, { enterMask: true });
          open = null;
          if (overList) showCursor();
        } else {
          openTl?.kill();
          const tl = gsap.timeline();
          openTl = tl;
          openRow(i, tl);
          open = i;
        }
      },
      enter: (i) => maskEnter(i),
      leave: (e, i) => maskLeave({ offsetY: e.nativeEvent.offsetY }, i, false),
      listEnter: () => {
        overList = true;
        if (hoverAgency === 0) showCursor();
      },
      listLeave: () => {
        overList = false;
        hoverAgency = 0;
        hideCursor();
      },
      agencyEnter: () => {
        hoverAgency += 1;
        if (hoverAgency === 1) hideCursor();
      },
      agencyLeave: () => {
        hoverAgency = Math.max(0, hoverAgency - 1);
        if (hoverAgency === 0 && overList) showCursor();
      },
    };

    let resizeTimer = 0;
    const offResize = emitter.on("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(relayout, 200);
    });
    const offRestore = emitter.on("showreelCursorRestore", () => {
      if (list.matches(":hover") && hoverAgency === 0) showCursor();
    });
    const raf = requestAnimationFrame(() => requestAnimationFrame(relayout));
    for (let i = 0; i < items.length; i++) resetMedia(i);

    return () => {
      cancelAnimationFrame(raf);
      offResize();
      offRestore();
      hideCursor();
      timers.forEach((t) => window.clearTimeout(t));
      videoPauseTimers.forEach((t) => window.clearTimeout(t));
      tweens.forEach((t) => t.kill());
      openTl?.kill();
    };
  }, [items, cursorIndication]);

  return (
    <WebglBg rootRef={rootRef} isGridWrapper={false} index={8} currentPage="home" className={cx("archivesBlock")}>
      <GridWrapper className={cx("archivesBlock__title")}>
        <h3 className={cx("title__text")}>{title}</h3>
      </GridWrapper>
      <div ref={listRef} className={cx("archivesBlock__list")} onMouseEnter={() => handlers.current.listEnter()} onMouseLeave={() => handlers.current.listLeave()}>
        {items.map((item, i) => {
          const media = resolveMedia(item);
          return (
            <GridWrapper
              key={i}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              className={cx("archivesBlock__items")}
              onClick={(e) => handlers.current.click(e, i)}
              onMouseEnter={() => handlers.current.enter(i)}
              onMouseLeave={(e) => handlers.current.leave(e, i)}
            >
              <div
                ref={(el) => {
                  maskRefs.current[i] = el;
                }}
                className={cx("items__mask")}
              />
              <div className={cx("items__separator", "items__separator--top")} />
              <div className={cx("items__title")}>
                <div className={cx("title__number")}>{i + 7}</div>
                <h4 className={cx("title__name")}>{item.name}</h4>
                <div className={cx("title__type")}>{item.type}</div>
              </div>
              <div className={cx("items__roles")}>{item.roles}</div>
              <div className={cx("items__date")}>{item.date}</div>
              <span onMouseEnter={() => handlers.current.agencyEnter()} onMouseLeave={() => handlers.current.agencyLeave()} style={{ display: "contents" }}>
                <MainButton className={cx("items__agency")} text={item.agency.name} url={item.agency.url} underlineOnHover={!isFreelance(item)} />
              </span>
              <svg className={cx("items__arrow")} width="7" height="5" viewBox="0 0 7 5" fill="none">
                <rect x="3.96875" y="4.02197" width="4.28576" height="1.09424" transform="rotate(-135 3.96875 4.02197)" fill="#022016" />
                <rect x="7" y="0.991699" width="4.28576" height="1.09424" transform="rotate(135 7 0.991699)" fill="#022016" />
              </svg>
              <div className={cx("items__text", { "items__text--noLink": !item.projectLink })}>
                {item.infos.map((info, k) => (
                  <TextComponent
                    key={k}
                    ref={(h) => {
                      textRefs.current[i] ??= [];
                      textRefs.current[i][k] = h;
                    }}
                    className={cx("text__infos")}
                    content={info}
                    revealOnScroll={false}
                    stagger={0.075}
                  />
                ))}
                {item.projectLink ? (
                  <ArrowButton
                    ref={(h) => {
                      arrowRefs.current[i] = h;
                    }}
                    className={cx("text__link")}
                    text={item.projectLink.text}
                    url={item.projectLink.url}
                  />
                ) : null}
              </div>
              <div className={cx("items__media")}>
                <div className={cx("media__inner")}>
                  {media.isVideo ? (
                    <div
                      ref={(el) => {
                        mediaRefs.current[i] = el;
                      }}
                      className={cx("media__content", "media__content--video")}
                      style={media.poster ? { backgroundImage: `url(${media.poster})`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" } : undefined}
                    >
                      <video
                        ref={(el) => {
                          videoRefs.current[i] = el;
                        }}
                        className={cx("media__video")}
                        loop
                        muted
                        playsInline
                        preload="none"
                      >
                        {media.src ? <source src={media.src} type="video/mp4" /> : null}
                      </video>
                      {media.poster ? (
                         
                        <img
                          ref={(el) => {
                            posterRefs.current[i] = el;
                          }}
                          className={cx("media__poster")}
                          src={media.poster}
                          alt=""
                          aria-hidden="true"
                        />
                      ) : null}
                    </div>
                  ) : media.src ? (
                     
                    <img
                      ref={(el) => {
                        mediaRefs.current[i] = el;
                      }}
                      className={cx("media__content")}
                      loading="lazy"
                      src={media.src}
                      alt=""
                    />
                  ) : null}
                </div>
              </div>
            </GridWrapper>
          );
        })}
      </div>
      <GridWrapper className={cx("archivesBlock__separator")}>
        <div className={cx("separator__line")} />
      </GridWrapper>
    </WebglBg>
  );
}
