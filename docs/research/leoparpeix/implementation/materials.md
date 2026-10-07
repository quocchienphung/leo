# Materials, renderers & WebGL pipeline — Léo Parpeix

Source: `raw/index-B1uQITYR.js`, prettified copy read line-by-line (line numbers below refer to
`npx prettier --parser babel` output of that file, 70 099 lines). Status tags follow the master prompt.

## Renderers / canvases (SOURCE_VERIFIED)

| Renderer | Class | Settings | Camera | Purpose |
|---|---|---|---|---|
| main | `sw` (WebGLRenderer) | `antialias:false`, `powerPreference:high-performance`, `premultipliedAlpha:false`, `outputColorSpace=SRGB`, `autoClear=false` | `jY` main camera (fov 22.9, near .01, far 500) inside pointer group inside model camera | Home/About environment, DOM-synced planes (sliders, flower bgs) |
| dom scene camera | `vY` | PerspectiveCamera fov computed so 1 world unit = 1 CSS px at z=2000; `position.y = -lenis.animatedScroll` | — | Sliders (`qY`), flowers (About), coloured section backgrounds |
| top | second renderer (`topRenderer`) | alpha, shadows (`shadowMap.type = PCFSoft`) | `KX` fov 45, z=5, y follows section scroll | Bees + fruits over hero/footer/playground |
| post | `hY` grain pass | `uNoiseStrength = gn() ? 0 : 0.07` hash21 noise on `gl_FragCoord` + time | ortho | Film grain (desktop only, ≥1025px) |

`gn()` = `window.innerWidth < 1025` (mobile/tablet layout branch).

## Colour pipeline — SOURCE_VERIFIED (line 193–195, 28195–28215, 60110)

- Asset manager `afterLoadCallback` for every KTX2/webp texture: `colorSpace = ""` (NoColorSpace),
  KTX2 also `flipY = false`.
- Renderer `outputColorSpace = "srgb-linear"` (LinearSRGBColorSpace) → **no output encoding**.
- Colours created with `setHex(hex, "srgb-linear")` are raw hex values.
- Net effect: baked atlas values reach the screen unchanged (no sRGB decode/encode round trip, no
  tone mapping). The clone mirrors this exactly (`webgl/assets.ts`, `webgl/manager.ts`).
- Ticker: `dt = min(Date.now() delta, 60ms)`, `et` = accumulated ms (line ~68420 `xN`).
- Main renderer DPR = `min(2, devicePixelRatio)`; top (bee) renderer uses `postDpr = 2`.

## Environment material (`i1`, line ~61162) — SOURCE_VERIFIED

Unlit. Fragment = `texture(uTexture, vUv)` (GLSL3). All lighting/shadows are **baked** into the
KTX2 atlases → do NOT relight with PBR lights.

- Every texture: `minFilter = magFilter = Linear`, `generateMipmaps = false` (`kh()`), colorSpace sRGB.
- KTX2 loader sets `flipY = true` for uncompressed types; Basis-compressed textures keep GLB UV
  orientation (GLB uv origin top-left; works with flipY=false which is what compressed tex use).
- `USE_TEXEL_MAX_CROSS` define for home `TexBibli, TexProps, TexWalls` and about `TexBook`
  → max of 5 texels (cross) via `texelFetch` — thickens thin dark lines? (it takes **max**, so it
  brightens/widens light pixels; removes dark seams). Needs `uTextureResolution`.
- `USE_HASH_BLUR` on desktop only (`!gn()`) for home `TexFloor` (radius 3) and about `TexGround`
  (radius 0) and `TexMobilier` (radius 3): 10-tap hash blur in texel units.
- Mesh → texture mapping: mesh `name.includes(textureName)`.

### Home (`WX`, line ~62711)
Textures: TexFleur, TexProps, TexMobilier, TexTableaux, TexBibli, TexFloor, TexWalls (TexDecor is
downloaded but not in the material list → INFERRED unused in v9).
Extras:
- Background sphere gradient `s1` (radius 1, BackSide): top `#B1C2CB` (11649739), bottom `#C2BEAE`
  (12763054), smooth 0→1, position (-10,3,0), scale (16, gn()?8:4, 16).
- Clouds `f1`: count 25, rangeX 19, rangeY 13, rangeZ 20, tint `#F7EFE4`, randomScale
  `(rand*.25+.85)*10`, translationSpeed .5, deformationSpeed 1, position (-10,3,0). Instanced
  quads rotated Y 90°, 6 cloud PNGs, noise-texture UV wobble, z wraps in ±rangeZ.
- Dust particles `QX` (Points): 2000, area (.1,.15,.5) × randFloatSpread(50), displacement
  (0,0,-8.2), displacementSpeed .04, deformation amp (0,.25,0) freq (.3,.2,.3) speed .001,
  pointSize `10*aScale*uScale` (scale gn()? .49 : .7), colour `#F4F1EB` (16052459), fade in/out on
  life, position (3,3,0).

### About (`LX`, line ~62249)
Textures: TexBook, TexFleur, texMontagne(png), TexGround, TexRock, TexProps, TexDecor, TexMobilier,
TexArbresFront, TexArbresBack.
- Trees (`sX`): wind vertex shader using `_centerposition` attribute; `pos.z -= sin(height + t*.002*speed + phase)*.025` above centre.
- Mountain (`cX`): `flipY=false`, BackSide, transparent, alpha × `smoothstep(.3,.4,vUv.y)`; mesh y = -10.
- Background gradient sphere: top `#90B8D9` (9484505), bottom `#D0DADA` (13687514), smooth .15→.663,
  position (-300, 86.8, 0), scale (.1, 65.5, 320).
