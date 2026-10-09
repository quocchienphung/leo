# Playground — crystal pavilion: scene component map

The scene plugs into the existing WebGL manager as a third route environment, next to
`HomeEnvironment` and `AboutEnvironment`. React Three Fiber / drei were not added: the site already
owns one main renderer (loader card, page transition, fluid distortion, film grain, Lenis-driven
cameras), and a second renderer would break those. Everything below is plain three.js (r186), one
module per concern. The pavilion is procedural (no downloads); the six Swarovski Florere figurines
around the daisy are modelled in code from the product photos (audit-2026-10-07/references/).
Composition and light follow the Crystal Flower Pavilion board (2026-10-07); the older
`docs/design-references/playground-crystal-reference.png` only still applies to the daisy itself.

## Frames

- **World** = the home GLB frame (camera looks down −X, screen right is −Z); the camera rigs live here.
- **Stage** = the pavilion frame: origin on the floor under the daisy (world (2.75, 0, 0)), x right,
  y up, z towards the camera. `stage.rotation.y = π/2` maps it into the world. Every object of the
  pavilion is built in the stage frame.
- **Backdrop** = the stage frame in km, eye 0.9 km above the valley datum (only directions matter).

## Files (`src/components/sites/leoparpeix/webgl/env/crystal/`)

| File | Contents | Reference element |
|---|---|---|
| `layout.ts` | camera rig, sun direction (behind the pavilion, top right), every placement (daisy, pool, garden spots and their back-layer repeats, spheres, quartz clusters), solved through the rig's projection | composition |
| `backdrop.ts` | `Backdrop`: sky dome sampling an HDR bake of the camera frustum (+10 %); massifs, cumulus towers, terrain-clipped waterfall/stream flow map; progressive strip refresh, per-frame water animation | sky, clouds, mountains, waterfalls |
| `materials.ts` | material families: frosted petal, champagne, glass rod, **traced cut crystal** (clear or tinted), coloured crystal, gold-tone metal, green lacquer, clear glass, limestone, marble; scene environment capture | materials |
| `cut.ts` | designed convex cuts (ring gems, marquise leaves, petal chips, briolettes, beads, bell bodies, natural rock bases, faceted rock for the daisy base, quartz points) and their face planes for the tracer | crystal geometry |
| `florere/kit.ts` | `Figurine` builder: merged metal wires, instanced crystal parts, frames, base wrap wire | Florere |
| `florere/species.ts` | Rose, Forget-me-not, Rozanne, Lily, Lily of the Valley, Blue Bellflower (product units, 1 tall) | Florere |
| `florere/garden.ts` | `FlorereGarden`: plinths, placement, idle sway; product line-up for `?debug=florere` | garden |
| `lightformers.ts` | capture-only lightformers (warm wall, two tall bright strips for petal streaks, sunlit opening, top strip, scattered warm points for crystal sparkle) and the jewel environment | reflections |
| `flower.ts` | `CrystalFlower`: the home/about daisy's proportions and pose (measured on `TexFleur`): 12 even paddle petals, flattened champagne dome wearing the bloub eyes (`eyes/orbFace.ts`), straight thin glass stem, two traced marquise leaves, a faceted block rock, glass disc; opening intro and idle | central flower |
| `architecture.ts` | `Pavilion`: arched wall, parapet, steps, the glass panel on the right pier | architecture |
| `floor.ts` | `MirrorFloor`: planar reflection shared by the marble floor and the pool | floor, water |
| `props.ts` | glass spheres and traced quartz-point clusters. No natural plants anywhere in the scene (removed 2026-10-08) | props |
| `post.ts` | `CrystalPost`: HDR target → half-res bright pass (glints and the sun only) → three-level bloom → corner sun glare at the projected sun → ACES → contrast-adaptive sharpen → grade → sRGB. No drawn light beams or star streaks | post-processing |
| `crystalEnvironment.ts` | `PlaygroundEnvironment`: assembly, lights, shadows, environment capture, adaptive resolution, precompile, `?debug=` modes | scene root |

Shaders: `webgl/shaders/backdrop.ts` (sky, terrain, clouds, waterfall ledges and flow map),
`webgl/shaders/backgroundWater.ts` (falling water, stream ripples and impact mist), `webgl/shaders/crystal.ts` (petal/orb
patches, floor, pool, post) and `webgl/shaders/crystalTrace.ts` (the convex-solid tracer:
entry refraction → internal bounces against the solid's planes with Fresnel/TIR → per-channel exit
refraction into the refraction buffer or the environment; planes read from a float texture;
absorption per object-space unit; instancing-aware).

## Integration points

| Where | What |
|---|---|
| `webgl/cameras.ts` | `modelCameraNode("playground")` returns the solved rig from `layout.ts` |
| `data/headerCamera.ts`, `data/playground.ts` | shared Work translation preset: local Y=-2.4p, Z=-4p, fixed horizontal viewing direction; Playground stops above its flat floor at p=0.92; measured Work rig/lens in `layout.ts`; current evidence in `scroll-2026-10-09/translation/` |
| `webgl/eyes/faceDriver.ts` | bloub eye montage, expressions and pointer follow, shared by the home/about `FlowerFace` and the playground `OrbFace` |
| `webgl/manager.ts` | `ensurePlayground()` builds and precompiles the pavilion before it joins the scene; render through `CrystalPost`; lighter grain on this route; `checkShaderErrors` off in production |
| `shell/LeoShell.tsx` | intro timeline, sibling prefetch (the pavilion is precompiled in idle time from other routes) |
| `shell/CursorIndication.tsx` | no "Click — to enable sound" pill on `/playground` |
| `views/PlaygroundView.tsx` | `HeaderBlock raised foregroundReveal` (3D header) → hero (bee) → media rows → footer |
| `blocks/shared/HeaderBlock.tsx` | `raised`: copy at the reference height; `foregroundReveal`: second mobile viewport for the floor camera reveal |

## Development switches

`?debug=backdrop` (sky only), `lighting` (clay), `sun` (clay, sun only), `glass` (no stylisation:
glitter, milk, translucency glow and traced sun glints off), `unpatched` (every patched glass swapped
for a stock `MeshPhysicalMaterial`, A/B baseline), `florere` (the six figurines side by side, no
daisy), `composition` (bounds), `probe` (exposes `window.__crystal`) — all ignored in production.
`?crystalEnv=jewel` makes the traced crystal reflect the jewel studio instead of the pavilion.
`?quality=high` pins the adaptive resolution, renders refraction at full resolution and refreshes
the floor mirror every frame (QA). Evidence: `node scripts/capture-playground-crystal.mjs`.
