# Motion spec (source-verified, clone-verified)

Status legend: SV = SOURCE_VERIFIED (bundle line), OBS = observed by timestamped screencast on the
live site, CLONE = same measurement on the clone.

## Intro / first load (Home)

| Step | Driver | Values | Status |
|---|---|---|---|
| Loader texts slide in | time, delay 1.5s after mount | `y:155%→0, rotate 5°→0`, 1s ease `reveal` (cubic .4,0,0,1), stagger .15 | SV 51761 |
| Progress circle | CSS | `stroke-dashoffset 20.4→0→-20.4`, 1s linear infinite | SV css |
| APP_LOADED → canvases visible | event | `#webgl-app` opacity 0→1 1s ease; navbar opacity 1s delay 3.75s | SV 52899 / css |
| Loader exit | APP_LOADED + 3.75s | texts `translateY(-100%)` .45s power2.out; block opacity→0 .35s | SV |
| Shader prewarm | +1ms … +500ms | both env groups compiled | SV |
| Camera dolly | APP_LOADED + .5s + 3.35s | model camera x: `cam.x+7 → cam.x`, 2.5s `expo.inOut` | SV 63034 |
| Card mask | APP_LOADED + .5s + 3.475s | uGlobal 0→1 1.75s expo.out; uScale 0→1 2.25s expo.out; uFinal 0→1 1.4s power4.inOut @.45 | SV 67977 |
| Reveal complete | same time as card | Lenis start, bees fade: bee scale .6s → shadows .6s (+.1) → fruits .6s (+.1) | SV 68420 |
| Header copy | reveal + .91s | description lines then "Scroll down" +.25s | SV 45254 |

OBS vs CLONE (1440×900, cold context, frame coverage of the card): card 5%→95% coverage took
**1046 ms** on the source and **1051 ms** on the clone; intermediate thresholds differ ≤40 ms
(capture jitter). Absolute start differs (source 6.37s vs clone 5.10s after navigation) only because of
CDN download time. Aligned frame sheet: scratchpad `shots/intro-aligned.jpg`.

## Scroll

| Element | Rule | Status |
|---|---|---|
| Lenis | lerp `.085` (desktop) / `1` (<1025), smoothWheel, syncTouch | SV 69846 |
| Header camera | `pos = -clamp(scroll/h · range)`; Home range (0,2.4,4); About (0,1.89,6.9)+offsets; mobile About ×.55 | SV |
| Header copy | translateY `p·800%`, opacity fade p .2→.45 (desktop) | SV 45254 |
| WebGL section camera | progress `[top-vh, top+h]→[0,1]`; Home (0,2.75,0)+offset (0,2.75,0) | SV |
| "FOCUS ON…" chars | base .15 opacity; reveal char i window `i/n·.72 … +8/n`, progress `[top-.9vh, top-0]` (mobile end .35vh) | SV 45544 |
| Text lines | SplitText masked lines `yPercent 110→0`, 1.125s reveal, stagger .1, on enter | SV 40646 |
| Media parallax | mask translate `±amount%`, optional scale/position/rotate | SV 42679 |
| Slider UV parallax | `uv.y += p·.085` | SV 60170 |
| Navbar colour | Home: white over WebGL section; About: cream after hero, white over library (>1600px) | SV 46050 / 42320 |
| Playground content bee | path functions `beePath.ts` (entry 14vh, reveal +110vh, exit dive, land/takeoff) | SV 50179–50590 |

## Pointer

| Element | Rule | Status |
|---|---|---|
| Camera parallax | rotX = deg(y·.2), rotY = deg(-x·.75), lerp `1-exp(-2dt)`; off on coarse pointer | SV 63099, OBS/CLONE |
| Cursor pill | lerp 12; tilt `z = clamp(signedDist·.02,±1)`, scale `1+|z|`, rotate `z·40°`; pop `elastic.out(.75)` .65s, hide `expo.out` .3s | SV 37756 |
| Fluid | 20% res stable fluids, force 80×1.75, cursor 40 (ref 1440), dissipation .98; distortion .003, blur `vel·15`, brighten ×1.25·|vel|·.75 | SV 69250, OBS/CLONE |
| Slider drag | dragMultiplier 3, deltaDecay .9, snapLerp .055, follow .068, depth push `1.5·force` | SV 48410, OBS/CLONE |
| Archive row | mask in `translateY 0` .35 expo.out; leave up/down by half; expand height CSS 1.4s, media 1.3s expo.out | SV 46828, OBS/CLONE |
| Footer credits | hover diagonal `(-85%,85%)` .85 reveal; open `(0,0)` 1.25 expo.out; close on scroll-up >2px | SV 44572, OBS/CLONE |
| Hero bee | Yuka pursuer (mass .2, maxSpeed 2.5, click 7) chasing Lissajous evader; fruit gravity 18, squash elastic | SV 66395, OBS/CLONE |
| Content bee | hover phrase, click conversation (300ms debounce), bounce .06/.1/.32 elastic | SV 67351, OBS/CLONE |
| About flowers | spring k .2 damp .9, spin damping .965, max tilt .6 | SV 60239 |
| Showreel | open timeline 0/.35/.55/1.0s; idle 1s → UI fade .2s; reveal after 100px travel | SV 51952, OBS/CLONE |

## Page transition

`hide`: disc radius 0 → cover (`.5·√(r²+1)·1.08`) .75s expo.out + daisy scale 0→1 / rotate; at .75s
route swap; `show`: radius → 0 .65s power3.inOut. Sound `pageTransition` from 15% with 700ms fade-in.
Camera on the new route: `cam.x+5 → cam.x` 2s expo.out (Home), `+8` (About). SV 68190 / 49193.
