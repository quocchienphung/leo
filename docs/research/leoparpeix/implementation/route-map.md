# Route map & file ownership

| Source URL | Local route | Entry file | View |
|---|---|---|---|
| `https://www.leoparpeix.com/` (`?ref=landing.love` has no effect: the bundle reads only `orbit`, `tab`, `remindScrollY`, `skipLoader`) | `/` | `src/app/page.tsx` | `views/HomeView.tsx` |
| `/about` | `/about` | `src/app/about/page.tsx` | `views/AboutView.tsx` |
| `/playground` | `/playground` | `src/app/playground/page.tsx` | `views/PlaygroundView.tsx` |
| `/Playground` | 307 → `/playground` | `src/proxy.ts` (exact-case; `redirects()` matched case-insensitively and looped) | — |
| `https://lab.leoparpeix.com` | external (navbar Lab / mobile menu) | — | — |
| Project / agency / social links | external, same targets as source | data files | — |

Out of scope (documented, not cloned): the source 404 view (`NotFoundView`, extra bees), Lab origin,
client websites.

## Shared ownership (`src/components/sites/leoparpeix/`)

| Area | Files |
|---|---|
| Session runtime (Lenis, gsap ticker, pointer, viewport) | `core/app.ts`, `core/emitter.ts`, `core/env.ts`, `core/math.ts` |
| Sound (howler, ambient + sfx) | `core/sound.ts` |
| Navigation / transitions | `core/navigation.ts`, `shell/LeoShell.tsx` |
| CSS modules + class registry | `styles/*.module.css` (one per source scope id), `core/cx.ts` |
| Global CSS (fonts, root size, loader, popup links, canvases) | `src/app/globals.css` |
| WebGL manager / renderers / composite / fluid | `webgl/manager.ts`, `webgl/fluid.ts`, `webgl/shaders/*` |
| Environments (Home workshop, About landscape) | `webgl/env/environments.ts`, `webgl/env/objects.ts` |
| Cameras | `webgl/cameras.ts` |
| DOM-synced planes (section colours, sliders, About flowers) | `webgl/interface/*` |
| Top layer (intro card, page transition, bees, fruits, content bee) | `webgl/top/*` |
| Shell UI (loader, navbar, cursor, bee speech, showreel, orientation) | `shell/*` |
| Shared blocks | `blocks/shared/*` (Header, WebglSection, BeeBlock, Footer) |
| Page blocks | `blocks/home/*`, `blocks/about/*`, `blocks/playground/*` |
| UI atoms | `ui/*` (GridWrapper, TextComponent, buttons, MediaComponent, ParallaxWrapper, WebglBg, AgencyLink) |
| Content (structure from bundle; displayed copy rewritten, see `differences.md` #10) | `data/*.ts`, route metadata in `src/app/**/page.tsx` + `layout.tsx` |
| Assets | `public/sites/leoparpeix/assets/**` (CDN tree mirrored), `public/sites/leoparpeix/decoders/**` |
