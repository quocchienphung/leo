"use client";

import { useEffect, useRef } from "react";
import { AboutContentBlock, AboutHeroBlock, AboutIntroBlock, CardBlock, FlowersBlock } from "../blocks/about/AboutBlocks";
import { FooterBlock } from "../blocks/shared/FooterBlock";
import { HeaderBlock } from "../blocks/shared/HeaderBlock";
import { WebglSectionBlock } from "../blocks/shared/WebglSectionBlock";
import { leo } from "../core/app";
import { emitter } from "../core/emitter";
import { aboutContent } from "../data/about";
import { globalContent } from "../data/global";
import { getWebgl } from "../webgl/instance";

const WIDE_QUERY = "(max-width: 1600px)"; // vT

/**
 * Source `SQ()` (line ~42320): cream navbar from the hero down, white navbar over the library
 * card section on wide screens (> 1600px).
 */
function useAboutNavbar(heroRef: React.RefObject<HTMLDivElement | null>, webglRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    let hero: { top: number } | null = null;
    let webgl: { top: number; height: number } | null = null;
    let line: number | null = null;
    let dark = false;
    let white = false;
    const doc = (el: HTMLElement) => {
      const b = el.getBoundingClientRect();
      return { top: b.top + window.scrollY, height: b.height };
    };
    const measure = () => {
      if (!heroRef.current || !webglRef.current) return;
      hero = doc(heroRef.current);
      webgl = doc(webglRef.current);
      const nav = document.querySelector<HTMLElement>(".navbarBlock");
      if (!nav) return;
      const title = document.querySelector<HTMLElement>(".navbarBlock .left__title");
      const r = (window.innerWidth <= 500 && title ? title : nav).getBoundingClientRect();
      line = r.top + r.height / 2;
    };
    const setDark = (v: boolean) => {
      if (v === dark) return;
      dark = v;
      emitter.emit("navbarDarkMode", v);
    };
    const setWhite = (v: boolean) => {
      if (v === white) return;
      white = v;
      emitter.emit("navbarForceWhite", v);
    };
    const update = () => {
      if (!hero || !webgl || line === null) return;
      const y = leo.scroll + line;
      const inWebgl = y >= webgl.top && y < webgl.top + webgl.height;
      setDark(y >= hero.top && !inWebgl);
      setWhite(inWebgl && !window.matchMedia(WIDE_QUERY).matches);
    };
    const onResize = () => {
      measure();
      update();
    };
    const mq = window.matchMedia(WIDE_QUERY);
    mq.addEventListener("change", onResize);
    const raf = requestAnimationFrame(onResize);
    leo.lenis?.on("scroll", update);
    const offResize = emitter.on("resize", onResize);
    const offReveal = emitter.on("loaderRevealComplete", onResize);
    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener("change", onResize);
      leo.lenis?.off("scroll", update);
      offResize();
      offReveal();
      emitter.emit("navbarDarkMode", false);
      emitter.emit("navbarForceWhite", false);
    };
  }, [heroRef, webglRef]);
}

/** Source `AboutView` (line ~45997). */
export function AboutView() {
  const heroRef = useRef<HTMLDivElement>(null);
  const webglRef = useRef<HTMLDivElement>(null);
  useAboutNavbar(heroRef, webglRef);

  useEffect(() => {
    const webgl = getWebgl();
    if (!webgl || leo.initialLoad) return;
    webgl.modelCamera.setModelCameraProperties("about");
    webgl.modelCamera.show("about");
    webgl.camera.setModelCameraFov("about");
    webgl.camera.setZoom("about");
    emitter.emit("cursorIndicationChange", null, false);
  }, []);

  const { header, hero, intro, flowers, cards, content } = aboutContent;
  return (
    <div className="page">
      <HeaderBlock {...header} mobileScrollRangeScale={0.55} />
      <AboutHeroBlock {...hero} rootRef={heroRef} />
      <AboutIntroBlock {...intro} />
      <FlowersBlock {...flowers} />
      <WebglSectionBlock
        sectionRef={webglRef}
        cameraParams={cards.cameraParams}
        card={(cls) => <CardBlock className={cls} experiences={cards.experiences} />}
      />
      <AboutContentBlock {...content} />
      <FooterBlock theme="green" {...globalContent.footer} />
    </div>
  );
}
