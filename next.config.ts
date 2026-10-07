import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The clone drives WebGL, Lenis and GSAP imperatively from effects. StrictMode's dev-only
  // double mount would fire unmount side effects (cursor/bee events) the source never emits.
  reactStrictMode: false,
  // `/Playground` → `/playground` lives in `src/proxy.ts` (exact-case match).
};

export default nextConfig;
