# Playground scroll — corrected to Work's translation

The required effect is the camera sliding down and forward as the visitor scrolls, with a fixed
viewing direction. The previous attempt pitched the camera down; that was the wrong interaction.
Current evidence is in `translation/`; `after/` and `iteration-1/` document the superseded tilt.

## Measured Work behavior

Run `node scripts/measure-work-scroll.mjs`. It navigates to Work, centers the pointer, drives
real wheel input and records the render camera at eight positions. Evidence:
`work-measurement/runtime.json` and `work-measurement/work-*.png` (1672×941).

Work's rig is world (14.7563982, 2.3107572, 0), facing world -X with practically horizontal pitch
(measured 0.00021°). Vertical FOV is 22.895192°, desktop zoom 1. The render camera sits inside
the pointer group inside this rig.

The header function is `p = scroll / headerHeight`, local position `(0, -2.4p, -4p)`, local
rotation `(0, 0, 0)`. Both routes share Lenis: desktop lerp 0.085, mobile lerp 1, wheel/touch
multipliers 1, syncTouch enabled.

| Scroll | Progress | Local Y | Local Z | World eye height |
|---:|---:|---:|---:|---:|
| 0px | 0 | 0 | 0 | 2.310757 |
| 188px | 0.0999 | -0.239745 | -0.399575 | 2.071014 |
| 452px | 0.2402 | -0.576408 | -0.960680 | 1.734353 |
| 753px | 0.4001 | -0.960255 | -1.600425 | 1.350508 |
| 941px | 0.5 | -1.2 | -2 | 1.110765 |
| 1317px | 0.6998 | -1.679490 | -2.799150 | 0.631278 |
| 1694px | 0.9001 | -2.160255 | -3.600425 | 0.150515 |

The foreground appears because the eye moves lower and forward. The viewing direction stays
constant throughout the scroll.

## Implementation

- `data/headerCamera.ts` owns the shared Work header translation preset and measured rig/lens.
  `data/home.ts` and `data/playground.ts` reference the same translation preset.
- `webgl/env/crystal/layout.ts` gives Playground Work's measured eye position and lens, facing
  horizontally. The previous pavilion rig looked upward by 4.7°.
- `HeaderBlock` still calls the existing `MainCamera.setScrollHeaderPositions` every frame;
  no additional scroll listener or animation loop.
- Playground limits progress to 0.92, leaving the eye about 0.103 units above its flat floor.
  Work's original floor includes a lower front level. This route-specific limit prevents a floor
  crossing at the end, when the bee hero already covers most of the scene. Work has no new limit.
- Playground retains a 200dvh header on mobile with the `foregroundReveal` option. Intro copy
  remains in the first viewport. Other routes retain their header heights.

## Current evidence and checks

Run `node scripts/capture-crystal-scroll.mjs translation` with the dev server on port 3000.
Desktop uses wheel input; mobile uses explicit Chromium touch events. Checks cover constant
world viewing direction, zero scroll rotation, Work's measured translation, increasing foreground
visibility, floor clearance, reverse scroll, resize, bee-hero handoff/re-entry and route navigation.
There were no browser errors or horizontal overflow.

`translation/scroll-sequence.png` shows Playground at 0, 452 and 941px.
`translation/work-vs-playground.png` compares Work (top) and Playground (bottom) at those same positions.
`translation/runtime.json` contains desktop 1672×941, wide 2559×1276 and touch-mobile 390×844
measurements plus resized states. `npm run check` passed (ESLint, TypeScript, production build).
Browser coverage is Chromium on Windows; Safari and physical phones were not tested.
