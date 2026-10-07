"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";
import { leo } from "../../core/app";
import { moduleClasses } from "../../core/cx";
import { emitter } from "../../core/emitter";
import { isTouch, isTouchTablet } from "../../core/env";
import { mapClamp, offsetRect } from "../../core/math";
import { sound } from "../../core/sound";
import { mediaWebp } from "../../data/media";
import type { AboutContent } from "../../data/types";
import contentStyles from "../../styles/AboutContentBlock.module.css";
import heroStyles from "../../styles/AboutHeroBlock.module.css";
import introStyles from "../../styles/AboutIntroBlock.module.css";
import cardStyles from "../../styles/CardBlock.module.css";
import flowersStyles from "../../styles/FlowersBlock.module.css";
import { GridWrapper } from "../../ui/GridWrapper";
import { MediaComponent } from "../../ui/MediaComponent";
import { ParallaxWrapper } from "../../ui/ParallaxWrapper";
import { TextComponent, type TextHandle } from "../../ui/TextComponent";
import { WebglBg } from "../../ui/WebglBg";
import { getWebgl } from "../../webgl/instance";
import { BeeBlock } from "../shared/BeeBlock";

const heroCx = moduleClasses(heroStyles);
const introCx = moduleClasses(introStyles);
const flowersCx = moduleClasses(flowersStyles);
const cardCx = moduleClasses(cardStyles);
const contentCx = moduleClasses(contentStyles);

/** Source `mS()`: touch tablets compress staggers by 1.35. */
const touchScale = (v: number) => (isTouchTablet() ? v / 1.35 : v);

/** Source About `HeroBlock` (line ~44377). */
export function AboutHeroBlock({ rootRef, ...props }: AboutContent["hero"] & { rootRef?: React.Ref<HTMLDivElement> }) {
  const { infosLeft, infosCenter, infosRight, titles, titlesReveal, indication } = props;
  return (
    <WebglBg rootRef={rootRef} isGridWrapper={false} index={30} currentPage="about" disablePlaneOverscan className={heroCx("heroBlock")}>
      <GridWrapper className={heroCx("heroBlock__top")}>
        <p className={heroCx("top__left")} dangerouslySetInnerHTML={{ __html: infosLeft }} />
        <p className={heroCx("top__center")} dangerouslySetInnerHTML={{ __html: infosCenter }} />
        <p className={heroCx("top__right")}>{infosRight}</p>
      </GridWrapper>
      <BeeBlock className={heroCx("heroBlock__bee")} titles={titles} titlesReveal={titlesReveal} indication={indication} />
    </WebglBg>
  );
}

/** Source About `IntroBlock` (line ~44441): Panama photo + caption + two texts. */
export function AboutIntroBlock({ imageUrl, place, date, credit, texts }: AboutContent["intro"]) {
  return (
    <WebglBg index={31} currentPage="about" className={introCx("introBlock")}>
      <MediaComponent
        className={introCx("introBlock__media")}
        url={mediaWebp(`/${imageUrl}`)}
        hasParallaxScale
        parallaxMaskAmount={10}
        parallaxScaleAmount={0.1}
        scaleOffsetAmount={1.025}
      />
      <div className={introCx("introBlock__infos")}>
        <div className={introCx("infos__left")}>
          <p className={introCx("left__place")}>{place}</p>
          <p className={introCx("left__date")}>{date}</p>
        </div>
        <p className={introCx("infos__credit")}>{credit}</p>
      </div>
      <div className={introCx("introBlock__texts")}>
        {texts.map((t, i) => (
          <TextComponent key={i} className={introCx(`texts__text-${i}`)} content={t} revealDelay={i * 0.15} />
        ))}
      </div>
      <p className={introCx("introBlock__star")}>*</p>
    </WebglBg>
  );
}

// FlowersBlock constants (line ~43355).
const GROUP_STAGGER = 0.075; // Ez
const TOUCH_PAD = 56; // Xd
const SFX_SPEED = 1200; // Sz
const SFX_THROTTLE = 100; // wz
const LINE_COUNT = 12; // _S

