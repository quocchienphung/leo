"use client";

import { useEffect, useRef, type MouseEventHandler } from "react";
import { leo } from "../core/app";
import { moduleClasses } from "../core/cx";
import { emitter } from "../core/emitter";
import { isTabletWidth } from "../core/env";
import { mapClamp, mapRange } from "../core/math";
import styles from "../styles/MediaComponent.module.css";

const cx = moduleClasses(styles);
const VIEW_MARGIN = 200; // FQ

interface MediaComponentProps {
  /** image src, or webm source for videos (already resolved to a local path) */
  url?: string;
  /** mp4 source */
  url2?: string;
  poster?: string;
  isVideo?: boolean;
  parallaxMaskAmount?: number;
  parallaxScaleAmount?: number;
  parallaxRotateAmount?: number;
  parallaxPositionAmount?: number;
  scaleOffsetAmount?: number;
  hasParallaxScale?: boolean;
  hasParallaxRotation?: boolean;
  hasParallaxPosition?: boolean;
  className?: string;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
  onClick?: MouseEventHandler<HTMLDivElement>;
}

/**
 * Source `MediaComponent` (line ~42679): masked image/video with scroll parallax. Videos only
 * play while on screen; the poster fades once the first frame is presented.
 */
export function MediaComponent({
  url,
  url2,
  poster,
  isVideo = false,
  parallaxMaskAmount = 20,
  parallaxScaleAmount = 0.05,
  parallaxRotateAmount = -3,
  parallaxPositionAmount = -200,
  scaleOffsetAmount = 1.1,
  hasParallaxScale = false,
  hasParallaxRotation = false,
  hasParallaxPosition = false,
  className,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: MediaComponentProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const posterRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let rect: DOMRect | null = null;
    let posterHidden = false;
    let frameToken = 0;
    const target = () => (isVideo ? transformRef.current : mediaRef.current);
    const measure = () => {
      const b = root.getBoundingClientRect();
      rect = new DOMRect(b.x, b.y + leo.scroll, b.width, b.height);
    };
    const reset = () => {
      root.style.transform = "";
      const t = target();
      if (t) t.style.transform = "";
    };
    const apply = (s: number) => {
      if (!rect) return;
      if (!(rect.bottom > s - VIEW_MARGIN && rect.top < s + window.innerHeight + VIEW_MARGIN)) {
        reset();
        return;
      }
      const a = rect.top - window.innerHeight;
      const b = rect.top + rect.height;
      const n = rect.top - window.innerHeight * 0.25;
      const mask = mapRange(s, [a, b], [-1, 1]) * parallaxMaskAmount;
      const scale = mapClamp(s, [a, n], [1, 0]) * parallaxScaleAmount;
      const rot = mapClamp(s, [a, b], [0, 1]) * parallaxRotateAmount;
      const pos = mapClamp(s, [a, b], [-1, 1]) * parallaxPositionAmount;
      if (hasParallaxScale) root.style.transform = `scale(${1 - scale})`;
      if (hasParallaxPosition && !isTabletWidth()) root.style.transform = `translate3d(0, ${pos}px, 0)`;
      if (hasParallaxScale && hasParallaxPosition) root.style.transform = `scale(${1 - scale}) translate3d(0, ${pos}px, 0)`;
      if (hasParallaxRotation) root.style.transform = `rotate(${rot}deg)`;
      const t = target();
      if (t) {
        t.style.transform = hasParallaxScale
          ? `translate3d(0, ${mask}%, 0) scale(${scaleOffsetAmount + scale})`
          : `translate3d(0, ${mask}%, 0) scale(${scaleOffsetAmount})`;
      }
    };
    const onScroll = () => apply(leo.scroll);
    const onResize = () => {
      measure();
      apply(leo.scroll);
    };

    const video = videoRef.current;
    let io: IntersectionObserver | null = null;
    if (isVideo && video) {
      video.pause();
      const hidePoster = () => {
        if (posterHidden) return;
        posterHidden = true;
        if (posterRef.current) posterRef.current.style.opacity = "0";
      };
      const play = () => {
        const token = ++frameToken;
        if (poster && !posterHidden) {
          const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
          if (typeof v.requestVideoFrameCallback === "function") v.requestVideoFrameCallback(() => token === frameToken && hidePoster());
          else video.addEventListener("playing", () => requestAnimationFrame(() => token === frameToken && hidePoster()), { once: true });
        }
        video.play().catch(() => {});
      };
      io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.target !== video) continue;
          if (e.isIntersecting) play();
          else {
            frameToken++;
            video.pause();
          }
        }
      });
      io.observe(video);
    }

    measure();
    apply(leo.scroll);
    leo.lenis?.on("scroll", onScroll);
    const offResize = emitter.on("resize", onResize);
    return () => {
      leo.lenis?.off("scroll", onScroll);
      offResize();
      io?.disconnect();
      frameToken++;
    };
  }, [isVideo, poster, parallaxMaskAmount, parallaxScaleAmount, parallaxRotateAmount, parallaxPositionAmount, scaleOffsetAmount, hasParallaxScale, hasParallaxRotation, hasParallaxPosition]);

  const posterStyle = poster
    ? { backgroundImage: `url(${poster})`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }
    : undefined;

  return (
    <div
      ref={rootRef}
      className={`${cx("mediaComponent")}${className ? ` ${className}` : ""}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {isVideo ? (
        <div ref={transformRef} className={cx("mediaComponent__media")} style={posterStyle}>
          <video ref={videoRef} className={cx("mediaComponent__video")} loop muted playsInline preload="metadata">
            {url ? <source src={url} type="video/webm" /> : null}
            {url2 ? <source src={url2} type="video/mp4" /> : null}
          </video>
          {poster ? <img ref={posterRef} className={cx("mediaComponent__poster")} src={poster} alt="" aria-hidden="true" /> : null}
        </div>
      ) : (
         
        <img ref={mediaRef} className={cx("mediaComponent__media")} src={url} alt="" loading="lazy" />
      )}
    </div>
  );
}
