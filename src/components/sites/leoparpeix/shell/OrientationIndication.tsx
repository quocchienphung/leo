"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { moduleClasses } from "../core/cx";
import { isMobileDevice } from "../core/env";
import { useClientValue } from "../core/useClient";
import { globalContent } from "../data/global";
import styles from "../styles/OrientationIndication.module.css";

const cx = moduleClasses(styles);
const LEAVE_MS = 575;

/** Source `zE()`: handheld device held in landscape. */
function shouldShow(): boolean {
  const landscape = window.innerWidth > window.innerHeight || window.matchMedia("(orientation: landscape)").matches;
  return isMobileDevice() && landscape;
}

function subscribe(cb: () => void): () => void {
  const mq = window.matchMedia("(orientation: landscape)");
  const twice = () => {
    cb();
    requestAnimationFrame(cb);
  };
  mq.addEventListener("change", twice);
  window.addEventListener("orientationchange", twice);
  window.addEventListener("resize", cb);
  return () => {
    mq.removeEventListener("change", twice);
    window.removeEventListener("orientationchange", twice);
    window.removeEventListener("resize", cb);
  };
}

/**
 * Source `OrientationIndication` (line ~39160): "Rotate your device" overlay on handheld
 * devices in landscape; locks page overflow while shown, fades out over 575ms.
 */
export function OrientationIndication() {
  const mounted = useClientValue(() => true, false);
  const show = useClientValue(shouldShow, false, subscribe);

  useEffect(() => {
    document.documentElement.style.overflow = show ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [show]);

  if (!mounted || !isMobileDevice()) return null;
  const { title, text } = globalContent.orientation;
  return createPortal(
    <div
      className={cx("orientationIndication", { "orientationIndication-leave-active": !show, "orientationIndication-leave-to": !show })}
      style={{ visibility: show ? "visible" : "hidden", transition: show ? "none" : `opacity 0.4s 0.175s cubic-bezier(0.4, 0, 0.2, 1), visibility 0s linear ${LEAVE_MS}ms` }}
      role="alertdialog"
      aria-modal="true"
      aria-hidden={!show}
      aria-label={title}
    >
      <div className={cx("orientationIndication__content")}>
        <div className={cx("orientationIndication__phone")} aria-hidden="true">
          <svg className={cx("orientationIndication__phoneSvg")} width="48" height="96" viewBox="0 0 48 96" fill="none">
            <rect x="4" y="2" width="40" height="92" rx="9" stroke="currentColor" strokeWidth="2" />
            <rect x="18" y="6" width="12" height="3" rx="1.5" fill="currentColor" />
            <rect x="10" y="14" width="28" height="68" rx="3" fill="currentColor" fillOpacity="0.08" />
            <rect x="19" y="86" width="10" height="2" rx="1" fill="currentColor" fillOpacity="0.35" />
          </svg>
        </div>
        <h2 className={cx("orientationIndication__title")}>{title}</h2>
        <p className={cx("orientationIndication__text")}>{text}</p>
      </div>
    </div>,
    document.body,
  );
}