/**
 * Source `FlowersBlock` (line ~43361): manifesto lines with inline daisies. The flowers are
 * flower_v2.glb meshes in the interface scene sitting on `.line__flower` placeholders; they
 * spin with scroll, tilt/spin under pointer gestures and are lit by a point light sweeping
 * across the block.
 */
export function FlowersBlock({ text1, lines, text2 }: AboutContent["flowers"]) {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const firstLineRef = useRef<HTMLDivElement>(null);
  const textRefs = useRef<(TextHandle | null)[]>([]);
  const grouped = typeof window !== "undefined" && isTouchTablet();

  useEffect(() => {
    const webgl = getWebgl();
    const root = rootRef.current;
    const container = containerRef.current;
    if (!webgl || !root || !container) return;
    const scene = webgl.interfaceScene;
    const flowers = [...container.querySelectorAll<HTMLElement>(".line__flower")];
    flowers.forEach((f, i) => scene.flowers.add(f, i));
    let rect = offsetRect(root);
    const touch = isTouch();
    const last = { x: 0, y: 0, t: 0, vx: 0, vy: 0, has: false };
    const sfxTimes = new WeakMap<HTMLElement, number>();

    const sync = () => {
      rect = offsetRect(root);
      scene.flowers.resize();
    };
    const offRender = emitter.on("render", () => {
      scene.flowers.setProgress(mapClamp(window.scrollY, [rect.top - window.innerHeight, rect.top + rect.height], [-1, 1]));
    });
    const offResize = emitter.on("resize", sync);

    const sfx = (el: HTMLElement, speed: number, touchDrag = false) => {
      if (touch || touchDrag || speed < SFX_SPEED) return;
      const now = performance.now();
      if (now - (sfxTimes.get(el) ?? 0) < SFX_THROTTLE) return;
      sfxTimes.set(el, now);
      sound.playSfx("fruit2");
    };
    const force = (el: HTMLElement, x: number, y: number, touchDrag = false) => {
      const now = performance.now();
      if (!last.has) {
        Object.assign(last, { has: true, x, y, t: now });
        return;
      }
      const dt = Math.max(now - last.t, 1) / 1000;
      const vx = (x - last.x) / dt;
      const vy = (y - last.y) / dt;
      const ax = (vx - last.vx) / dt;
      const ay = (vy - last.vy) / dt;
      Object.assign(last, { x, y, t: now, vx, vy });
      const speed = Math.hypot(vx, vy);
      sfx(el, speed, touchDrag);
      scene.flowers.applyMouseForce(el, { vx, vy, speed, ax, ay, dt, clientX: x, clientY: y, touchDrag });
    };
    const reset = () => {
      last.has = false;
      last.vx = 0;
      last.vy = 0;
    };
    const flowerAt = (x: number, y: number, target: EventTarget | null): HTMLElement | null => {
      if (touch) {
        let best: HTMLElement | null = null;
        let bestD = Infinity;
        for (const f of flowers) {
          const b = f.getBoundingClientRect();
          if (!(x >= b.left - TOUCH_PAD && x <= b.right + TOUCH_PAD && y >= b.top - TOUCH_PAD && y <= b.bottom + TOUCH_PAD)) continue;
          const d = Math.hypot(x - (b.left + b.width / 2), y - (b.top + b.height / 2));
          if (d < bestD) {
            bestD = d;
            best = f;
          }
        }
        if (best) return best;
      }
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      return el?.closest<HTMLElement>(".line__flower") ?? (target as HTMLElement | null)?.closest?.<HTMLElement>(".line__flower") ?? null;
    };
    const onMove = (e: MouseEvent) => {
      const f = (e.target as HTMLElement | null)?.closest<HTMLElement>(".line__flower");
      if (f) force(f, e.clientX, e.clientY);
    };
    const onTouchStart = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (!t) return;
      const f = flowerAt(t.clientX, t.clientY, e.target);
      if (!f) return;
      sound.playSfx("fruit2");
      scene.flowers.applyTouchImpulse(f, t.clientX, t.clientY);
      Object.assign(last, { has: true, x: t.clientX, y: t.clientY, t: performance.now(), vx: 0, vy: 0 });
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const f = flowerAt(t.clientX, t.clientY, e.target);
      if (f) force(f, t.clientX, t.clientY, true);
    };
    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", reset);
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: true });
    container.addEventListener("touchend", reset);
    container.addEventListener("touchcancel", reset);

    // Source `jQ`: grouped line reveal on touch tablets.
    let groupTl: gsap.core.Timeline | null = null;
    let groupDone = false;
    const groupProgress = () => {
      const el = firstLineRef.current;
      if (!el) return 0;
      const r = offsetRect(el);
      return mapClamp(leo.scroll, [r.top - window.innerHeight, r.top + r.height], [0, 1]);
    };
    const runGroup = () => {
      const t = textRefs.current.filter(Boolean) as TextHandle[];
      if (t.length < LINE_COUNT) return false;
      groupTl?.kill();
      const tl = gsap.timeline();
      t.forEach((h, i) => tl.add(h.reveal(), i * GROUP_STAGGER));
      groupTl = tl;
      return true;
    };
    const onGroupScroll = () => {
      const p = groupProgress();
      if (p > 0 && !groupDone && runGroup()) groupDone = true;
      if (p <= 0) groupDone = false;
    };
    if (grouped) {
      leo.lenis?.on("scroll", onGroupScroll);
      requestAnimationFrame(onGroupScroll);
    }

    sync();
    return () => {
      offRender();
      offResize();
      groupTl?.kill();
      if (grouped) leo.lenis?.off("scroll", onGroupScroll);
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", reset);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", reset);
      container.removeEventListener("touchcancel", reset);
    };
  }, [grouped]);

  const title = (i: number) => (
    <TextComponent
      ref={(h) => {
        textRefs.current[i] = h;
      }}
      className={flowersCx("line__title")}
      onlyOneLine
      content={lines[i]}
      revealOnScroll={!grouped}
    />
  );
  const flower = <div className={flowersCx("line__flower")} />;

  return (
    <WebglBg rootRef={rootRef} index={32} needLight forceWebgl currentPage="about" className={flowersCx("flowersBlock")}>
      <div ref={containerRef} className={flowersCx("flowersBlock__container")}>
        <div ref={firstLineRef} className={flowersCx("flowersBlock__line", "flowersBlock__line--1")}>
          <p className={flowersCx("line__paragraph", "line__paragraph--1")}>{text1}</p>
          {title(0)}
        </div>
        <div className={flowersCx("flowersBlock__line", "flowersBlock__line--2")}>
          <div className={flowersCx("line__wrapper")}>
            {title(1)}
            {flower}
          </div>
          {title(2)}
        </div>
        <div className={flowersCx("flowersBlock__line", "flowersBlock__line--3")}>
          <div className={flowersCx("line__wrapper")}>
            {title(3)}
            {flower}
          </div>
          {title(4)}
        </div>
        <div className={flowersCx("flowersBlock__line", "flowersBlock__line--4")}>{title(5)}</div>
        <div className={flowersCx("flowersBlock__line", "flowersBlock__line--5")}>
          {title(6)}
          {title(7)}
        </div>
        <div className={flowersCx("flowersBlock__line", "flowersBlock__line--6")}>
          {title(8)}
          {flower}
        </div>
        <div className={flowersCx("flowersBlock__line", "flowersBlock__line--7")}>{title(9)}</div>
        <div className={flowersCx("flowersBlock__line", "flowersBlock__line--8")}>
          <div className={flowersCx("line__wrapper")}>
            {title(10)}
            {flower}
            {title(11)}
          </div>
          <p className={flowersCx("line__paragraph", "line__paragraph--2")}>{text2}</p>
        </div>
      </div>
    </WebglBg>
  );
}

