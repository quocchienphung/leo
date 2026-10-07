"use client";

import { Fragment, useEffect, useRef } from "react";
import { HomeHeroBlock } from "../blocks/home/HomeHeroBlock";
import { HomeIntroBlock } from "../blocks/home/HomeIntroBlock";
import { ProjectBlock } from "../blocks/home/ProjectBlock";
import { HeaderBlock } from "../blocks/shared/HeaderBlock";
import { WebglSectionBlock } from "../blocks/shared/WebglSectionBlock";
import { leo } from "../core/app";
import { moduleClasses } from "../core/cx";
import { emitter } from "../core/emitter";
import { homeContent } from "../data/home";
import styles from "../styles/HomeView.module.css";
import { getWebgl } from "../webgl/instance";
import { useNavbarDarkZone } from "./useNavbarDarkZone";
import { ArchivesBlock } from "../blocks/home/ArchivesBlock";
import { FooterBlock } from "../blocks/shared/FooterBlock";
import { globalContent } from "../data/global";

const cx = moduleClasses(styles);

/** Source `HomeView` (line ~49079). */
export function HomeView() {
  const webglRef = useRef<HTMLDivElement>(null);
  const firstAfterWebglRef = useRef<HTMLDivElement>(null);
  useNavbarDarkZone(webglRef, firstAfterWebglRef);

  useEffect(() => {
    const webgl = getWebgl();
    if (!webgl) return;
    if (!leo.initialLoad) {
      webgl.modelCamera.setModelCameraProperties("home");
      webgl.modelCamera.show("home");
      webgl.camera.setModelCameraFov("home");
      webgl.camera.setZoom("home");
      emitter.emit("cursorIndicationChange", null, false);
    }
  }, []);

  return (
    <div className="page">
      <HeaderBlock {...homeContent.header} />
      <HomeHeroBlock {...homeContent.hero} />
      <HomeIntroBlock {...homeContent.intro} />
      <div className={cx("wrapper")}>
        {homeContent.projects.map((p, i) => (
          <Fragment key={i}>
            {p.sectionType === "slider" ? (
              <ProjectBlock {...p} rootRef={p.projectIndex === 3 ? firstAfterWebglRef : undefined} />
            ) : (
              <WebglSectionBlock sectionRef={webglRef} textLines={p.textLines} cameraParams={p.cameraParams} />
            )}
          </Fragment>
        ))}
      </div>
      <ArchivesBlock {...homeContent.archives} />
      <FooterBlock theme="white" {...globalContent.footer} />
    </div>
  );
}
