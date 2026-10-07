# Playground — crystal pavilion: visual deconstruction

Reference: `docs/design-references/playground-crystal-reference.png` (1672 × 941, user sketch, 2026-10-07).
Coordinates below are reference pixels (x right, y down). Colours were sampled as 7 × 7 averages.

## 1. Camera

| Measure | Value | How |
|---|---|---|
| Flower head centre (orb) | (820, 370) → 49 % / 39 % | measured |
| Flower total height | top petal 140 → crystal base bottom 870 (78 % of height) | measured |
| Petal span | x 583 → 1067, y 140 → 578 | measured |
| Horizon (eye level) | ≈ y 590: parapet top (y 655) and steps are seen from above, mountain bases at ≈ 600 | inferred |
| Solved rig | vertical FOV 36°, camera 8 units in front of the flower, eye height 1.52, pitched up 4.7°, 0.08 to the right | flower base (y 0) on v 870; placements use the exact projection in `REFERENCE_MEASUREMENTS.md` (orb centre y 2.72) |

The reference is a crystal reinterpretation of the home workshop daisy (same pose and proportions, ≈ 181 px per
unit at the flower), but with 11 petals and a crystal cluster; the playground builds it procedurally.

## 2. Composition (depth layers)

| Layer | Elements |
|---|---|
| Foreground (d ≈ 6–9) | wet marble floor + shallow pool, crystal base and its glass disc, big clear sphere (lower left, centre (62, 795), r 68 px), glass blocks lower right, marble ledge on glass blocks (left), vase + olive tree, small orb, glass prism |
| Midground (d ≈ 8–14) | crystal daisy (d 8), sheer curtains (left, d ≈ 9.5), tall glass panels (d ≈ 11), right glass pedestal + crystal octahedron (d ≈ 10), floor orb (d ≈ 13), colonnade: left pier x 445–600, central arch opening x 600 → 1300, right pier x 1300–1430, small left arch x 290–445, parapet top y 655, steps x 420–650 |
| Background | green hills (d ≈ 40), blue-grey ranges (d 60–90, peaks at (390, 400), (1170, 415), (1600, 330)), sea of clouds y 500–620, big cumulus right (x 1100–1672, y 150–450), sky |

Negative space: the whole upper third between the arch jambs is plain sky; nothing overlaps the flower head.

## 3. Central flower

| Part | Reference | Build |
|---|---|---|
| Head | 11 petals, one straight up, a gap at 6 o'clock where the stem shows; tips 1.27 above, 1.31 beside, 1.14 below the centre | smooth paddle petals (dense reshaped sphere: narrow rounded root, fuller outer third, semicircular tip, pillow section, cupped tips), lengths per angle, ±1.25° / ±2.5 % jitter, alternating depth |
| Material | milky frosted glass, neutral light grey in front of the sky, fine glitter, glossy shell, bright rims | `MeshPhysicalMaterial` transmission 1, roughness 0.32, clearcoat 1, milky transmission (0.24) with a darker rim, back-lit translucency, object-space glitter |
| Centre | champagne orb (#f6d6aa centre, #e9c995 rim), glowing from inside | sphere r 0.47 (0.82 deep), champagne transmission + inner glow, golden attenuation at the rim, clearcoat |
| Face | two vertical rounded eyes (≈ 17 × 34 px, warm dark brown), no mouth | capsules inlaid on the orb surface along its normal, calm blink |
| Stem | clear glass rod, ≈ 22 px wide, slight S | tapered tube (r 0.068 → 0.058) along the measured line, glass rod with a little internal glow |
| Leaves | two brilliant-cut leaves with rainbow fire | volumetric cut leaf (midrib, two facet rows per side, girdle), cut-crystal shading |
| Base | faceted crystal block x 705–965, y 725–870, in the pool on a thin glass disc (x 645–1000) | convex-hull crystal cluster (one broad block + six stones), cut-crystal shading, glass disc r 0.98 |

## 4. Architecture

- Pale limestone / plaster, warm ivory in light, #b1a59f in shade. Semi-circular arches (not Gothic).
- Central arch opening 6.8 units at d 14, springing above the frame; small left arch 1.5 wide.
- Low parapet (top 0.9) running behind the pool and continuing right of the right pier, a plinth and two steps on the left.
- Glass: two tall clear panels on the left (rainbow streaks), a slab on the right pier catching the sun.
- Sheer white curtains on the far left, almost still.

## 5. Materials

| Surface | Look |
|---|---|
| Frosted glass (petals) | milky, soft, internal glow, sparkle |
| Crystal (leaves, base, props) | polished, sharp refraction, restrained rainbow dispersion |
| Clear glass (panels, blocks, bowl, vase, spheres) | thin, reflective, slight tint |
| Limestone | rough 0.85, micro grain, warm variation |
| Marble floor | pale cream tiles, polished, wet; strong sun reflections (#f8e1c9 in the light) |
| Pool | shallow water, very slow ripple, reflects sky and crystal (#b2c1c8) |

## 6. Lights

- Sun from the right, almost square to the view, ≈ 27° high (right edges lit, fronts grazing, glare on the right pier). Warm cream.
- Low sky fill and a warm bounce from the floor side.
- Image-based light: the pavilion itself captured from the flower (sky, sun disc, ranges, stone, marble) with
  capture-only lightformers (arched windows, sunlit opening); cut crystal uses its own jewel surround.
- No shadows from glass (it would cast solid shadows); stone and trees cast them.

## 7. Background

- Sky #a0bcd5 top left → #b1c8db middle → #dae2eb hazy and warm near the sun (top right).
- Clouds: warm ivory lit side #e9ddd5, neutral grey shade #b7b8b7; billowing cumulus banks right of the daisy, a sea
  of clouds in the valleys, small puffs through the left arch.
- Mountains: far ranges #a7b2ba (blue haze), nearer slopes muted green, strong atmospheric perspective.

## 8. UI

Already provided by the shell (real DOM): brand, subtitle, nav with active underline, sound bars; header copy
bottom left at x ≈ 18 % (home `HeaderBlock` puts it at the same column). The playground uses the reference copy
("Clean code. Scalable systems. Smarter models."), set higher than on home (`HeaderBlock raised`: description top
≈ 73 % of the height, "Scroll down" ≈ 88 %). No audio onboarding pill.

## 9. Motion

- Intro: the camera dolly of the other routes (`ModelCamera.show`) and the petals opening.
- Idle: head floats ±0.018 over 7 s and rolls ±0.25°, petals breathe ±0.5 % out of phase, leaves sway ±0.45°, eyes blink every 4–7 s, curtains drift a few pixels, pool ripples slowly, clouds drift and evolve (minutes to cross the arch).
- Pointer: the existing pointer camera rig (±0.75° yaw, ±0.2° pitch, damped) plus a slight highlight change.
- Scroll: the shared header dolly (forward and down towards the pool).

## 10. Responsive

- ≥ 1025 px: the composition above.
- < 1025 px: camera zoom 0.62 so the head fits portrait screens; far props drop out of frame naturally; tree leaves and reflections are cheaper.
