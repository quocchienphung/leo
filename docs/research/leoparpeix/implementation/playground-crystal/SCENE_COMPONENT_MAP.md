# Playground — crystal pavilion: scene component map

The scene plugs into the existing WebGL manager as a third route environment, next to
`HomeEnvironment` and `AboutEnvironment`. React Three Fiber / drei were not added: the site already
owns one main renderer (loader card, page transition, fluid distortion, film grain, Lenis-driven
cameras), and a second renderer would break those. Everything below is plain three.js (r186), one
module per concern. The pavilion is fully procedural: it downloads nothing.

## Frames

- **World** = the home GLB frame (camera looks down −X, screen right is −Z); the camera rigs live here.
- **Stage** = the pavilion frame: origin on the floor under the daisy (world (2.75, 0, 0)), x right,
  y up, z towards the camera. `stage.rotation.y = π/2` maps it into the world. Every object of the
  pavilion is built in the stage frame.
- **Backdrop** = the stage frame in km, eye 0.9 km above the valley datum (only directions matter).

## Files (`src/components/sites/leoparpeix/webgl/env/crystal/`)

| File | Contents | Reference element |
|---|---|---|
| `layout.ts` | camera rig, sun direction, every placement, each with the reference pixels it was solved from | composition |
| `backdrop.ts` | `Backdrop`: sky dome sampling an HDR bake of the camera frustum (+10 %); massifs and cumulus towers placed by azimuth/distance; progressive strip refresh | sky, clouds, mountains |
| `materials.ts` | frosted petal glass, champagne glass, glass rod, cut crystal, clear glass, limestone, marble; scene environment capture | materials |
| `lightformers.ts` | capture-only softboxes (arched windows, sunlit opening) and the jewel environment of the cut crystal | reflections |
| `flower.ts` | `CrystalFlower`: 11 paddle petals, champagne orb, inlaid eyes, glass stem, cut leaves, crystal cluster, glass disc; opening intro and idle | central flower |
| `architecture.ts` | `Pavilion`: arched wall, parapet, steps, glass panels, sheer curtains | architecture |
| `floor.ts` | `MirrorFloor`: planar reflection shared by the marble floor and the pool | floor, water |
| `props.ts` | spheres, ledge on glass blocks, prism, pedestal + cut cube, bowl on blocks, vase + olive tree, distant olives | props, tree |
| `world.ts` | `SunShafts`: glare strips and soft beams | light |
| `post.ts` | `CrystalPost`: HDR target → three-level bloom → ACES → sRGB, written into the manager's main target | post-processing |
| `crystalEnvironment.ts` | `PlaygroundEnvironment`: assembly, lights, shadows, environment capture, adaptive resolution, precompile, `?debug=` modes | scene root |

Shaders: `webgl/shaders/backdrop.ts` (sky, terrain, clouds) and `webgl/shaders/crystal.ts` (material
patches, floor, pool, shafts, post).

## Integration points

| Where | What |
|---|---|
| `webgl/cameras.ts` | `modelCameraNode("playground")` returns the solved rig from `layout.ts` |
| `webgl/manager.ts` | `ensurePlayground()` builds and precompiles the pavilion before it joins the scene; render through `CrystalPost`; lighter grain on this route; `checkShaderErrors` off in production |
| `shell/LeoShell.tsx` | intro timeline, sibling prefetch (the pavilion is precompiled in idle time from other routes) |
| `shell/CursorIndication.tsx` | no "Click — to enable sound" pill on `/playground` |
| `views/PlaygroundView.tsx` | `HeaderBlock raised` (3D header) → hero (bee) → media rows → footer |
| `blocks/shared/HeaderBlock.tsx` | `raised`: the copy sits at the reference height |

## Development switches

`?debug=backdrop` (sky only), `lighting` (clay), `sun` (clay, sun only), `glass` (physical glass
without crystal stylisation), `composition` (bounds), `probe` (exposes `window.__crystal`) — all
ignored in production. `?quality=high` pins the adaptive resolution (used by `npm run screenshot`).
