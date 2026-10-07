"use client";

import { useEffect, useRef, type ReactNode, type Ref } from "react";
import { isModuleClass, moduleClasses } from "../core/cx";
import { emitter } from "../core/emitter";
import { setRef } from "../core/refs";
import styles from "../styles/WebglBg.module.css";
import { getWebgl } from "../webgl/instance";
import { GridWrapper } from "./GridWrapper";

const cx = moduleClasses(styles);

type Page = "home" | "about" | "playground";

interface WebglBgProps {
  index: number;
  currentPage: Page;
  isGridWrapper?: boolean;
  isFooter?: boolean;
  /** Section shows WebGL content beneath the DOM (project sliders) → colour drawn in WebGL. */
  isProject?: boolean;
  forceWebgl?: boolean;
  disablePlaneOverscan?: boolean;
  /** About flowers block: the background drives the flower point light. */
  needLight?: boolean;
  className?: string;
  contentRef?: Ref<HTMLDivElement>;
  rootRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}

/**
 * Source `WebglBgComponent` (line ~42983). Without fluid effects the section colour is CSS
 * (`webglBg--<page>`); sections that host WebGL media get a coloured plane in the interface
 * scene instead so the canvas (behind the DOM) shows through.
 */
export function WebglBg({
  index,
  currentPage,
  isGridWrapper = true,
  isFooter = false,
  isProject = false,
  forceWebgl = false,
  disablePlaneOverscan = false,
  needLight = false,
  className,
  contentRef,
  rootRef: externalRootRef,
  children,
}: WebglBgProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const setRoot = (el: HTMLDivElement | null) => {
    rootRef.current = el;
    setRef(externalRootRef, el);
  };
  const webglColour = isProject || forceWebgl || (getWebgl()?.usesFluidEffects() ?? false);

  useEffect(() => {
    const webgl = getWebgl();
    const el = rootRef.current;
    if (!webgl || !el || !webglColour) return;
    webgl.interfaceScene.addBackground(el, index, currentPage, disablePlaneOverscan);
    if (needLight) webgl.interfaceScene.flowers.setupLights(el);
    const refresh = () => webgl.interfaceScene.refreshBackground(index);
    const offResize = emitter.on("resize", refresh);
    const offLayout = emitter.on("layoutRefresh", refresh);
    const ro = new ResizeObserver(refresh);
    ro.observe(el);
    return () => {
      offResize();
      offLayout();
      ro.disconnect();
      webgl.interfaceScene.removeBackground(index);
    };
  }, [index, currentPage, disablePlaneOverscan, webglColour, needLight]);

  const pageClass = !webglColour ? `webglBg--${currentPage}` : null;
  // Parent scoped styles only reach the root in the source (it carries the parent scope id);
  // the content element just keeps the raw class names (used by selectors in JS).
  const rawClass = className
    ?.split(/\s+/)
    .filter((c) => c && !isModuleClass(c))
    .join(" ");
  return (
    // Vue falls the component `class` through to the root as well as the content element.
    <div ref={setRoot} className={`${cx("webglBg", pageClass)}${className ? ` ${className}` : ""}`}>
      {isGridWrapper ? (
        <GridWrapper ref={contentRef} className={`${cx("webglBg__content")}${rawClass ? ` ${rawClass}` : ""}`}>
          {children}
        </GridWrapper>
      ) : (
        <div ref={contentRef} className={`${cx("webglBg__content", { isFooter })}${rawClass ? ` ${rawClass}` : ""}`}>
          {children}
        </div>
      )}
    </div>
  );
}
