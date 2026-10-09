# Work / Playground performance diagnosis — 2026-10-09

Playground's crystal header is the reproduced bottleneck. Work's baked environment
and the sampled Playground content region both sustain approximately 60 FPS in
this test. No application source or visual design was changed.

## Measurement

- Existing local server at `http://localhost:3000`; Chrome headless, Apple M4
  (ANGLE Metal), 1440 × 900 CSS pixels, DPR 1.
- `skipLoader&debug=probe`; steady-state samples last four seconds after loading
  and shader compilation. Header scrolling oscillates between y=20 and y=340
  through native `window.scrollTo` on animation frames.
- Runtime-only A/B overrides; separate browser run repeats the baseline before
  substituting materials. No JavaScript page errors in either run.
- These are local diagnostic results, not a production benchmark or a guarantee
  of FPS on other devices. Content was sampled at rest at y=4500, not across its
  entire scroll range. Render CPU timing measures command submission, not GPU time.
- Raw measurements: [performance-audit-2026-10-09.json](performance-audit-2026-10-09.json).

| Sample | FPS |
| --- | ---: |
| Work header, idle / scrolling | 60.1 / 60.1 |
| Playground header, idle / scrolling | 34.5 / 33.9 |
| Playground header, mirror disabled | 39.3 |
| Playground header, mirror and depth of field disabled | 40.4 |
| Playground header, mirror, depth of field and bloom chain bypassed | 40.3 |
| Playground content at y=4500, 3 videos playing | 60.1 |
| Separate run: Playground header baseline | 33.4 |
| Same run: custom glass replaced with unpatched physical glass | 51.4 |
| Same run: unpatched glass plus render scale 0.65 | 60.2 |

The postprocessing tests are cumulative. The material experiment restores the
normal mirror and postprocessing pipeline. The last row combines material and
resolution changes; it does not establish the effect of resolution alone with
the original materials. Replacing materials changes appearance and is only an
isolation experiment.

## Code findings

1. **Different rendering costs despite similar motion.** Work's
   `webgl/env/environments.ts:createEnvMaterial` uses unlit, baked textures.
   Playground uses physically lit transmissive materials with custom shader
   patches. In `webgl/shaders/crystalTrace.ts`, each fragment traces repeated
   exits against facet planes and samples different exit directions for RGB.
   `webgl/env/crystal/materials.ts:tracedCrystal` defaults to four bounces and
   plane buckets up to 256. Actual complexity varies by material. The unpatched
   glass A/B test implicates this material path strongly; it does not distinguish
   the cost of each individual shader patch.

2. **The floor repeats expensive scene rendering.**
   `webgl/env/crystal/floor.ts:MirrorFloor.update` renders the scene, including
   glass, from a mirrored camera every other frame at full desktop HDR size.
   `quality=high` makes it update every frame. This is a measurable secondary
   cost and can also produce uneven frame workloads while scrolling.

3. **Adaptive resolution cannot help DPR 1 devices.**
   `webgl/env/crystal/crystalEnvironment.ts:adapt` calculates
   `minScale = min(1, max(0.65, 1.15 / dpr))`. At DPR 1, the result is 1.
   A slow frame therefore cannot lower `renderScale` below 100%. The runtime
   remained at scale 1 despite approximately 29 ms smoothed frame times.
   `quality=high` disables adaptation entirely.

4. **Additional image passes are secondary in this test.**
   `webgl/env/crystal/post.ts:render` adds 17 postprocessing draws with depth of
   field enabled: two depth-of-field passes, bright extraction, glints, twelve
   bloom downsample/blur draws and the final composite. The scene target also
   uses half-float HDR and four MSAA samples on desktop. Bypassing depth of field
   and bloom after disabling the mirror adds little improvement in this run.

5. **The environment does stop outside the header.**
   `webgl/manager.ts` gates `crystal.update` and the HDR pipeline on environment
   visibility. At the content sample the crystal environment is invisible and
   the page returns to 60 FPS despite three playing videos. This does not rule
   out separate issues at unmeasured content positions or on other devices.

CPU render submission in the baseline is only approximately 2–3 ms per frame,
while animation frames commonly arrive approximately 33 ms apart. Together
with the material A/B result, this points primarily to graphics rendering cost;
GPU timer queries were not collected.

## Optimization priority

1. Correct the adaptive-resolution floor for DPR 1 and tune it using measured
   frame time. Verify original materials at lower resolution before choosing
   the final quality range.
2. Reduce custom crystal shader work for distant/small objects; use simpler
   materials or fewer trace bounces/planes where visually acceptable.
3. Render floor reflection at lower independent resolution and tune its update
   cadence while the camera moves.
4. Tune depth of field, bloom and MSAA only after the larger costs above.

Verify the final changes on a production build and visually compare the crystal
header before accepting any quality reductions.
