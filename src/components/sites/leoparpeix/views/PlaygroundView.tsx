"use client";

import { useEffect } from "react";
import { PlaygroundContentBlock, PlaygroundHeroBlock } from "../blocks/playground/PlaygroundBlocks";
import { FooterBlock } from "../blocks/shared/FooterBlock";
import { HeaderBlock } from "../blocks/shared/HeaderBlock";
import { leo } from "../core/app";
import { emitter } from "../core/emitter";
import { globalContent } from "../data/global";
import { playgroundContent } from "../data/playground";
import { getWebgl } from "../webgl/instance";

/**
 * Source `PlaygroundView` (line ~51036) with a 3D header in front, like Home and About: the
 * crystal daisy pavilion (webgl/env/crystal/). The source navbar spacer is gone since the header
 * starts under the navbar, as on the other two routes.
 */
export function PlaygroundView() {
  useEffect(() => {
    const webgl = getWebgl();
    if (!webgl) return;
    webgl.isPlaygroundPageActive = true;
    webgl.updateGroupsScrollActive(leo.scroll);
    if (!leo.initialLoad) {
      webgl.modelCamera.setModelCameraProperties("playground");
      webgl.enterRoute("playground", false);
      webgl.camera.setModelCameraFov("playground");
      webgl.camera.setZoom("playground");
      emitter.emit("cursorIndicationChange", null, false);
    }
    return () => {
      webgl.isPlaygroundPageActive = false;
    };
  }, []);

  return (
    <div className="page">
      <HeaderBlock {...playgroundContent.header} raised />
      <PlaygroundHeroBlock {...playgroundContent.hero} />
      <PlaygroundContentBlock rows={playgroundContent.content} />
      <FooterBlock theme="yellow" {...globalContent.footer} />
    </div>
  );
}
