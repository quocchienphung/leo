// Tiny typed event bus. The source routes almost every cross-component signal through one
// global emitter (`ne` / `re` in the bundle); keeping the same shape keeps ports readable.

export interface FrameInfo {
  /** elapsed time in ms */
  et: number;
  /** delta time in seconds */
  dt: number;
}

export interface ViewportInfo {
  width: number;
  height: number;
  dpr: number;
  postDpr: number;
  ratio: number;
  device: "mobile" | "tablet" | "desktop";
}

export interface PointerCoords {
  /** normalized device coords (-1..1, y up) */
  webgl: { x: number; y: number };
  dom: { x: number; y: number };
}

export interface CursorIndicationOptions {
  variant?: "default" | "clipboard";
  clipboardTheme?: "default" | "white";
}

export interface BeeTextOptions {
  placement?: "top" | "bottomLeft";
  mode?: "generic" | "conversation";
  theme?: "white" | "yellow";
}

export interface BeeAnchor {
  x: number;
  y: number;
  scale: number;
  placement: "top" | "bottomLeft";
}

export interface ShowreelPlayerState {
  active: boolean;
  isPlaying?: boolean;
  cursorMode?: "default" | "hidden" | "timeline" | "timelineDrag";
  clientX?: number;
  clientY?: number;
}

export interface Events {
  tick: [FrameInfo];
  render: [FrameInfo];
  resize: [ViewportInfo];
  pointerMove: [PointerCoords];
  pointerDown: [PointerCoords];
  pointerUp: [PointerCoords];
  appLoaded: [];
  loaderRevealComplete: [];
  toggleSound: [];
  soundStateChange: [boolean];
  cursorIndicationChange: [text: string | string[] | null, visible: boolean, options?: CursorIndicationOptions];
  cursorSoundIndicationSuppress: [boolean];
  cursorClipboardCopied: [];
  showreelPlayerChange: [ShowreelPlayerState];
  showreelIconToggle: [boolean];
  showreelReset: [];
  showreelOpen: [];
  beeTextChange: [text: string | null, visible: boolean, options?: BeeTextOptions];
  beeAnchorUpdate: [BeeAnchor];
  beeTextHideAll: [];
  layoutRefresh: [];
  showHomePage: [];
  pageTransitionSound: [];
  menuToggle: [boolean];
  navbarDarkMode: [boolean];
  navbarForceWhite: [boolean];
  webglSectionRevealLock: [];
  webglSectionRevealReset: [];
  showreelCursorRestore: [];
  pageTransitionComplete: [];
  creditsToggle: [boolean];
  routeEnter: [route: RouteName, initial: boolean];
  routeLeave: [route: RouteName];
}

export type RouteName = "home" | "about" | "playground";

type Handler<A extends unknown[]> = (...args: A) => void;

class Emitter {
  private map = new Map<keyof Events, Set<Handler<never[]>>>();

  on<K extends keyof Events>(key: K, fn: Handler<Events[K]>): () => void {
    let set = this.map.get(key);
    if (!set) {
      set = new Set();
      this.map.set(key, set);
    }
    set.add(fn as unknown as Handler<never[]>);
    return () => this.off(key, fn);
  }

  off<K extends keyof Events>(key: K, fn: Handler<Events[K]>): void {
    this.map.get(key)?.delete(fn as unknown as Handler<never[]>);
  }

  emit<K extends keyof Events>(key: K, ...args: Events[K]): void {
    const set = this.map.get(key);
    if (!set) return;
    for (const fn of [...set]) (fn as unknown as Handler<Events[K]>)(...args);
  }
}

export const emitter = new Emitter();
