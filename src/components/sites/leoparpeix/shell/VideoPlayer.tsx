"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { leo } from "../core/app";
import { moduleClasses } from "../core/cx";
import { emitter, type ShowreelPlayerState } from "../core/emitter";
import { isSafari, isTabletWidth } from "../core/env";
import { sound } from "../core/sound";
import { showreelVideo } from "../data/media";
import styles from "../styles/VideoPlayer.module.css";
import { GridWrapper } from "../ui/GridWrapper";

const cx = moduleClasses(styles);

// Source constants (line ~51936).
const CLOSE_FADE = 0.3; // Nl
const MASK_OUT_AT = 0.35; // BS
const MASK_OUT = 0.6; // DS
const VOLUME_FADE = 0.5; // r8
const PAUSE_FADE = 0.35; // o8
const MEDIA_OPEN_SCALE = 1.02; // c8
const FULL_VOLUME = 1; // Jg
const IDLE_MS = 1000; // u8
const UI_FADE = 0.2; // h8
const REVEAL_DISTANCE = 100; // d8
const CONTRAST_OPACITY = 0.6; // f8
const MAX_SEEK = 0.99; // p8
const T = {
  WHITE_MASK_START: 0,
  WHITE_MASK_DURATION: 0.4,
  VIDEO_SCALE_1_START: 0,
  VIDEO_SCALE_1_DURATION: 0.4,
  VIDEO_SCALE_2_START: 0.35,
  VIDEO_SCALE_2_DURATION: 0.65,
  CLOSE_BUTTON_START: 0.35,
  CLOSE_BUTTON_DURATION: 0.65,
  PROGRESS_SCALE_START: 0.35,
  PROGRESS_SCALE_DURATION: 0.65,
  PLAY_START: 0.55,
};

function CrossIcon({ className }: { className?: string }) {
  return (
    <svg className={`svg-cross${className ? ` ${className}` : ""}`} width="11" height="11" viewBox="0 0 11 11" fill="none">
      <rect y="5" width="11" height="1" />
      <rect x="5" y="11" width="11" height="1" transform="rotate(-90 5 11)" />
    </svg>
  );
}

/**
 * Source `VideoPlayer` (line ~51952): full-screen showreel. Opens from the intro preview with a
 * white mask + scale-in, plays the compressed desktop/mobile cut, exposes click-to-pause,
 * a draggable timeline, idle UI hiding and restores scroll + ambient sound on close.
 */
