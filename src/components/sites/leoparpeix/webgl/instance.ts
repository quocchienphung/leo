import type { WebglManager } from "./manager";

let instance: WebglManager | null = null;

export function setWebgl(w: WebglManager | null): void {
  instance = w;
}

/** The session-wide WebGL manager (null during SSR and before boot). */
export function getWebgl(): WebglManager | null {
  return instance;
}
