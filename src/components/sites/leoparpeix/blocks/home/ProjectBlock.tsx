"use client";

import { useEffect, useRef } from "react";
import { leo } from "../../core/app";
import { moduleClasses } from "../../core/cx";
import { emitter } from "../../core/emitter";
import { isSafari, isTouch } from "../../core/env";
import { mapClamp, offsetRect } from "../../core/math";
import type { SliderProject } from "../../data/types";
import styles from "../../styles/ProjectBlock.module.css";
import { ArrowButton, MainButton } from "../../ui/buttons";
import { GridWrapper } from "../../ui/GridWrapper";
import { WebglBg } from "../../ui/WebglBg";
import { getWebgl } from "../../webgl/instance";
import { createSliderParams, sliderConfig, sliderGap } from "../../webgl/interface/sliderConfig";

const cx = moduleClasses(styles);

// Source constants (line ~48450).
const AXIS_LOCK_PX = 6; // Z4
const SCROLL_TO_PX = 8; // $4
const SCROLL_OFFSET = 0.029; // eW
const LOAD_MARGIN = "200% 0px"; // tW
const REVEAL_MARGIN = "20% 0px"; // nW

/**
 * Source `ProjectBlock` (line ~48463). DOM placeholders define the slide layout; the images
 * themselves are KTX2 textures on WebGL planes behind the (transparent) section, with drag
 * inertia, snapping, drag depth-push and scroll/horizontal UV parallax.
 */
