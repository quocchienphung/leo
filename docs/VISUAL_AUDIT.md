# Visual audit — playground crystal daisy

- IMAGE A (target): `docs/design-references/playground-crystal-reference.png` (= `qa/target.png`), 1672 × 941.
- IMAGE B (failed baseline): `qa/baseline-failed.png`. `qa/pass0-current.png` is the same scene re-rendered at the
  start of the second session: the corrections planned in the first audit had not been implemented.
- Material board: the user's sheet (frosted petal, champagne centre, matte dark eye, faceted leaf, crystal cluster,
  limestone, polished marble, shallow water, volumetric clouds, sunlight from the right, glass props).
- Measurements: `docs/REFERENCE_MEASUREMENTS.md`. Component map:
  `docs/research/leoparpeix/implementation/playground-crystal/SCENE_COMPONENT_MAP.md`.
- QA: `npm run screenshot` → `qa/current.png` at 1672 × 941 (`?skipLoader&quality=high`).

## 1. Frame, composition, camera

- **Frame:** 1672 × 941, 16 : 9. Large negative space: the upper half between the arch jambs is sky.
- **Focal hierarchy:** daisy → central arch → mountains and clouds → crystal props → floor reflection → text.
- **Camera:** eye level 1.52, vertical FOV 36°, pitched up 4.7°, 8 units from the daisy. Verticals stay vertical.
- **Visual centre:** the orb at (49 %, 39 %); the head spans 29 % of the width.
- **Horizon:** ≈ 63 % down; the parapet top is at 69.6 %.
- **Light:** sun from the right, almost square to the view: right petal edges, the cube, the arch jamb and the
  spheres are lit; fronts get grazing light; glare on the right pier.
- **Depth layers:** glass props → pool and base → daisy → colonnade → forested foothills → ranges → sea of clouds →
  cumulus → sky.

## 2. Material families

| Family | Where | Look |
|---|---|---|
| Frosted milky glass | petals | neutral light grey body, fine glitter, glossy shell with window highlights, darker refracted rim |
| Champagne glass | orb | honey centre glowing from within, deeper gold at the rim, glossy |
| Clear optical glass | stem, vase, bowl, orbs, panels, pedestal | almost invisible, bright rims, refraction |
| Cut crystal | leaves, base, cube | dark and brilliant facets side by side, restrained amber-to-blue fire, glints |
| Limestone / plaster | arches, piers, parapet, steps | warm ivory, smooth, soft shadow |
| Polished marble + water | floor, pool | warm white, reflective; calm blue-grey water |
| Vegetation | olive tree, far trees | muted olive, small narrow leaves |

## 3. Current (IMAGE B / pass 0) vs target, and what was done

| # | Current problem | Target characteristic | Correction made |
|---|---|---|---|
| 1 | Washed out, flat, grey; heavy grain | Warm sunlit pavilion, clear light hierarchy, clean | Sun moved from behind the colonnade (every visible face was in shade) to the right; warm sun, low fill, scene-captured environment; ACES exposure calibrated region by region; three-level bloom; grain 0.07 → 0.012 on this route |
| 2 | Clouds: flat cut-out sprites | Large billowing cumulus, grey undersides, haze | Raymarched volumetric cumulus (7-puff cauliflower clusters, self-shadowing, two-octave multiple scattering) + sea of clouds in the valleys, baked progressively into an HDR sky texture |
| 3 | Mountains: flat poster strips | Smooth atmospheric ranges, forested near slopes | Raymarched eroded heightfield with placed massifs, forest canopy texture, altitude haze |
| 4 | Petals: pale blue balloons, 12 of them | 11 milky glass paddles, gap at the bottom where the stem shows | 11 smooth paddle petals (dense reshaped sphere, pillow section, cupped), lower petals shorter as measured; milky transmission + back-lit translucency + glitter + clearcoat |
| 5 | Leaves: thin grey slabs; base: crude pile | Brilliant-cut crystal leaves and cluster | Volumetric cut leaves (midrib, two facet rows, girdle); convex-hull crystal cluster; per-facet internal sunlight, fire, glints, cut seams; dedicated jewel environment |
| 6 | Eyes slanted (bloub montage) | Two calm vertical dark capsules | Inlaid capsules on the orb surface, calm blink only |
| 7 | Orb: flat cream disc | Translucent champagne sphere | Champagne glass with inner glow and golden rim |
| 8 | Stem: invisible | Thick bright glass rod | Tapered solid glass rod with a little internal glow |
| 9 | Architecture grey | Warm ivory limestone | Warm limestone, sunlit jambs, glare on the right pier glass |
| 10 | Floor flat; pool with a thick white curb | Polished marble, calm blue-grey water, fine lip | Pool re-solved from the reference (x −2.8 → 3.9, z −3.4 → 0.5), fine lip, cooler water, higher floor reflectivity |
| 11 | Tree: noisy dark twigs | Elegant olive in a glass vase | Graceful forked olive with 2 800 instanced lanceolate leaves, per-leaf tone |
| 12 | Right sculpture: octahedron | Cut cube balanced on an edge | Chamfered cut cube, diamond outline |
| 13 | "Click — to enable sound" pill | No audio onboarding | Sound pill never shown on `/playground` (other cursor labels unchanged) |
| 14 | Copy "Welcome on my code playground.", too low | "Clean code. / Scalable systems. / Smarter models." at y ≈ 690–826 | Reference copy; `HeaderBlock raised` lifts it to the measured position |

