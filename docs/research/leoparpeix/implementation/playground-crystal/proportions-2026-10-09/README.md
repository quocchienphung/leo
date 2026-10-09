# Main flower proportions — 2026-10-09

The Playground daisy now follows the Work/About sculpt's proportions. The crystal materials,
facet cuts, palace, supporting flowers and measured Work scroll translation are preserved.

The supplied crops suggested a larger Playground subject. Comparing actual mesh vertices at
the same viewport confirmed that its crown was 23.4% wider in world space and about 22% wider
on screen than Work. The whole plant was only about 4% taller: uniformly shrinking it would
have shortened the stem and left the crown/core/leaf proportions inconsistent.

## Geometry changes

Measurements come from live `TexFleur` geometry in the local Work and About scenes, excluding
the removed eye/moustache decal indices. Work has separate front/back petal shells; About
uses the same sculpt at another scale. Their core/crown diameter ratios both measure ≈0.379.

| Part | Previous Playground | Updated Playground / Work target |
|---|---:|---:|
| Crown width | 2.880 | 2.334 |
| Petal length | 1.080 | 0.800 |
| Petal maximum width | 0.600 | 0.430 |
| Core diameter | 0.980 | 0.8854 |
| Core front bulge | 0.4018 | 0.2435 |
| Head centre height | 2.740 | 2.851 |
| Right / left leaf length | 1.120 / 0.820 | 0.850 / 0.850 |
| Rock height, desktop hull | 0.728 | ≈0.839 |
| Disc radius | 0.980 | 0.820 |

All twelve petals now have equal length; the old 14% shortening of lower petals is removed.
Leaf attachment heights follow Work's staggered pose. Stem and head depth offsets are corrected
for the pavilion stage origin at world X=2.75. The stem retains its original diameter and height.
The base becomes taller with almost the same footprint, rather than a wide, low dome.

Work and Playground now share mobile camera zoom 0.67 (previous Playground: 0.62).
Desktop zoom remains 1; the camera rig, lens and scroll motion are unchanged.

## Evidence and validation

- `before/`: desktop Work, About and Playground at 1672×941, plus vertex/projected bounds.
- `after/`: the same routes at 1672×941, 2559×1276 and touch mobile 390×844.
- `after/runtime.json`: component bounds, camera state, cross-route dimensions and browser errors.
- `comparison-subject.png`: Work / previous Playground / updated Playground at the same crop.
- `comparison-desktop.png`, `comparison-mobile.png`: complete scene framing.

Run `node scripts/capture-crystal-proportions.mjs after` with the dev server on port 3000.
Run `node scripts/compare-crystal-proportions.mjs` to rebuild the comparison images.
The script uses visible navigation links and the mobile menu. It verifies twelve petals and
compares world crown width/height, core diameter, whole-plant height, projected crown size and
About's core/crown ratio, allowing 2.5% for differences in pose, projection and idle animation.
This verifies proportion matching, not identical surface geometry: the hero remains a
procedural crystal flower with cut leaves/base and a smooth frosted crown.

Production validation: `npm run check` (ESLint, TypeScript, Next production build).

Measured updated crown widths on screen: Playground / Work = 451.73 / 452.46 px (desktop),
612.52 / 613.54 px (wide), 271.45 / 271.90 px (mobile), all within 0.2%.
Whole-plant world heights differ by less than 0.4% (projected heights: less than 0.7%);
the small variation comes from crystal idle motion and the different base surface.
About retains its existing floating pose and scale, with the same core/crown proportion.

Real-wheel scroll/reverse-scroll frames with the updated model are in
`../scroll-2026-10-09/proportions/`: 0, 200, 452, 753, 941, 1317 and 1694 px, then back to 0.
The camera retains zero scroll rotation and stays above the floor; no browser errors or overflow.
