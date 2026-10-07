"use client";

import { useEffect, useRef } from "react";
import { moduleClasses } from "../../core/cx";
import { emitter } from "../../core/emitter";
import { isTabletWidth } from "../../core/env";
import { showreelPoster, showreelPreview } from "../../data/media";
import type { HomeContent } from "../../data/types";
import styles from "../../styles/HomeIntroBlock.module.css";
import { GridWrapper } from "../../ui/GridWrapper";
import { MediaComponent } from "../../ui/MediaComponent";
import { TextComponent } from "../../ui/TextComponent";
import { WebglBg } from "../../ui/WebglBg";

const cx = moduleClasses(styles);

/** Source Home `IntroBlock` (line ~48255): "Bonjour," copy + showreel preview. */
export function HomeIntroBlock({ bigTexts, smallTexts, cursorIndication }: HomeContent["intro"]) {
  const playerActive = useRef(false);

  useEffect(() => {
    const offPlayer = emitter.on("showreelPlayerChange", (s) => {
      playerActive.current = s.active;
    });
    const offRestore = emitter.on("showreelCursorRestore", () => {
      if (playerActive.current) return;
      const el = document.querySelector(".introBlock .bottom__video");
      if (el?.matches(":hover")) emitter.emit("cursorIndicationChange", cursorIndication, true);
    });
    return () => {
      offPlayer();
      offRestore();
    };
  }, [cursorIndication]);

  return (
    <WebglBg isGridWrapper={false} index={1} currentPage="home" className={cx("introBlock")}>
      <GridWrapper className={cx("introBlock__top")}>
        <div className={cx("top__baseline")}>
          {bigTexts.map((t, i) => (
            <TextComponent key={i} className={cx(`baseline__text--${i}`)} content={t} />
          ))}
        </div>
      </GridWrapper>
      <GridWrapper className={cx("introBlock__bottom")}>
        <p className={cx("bottom__stars")}>*</p>
        <div className={cx("bottom__text")}>
          {smallTexts.map((t, i) => (
            <span key={i}>
              <TextComponent content={t} revealDelay={i * 0.15} />
            </span>
          ))}
        </div>
        <MediaComponent
          className={cx("bottom__video")}
          isVideo
          url2={showreelPreview}
          poster={showreelPoster}
          parallaxMaskAmount={typeof window !== "undefined" && isTabletWidth() ? 8 : 10}
          parallaxScaleAmount={0.1}
          hasParallaxPosition
          parallaxPositionAmount={-75}
          onMouseEnter={() => {
            if (!playerActive.current) emitter.emit("cursorIndicationChange", cursorIndication, true);
          }}
          onMouseLeave={() => {
            if (!playerActive.current) emitter.emit("cursorIndicationChange", null, false);
          }}
          onClick={() => emitter.emit("showreelOpen")}
        />
        <p className={cx("bottom__showreelHint")}>{cursorIndication}</p>
      </GridWrapper>
    </WebglBg>
  );
}
