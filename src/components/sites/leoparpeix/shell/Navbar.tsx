"use client";

import gsap from "gsap";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { leo } from "../core/app";
import { moduleClasses } from "../core/cx";
import { emitter } from "../core/emitter";
import { LINK_ROUTES, ROUTE_PATHS, navigate, routeFromPath } from "../core/navigation";
import { globalContent } from "../data/global";
import styles from "../styles/Navbar.module.css";
import { MainButton, MenuButton, NavLabButton, SoundButton, type MenuButtonHandle } from "../ui/buttons";
import { GridWrapper } from "../ui/GridWrapper";
import { TextComponent, type TextHandle } from "../ui/TextComponent";

const cx = moduleClasses(styles);
const OVERLAY_OPACITY = 0.3; // C5
const CLOSE_SCROLL_DELTA = 1; // M5
const ROUTE_CLOSE_DELAY = 0.325; // I5
const SOUND_SUPPRESS_SELECTOR = ".left__title, .links__link, .links__lab, .soundButton";

/** Source `NavbarComponent` (line ~51172). */
export function Navbar({ visible }: { visible: boolean }) {
  const pathname = usePathname();
  const route = routeFromPath(pathname);
  const { navbar, title, infos } = globalContent;
  const [open, setOpen] = useState(false);
  const [toggleColor, setToggleColor] = useState(false);
  const [forceWhite, setForceWhite] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<MenuButtonHandle>(null);
  const linkRefs = useRef<(TextHandle | null)[]>([]);
  const labRef = useRef<TextHandle>(null);
  const contactRef = useRef<TextHandle>(null);
  const infosRef = useRef<TextHandle>(null);
  const openRef = useRef(false);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const scrollAtOpen = useRef(0);
  const hoverCount = useRef(0);

  const hideTexts = () => {
    linkRefs.current.forEach((t) => t?.hide());
    infosRef.current?.hide();
    labRef.current?.hide();
    contactRef.current?.hide();
  };

  const toggle = () => {
    const next = !openRef.current;
    openRef.current = next;
    setOpen(next);
    tlRef.current?.kill();
    if (next) hideTexts();
    const tl = gsap.timeline();
    const overlay = overlayRef.current;
    if (overlay) {
      if (next) {
        scrollAtOpen.current = leo.lenis?.scroll ?? window.scrollY;
        tl.set(overlay, { pointerEvents: "auto" }, 0);
        tl.to(overlay, { opacity: OVERLAY_OPACITY, duration: 0.75, ease: "sine.out" }, 0);
      } else {
        tl.to(overlay, { opacity: 0, duration: 0.5, ease: "power1.inOut" }, 0);
        tl.set(overlay, { pointerEvents: "none" }, 0.5);
      }
    }
    tl.to(menuRef.current, { transform: next ? "translateY(0%)" : "translateY(-100%)", duration: 0.65, ease: next ? "reveal" : "power3.out" }, 0);
    const cross = menuButtonRef.current?.animateCross(next);
    if (cross) tl.add(cross, 0);
    if (next) {
      const links = linkRefs.current.filter(Boolean) as TextHandle[];
      links.forEach((t, i) => tl.add(t.reveal(), 0.075 * i + 0.25));
      if (labRef.current) tl.add(labRef.current.reveal(), 0.075 * links.length + 0.25);
      const n = links.length + (labRef.current ? 1 : 0);
      if (contactRef.current) tl.add(contactRef.current.reveal(), 0.075 * (n + 1) + 0.25);
      if (infosRef.current) tl.add(infosRef.current.reveal(), 0.25);
    } else {
      tl.call(hideTexts, undefined, 0.65);
    }
    tlRef.current = tl;
  };

  const close = () => {
    if (openRef.current) toggle();
  };

  const go = (label: string) => {
    const r = LINK_ROUTES[label];
    if (!r) return;
    navigate(ROUTE_PATHS[r]);
  };

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onScroll = () => {
      const s = leo.lenis?.scroll ?? window.scrollY;
      if (!openRef.current) {
        scrollAtOpen.current = s;
        return;
      }
      if (Math.abs(s - scrollAtOpen.current) >= CLOSE_SCROLL_DELTA) close();
      else scrollAtOpen.current = s;
    };
    leo.lenis?.on("scroll", onScroll);
    const offDark = emitter.on("navbarDarkMode", (v) => setToggleColor(v));
    const offWhite = emitter.on("navbarForceWhite", (v) => setForceWhite(v));
    return () => {
      leo.lenis?.off("scroll", onScroll);
      offDark();
      offWhite();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route change: close the menu after a short delay and reset colour modes.
  useEffect(() => {
    const t = window.setTimeout(close, ROUTE_CLOSE_DELAY * 1000);
    setToggleColor(false);
    setForceWhite(false);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const pageClass = route === "home" || route === "about" ? route : null;
  const isCurrent = (label: string) => LINK_ROUTES[label] === route;

  const onMouseOver = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (!t.closest?.(SOUND_SUPPRESS_SELECTOR)) return;
    hoverCount.current += 1;
    if (hoverCount.current === 1) emitter.emit("cursorSoundIndicationSuppress", true);
  };
  const onMouseOut = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const rel = e.relatedTarget as HTMLElement | null;
    if (t.closest?.(SOUND_SUPPRESS_SELECTOR) && !rel?.closest?.(SOUND_SUPPRESS_SELECTOR)) hoverCount.current = Math.max(0, hoverCount.current - 1);
  };

  return (
    <div
      className={cx("navbarBlock", pageClass, {
        visible,
        toggleColor: toggleColor && !!pageClass,
        forceWhite: forceWhite && route === "about",
      })}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
    >
      <GridWrapper className={cx("navbarBlock__left")}>
        <h1 className={cx("left__title")}>
          <MainButton
            text={title}
            isExternal={false}
            url="/"
            onClick={(e) => {
              e.preventDefault();
              go("Work");
            }}
          />
        </h1>
        <h3 className={cx("left__infos")}>{infos}</h3>
      </GridWrapper>
      <GridWrapper className={cx("navbarBlock__right")}>
        <div className={cx("right__links")}>
          {navbar.links.map((label) => (
            <MainButton
              key={label}
              className={cx("links__link")}
              text={label}
              isExternal={false}
              url={ROUTE_PATHS[LINK_ROUTES[label]]}
              onClick={(e) => {
                e.preventDefault();
                go(label);
              }}
            />
          ))}
          <NavLabButton className={cx("links__lab")} text={navbar.lab.text} url={navbar.lab.url} />
          <SoundButton />
        </div>
        <div className={cx("right__buttons")}>
          <SoundButton />
          <MenuButton ref={menuButtonRef} onClick={toggle} />
        </div>
      </GridWrapper>
      <GridWrapper ref={menuRef} className={cx("navbarBlock__menu")} aria-hidden={!open}>
        <TextComponent ref={infosRef} className={cx("menu__infos")} content={infos} duration={0.75} hideDuration={0.75} revealOnScroll={false} />
        <div className={cx("menu__links")}>
          {navbar.links.map((label, i) => (
            <Fragment key={label}>
              <TextComponent
                ref={(h) => {
                  linkRefs.current[i] = h;
                }}
                className={cx("links__link", { "links__link--current": isCurrent(label) })}
                content={label}
                duration={0.75}
                hideDuration={0.75}
                revealOnScroll={false}
                onlyOneLine
                isFromToReveal={false}
                tag="button"
                onClick={() => go(label)}
              />
              {label === "Playground" && (
                <TextComponent
                  ref={labRef}
                  className={cx("links__lab")}
                  content={navbar.lab.text}
                  duration={0.75}
                  hideDuration={0.75}
                  revealOnScroll={false}
                  onlyOneLine
                  isFromToReveal={false}
                  tag="button"
                  onClick={() => {
                    window.open(navbar.lab.url, "_blank", "noopener,noreferrer");
                    close();
                  }}
                />
              )}
            </Fragment>
          ))}
          <TextComponent
            ref={contactRef}
            className={cx("links__contact")}
            content={navbar.contact}
            duration={0.75}
            hideDuration={0.75}
            revealOnScroll={false}
            onlyOneLine
            isFromToReveal={false}
            tag="button"
            onClick={() => {
              window.location.href = `mailto:${navbar.contact}`;
            }}
          />
        </div>
      </GridWrapper>
      {mounted && createPortal(<div ref={overlayRef} className={cx("navbarBlock__overlay")} onClick={close} />, document.body)}
    </div>
  );
}