- Clouds: count 45, rangeX 2, rangeY 50, rangeZ 350, tint white, randomScale 100, translation 3,
  deformation .75, position (-250,40,0), rotation.z -.085.
- Leaves `EX` ×2 (instanced MeshPhong-derived with texture `leaves.webp`): 500 each, area
  (4,.18,.5), displacement (-15,-7,±14.4), speed .1, deformation amp (0,.8,0) freq (.3,.125,.3)
  speed .00125, scale .8, rotationSpeed 6e-4; positions (-60,0,15) / (-70,0,-15).
- Lights: AmbientLight white 1; PointLight white 1 at (-32.61, 8.7, 17.39) (only affect leaves).
- Water reflector `MX`: plane rotated -90° X, scale 275, position (-132.416,-3.7,0); render target
  1024², MSAA 4, update every 3 frames, clipBias .03; waveStrength .2, waveSpeed .1, contrast .72,
  saturation 1, brightness 1.22, blurRadius `.239` desktop / 0 mobile, noiseRepeat 40.3,
  deformation texture `waterDeformation`, noise texture `noise`.

## Cameras (SOURCE_VERIFIED, line ~61089 / 62880 / 63099)

Hierarchy: **model camera `XX`** (copies GLB node `camera` position/rotation/fov/near/far)
→ **pointer group `qX`** (rotation lerp toward pointer; forceX .2 on rotation.x from pointer y,
forceY .75 on rotation.y from -pointer x; coef 2 → `1-exp(-2dt)`; disabled for coarse pointer
`ii()`) → **main camera `jY`** (position/rotation offsets from scroll).

- `jY.setZoom`: home `gn() ? .67 : 1`, about `gn() ? .89 : 1`.
- `setScrollHeaderPositions(scroll, rect, rangePos, rangeRot, offsetPos, offsetRot)`:
  `pos = -clamp(scroll/rect.height * range, 0, range) - offset` (only while `isOnHeader`).
- `setScrollSectionPositions`: progress = map(scroll, [rect.y - innerHeight, rect.y + rect.height], [0,1]);
  `pos = -progress*range - offset`; `isOnHeader = (y >= 0)`.
- Home header params: range pos (0, 2.4, 4), offsets 0. Home webgl interlude ("Focus on…"):
  range pos (0,2.75,0), offset pos (0,2.75,0).
- About header: range pos (0,1.89,6.9), offset pos (0,1.1,1), offset rot (-.1,0,0).
  About cards (experiences): range pos (0,2.75,0), offset pos (0,3.75,4.25).
- `XX.show(route, initial)`: home → `position.x` from `cam.x + (initial?7:5)` to `cam.x`; about →
  from `cam.x + 8`; duration `initial ? 2.5 : 2`, ease `initial ? expo.inOut : expo.out`.
  `hide`: home → `cam.x + 6`, about → `cam.x - 4`, .5 s `sine.out`.
- `Dh.INITIAL_LOAD = { duration: 2.5, ease: "expo.inOut", from: .65 }` (line 49193).

## DOM-synced plane scene (`qY`, line ~60273)

- Section background colours: home `(0.9686…)` = `#F7F7F7`, about `(0.031,0.239,0.165)` = `#083D2A`,
  playground `(0.965,0.878,0.086)` = `#F6E016`.
- Slider media material `IY`: cover-fit UV with `uCoverBleed = gn()?1.155:1.05`, parallax
  `uv.y += uParallaxProgress*.085`, `uv.x += uParallaxX*.085`, `uv.y = 1-uv.y`; vertex pushes
  z back by `smoothstep(0,5.5,length(vec2(screenX, position.y))) * dragForce * (gn()? .5 : 1.5)`.
- Slider physics (`onRender`): currentDrag += delta.x × dragMultiplier; clamp [0, (n-1)·w];
  delta decays by deltaDecay; dragForce from |delta| with smoothing; when not dragging and force <
  snapThreshold → snap to nearest index with `lerp(…, 1-exp(-snapLerp·dt·60))`.
  Plane spacing = width + gap (`bp()`).
- About flowers (`addFlowers`): flower_v2.glb with `flowerTex`, MeshPhong-like `Cc` (MeshLambert?)
  material, lit by PointLight (z=-400) moving between flower keyframes + Ambient .9; spring tilt
  (UY .2 stiffness, GY .9 damping), spin impulse, rotation.z = progress×3×random.

## Page-transition shader injection (line ~66262)

Circle reveal: `visibility = step(transition, length((screenUv-.5)·aspect))` → objects inside the
circle of radius `uTransition` are discarded. Applied to bee/fruit materials.

## Postprocessing (line ~59942–60100)

- Grain: `render.rgb += (hash21(fragCoord + t·(.017,.013)) - .5) * .07` (desktop).
- Fluid velocity distortion pass (`mY`): `uv += vel * .003`, blur radius `velMag*15` (hash blur 15
  taps). Active only when `C.webgl.usesFluidEffects()` — UNVERIFIED which routes/devices.

## three.js version gap — SOURCE_VERIFIED (bundle line 61: `REVISION "153"`)

The source ships three **r153** with the default `useLegacyLights = true`. The clone runs r186
(physically based light units only). To keep lit materials (bee/flowers/leaves = MeshPhong,
fruits = MeshStandard) identical:

- every light intensity is multiplied by π (r153 `WebGLLights` legacy `scaleFactor = Math.PI`);
- PointLights use `decay = 0` (r153 legacy attenuation with `distance = 0` ⇒ no falloff);
- chunk `output_fragment` was renamed `opaque_fragment`; page-transition injection targets the
  r186 name (`webgl/top/transitionMaterial.ts`).

Helper: `legacyIntensity()` in `webgl/lights.ts`.