/** Source `CardBlock` (line ~45481): "Professional experiences" card over the library. */
export function CardBlock({ experiences, className }: { experiences: AboutContent["cards"]["experiences"]; className?: string }) {
  return (
    <div className={`${cardCx("cardBlock")}${className ? ` ${className}` : ""}`}>
      <div className={cardCx("cardBlock__top")}>
        <div className={cardCx("top__indication")}>
          <div className={cardCx("indication__circle")} /> {experiences.indication}
        </div>
        <p className={cardCx("top__number")}>({experiences.jobs.length})</p>
      </div>
      <div className={cardCx("cardBlock__content")}>
        <h3 className={cardCx("content__title")}>{experiences.title}</h3>
        <div className={cardCx("content__jobs")}>
          {experiences.jobs.map((job, i) => (
            <div key={i} className={cardCx("jobs__job")}>
              <div className={cardCx("job__line")} />
              <div className={cardCx("job__wrapper")}>
                <p className={cardCx("job__date")}>{job.date}</p>
                <div>
                  {i === 1 ? (
                    <div className={cardCx("wrapper")}>
                      <div className={cardCx("job__current")}>
                        <div className={cardCx("current__circle")} />
                        <div className={cardCx("current__text")}>{job.agency.currentText}</div>
                      </div>
                      <div className={cardCx("job__name")}>{job.agency.name}</div>
                    </div>
                  ) : (
                    <div className={cardCx("job__name")}>{job.agency.name}</div>
                  )}
                  <div className={cardCx("job__roles")}>{job.agency.roles}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Source About `ContentBlock` (line ~43164): portrait, copy, awards (31) and clients. */
export function AboutContentBlock({ titleText, imageUrl, texts, recognitions, clients }: AboutContent["content"]) {
  const stagger = touchScale(0.1);
  const delay = touchScale(0.15);
  const total = recognitions.awards.reduce((a, w) => a + (w.number || 0), 0);
  const half = Math.ceil(clients.names.length / 2);
  return (
    <WebglBg index={53} currentPage="about" className={contentCx("contentBlock")}>
      <div className={contentCx("contentBlock__left")}>
        <TextComponent className={contentCx("left__title")} content={titleText} stagger={stagger} />
        <p className={contentCx("left__star")}>*</p>
        <MediaComponent className={contentCx("left__media")} url={mediaWebp(`/${imageUrl}`)} parallaxMaskAmount={5} hasParallaxRotation />
        {texts.map((t, i) => (
          <TextComponent key={i} content={t} className={contentCx("left__text", `left__text---${i}`)} revealDelay={i * delay} stagger={stagger} />
        ))}
      </div>
      <ParallaxWrapper parallaxAmount={-150} className={contentCx("contentBlock__right")}>
        <ul className={contentCx("right__recognitions")}>
          <div className={contentCx("recognitions__title")}>
            <div className={contentCx("title__text")}>{recognitions.title}</div>
            <div className={contentCx("title__number")}>({total})</div>
          </div>
          {recognitions.awards.map((a, i) => (
            <li key={i} className={contentCx("recognitions__award")}>
              <div className={contentCx("award__name")}>{a.name}</div>
              <div className={contentCx("award__number")}>{a.number}</div>
            </li>
          ))}
        </ul>
        <ul className={contentCx("right__clients")}>
          <div className={contentCx("clients__title")}>{clients.title}</div>
          <div className={contentCx("clients__wrapper")}>
            <div className={contentCx("wrapper__column")}>
              {clients.names.slice(0, half).map((n, i) => (
                <li key={i} className={contentCx("wrapper__name")}>
                  {n}
                </li>
              ))}
            </div>
            <div className={contentCx("wrapper__column")}>
              {clients.names.slice(half).map((n, i) => (
                <li key={i} className={contentCx("wrapper__name")}>
                  {n}
                </li>
              ))}
            </div>
          </div>
        </ul>
      </ParallaxWrapper>
    </WebglBg>
  );
}
