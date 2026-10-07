# State matrix — source vs clone

Evidence = Playwright (Chromium 147, real GPU path) captures in the session scratchpad
(`shots/*`, `cast/*`), source and clone driven with identical input. ✅ = visually equivalent at the
same viewport/scroll/state.

| Scene / control | Trigger | Before → after | Viewports | Result |
|---|---|---|---|---|
| Loader → card → workshop | cold load | white → texts → rotated card → full scene + dolly | 1440×900 | ✅ timing within 40 ms |
| Header 3D dolly | wheel 0→1800 | camera up/forward, copy pushed + faded | 1440, 2048, 390 | ✅ |
| Camera parallax | pointer to corners | scene rotates toward pointer | 1440 | ✅ |
| Fluid trail | fast pointer sweep | warped/brightened trail on canvas | 1440 | ✅ |
| Hero fruit at cursor | pointer in hero zone | orange follows cursor, tilts with speed | 1440 | ✅ |
| Feed the bee | click in zone | fruit falls/squashes, bee seeks, titles flip to "CREATIVE / PASSIONNATE / ART DIRECTOR", next fruit = grape | 1440 | ✅ |
| Nav hover / current | hover links | underline grows | 1440 | ✅ |
| Watch reel | hover preview | "WATCH REEL" pill | 1440 | ✅ |
| Showreel open/play/idle/timeline/pause/close | click / move / hover / click | white mask, scale-in, play bubble, timeline pill, green contrast on pause, close | 1440 | ✅ (fixed: stale pill after close) |
| Project slider | drag 400px | depth push, inertia, snap to next slide | 1440 | ✅ identical positions |
| "Focus on…" library | wheel | camera pans library, char reveal | 1440, 1024, 390 | ✅ |
| Archives hover / open / close | hover row / click | mask in, row expands with copy + media + link, collapses | 1440 | ✅ |
| Credits | hover / click | yellow corner, panel slides in, overlay | 1440 | ✅ |
| Email | hover / click | "Copy to clipboard" beige pill → "Copied" | 1440 | ✅ |
| About landscape | load / wheel | flower in pot, water reflection, trees, clouds | 1440, 390 | ✅ |
| About flowers | pointer swipe | daisies spin/tilt, light sweeps | 1440 | ✅ (impulse sign may differ per sample) |
| Experiences card | wheel | card over library window scene | 1440, 390 | ✅ |
| Playground hero zoom | load / transition | titles + bee zoom in | 1440 | ✅ |
| Content bee path | wheel 0→7400 | bee dives into grid, lands, takes off before footer | 1440 | ✅ identical positions |
| Content bee speech | idle / hover / click | idle teaser, hover phrase, conversation pill | 1440 | ✅ (phrases random by design) |
| Page transition | navbar Work/About/Playground | green disc + daisy, route swap | 1440 | ✅ |
| Back / forward | history | instant cover → reveal | 1440 | ✅ (source animates the cover; clone snaps cover, see differences) |
| Mobile menu | burger | white panel, big links, Lab, email | 390×844 touch | ✅ |
| Landscape phone | 844×390 touch | "Rotate your device" | — | ✅ |
| Wide screen | 2880×1400 | grid capped at 2560 | — | ✅ |
| 1024 / 1025 boundary | resize | tablet branch (8 cols, zoom .67) vs desktop | — | ✅ |
| Geometry | DOM rects | every block top/height | 1440×900 (3 routes) | ✅ identical px |
