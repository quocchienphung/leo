# Daisies: bloub eyes (user-requested change, 2026-10-07)

The sculpted face of both daisies (home workshop hero and About landscape) is replaced by the animated eyes of
[bloub](https://bloub.vercel.app/) ([source](https://github.com/jeremy-prt/bloub), MIT, © 2026 Jérémy Perret).
Layout, model, petals, colours, scene, lights and every other animation are untouched.

## Code

| File | Role |
|---|---|
| `src/components/sites/leoparpeix/webgl/eyes/bloubEyes.ts` | Port of bloub's eye maths and `zc` controller: 16 expressions (`ys`), 15 states (`dc`), gaze sphere projection (`us`), wander/blink/float (`hs`, `ms`), state + expression morphs (`Rc`, `Cs`), `blinkIn`, follow look (`hl`) |
| `src/components/sites/leoparpeix/webgl/eyes/bloubShapes.ts` | bloub silhouettes (egg, hexagon, triangle, capsule, drop) as 64 radii; only used to place eyes (`Fs`) |
| `src/components/sites/leoparpeix/webgl/eyes/flowerFace.ts` | Removes the face from `TexFleur`, draws the eyes on the dome surface, runs the timeline + pointer follow |
| `webgl/env/environments.ts`, `webgl/manager.ts` | `HomeEnvironment` / `AboutEnvironment` attach `FlowerFace` with `HOME_FACE` / `ABOUT_FACE`; `renderFace(et, camera)` each frame |

## Evidence

| Claim | How it was checked | Status |
|---|---|---|
| The face is 4 decal meshes on the dome (eyes 2×108 vertices, moustache 2×80) | Draco-decoded `TexFleur` of `scene_v9.glb` (home) and `scene_v15.glb` (about, node rotation + scale 1.43), connected components | OBSERVED |
| Face axes, centre and radius per flower | down = eye-decal midpoint → moustache midpoint; right = between the eye decals, signed so right × up leaves the face. Home: right −Z, down −Y. About (faces local +Y): right (−0.795, 0, −0.607), down (0.607, 0, −0.795). Original eyes at b (±0.116, −0.047) on both | OBSERVED |
| The same face is also painted in the dome's baked texture | Rendered after removing the decals: dots and moustache still visible | OBSERVED |
| Dome UV ≈ planar in face space | Least squares over 65 dome vertices (\|b\| < 0.6): max residual 0.51 texel (home), 0.67 texel (about) at 2048² | OBSERVED |
| Expression eyes match bloub | Port vs the 16 provided `design-references/eyes/*.svg` (cloud body), 90 frames each: linear part ≤ 0.01 (export rounding); vs live circle-body thumbnails (t = 1s): all 6 matrix terms 0.00 | SOURCE_VERIFIED |
| States, morphs, blink-in, follow/tour, expression changes match bloub | bloub's own maths extracted from the production bundle and run in Node beside the port: 3901 frames / 4830 eye samples over the default montage + swirl (twice), mid-morph switches, expression changes, follow on/off: matrix diff 0.0000, alpha diff 0, no shape or count mismatch | SOURCE_VERIFIED |
| Settings-mode behaviour (follow pointer, circle body, expressions `fl` every 4.2s) | Bundle: `follow: b.value === 'reglages'`, `ae = Ys` (circle), `setInterval(… fl …, qp = 4200)` | SOURCE_VERIFIED |

## Rendering

- The four decal meshes are removed from the `TexFleur` index buffer at load.
- A shell made of the dome's own triangles (same vertices, polygon offset, no depth write) draws on
  top of the dome:
  - **Face space.** Coordinates are `b = (−(z − cz), −(y − cy)) / R`, with R = 0.4427 (the dome
    radius, equal to bloub's body radius of 1). The eyes are therefore an orthographic projection
    onto the real dome surface, exactly as bloub projects onto its sphere.
  - **Repainting the old face.** The painted face (ellipse centre (0, −0.03), radii (0.42, 0.2) in
    b units) is filled from the surrounding texels by blended horizontal and vertical
    interpolation.
  - **Eye shape and colour.** Each eye is bloub's stadium (`Vs`) as an SDF through the inverse eye
    matrix, anti-aliased with `fwidth`. The ink is the darkest texel around the original painted
    eye. It is shaded by the dome's baked light relative to the face centre, clamped to
    [0.6, 1.15], so the eyes read as painted on the surface.

## Timeline

1. **Before the loader reveal:** idle with the neutral expression, wandering and blinking.
2. **From the reveal:** bloub's montage loops with block lengths from `bl()`:
   - idle 8.4 s, wink 1.6, wide 1.8, notify 2.2, egg 1.8, hexagon 1.6, play 2.0, orbit 3.4,
     burst 2.6, comet 2.4, swirl 1.3.
   - Idle is lengthened inside bloub's 10 s block limit so that expressions can show.
3. **Expressions:** they rotate through surpris → heureux → hilare → excite → fier → blasé every
   4.2 s. They are visible in the face states (idle, swirl).
4. **Pointer:** in face states the eyes follow the pointer.
   - The range is bloub's ±16° yaw and ±13° pitch, measured relative to the projected dome centre.
   - Following starts with bloub's 360° tour (1.1 s, easeOutQuint).
   - Leaving a face state eases back to rest over 1.1 s.
   - Touch pointers are ignored, as in bloub.

## Deliberate differences from bloub

- **No body.** The flower dome is the body, so bloub's body, thinking dots, notification badge,
  arcs and burst particles are not drawn.
- **Eyeless states left out.** `thinking`, `alert`, `exclaim` and `sleep` are not played: their
  poses set `eyeAlpha: 0` for the whole block, so they contain no eye animation.
- **Follow base 0°/0°.** bloub uses −26°/+10° for its own page layout. Here the daisy looks
  straight at the pointer.
- **Ink eyes.** bloub's eyes are holes showing the paper colour through an ink body. On the cream
  daisy they use the daisy's original ink instead.
