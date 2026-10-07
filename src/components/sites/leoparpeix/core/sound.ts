"use client";

import gsap from "gsap";
import { Howl, Howler } from "howler";
import { sounds } from "../data/media";
import { emitter } from "./emitter";

type SoundKey = keyof typeof sounds;

/**
 * Port of the source sound controller (`J8`, line ~58466) and SoundButton toggle logic.
 * Ambient loop volume = 0.375 × factor; sfx are muted while the factor is 0. Audio only
 * starts after a user gesture (first click or the sound button).
 */
class SoundController {
  private howls = new Map<SoundKey, Howl>();
  private initialized = false;
  enabled = false;
  /** Tweened 0↔1 ambient factor; drives the SoundButton bars. */
  amount = 0;
  private tween: gsap.core.Tween | null = null;
  private suppressedForShowreel = false;

  init(): void {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;
    Howler.volume(0.7);
    for (const [key, cfg] of Object.entries(sounds) as [SoundKey, (typeof sounds)[SoundKey]][]) {
      this.howls.set(
        key,
        new Howl({
          src: [cfg.path],
          loop: "loop" in cfg ? cfg.loop : false,
          volume: cfg.volume,
          format: ["aac"],
        }),
      );
    }
    document.addEventListener("visibilitychange", () => Howler.mute(document.visibilityState !== "visible"));
    emitter.on("pageTransitionSound", () => this.playPageTransition());
  }

  toggle(): void {
    this.init();
    this.enabled = !this.enabled;
    this.tween?.kill();
    const state = { amount: this.amount };
    this.tween = gsap.to(state, {
      amount: this.enabled ? 1 : 0,
      duration: 0.5,
      ease: "power4.out",
      onUpdate: () => {
        this.amount = state.amount;
        this.setAmbientVolume(state.amount);
      },
    });
    this.playAmbient();
    emitter.emit("soundStateChange", this.enabled);
  }

  private playAmbient(): void {
    const h = this.howls.get("ambient");
    if (h && !h.playing()) {
      h.volume(0);
      h.play();
    }
  }

  private setAmbientVolume(factor: number): void {
    const h = this.howls.get("ambient");
    if (!h || this.suppressedForShowreel) return;
    h.volume(sounds.ambient.volume * factor);
  }

  playSfx(key: Exclude<SoundKey, "ambient">): void {
    const h = this.howls.get(key);
    if (!h || this.amount <= 0) return;
    h.volume(sounds[key].volume * this.amount);
    h.play();
  }

  /** Source `Fp`: page transition whoosh seeks to 15% and fades in over 700ms. */
  playPageTransition(): void {
    const h = this.howls.get("pageTransition");
    if (!h || this.amount <= 0) return;
    const cfg = sounds.pageTransition;
    const target = cfg.volume * this.amount;
    const start = () => {
      h.stop();
      h.volume(0);
      const id = h.play();
      const d = h.duration();
      if (d > 0) h.seek(d * cfg.startProgress, id);
      const v = { value: 0 };
      gsap.to(v, { value: target, duration: cfg.fadeInDuration / 1000, ease: "power2.out", onUpdate: () => void h.volume(v.value, id) });
    };
    if (h.state() === "loaded") start();
    else h.once("load", start);
  }

  suppressAmbientForShowreel(on: boolean): void {
    this.suppressedForShowreel = on;
    const h = this.howls.get("ambient");
    if (!h) return;
    if (on) h.fade(h.volume(), 0, 500);
    else h.fade(h.volume(), sounds.ambient.volume * this.amount, 500);
  }
}

export const sound = new SoundController();
