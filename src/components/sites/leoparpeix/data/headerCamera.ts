import type { CameraParams } from "./types";

/** Work header motion: local translation driven linearly by Lenis scroll / header height. */
export const WORK_HEADER_CAMERA_PARAMS: CameraParams = {
  scrollRangePosition: { x: 0, y: 2.4, z: 4 },
  scrollRangeRotation: { x: 0, y: 0, z: 0 },
  scrollOffsetPosition: { x: 0, y: 0, z: 0 },
  scrollOffsetRotation: { x: 0, y: 0, z: 0 },
};

/** Measured from the home GLB camera; forward is horizontal along world -X. */
export const WORK_HEADER_RIG = {
  x: 14.75639820098877,
  y: 2.3107571601867676,
  z: 0,
  fov: 22.895191956401895,
} as const;