## 4. Highest-impact changes (in the order they were made)

1. Procedural daisy in the stage frame (11 petals, orb, eyes, stem, leaves, base) placed with the exact projection.
2. Raymarched sky, cumulus, sea of clouds and ranges, baked progressively.
3. Physically based glass with milky transmission, translucency, lightformers in the environment capture.
4. Sun direction and tone calibrated against region statistics of the target.
5. Cut-crystal shading (jewel environment, internal sunlight, fire, seams).

## 5. QA log (1672 × 941)

Region statistics (mean RGB and luminance ± std over 14 regions) were compared with the target after every pass.

| Pass | Change | Result |
|---|---|---|
| 0 | Starting point | Same as IMAGE B |
| 1 | New flower, backdrop, materials | Real mountains and clouds; popcorn cloud layer (field bug) |
| 2 | Copy + position, tone | Copy matches; frame washed out (bloom haze, +15–20 levels) |
| 3 | Exposure, warmth, fill | Piers, base, floor within a few levels |
| 5–7 | Lightformers, 11 petals, glass rod stem | Petals read as glass; stem visible; crystals still white |
| 8 | Forested hills behind the leaves, pool re-solved | Crystals pick up darker landscape |
| 11 | Sun moved to the right | Light hierarchy appears (flat look was the sun behind every visible face) |
| 12–20 | Crystal: barycentric seams, internal sunlight, jewel environment, larger facets | From white plaster to cut crystal |
| 21–24 | Three-level bloom, clearcoat glass, curtains, tree, glare; six reversed `smoothstep` calls fixed | Warm, glowing frame |
| 25–31 | Sliver facets removed (2 × 2 derivative noise), light-march jitter, puff cumulus, cloud contrast | Clean crystal, real cumulus |
| — | Performance and first frame (see below) | 35 fps (DPR 1) / 32 fps (DPR 2, adaptive) on an AMD 680M |

Milestone renders: `qa/pass2.png`, `qa/pass11.png`, `qa/pass21.png`, `qa/pass31.png`, `qa/current.png`,
production build `qa/prod.png`, phone `qa/mobile.png` (390 × 844).

## 6. Performance and loading

- Sky: raymarch baked once at load, then refreshed one strip per frame (320 strips, blended) for slow drift.
- Shadow map rendered once (nothing that casts moves); refraction buffer at 0.45×; floor mirror every other frame.
- Adaptive resolution of the HDR pass (0.85× CSS → full DPR) from the frame time; `?quality=high` pins it.
- Shaders are compiled with `compileAsync` before the pavilion joins the scene; every material holds a same-size
  placeholder environment so the captured one does not trigger recompiles. On Windows/Direct3D the first visit
  still spends ≈ 6 s compiling in the background (main thread free, behind the loader); Chrome caches the result.

## 7. Remaining gaps against IMAGE A

- Cut crystal is convincing but a little metallic; the reference's crystal shows more of the landscape through it.
- The floor is less mirror-like than the reference and shows no sun streaks.
- The sheer curtains on the far left are faint.
- The reference is an illustration with some physically inconsistent light (glow on surfaces facing away from the
  sun); the reconstruction keeps one consistent sun and approximates the glow with bloom and glare strips.