export function ProjectBlock({ rootRef, ...props }: SliderProject & { rootRef?: React.Ref<HTMLDivElement> }) {
  const { title, cursorIndication, projectIndex, mediasCount, name, type, recognitions, date, team, projectLink, roles } = props;
  const sliderRef = useRef<HTMLDivElement>(null);
  const mediaRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const slider = sliderRef.current;
    const webgl = getWebgl();
    if (!slider || !webgl) return;
    const scene = webgl.interfaceScene;
    const params = createSliderParams();
    const delta = { x: 0, y: 0 };
    const start = { x: 0, y: 0 };
    const last: { x: number | null; y: number | null } = { x: null, y: null };
    const down: { x: number | null; y: number | null } = { x: null, y: null };
    let ready = false;
    let dragging = false;
    let scrolledTo = false;
    let lenisStopped = false;
    let axis: "x" | "y" | null = null;
    let phase: "step" | "drag" = "step";
    let touchActive = false;
    let stepIndex = 0;
    let slideWidth = 0;
    let pointerId: number | null = null;
    let rect: DOMRect | null = null;
    let loadIo: IntersectionObserver | null = null;
    let revealIo: IntersectionObserver | null = null;
    let disposed = false;

    const parallaxProgress = () => {
      const r = offsetRect(slider);
      return mapClamp(leo.scroll, [r.top - window.innerHeight, r.top + r.height], [-1, 1]);
    };
    const scrollIntoView = () => {
      if (scrolledTo || !leo.lenis) return;
      scrolledTo = true;
      if (isSafari()) return;
      leo.lenis.resize();
      leo.lenis.scrollTo(slider, { duration: 2.5, offset: -window.innerHeight * SCROLL_OFFSET });
    };
    const maybeScrollIntoView = (x: number, y: number) => {
      if (down.x === null || down.y === null || scrolledTo) return;
      if (Math.hypot(down.x - x, down.y - y) < SCROLL_TO_PX) return;
      scrollIntoView();
    };
    const begin = (x: number, y: number) => {
      dragging = true;
      scrolledTo = false;
      params.isDragging = true;
      down.x = x;
      down.y = y;
      last.x = x;
      last.y = y;
      emitter.emit("cursorIndicationChange", null, false);
    };
    const move = (x: number, y: number) => {
      if (dragging) maybeScrollIntoView(x, y);
      delta.x = (last.x ?? x) - x;
      delta.y = axis === "x" ? 0 : (last.y ?? y) - y;
      last.x = x;
      last.y = y;
      scene.updateSliderDelta(projectIndex, delta);
    };
    const resetTouch = () => {
      if (lenisStopped) {
        leo.lenis?.start();
        lenisStopped = false;
      }
      slider.style.touchAction = "";
      axis = null;
      phase = "step";
      touchActive = false;
    };
    const end = () => {
      dragging = false;
      params.isDragging = false;
      down.x = down.y = last.x = last.y = null;
      resetTouch();
    };
    const commitStep = (clientX: number | null) => {
      const cfg = sliderConfig();
      const max = mediasCount - 1;
      if (clientX !== null && slideWidth) {
        const dx = clientX - start.x;
        const passed = Math.abs(dx) >= (cfg.stepThresholdPx ?? 1);
        let target = stepIndex;
        if (phase === "step") {
          if (passed) target = stepIndex + (dx > 0 ? -1 : 1);
        } else {
          target = Math.round(params.currentDrag / slideWidth);
          if (target === stepIndex && passed) target = stepIndex + (dx > 0 ? -1 : 1);
        }
        if (!cfg.infiniteDrag) target = Math.max(0, Math.min(max, target));
        params.forcedSnapIndex = target;
        params.snapTarget = target * slideWidth;
      }
      delta.x = delta.y = 0;
      params.smoothDragForce = 0;
      params.dragForce = 0;
      params.rawDragInput = 0;
      scene.updateSliderDelta(projectIndex, delta);
    };

    // Touch (source G/V/I): axis lock, then step / drag phases.
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      axis = null;
      phase = "step";
      touchActive = true;
      start.x = t.clientX;
      start.y = t.clientY;
      begin(t.clientX, t.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging) return;
      const t = e.touches[0];
      if (isTouch() && axis === null) {
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        if (Math.hypot(dx, dy) < AXIS_LOCK_PX) return;
        if (Math.abs(dx) > Math.abs(dy)) {
          axis = "x";
          phase = "step";
          stepIndex = slideWidth ? Math.round(params.smoothCurrentDrag / slideWidth) : 0;
          scrollIntoView();
          slider.style.touchAction = "none";
          if (leo.lenis && !lenisStopped) {
            leo.lenis.stop();
            lenisStopped = true;
          }
        } else {
          axis = "y";
          dragging = false;
          params.isDragging = false;
          down.x = down.y = last.x = last.y = null;
          return;
        }
      }
      if (axis === "y") return;
      if (axis === "x") {
        e.preventDefault();
        const cfg = sliderConfig();
        const dx = t.clientX - start.x;
        if (phase === "step" && Math.abs(dx) < (cfg.dragActivationThresholdPx ?? 0)) {
          delta.x = delta.y = 0;
          scene.updateSliderDelta(projectIndex, delta);
          return;
        }
        if (phase === "step") {
          phase = "drag";
          last.x = t.clientX;
          last.y = t.clientY;
        }
      }
      move(t.clientX, t.clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (axis === "x") commitStep(t.clientX);
      else if (touchActive && axis !== "y" && Math.abs(dx) >= (sliderConfig().stepThresholdPx ?? 1) && Math.abs(dx) >= Math.abs(dy)) {
        stepIndex = slideWidth ? Math.round(params.smoothCurrentDrag / slideWidth) : 0;
        phase = "step";
        commitStep(t.clientX);
      }
      resetTouch();
      dragging = false;
      params.isDragging = false;
      down.x = down.y = last.x = last.y = null;
    };

    // Mouse / pen (source ie/Y/ce).
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch" || e.button !== 0) return;
      e.preventDefault();
      pointerId = e.pointerId;
      try {
        slider.setPointerCapture(e.pointerId);
      } catch {
        // capture can fail on detached targets
      }
      begin(e.clientX, e.clientY);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" || !dragging) return;
      if (pointerId != null && e.pointerId !== pointerId) return;
      if (e.cancelable) e.preventDefault();
      move(e.clientX, e.clientY);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (pointerId != null && e.pointerId !== pointerId) return;
      if (slider.hasPointerCapture?.(e.pointerId)) {
        try {
          slider.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
      pointerId = null;
      end();
    };

    const onScroll = () => {
      if (!ready || !rect) return;
      scene.setParallaxUniforms(projectIndex, mapClamp(leo.scroll, [rect.top - window.innerHeight, rect.top + rect.height], [-1, 1]));
    };
    const onResize = () => {
      if (!ready) return;
      rect = offsetRect(slider);
      const cfg = sliderConfig();
      params.snapThreshold = cfg.snapThreshold;
      scene.setSliderConfig(projectIndex, cfg);
      const first = mediaRefs.current[0];
      if (first) {
        slideWidth = offsetRect(first).width + sliderGap();
        params.mediaWidth = slideWidth;
      }
      for (const m of mediaRefs.current) if (m) scene.refreshMediaLayout(m);
    };
    const reveal = () => {
      scene.revealProjectGroup(projectIndex);
      scene.setParallaxUniforms(projectIndex, parallaxProgress());
      scene.update(projectIndex, params);
    };

    const setup = async () => {
      if (ready) return;
      const textures = await webgl.assets.ensureProject(projectIndex);
      if (disposed) return;
      const medias = mediaRefs.current.filter(Boolean) as HTMLDivElement[];
      if (!medias.length) return;
      slideWidth = offsetRect(medias[0]).width + sliderGap();
      params.mediaWidth = slideWidth;
      scene.ensureProjectGroup(projectIndex);
      medias.forEach((m, i) => {
        const t = textures[i];
        if (t) scene.addMedia(m, i, projectIndex, t);
      });
      scene.registerSlider(projectIndex, params, delta, sliderConfig());
      scene.setParallaxUniforms(projectIndex, parallaxProgress());
      scene.update(projectIndex, params);
      ready = true;
      rect = offsetRect(slider);
      slider.addEventListener("touchstart", onTouchStart, { passive: true });
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", onTouchEnd);
      window.addEventListener("touchcancel", onTouchEnd);
      slider.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
      leo.lenis?.on("scroll", onScroll);
      const r = offsetRect(slider);
      if (r.top <= leo.scroll + window.innerHeight * 1.2) {
        reveal();
        return;
      }
      revealIo = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            revealIo?.disconnect();
            revealIo = null;
            reveal();
          }
        },
        { rootMargin: REVEAL_MARGIN, threshold: 0 },
      );
      revealIo.observe(slider);
    };

    const arm = () => {
      loadIo = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            loadIo?.disconnect();
            loadIo = null;
            void setup();
          }
        },
        { rootMargin: LOAD_MARGIN, threshold: 0 },
      );
      loadIo.observe(slider);
    };
    let offReveal: (() => void) | null = null;
    if (leo.isLoaderRevealComplete) arm();
    else
      offReveal = emitter.on("loaderRevealComplete", () => {
        offReveal?.();
        offReveal = null;
        arm();
      });
    const offResize = emitter.on("resize", onResize);
    const offRestore = emitter.on("showreelCursorRestore", () => {
      if (slider.matches(":hover")) emitter.emit("cursorIndicationChange", cursorIndication, true);
    });

    return () => {
      disposed = true;
      offReveal?.();
      offResize();
      offRestore();
      loadIo?.disconnect();
      revealIo?.disconnect();
      resetTouch();
      slider.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      slider.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      leo.lenis?.off("scroll", onScroll);
      scene.removeProject(projectIndex);
    };
  }, [projectIndex, mediasCount, cursorIndication]);

  return (
    <WebglBg rootRef={rootRef} index={projectIndex + 2} isGridWrapper={false} isProject currentPage="home" className={cx("projectBlock")}>
      {projectIndex === 0 && title ? (
        <GridWrapper className={cx("projectBlock__title")}>
          <h3 className={cx("title__text")}>{title}</h3>
        </GridWrapper>
      ) : null}
      <div
        ref={sliderRef}
        className={cx("projectBlock__slider")}
        onMouseEnter={() => emitter.emit("cursorIndicationChange", cursorIndication, true)}
        onMouseLeave={() => emitter.emit("cursorIndicationChange", null, false)}
      >
        {Array.from({ length: mediasCount }, (_, i) => (
          <div key={i} className={cx("slider__media")}>
            <div
              ref={(el) => {
                mediaRefs.current[i] = el;
              }}
              className={cx("media__image")}
            />
          </div>
        ))}
      </div>
      <div className={cx("projectBlock__informations")}>
        <GridWrapper className={cx("informations__top")}>
          <div className={cx("top__title")}>
            <div className={cx("title__number")}>{projectIndex + 1}</div>
            <h4 className={cx("title__name")}>{name}</h4>
            <div className={cx("title__type")}>{type}</div>
          </div>
          {recognitions ? (
            <div className={cx("top__recognitions")}>
              {recognitions.map((r) => (
                <div key={r} className={cx("recognitions__recognition")}>
                  {r}
                </div>
              ))}
            </div>
          ) : null}
          <div className={cx("top__date")}>{date}</div>
          {projectLink ? <ArrowButton className={cx("top__link")} text={projectLink.text} url={projectLink.url} alwaysVisible /> : null}
          <div className={cx("top__team")}>
            <div className={cx("team__text")}>{team.text}</div>
            {team.agency.url ? <MainButton text={team.agency.name} url={team.agency.url} /> : <div>{team.agency.name}</div>}
          </div>
        </GridWrapper>
        <GridWrapper className={cx("informations__bottom")}>
          <div className={cx("bottom__left")}>
            <div className={cx("left__number")}>{projectIndex + 1}</div>
            {projectLink ? <ArrowButton className={cx("left__link")} text={projectLink.text} url={projectLink.url} alwaysVisible /> : null}
          </div>
          <div className={cx("bottom__roles")}>
            <div className={cx("roles__text")}>{roles.text}</div>
            {roles.items.map((r) => (
              <div key={r} className={cx("roles__role")}>
                {r}
              </div>
            ))}
          </div>
        </GridWrapper>
      </div>
    </WebglBg>
  );
}
