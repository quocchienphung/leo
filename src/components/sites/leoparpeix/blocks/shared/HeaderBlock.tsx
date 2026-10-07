"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";
import { leo } from "../../core/app";
import { moduleClasses } from "../../core/cx";
import { emitter } from "../../core/emitter";
import { isTabletWidth } from "../../core/env";
import { clamp, mapRange, offsetRect } from "../../core/math";
import type { CameraParams, Vec3 } from "../../data/types";
import styles from "../../styles/HeaderBlock.module.css";
import { GridWrapper } from "../../ui/GridWrapper";
import { TextComponent, type TextHandle } from "../../ui/TextComponent";
import { getWebgl } from "../../webgl/instance";

const cx = moduleClasses(styles);

const scaleVec = (v: Vec3, k: number): Vec3 => ({ x: v.x * k, y: v.y * k, z: v.z * k });

interface HeaderBlockProps {
  cameraParams: CameraParams;
  description: string;
  scrollIndication: string;
  mobileScrollRangeScale?: number;
  /** Copy set higher above the fold (playground: clear of the pool in front of the daisy). */
  raised?: boolean;
}

// Source defaults (line ~45254).
const CONTENT_PARALLAX = 800;
const FADE_START = 0.2;
const FADE_END = 0.45;
const ARRIVAL_DELAY = 0.01;
const FIRST_LOAD_EXTRA = 0.9;
const TEXT_STAGGER = 0.25;

/**
 * Source `HeaderBlock` (line ~45254): a 200dvh transparent block over the 3D scene. Scroll
 * drives the camera dolly (`setScrollHeaderPositions`) and pushes/fades the intro copy.
 */
export function HeaderBlock({ cameraParams, description, scrollIndication, mobileScrollRangeScale = 1, raised = false }: HeaderBlockProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<TextHandle>(null);
  const scrollRef = useRef<TextHandle>(null);

  useEffect(() => {
    const webgl = getWebgl();
    const root = rootRef.current;
    const content = contentRef.current;
    if (!webgl || !root) return;
    let rect = offsetRect(root);
    let revealed = false;
    let delayed: gsap.core.Tween | null = null;
    let tl: gsap.core.Timeline | null = null;
    webgl.setHeaderScrollRect({ y: rect.y, height: rect.height });

    const show = () => {
      if (revealed) return;
      if (!descRef.current || !scrollRef.current) {
        requestAnimationFrame(show);
        return;
      }
      revealed = true;
      tl?.kill();
      tl = gsap.timeline();
      tl.add(descRef.current.reveal(), 0);
      tl.add(scrollRef.current.reveal(), TEXT_STAGGER);
    };
    const schedule = (isPageTransition: boolean) => {
      if (revealed) return;
      delayed?.kill();
      delayed = gsap.delayedCall(isPageTransition ? 0 : ARRIVAL_DELAY + FIRST_LOAD_EXTRA, show);
    };

    const applyContent = (scroll: number) => {
      const el = contentRef.current;
      if (!el || !rect.height) return;
      if (isTabletWidth()) {
        el.style.transform = "";
        el.style.opacity = "1";
        el.style.willChange = "";
        return;
      }
      const p = clamp(scroll / rect.height, 0, 1);
      if (p <= 0) {
        el.style.transform = "";
        el.style.opacity = "";
        el.style.willChange = "";
        return;
      }
      el.style.transform = `translateY(${p * CONTENT_PARALLAX}%)`;
      const fade = clamp(mapRange(p, [FADE_START, FADE_END], [0, 1]), 0, 1);
      el.style.opacity = String(1 - fade);
      el.style.willChange = p < 1 ? "transform, opacity" : "";
    };

    const onRender = () => {
      const k = isTabletWidth() ? mobileScrollRangeScale : 1;
      webgl.camera.setScrollHeaderPositions(leo.scroll, rect.height, {
        scrollRangePosition: scaleVec(cameraParams.scrollRangePosition, k),
        scrollRangeRotation: scaleVec(cameraParams.scrollRangeRotation, k),
        scrollOffsetPosition: cameraParams.scrollOffsetPosition,
        scrollOffsetRotation: cameraParams.scrollOffsetRotation,
      });
    };
    const onResize = () => {
      rect = offsetRect(root);
      webgl.setHeaderScrollRect({ y: rect.y, height: rect.height });
      applyContent(leo.scroll);
    };
    const onScroll = () => applyContent(leo.scroll);

    const offRender = emitter.on("render", onRender);
    const offResize = emitter.on("resize", onResize);
    const offReveal = emitter.on("loaderRevealComplete", () => schedule(false));
    leo.lenis?.on("scroll", onScroll);
    applyContent(leo.scroll);
    if (leo.isLoaderRevealComplete) schedule(true);

    return () => {
      delayed?.kill();
      tl?.kill();
      offRender();
      offResize();
      offReveal();
      leo.lenis?.off("scroll", onScroll);
      const el = content;
      if (el) {
        el.style.transform = "";
        el.style.opacity = "";
        el.style.willChange = "";
      }
      webgl.setHeaderScrollRect(null);
    };
  }, [cameraParams, mobileScrollRangeScale]);

  return (
    <GridWrapper ref={rootRef} className={cx("headerBlock", raised && "headerBlock--raised")}>
      <div ref={contentRef} className={cx("headerBlock__content")}>
        <TextComponent ref={descRef} className={cx("content__description")} content={description} revealOnScroll={false} isFromToReveal />
        <TextComponent
          ref={scrollRef}
          className={cx("content__scrollIndication")}
          content={scrollIndication}
          onlyOneLine
          revealOnScroll={false}
          isFromToReveal
        />
      </div>
    </GridWrapper>
  );
}
