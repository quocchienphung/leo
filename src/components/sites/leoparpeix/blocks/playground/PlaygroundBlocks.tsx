"use client";

import { useEffect, useRef } from "react";
import { leo } from "../../core/app";
import { moduleClasses } from "../../core/cx";
import { emitter } from "../../core/emitter";
import { isDesktopWidth } from "../../core/env";
import { asset, mediaWebp } from "../../data/media";
import type { PlaygroundContent, PlaygroundMedia } from "../../data/types";
import contentStyles from "../../styles/PlaygroundContentBlock.module.css";
import heroStyles from "../../styles/PlaygroundHeroBlock.module.css";
import { GridWrapper } from "../../ui/GridWrapper";
import { MediaComponent } from "../../ui/MediaComponent";
import { ParallaxWrapper } from "../../ui/ParallaxWrapper";
import { TextComponent } from "../../ui/TextComponent";
import { WebglBg } from "../../ui/WebglBg";
import {
  blockStart,
  contentBeeCameraActive,
  contentBeeCameraY,
  contentBeeVisible,
  isPastFooterStart,
  isValidLayout,
  measureBeeLayout,
  revealAnimStart,
} from "../../webgl/top/beePath";
import { getWebgl } from "../../webgl/instance";
import { BeeBlock } from "../shared/BeeBlock";

const heroCx = moduleClasses(heroStyles);
const contentCx = moduleClasses(contentStyles);

/**
 * Source Playground `HeroBlock` (line ~50873), now below the sky header: the intro paragraph and
 * the BeeBlock, revealed on scroll like the home and about heroes. The source zoom-in enter
 * (`playgroundHeroEnterZoom`) only made sense while this block was the first screen.
 */
export function PlaygroundHeroBlock({ titles, titlesReveal, indication, text }: PlaygroundContent["hero"]) {
  return (
    <WebglBg isGridWrapper={false} index={41} currentPage="playground" className={heroCx("heroBlock")}>
      <GridWrapper className={heroCx("heroBlock__top")}>
        <p className={heroCx("top__text")}>{text}</p>
      </GridWrapper>
      <BeeBlock className={heroCx("heroBlock__bee")} titles={titles} titlesReveal={titlesReveal} indication={indication} />
    </WebglBg>
  );
}

function mediaProps(m: PlaygroundMedia) {
  if (m.isVideo) {
    const webm = asset(m.url);
    return { isVideo: true, url: webm, poster: webm.replace(/\.(webm|mp4)$/i, "-poster.webp") };
  }
  return { isVideo: false, url: mediaWebp(m.url) };
}

/**
 * Source Playground `ContentBlock` (line ~50594): staggered media rows with parallax and the
 * content-bee flight zones. Drives the bee choreography every frame on desktop widths.
 */
export function PlaygroundContentBlock({ rows }: { rows: PlaygroundContent["content"] }) {
  const topZoneRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const bottomZoneRef = useRef<HTMLDivElement>(null);
  const desktop = typeof window === "undefined" ? true : isDesktopWidth();

  useEffect(() => {
    const webgl = getWebgl();
    if (!webgl) return;
    const scene = webgl.topScene;
    const pg = scene.playground;
    const reset = () => {
      if (webgl.pageTransitionHidingGroups) return;
      Object.assign(pg, { layout: null, blockStartScroll: 0, show: false });
      scene.resetContentBee();
    };
    const layout = () => {
      if (!isDesktopWidth()) {
        reset();
        return;
      }
      const l = measureBeeLayout(topZoneRef.current, innerRef.current, bottomZoneRef.current);
      pg.layout = l;
      if (!l) return;
      pg.blockStartScroll = blockStart(l);
      scene.updateContentBeeLayout(l.innerRect);
    };
    const onRender = () => {
      if (!isDesktopWidth() || !leo.isLoaderRevealComplete || webgl.pageTransitionHidingGroups || !webgl.isPlaygroundPageActive) return;
      const l = pg.layout;
      if (!isValidLayout(l)) return;
      const s = leo.scroll;
      const footer = pg.footerStart || Infinity;
      pg.show = contentBeeVisible(s, l, footer);
      if (isPastFooterStart(s, footer)) {
        if (pg.show) scene.setContentBeeGroupPosition(scene.poseAt(s, l, footer));
        return;
      }
      if (contentBeeCameraActive(s, l, footer)) {
        const pose = scene.poseAt(s, l, footer);
        const camY = contentBeeCameraY(s, l, webgl.topCamera.dimensions.height);
        if (camY !== null) webgl.topCamera.position.y = camY;
        scene.setContentBeeGroupScroll(webgl.topCamera.position.y, pose);
      } else if (s >= revealAnimStart(l) - window.innerHeight && s < blockStart(l)) {
        scene.setContentBeeGroupPosition(scene.poseAt(s, l, footer));
      }
    };
    const raf = requestAnimationFrame(() => {
      layout();
      leo.refreshScrollLayout();
    });
    const offResize = emitter.on("resize", layout);
    const offEnter = emitter.on("routeEnter", () => requestAnimationFrame(layout));
    const offRender = emitter.on("render", onRender);
    return () => {
      cancelAnimationFrame(raf);
      offResize();
      offEnter();
      offRender();
      reset();
    };
  }, []);

  return (
    <WebglBg isGridWrapper={false} index={42} currentPage="playground" className={contentCx("contentBlock")}>
      {desktop ? <div ref={topZoneRef} className={contentCx("contentBlock__beeZone", "contentBlock__beeZone--top")} aria-hidden="true" /> : null}
      <div ref={innerRef} className={contentCx("contentBlock__inner")}>
        {rows.map((row, i) => (
          <GridWrapper key={i} className={contentCx("contentBlock__row", `contentBlock__row--${i}`)}>
            {row.medias.map((m, k) => (
              <div key={k} className={contentCx("row__media", `row__media--${k}`)}>
                <ParallaxWrapper parallaxAmount={m.parallaxAmount}>
                  <MediaComponent className={contentCx("media__src")} {...mediaProps(m)} parallaxMaskAmount={9} parallaxScaleAmount={0.125} />
                  <div className={contentCx("media__text")}>
                    <p className={contentCx("text__title")}>{m.title}</p>
                    <p className={contentCx("text__date")}>{m.date}</p>
                  </div>
                </ParallaxWrapper>
              </div>
            ))}
            {row.paragraph ? (
              <div className={contentCx("contentBlock__paragraph")}>
                <TextComponent content={row.paragraph} className={contentCx("paragraph__text")} />
              </div>
            ) : null}
          </GridWrapper>
        ))}
      </div>
      {desktop ? <div ref={bottomZoneRef} className={contentCx("contentBlock__beeZone", "contentBlock__beeZone--bottom")} aria-hidden="true" /> : null}
    </WebglBg>
  );
}
