# Reference measurements — playground crystal daisy

Target: `docs/design-references/playground-crystal-reference.png` (IMAGE A), 1672 × 941 (16 : 9).
Measured on a 100 px / 50 px grid overlay. Percentages are of the viewport width (x) and height (y).

## Flower

| Item | Pixels | Percent |
|---|---|---|
| Petals | 11, one straight up; a gap at 6 o'clock shows the stem | — |
| Petal ring bounding box | x 583 → 1067, y 140 → 578 | x 34.9 → 63.8 %, y 14.9 → 61.4 % |
| Head width | 484 px | 28.9 % of width |
| Head centre (orb) | (822, 365) | (49.2 %, 38.8 %) |
| Orb diameter | ≈ 170 px (x 738 → 906) | 10.2 % of width |
| Eyes | (818, 363) and (858, 358), each ≈ 14 × 34 px, vertical | spacing 2.4 % of width |
| Stem | x ≈ 810 → 832, y 455 → 735 | — |
| Left leaf | x 700 → 815, y 597 → 695 | — |
| Right leaf | x 845 → 1000, y 578 → 712 | — |
| Crystal base | x 705 → 965, y 725 → 870 | x 42.2 → 57.7 %, y 77.0 → 92.5 % |
| Glass disc under the base | x 645 → 1000, y ≈ 850 → 872 | — |
| Whole flower | y 140 → 870 | 77.6 % of height |

## Architecture

| Item | Pixels | Percent |
|---|---|---|
| Central arch opening (jambs) | x 600 → 1300, springing above the frame | x 35.9 → 77.8 % |
| Left pier (cream) | x 445 → 600 | x 26.6 → 35.9 % |
| Right pier | x 1300 → 1430 | x 77.8 → 85.5 % |
| Small left arch opening | x 290 → 445, crown at y ≈ 0–60 | x 17.3 → 26.6 % |
| Sheer curtains | x 0 → 290 | x 0 → 17.3 % |
| Parapet top | y 655 | 69.6 % |
| Steps (left) | x 420 → 650, y 650 → 740 | — |

## Horizon, light, background

| Item | Value |
|---|---|
| Eye level (horizon) | ≈ y 590 (62.7 %): parapet and steps seen slightly from above |
| Sun | beyond the right edge, a little behind and ≈ 30° high: glare on the right pier, highlights on the right side of the petals and crystals, bright streaks on the floor |
| Sky | #a0bcd5 top left → #b1c8db mid → #dae2eb hazy and warm near the sun |
| Clouds | big cumulus x 1100 → 1672, y 150 → 450; sea of clouds y 500 → 620; lit #e9ddd5, shade #b7b8b7 |
| Ranges | peaks (390, 400), (1170, 415), (1600, 330); green slopes lower right y 530 → 650 |

## Props

| Item | Pixels |
|---|---|
| Big clear sphere | centre (62, 795), r 68 |
| Vase (bell jar) + olive tree | vase x 0 → 135, y 510 → 650; tree up to y ≈ 140, x 0 → 285 |
| Small orb on the ledge | (288, 600), r 27 |
| Vertical glass prism | x 280 → 380, y 510 → 650 |
| Glass table / ledge | x 0 → 420, y 625 → 810 |
| Right pedestal | x 1365 → 1512, y 515 → 770 |
| Crystal cube on its corner | x 1365 → 1505, y 378 → 515 |
| Floor orb | (1335, 710), r 48 |
| Glass bowl | x 1528 → 1672, y 595 → 695, on glass blocks x 1465 → 1672, y 690 → 880 |

## UI

| Item | Pixels |
|---|---|
| Brand "Peanutto" | x 50, baseline ≈ 64 |
| Subtitle | x 303 |
| Nav | Work x 1350, About 1415, Playground 1485, sound bars 1595; y ≈ 58 |
| Headline (3 lines) | x 303, y 690 → 785, ≈ 28 px, line height ≈ 33 px |
| "Scroll down" | x 303, y ≈ 819; chevrons below at y ≈ 880 |

## Solved camera and placements (see `webgl/env/crystal/layout.ts`)

Vertical FOV 36° (f = 1448 px), camera 8 units in front of the flower, eye height 1.52, pitched up 4.7°, 0.08 to the
right. Exact projection used for every placement (stage frame, z towards the camera):

    forward = d·cos 4.7° + Δy·sin 4.7°,  up = Δy·cos 4.7° − d·sin 4.7°
    v = 470.5 − 1448·up / forward,       u = 836 + 1448·(x − 0.08) / forward

| Item | Reference | Solved |
|---|---|---|
| Orb centre | (820, 370) | y 2.72 |
| Petal tips | top v 140, bottom v 578, left u 583, right u 1067 | 1.27 above, 1.14 below, 1.31 beside the centre |
| Eyes | (816, 365), (860, 357), 17 × 34 px | x −0.02 / 0.22 on the orb face (its front reads ≈ 12 px high) |
| Left leaf | base (810, 695) → tip (700, 600) | (−0.06, 0.95) → length 0.82 at 50° |
| Right leaf | base (850, 712) → tip (1000, 580) | (0.16, 0.85) → length 1.12 at 48.6° |
| Crystal base | u 705 → 965, top v 725 | x −0.64 → 0.78, top y 0.78 |
| Pool | far edge v 785, left u ≈ 430, right border (1175, 800) → (1390, 830) | x −2.8 → 3.9, z −3.4 → 0.5 |
| Cube on its edge | u 1365 → 1505, v 378 → 515 at d 10 | side 0.68, centre y 2.51 |
| Sun | right edges lit, fronts grazing | direction (0.88, 0.45, 0.12), ≈ 27° high |

Background (km, eye 0.9 km above the valley datum; a summit at elevation e and distance d is 0.9 + d·tan e high):
peaks (1600, 330) → az 27.8°, (1170, 415) → az 13°, (390, 400) → az −17°; cumulus banks az 11°–36°, base 2 km.
