# Remaining differences (honest list)

| # | Difference | Impact | Evidence | Next action |
|---|---|---|---|---|
| 1 | three.js r186 instead of r153: lights rescaled ×π, point lights `decay 0`; `PCFSoftShadowMap` was removed → `PCFShadowMap` | minimal: fruit shadow edge marginally crisper (3× zoom crop compared) | `shots/shadow.jpg` | try `shadow.radius`/VSM tuning against source crops |
| 2 | Browser back/forward: the clone snaps the transition disc to "covered" then plays the reveal; the source router animates the cover before swapping | first ~0.75s of the transition | nav tests | intercept `popstate` before Next swaps (needs router event hook) |
| 3 | Source 404 view (bee "Page not found") not cloned; Next default 404 | only unknown URLs | — | out of the 3-route scope |
| 4 | Lenis 1.3 vs vendored 1.0.x | touch inertia constants may differ slightly | — | compare on a real touch device |
| 5 | Random content (bee phrases, fruit order resets, cloud placement, particle seeds) | per-visit variation — same as source | screenshots | none (matches source behaviour) |
| 6 | Videos are mid-playback in captures | frame-level mismatch only | archive / reel shots | none |
| 7 | Headless capture uses Chromium on Windows/ANGLE; not verified on Safari / real iOS (`isSafari` branches: fruit ground z, slider scroll-into-view disabled, close button style) | unverified on Safari | — | test on macOS/iOS |
| 8 | About: library→green boundary differed by ~10px in one 1440×900 capture at scroll 6300 while DOM rects are identical | likely Lenis settle timing in capture | `shots/cmp-about-2.jpg` | recapture with longer settle |
| 9 | Reduced motion: source has no `prefers-reduced-motion` handling; clone mirrors that | accessibility | — | optional enhancement outside 1:1 phase |
| 10 | **Displayed copy intentionally changed** (user request, 2026-10-07): all text rewritten as a software-engineering portfolio (front end, back end, load balancer, AWS, ML / deep learning / computer vision). Name placeholder `Peanutto`, email `hello@example.com`, external links → github.com. Layout, images, video, WebGL and animation untouched; item counts and per-block line counts kept so every block rect still matches the source at 1440×900 and 390×844 | copy only | block-rect measurement on all 3 routes, both viewports | replace placeholder identity in `data/global.ts`; credits panel keeps attribution to the original design (Léo Parpeix) and development (Thoma Lecornu) |
| 11 | **Daisy faces (home hero + About) intentionally replaced** (user request, 2026-10-07) by bloub's animated eyes (expressions, states, blink, pointer follow); sculpted face decals removed and the painted face repainted in shader. Everything else in the scene untouched | hero daisy only | `flower-eyes.md` (port verified frame-by-frame against bloub's own code) | — |

No metric "% match" is claimed. Geometry was compared by DOM rect (exact), visuals by side-by-side
frames at identical viewport/scroll/input, intro timing by frame-coverage curves.
