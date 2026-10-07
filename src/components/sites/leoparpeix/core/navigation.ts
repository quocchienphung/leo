import type { RouteName } from "./emitter";

type Navigator = (href: string) => void;

let navigator: Navigator | null = null;

export function registerNavigator(fn: Navigator | null): void {
  navigator = fn;
}

/** Navigate between cloned routes with the source page transition. */
export function navigate(href: string): void {
  if (navigator) navigator(href);
  else window.location.href = href;
}

export function routeFromPath(pathname: string): RouteName {
  if (pathname.startsWith("/about")) return "about";
  if (pathname.startsWith("/playground")) return "playground";
  return "home";
}

export const ROUTE_PATHS: Record<RouteName, string> = {
  home: "/",
  about: "/about",
  playground: "/playground",
};

/** Navbar labels → routes (source `m()`). */
export const LINK_ROUTES: Record<string, RouteName> = {
  Work: "home",
  About: "about",
  Playground: "playground",
};
