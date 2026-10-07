import { isTabletWidth } from "../../core/env";

/** Source `O4` (desktop) / `F4` (tablet & mobile) slider configs, line ~48410. */
export interface SliderConfig {
  discreteDrag: boolean;
  infiniteDrag: boolean;
  parallaxXMultiplier: number;
  dragActivationThresholdPx?: number;
  stepThresholdPx?: number;
  stepSnapLerp?: number;
  snapThreshold: number;
  snapLerp: number;
  dragFollowLerp: number;
  dragMultiplier: number;
  deltaDecay: number;
  dragForceDecay: number;
  dragForceSmooth: number;
  dragForceMultiplier: number;
  dragForceMax: number;
}

const DESKTOP: SliderConfig = {
  discreteDrag: false,
  infiniteDrag: true,
  parallaxXMultiplier: 1.25,
  snapThreshold: 42,
  snapLerp: 0.055,
  dragFollowLerp: 0.068,
  dragMultiplier: 3,
  deltaDecay: 0.9,
  dragForceDecay: 0.42,
  dragForceSmooth: 0.065,
  dragForceMultiplier: 400,
  dragForceMax: 600,
};

const MOBILE: SliderConfig = {
  discreteDrag: false,
  infiniteDrag: true,
  parallaxXMultiplier: 2.75,
  dragActivationThresholdPx: 85,
  stepThresholdPx: 1,
  snapThreshold: 42,
  snapLerp: 0.14,
  dragFollowLerp: 0.14,
  dragMultiplier: 4,
  deltaDecay: 0.9,
  dragForceDecay: 0.42,
  dragForceSmooth: 0.14,
  dragForceMultiplier: 400,
  dragForceMax: 600,
};

export function sliderConfig(): SliderConfig {
  return isTabletWidth() ? MOBILE : DESKTOP;
}

/** Source `bp()`: gap between slides in px. */
export function sliderGap(): number {
  return isTabletWidth() ? 10 : 20;
}

export interface SliderParams {
  currentDrag: number;
  smoothCurrentDrag: number;
  rawDragInput: number;
  dragForce: number;
  smoothDragForce: number;
  snapThreshold: number;
  targetIndex: number;
  snapTarget: number | null;
  forcedSnapIndex: number | null;
  activeIndex: number;
  isDragging: boolean;
  mediaWidth?: number;
}

export function createSliderParams(): SliderParams {
  return {
    currentDrag: 0,
    smoothCurrentDrag: 0,
    rawDragInput: 0,
    dragForce: 0,
    smoothDragForce: 0,
    snapThreshold: sliderConfig().snapThreshold,
    targetIndex: 0,
    snapTarget: null,
    forcedSnapIndex: null,
    activeIndex: 0,
    isDragging: false,
  };
}
