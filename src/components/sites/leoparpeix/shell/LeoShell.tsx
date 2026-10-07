"use client";

import gsap from "gsap";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { leo } from "../core/app";
import { emitter, type RouteName } from "../core/emitter";
import { registerNavigator, routeFromPath } from "../core/navigation";
import { sound } from "../core/sound";
import { moduleClasses } from "../core/cx";
import { globalContent } from "../data/global";
import appStyles from "../styles/App.module.css";
import { setWebgl, getWebgl } from "../webgl/instance";
import { WebglManager } from "../webgl/manager";
import { BeeTextIndication } from "./BeeTextIndication";
import { CursorIndication } from "./CursorIndication";
import { LoaderBlock } from "./LoaderBlock";
import { Navbar } from "./Navbar";
import { OrientationIndication } from "./OrientationIndication";
import { VideoPlayer } from "./VideoPlayer";

// Source App timings (line ~52891): TI = 2.25 + 1, PS = TI + .1, LS = TI + .225, prewarm 500ms.
const appCx = moduleClasses(appStyles);
const TI = 2.25 + 1;
const CAMERA_SHOW_AT = 0.1 + TI;
const MASK_SHOW_AT = 0.225 + TI;
const PREWARM_MS = 500;

async function ensureRouteAssets(webgl: WebglManager, route: RouteName): Promise<void> {
  if (route === "home") await webgl.ensureHome();
  else if (route === "about") await webgl.ensureAbout();
  else await webgl.ensurePlayground();
}

/**
 * Root client shell — the equivalent of the source `App` component + singleton bootstrap.
 * Owns both WebGL canvases for the whole session, the loader, navbar, cursor label and the
 * page transition between the three cloned routes.
 */