export function VideoPlayer() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [idle, setIdle] = useState(false);
  const [locked, setLocked] = useState(false);
  const [progress, setProgress] = useState(0);
  const [src, setSrc] = useState<string | null>(null);
  const maskRef = useRef<HTMLDivElement>(null);
  const letterboxRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const contrastRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const compactRef = useRef<HTMLButtonElement>(null);
  const compactIconRef = useRef<HTMLDivElement>(null);
  const progressWrapRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const api = useRef({ open: () => {}, close: () => {}, reset: () => {}, toggle: () => {}, seekDown: (_e: PointerEvent) => {} });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    setSrc(showreelVideo(window.innerWidth));
    const video = videoRef.current;
    if (!video) return;
    const st = {
      open: false,
      playing: false,
      dragging: false,
      overClose: false,
      overProgress: false,
      ready: false,
      idle: false,
      x: 0,
      y: 0,
      mode: "default" as ShowreelPlayerState["cursorMode"] | "",
      idleTimer: 0 as number | undefined,
      travel: 0,
      lastX: 0,
      lastY: 0,
    };
    let openTl: gsap.core.Timeline | null = null;
    let closeTl: gsap.core.Timeline | null = null;
    let volumeTw: gsap.core.Tween | null = null;
    let uiTl: gsap.core.Timeline | null = null;
    const compact = () => isTabletWidth();
    const uiEls = () => [closeRef.current, progressWrapRef.current, compactRef.current].filter(Boolean) as HTMLElement[];

    const emit = (active: boolean, playing = st.playing, mode: ShowreelPlayerState["cursorMode"] = "default", pos?: { x: number; y: number }) => {
      const s: ShowreelPlayerState = { active, isPlaying: playing, cursorMode: mode };
      if (pos) {
        s.clientX = pos.x;
        s.clientY = pos.y;
      }
      emitter.emit("showreelPlayerChange", s);
    };
    const overTimeline = (x: number, y: number) => {
      const el = progressRef.current;
      if (!el) return false;
      const b = el.getBoundingClientRect();
      const band = compact() ? 80 : 48;
      const top = b.top + b.height / 2 - band / 2;
      return x >= b.left && x <= b.right && y >= top && y <= top + band;
    };
    const cursorMode = (): ShowreelPlayerState["cursorMode"] => {
      if (compact()) return st.dragging ? "timelineDrag" : "hidden";
      if (st.idle || st.overClose) return "hidden";
      if (st.dragging) return "timelineDrag";
      if (st.overProgress || overTimeline(st.x, st.y)) return "timeline";
      return "default";
    };
    const syncCursor = (playingOverride?: boolean) => {
      if (!st.open) return;
      const mode = st.ready || (compact() && st.dragging) ? cursorMode() : "hidden";
      const playing = playingOverride ?? st.playing;
      if (mode === st.mode && playingOverride === undefined) return;
      st.mode = mode;
      emit(true, playing, mode, { x: st.x, y: st.y });
    };

    const setPointerEvents = (on: boolean) => {
      if (closeRef.current) closeRef.current.style.pointerEvents = on ? "auto" : "none";
      if (progressRef.current) progressRef.current.style.pointerEvents = on ? "auto" : "none";
    };
    const fadeUi = (show: boolean) => {
      uiTl?.kill();
      const tl = gsap.timeline();
      const ease = show ? "power2.out" : "power2.inOut";
      tl.to(uiEls(), { opacity: show ? 1 : 0, duration: UI_FADE, ease }, 0);
      if (contrastRef.current) {
        if (show && st.ready && !compact()) tl.to(contrastRef.current, { opacity: CONTRAST_OPACITY, duration: UI_FADE, ease }, 0);
        else if (!show) tl.to(contrastRef.current, { opacity: 0, duration: UI_FADE, ease }, 0);
      }
      uiTl = tl;
    };
    const setIdleState = (v: boolean) => {
      st.idle = v;
      setIdle(v);
      document.body.style.cursor = st.open && v ? "none" : "";
    };
    const clearIdle = () => {
      window.clearTimeout(st.idleTimer);
      st.idleTimer = undefined;
    };
    const goIdle = () => {
      if (compact() || !st.open || !st.playing || st.dragging || st.idle) return;
      setIdleState(true);
      setPointerEvents(false);
      st.mode = "hidden";
      emit(true, st.playing, "hidden");
      fadeUi(false);
      st.travel = 0;
      st.lastX = st.x;
      st.lastY = st.y;
    };
    const scheduleIdle = () => {
      clearIdle();
      if (compact() || !st.open || !st.playing) return;
      st.idleTimer = window.setTimeout(goIdle, IDLE_MS);
    };
    const wake = () => {
      if (!st.open) return;
      setIdleState(false);
      setPointerEvents(true);
      st.mode = "";
      syncCursor();
      fadeUi(true);
    };
    const resetUi = () => {
      clearIdle();
      uiTl?.kill();
      setIdleState(false);
      gsap.set(uiEls(), { opacity: 1 });
      setPointerEvents(true);
    };

    const fadeVolume = (to: number, done?: () => void, d = VOLUME_FADE) => {
      volumeTw?.kill();
      volumeTw = gsap.to(video, { volume: to, duration: d, ease: "power2.inOut", onComplete: done });
    };
    const play = () => {
      st.playing = true;
      volumeTw?.kill();
      video.play().catch(() => {});
      if (compact()) video.volume = FULL_VOLUME;
      else fadeVolume(FULL_VOLUME);
      syncCursor(true);
    };
    const pause = (instant = false) => {
      st.playing = false;
      clearIdle();
      syncCursor(false);
      if (!instant && !compact()) {
        if (st.idle) wake();
        else fadeUi(true);
        fadeVolume(0, () => video.pause(), PAUSE_FADE);
        return;
      }
      volumeTw?.kill();
      video.volume = 0;
      video.pause();
    };
    const toggle = () => {
      if (!st.open) return;
      const next = !st.playing;
      emitter.emit("showreelIconToggle", next);
      if (compactIconRef.current && compact()) gsap.to(compactIconRef.current, { yPercent: next ? 0 : -50, duration: 0.35, ease: "power3.out" });
      if (st.playing) pause();
      else {
        play();
        if (!compact()) {
          clearIdle();
          goIdle();
        }
      }
    };
    const seek = (clientX: number) => {
      const el = progressRef.current;
      if (!video.duration || !el) return;
      const b = el.getBoundingClientRect();
      const x = Math.min(b.right, Math.max(b.left, clientX));
      const p = Math.min(MAX_SEEK, Math.max(0, (x - b.left) / b.width));
      video.currentTime = p * video.duration;
      setProgress(p);
    };

    const onWindowMove = (e: PointerEvent) => {
      st.x = e.clientX;
      st.y = e.clientY;
      if (st.idle) {
        st.travel += Math.hypot(e.clientX - st.lastX, e.clientY - st.lastY);
        st.lastX = e.clientX;
        st.lastY = e.clientY;
        if (st.travel < REVEAL_DISTANCE) return;
        wake();
        scheduleIdle();
        return;
      }
      scheduleIdle();
      syncCursor();
    };
    const onWindowDown = (e: PointerEvent) => {
      if (!st.open) return;
      st.x = e.clientX;
      st.y = e.clientY;
      if (st.idle) wake();
      scheduleIdle();
    };
    const onDragMove = (e: PointerEvent) => {
      if (!st.dragging) return;
      st.x = e.clientX;
      st.y = e.clientY;
      seek(e.clientX);
    };
    const onDragEnd = (e: PointerEvent) => {
      if (!st.dragging) return;
      st.dragging = false;
      window.removeEventListener("pointermove", onDragMove);
      window.removeEventListener("pointerup", onDragEnd);
      window.removeEventListener("pointercancel", onDragEnd);
      if (!st.open) return;
      st.x = e.clientX;
      st.y = e.clientY;
      emitter.emit("showreelIconToggle", true);
      play();
      st.mode = "";
      syncCursor(true);
    };

    api.current.seekDown = (e: PointerEvent) => {
      if (!st.open) return;
      st.dragging = true;
      st.x = e.clientX;
      st.y = e.clientY;
      pause(true);
      seek(e.clientX);
      syncCursor(false);
      window.addEventListener("pointermove", onDragMove);
      window.addEventListener("pointerup", onDragEnd);
      window.addEventListener("pointercancel", onDragEnd);
    };
    api.current.toggle = toggle;

    api.current.open = () => {
      if (st.open) return;
      openTl?.kill();
      closeTl?.kill();
      volumeTw?.kill();
      video.pause();
      video.currentTime = 0;
      video.volume = 0;
      setProgress(0);
      setVisible(true);
      setOpen(true);
      st.open = true;
      st.ready = false;
      leo.lenis?.stop();
      sound.suppressAmbientForShowreel(true);
      st.mode = "hidden";
      emit(true, true, "hidden");
      window.addEventListener("pointermove", onWindowMove, { passive: true });
      window.addEventListener("pointerdown", onWindowDown, { passive: true });
      const media = mediaRef.current;
      gsap.set(media, { scale: 0, opacity: 1 });
      gsap.set(maskRef.current, { opacity: 0 });
      gsap.set(letterboxRef.current, { opacity: 0 });
      gsap.set(progressWrapRef.current, { opacity: 1 });
      gsap.set(progressRef.current, { scaleX: 0, opacity: 1, transformOrigin: "left center" });
      gsap.set(closeRef.current, { scale: 0 });
      gsap.set(uiEls(), { opacity: 1 });
      if (compactRef.current && compact()) {
        gsap.set(compactRef.current, { xPercent: -50, scale: 0 });
        gsap.set(compactIconRef.current, { yPercent: 0 });
      }
      gsap.set(contrastRef.current, { opacity: 0 });
      resetUi();
      const tl = gsap.timeline();
      tl.to(maskRef.current, { opacity: 1, duration: T.WHITE_MASK_DURATION, ease: "reveal" }, T.WHITE_MASK_START);
      if (compact()) tl.to(letterboxRef.current, { opacity: 1, duration: T.WHITE_MASK_DURATION, ease: "reveal" }, T.WHITE_MASK_START);
      tl.fromTo(media, { scale: 0 }, { scale: 0.5, duration: T.VIDEO_SCALE_1_DURATION, ease: "reveal" }, T.VIDEO_SCALE_1_START);
      tl.to(media, { scale: MEDIA_OPEN_SCALE, duration: T.VIDEO_SCALE_2_DURATION, ease: "reveal" }, T.VIDEO_SCALE_2_START);
      tl.fromTo(closeRef.current, { scale: 0 }, { scale: 1, duration: T.CLOSE_BUTTON_DURATION, ease: "reveal" }, T.CLOSE_BUTTON_START);
      if (compactRef.current && compact())
        tl.fromTo(compactRef.current, { scale: 0 }, { scale: 1, duration: T.CLOSE_BUTTON_DURATION, ease: "reveal" }, T.CLOSE_BUTTON_START);
      tl.to(progressRef.current, { scaleX: 1, duration: T.PROGRESS_SCALE_DURATION, ease: "power2.out" }, T.PROGRESS_SCALE_START);
      tl.add(() => play(), T.PLAY_START);
      tl.add(() => {
        st.ready = true;
        st.mode = "";
        syncCursor();
      }, T.VIDEO_SCALE_2_START + T.VIDEO_SCALE_2_DURATION);
      tl.add(() => {
        resetUi();
        scheduleIdle();
        syncCursor();
      });
      openTl = tl;
    };

    const teardown = () => {
      window.removeEventListener("pointermove", onWindowMove);
      window.removeEventListener("pointerdown", onWindowDown);
      window.removeEventListener("pointermove", onDragMove);
      window.removeEventListener("pointerup", onDragEnd);
      window.removeEventListener("pointercancel", onDragEnd);
    };

    api.current.close = () => {
      if (!st.open) return;
      st.open = false;
      st.dragging = false;
      st.overClose = false;
      st.overProgress = false;
      st.mode = "default";
      setOpen(false);
      teardown();
      resetUi();
      st.ready = false;
      sound.suppressAmbientForShowreel(false);
      emit(false, false);
      openTl?.kill();
      closeTl?.kill();
      const wasPlaying = st.playing;
      st.playing = false;
      if (wasPlaying) fadeVolume(0, undefined, CLOSE_FADE);
      else {
        volumeTw?.kill();
        video.pause();
        video.volume = 0;
      }
      const media = mediaRef.current;
      const tl = gsap.timeline({
        onComplete: () => {
          setVisible(false);
          gsap.set(media, { scale: 0, opacity: 1 });
          gsap.set(maskRef.current, { opacity: 0 });
          gsap.set(letterboxRef.current, { opacity: 0 });
          gsap.set(progressRef.current, { scaleX: 0, opacity: 1, transformOrigin: "left center" });
          gsap.set(closeRef.current, { scale: 0 });
          if (compactRef.current) gsap.set(compactRef.current, { xPercent: -50, scale: 0 });
          video.pause();
          video.currentTime = 0;
          video.volume = 0;
          setProgress(0);
          gsap.set(contrastRef.current, { opacity: 0 });
        },
      });
      tl.add(() => leo.lenis?.start(), 0);
      tl.to(media, { opacity: 0, duration: CLOSE_FADE, ease: "sine.out" }, 0);
      tl.to(contrastRef.current, { opacity: 0, duration: CLOSE_FADE, ease: "sine.out" }, 0);
      tl.to(progressRef.current, { opacity: 0, duration: CLOSE_FADE, ease: "hide" }, 0);
      tl.to(closeRef.current, { scale: 0, duration: CLOSE_FADE, ease: "hide" }, 0);
      if (compactRef.current && compact()) tl.to(compactRef.current, { scale: 0, duration: CLOSE_FADE, ease: "hide" }, 0);
      tl.to(maskRef.current, { opacity: 0, duration: MASK_OUT, ease: "sine.inOut" }, MASK_OUT_AT);
      if (compact()) tl.to(letterboxRef.current, { opacity: 0, duration: MASK_OUT, ease: "sine.inOut" }, MASK_OUT_AT);
      closeTl = tl;
    };

    api.current.reset = () => {
      setLocked(false);
      if (!st.open && !visible) return;
      openTl?.kill();
      closeTl?.kill();
      volumeTw?.kill();
      st.open = false;
      st.playing = false;
      setOpen(false);
      setVisible(false);
      teardown();
      resetUi();
      video.pause();
      video.currentTime = 0;
      video.volume = 0;
      setProgress(0);
      emit(false, false);
      leo.lenis?.start();
      sound.suppressAmbientForShowreel(false);
    };

    const onTime = () => {
      if (video.duration) setProgress(video.currentTime / video.duration);
    };
    const onMeta = () => {
      video.volume = 0;
      setProgress(0);
    };
    const onEnded = () => api.current.close();
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("ended", onEnded);

    const closeEl = closeRef.current;
    const progressEl = progressRef.current;
    const onCloseEnter = () => {
      st.overClose = true;
      syncCursor();
    };
    const onCloseLeave = () => {
      st.overClose = false;
      syncCursor();
    };
    const onProgEnter = (e: MouseEvent) => {
      st.overProgress = true;
      st.x = e.clientX;
      st.y = e.clientY;
      syncCursor();
    };
    const onProgLeave = (e: MouseEvent) => {
      st.overProgress = false;
      st.x = e.clientX;
      st.y = e.clientY;
      if (!st.dragging) syncCursor();
    };
    closeEl?.addEventListener("mouseenter", onCloseEnter);
    closeEl?.addEventListener("mouseleave", onCloseLeave);
    progressEl?.addEventListener("mouseenter", onProgEnter);
    progressEl?.addEventListener("mouseleave", onProgLeave);

    const offOpen = emitter.on("showreelOpen", () => api.current.open());
    const offReset = emitter.on("showreelReset", () => api.current.reset());
    const offLock = emitter.on("webglSectionRevealLock", () => {
      if (st.open) setLocked(true);
    });
    const offResize = emitter.on("resize", () => setSrc(showreelVideo(window.innerWidth)));
    return () => {
      offOpen();
      offReset();
      offLock();
      offResize();
      teardown();
      clearIdle();
      openTl?.kill();
      closeTl?.kill();
      volumeTw?.kill();
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("ended", onEnded);
      closeEl?.removeEventListener("mouseenter", onCloseEnter);
      closeEl?.removeEventListener("mouseleave", onCloseLeave);
      progressEl?.removeEventListener("mouseenter", onProgEnter);
      progressEl?.removeEventListener("mouseleave", onProgLeave);
      document.body.style.cursor = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  if (!mounted) return null;
  return createPortal(
    <div
      className={cx("videoPlayer", {
        "videoPlayer--open": open,
        "videoPlayer--visible": visible,
        "videoPlayer--uiIdle": idle,
        "videoPlayer--transitionLocked": locked,
        "videoPlayer--safari": isSafari(),
      })}
    >
      <div ref={maskRef} className={cx("videoPlayer__whiteMask")} />
      <div ref={letterboxRef} className={cx("videoPlayer__letterboxMask")} aria-hidden="true" />
      <div className={cx("videoPlayer__media")}>
        <div
          ref={mediaRef}
          className={cx("videoPlayer__mediaInner")}
          onClick={(e) => {
            e.stopPropagation();
            api.current.toggle();
          }}
        >
          <video ref={videoRef} className={cx("videoPlayer__video")} playsInline preload="metadata" src={src ?? undefined} />
          <div ref={contrastRef} className={cx("videoPlayer__videoContrast")} aria-hidden="true" />
        </div>
      </div>
      <div className={cx("videoPlayer__closeWrap")}>
        <button
          ref={closeRef}
          className={cx("videoPlayer__close")}
          type="button"
          aria-label="Close showreel"
          onClick={(e) => {
            e.stopPropagation();
            api.current.close();
          }}
        >
          <CrossIcon className={cx("close__icon")} />
        </button>
      </div>
      <button
        ref={compactRef}
        className={cx("videoPlayer__compactPlayPause")}
        type="button"
        aria-label="Play or pause showreel"
        style={{ display: visible ? undefined : "none" }}
        onClick={(e) => {
          e.stopPropagation();
          api.current.toggle();
        }}
      >
        <div className={cx("compactPlayPause__iconTrack")}>
          <div ref={compactIconRef} className={cx("compactPlayPause__iconInner")}>
            <div className={cx("compactPlayPause__iconLine")}>
              <span className={cx("compactPlayPause__icon", "compactPlayPause__icon--pause")} aria-hidden="true">
                <span className={cx("compactPlayPause__pauseBar")} />
                <span className={cx("compactPlayPause__pauseBar")} />
              </span>
            </div>
            <div className={cx("compactPlayPause__iconLine")}>
              <svg className={cx("compactPlayPause__icon", "compactPlayPause__icon--play")} viewBox="0 0 9 11" fill="none" aria-hidden="true">
                <path d="M0 0L9 5.5L0 11V0Z" fill="currentColor" />
              </svg>
            </div>
          </div>
        </div>
      </button>
      <div ref={progressWrapRef} className={cx("videoPlayer__progressWrap")}>
        <GridWrapper className={cx("videoPlayer__progressGrid")}>
          <div
            ref={progressRef}
            className={cx("videoPlayer__progress")}
            onClick={(e) => {
              e.stopPropagation();
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              api.current.seekDown(e.nativeEvent);
            }}
          >
            <div className={cx("progress__track")} />
            <div className={cx("progress__fill")} style={{ transform: `scaleX(${progress})` }} />
          </div>
        </GridWrapper>
      </div>
    </div>,
    document.body,
  );
}