export function LeoShell({ children }: { children: ReactNode }) {
  // Child effects run before this component's effects; the session runtime (Lenis, ticker)
  // must exist before any child subscribes to it. `init()` is idempotent and client-only.
  if (typeof window !== "undefined") leo.init();
  const pathname = usePathname();
  const router = useRouter();
  const mainRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const pendingShow = useRef(false);
  const transitionTl = useRef<gsap.core.Timeline | null>(null);
  const routeRef = useRef<RouteName>(routeFromPath(pathname));

  // Boot once.
  useEffect(() => {
    leo.init();
    if (getWebgl()) return;
    const main = mainRef.current;
    const top = topRef.current;
    if (!main || !top) return;
    const webgl = new WebglManager(main, top);
    setWebgl(webgl);
    const route = routeFromPath(window.location.pathname);
    routeRef.current = route;
    leo.currentRoute = route;

    (async () => {
      await Promise.all([webgl.loadGlobal(), ensureRouteAssets(webgl, route)]);
      await webgl.showRoute(route);
      main.parentElement?.classList.add("visible");
      top.parentElement?.classList.add("visible");
      setLoaded(true);
      emitter.emit("appLoaded");

      const reveal = () => {
        leo.isLoaderRevealComplete = true;
        leo.initialLoad = false;
        leo.lenis?.start();
        leo.refreshScrollLayout();
        emitter.emit("loaderRevealComplete");
        // Prefetch the sibling route (source `prefetchSiblingRoutes`).
        const idle = () => {
          if (route === "home") void webgl.ensureAbout();
          else if (route === "about") void webgl.ensureHome();
          else {
            void webgl.ensureHome();
            void webgl.ensureAbout();
          }
          if (route !== "playground") void webgl.ensurePlayground();
        };
        if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(idle, { timeout: 5000 });
        else window.setTimeout(idle, 1500);
      };

      if (leo.skipLoader) {
        window.setTimeout(() => {
          webgl.prewarm();
          webgl.topScene.loaderMask.skip();
          reveal();
        }, 1);
        return;
      }
      // Hold the camera at its dolly start (and the playground cloud un-condensed) until the
      // timeline below takes over.
      webgl.enterRoute(route, true).pause(0);
      window.setTimeout(() => {
        webgl.prewarm();
        window.setTimeout(() => {
          const tl = gsap.timeline();
          tl.add(webgl.topScene.loaderMask.show(), MASK_SHOW_AT);
          tl.call(reveal, undefined, MASK_SHOW_AT);
          tl.add(webgl.enterRoute(route, true), CAMERA_SHOW_AT);
        }, PREWARM_MS);
      }, 1);
    })().catch((err: unknown) => console.error("[leo] boot failed", err));

    // First click anywhere enables sound (source `_setupFirstClick`).
    document.body.classList.add("awaiting-sound-click");
    const onFirstClick = (e: MouseEvent) => {
      if (!leo.firstClick) return;
      const target = e.target as HTMLElement | null;
      leo.firstClick = false;
      document.body.classList.remove("awaiting-sound-click");
      if (!target?.closest?.(".soundButton")) sound.toggle();
      emitter.emit("cursorSoundIndicationSuppress", true);
      if (!target?.closest?.("[data-cursor-indication-preserve]")) emitter.emit("cursorIndicationChange", null, false);
      window.removeEventListener("click", onFirstClick, true);
    };
    window.addEventListener("click", onFirstClick, true);

    // The WebGL/session boot is a singleton: StrictMode's dev re-mount must not cancel it.
    return undefined;
  }, []);

  // Page transitions (source `App` leave hook + router guard).
  useEffect(() => {
    registerNavigator((href) => {
      const webgl = getWebgl();
      const next = routeFromPath(href);
      if (!webgl || leo.isTransitioning || next === routeRef.current) return;
      leo.isTransitioning = true;
      (async () => {
        await ensureRouteAssets(webgl, next);
        emitter.emit("webglSectionRevealLock");
        emitter.emit("pageTransitionSound");
        emitter.emit("beeTextHideAll");
        webgl.beginPageTransitionHide();
        transitionTl.current?.kill();
        setOverlay(true);
        const tl = gsap.timeline();
        transitionTl.current = tl;
        tl.add(
          webgl.topScene.hide(() => {
            emitter.emit("showreelReset");
            emitter.emit("webglSectionRevealReset");
            webgl.endPageTransitionHide();
            webgl.interfaceScene.cleanup();
            pendingShow.current = true;
            router.push(href);
          }),
          0,
        );
      })();
    });
    return () => registerNavigator(null);
  }, [router]);

  // New route mounted under the cover → reveal it.
  useEffect(() => {
    const route = routeFromPath(pathname);
    const previous = routeRef.current;
    routeRef.current = route;
    leo.currentRoute = route;
    const webgl = getWebgl();
    if (!webgl || !loaded) return;
    if (!pendingShow.current) {
      if (previous === route) return;
      // Browser back/forward: cover instantly, then run the normal reveal.
      webgl.topScene.uniforms.uTransition.value = 2;
      webgl.interfaceScene.cleanup();
    }
    pendingShow.current = false;
    (async () => {
      await webgl.showRoute(route);
      if (leo.isLoaderRevealComplete) leo.resetSmoothScroll();
      emitter.emit("routeEnter", route, false);
      const tl = gsap.timeline({
        onComplete: () => {
          leo.isTransitioning = false;
          setOverlay(false);
          emitter.emit("pageTransitionComplete");
          leo.refreshScrollLayout();
        },
      });
      tl.add(webgl.topScene.show());
      transitionTl.current = tl;
    })();
  }, [pathname, loaded]);

  return (
    <>
      <div id="webgl-app">
        <div id="canvas-app" ref={mainRef} />
      </div>
      <div id="webgl-top-app">
        <div id="canvas-top-app" ref={topRef} />
      </div>
      <main className={appCx("app", { visible: loaded })}>
        <LoaderBlock />
        <Navbar visible={loaded} />
        <CursorIndication initial={globalContent.loader.cursorIndication} />
        <BeeTextIndication />
        {loaded ? children : null}
        <VideoPlayer />
        <OrientationIndication />
        {overlay ? <div className={appCx("pageTransitionOverlay")} aria-hidden="true" /> : null}
      </main>
    </>
  );
}
