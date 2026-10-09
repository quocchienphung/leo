// Playground backdrop: sky, volumetric cumulus, a sea of clouds and atmospheric mountain ranges,
// raymarched in the stage frame (x right, y up, z towards the camera) with lengths in km.
// Rendered progressively into an HDR texture (env/crystal/backdrop.ts); outputs LINEAR radiance.
import { backgroundWater } from "./backgroundWater";

/** Shared by the bake and the visible dome: analytic sky radiance for a stage direction. */
export const skyChunk = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform float uSunDisc;

vec3 skyRadiance(vec3 rd) {
  float e = clamp(rd.y, 0.0, 1.0);
  float mu = max(dot(rd, uSunDir), 0.0);
  // Pale, hazy morning sky: quick rise from a milky horizon to a soft blue.
  vec3 col = mix(uHorizon, uZenith, pow(smoothstep(-0.01, 0.55, e), 0.62));
  // Mie glow: the whole sun side of the sky is warmer and brighter.
  col += uSunColor * (0.10 * pow(mu, 3.0) + 0.22 * pow(mu, 12.0) + 0.5 * pow(mu, 120.0));
  col = mix(col, uHorizon * 1.04 + uSunColor * 0.08 * mu, pow(1.0 - e, 14.0) * 0.6);
  col += uSunColor * pow(mu, 2400.0) * uSunDisc;
  return mix(col, uGround, 1.0 - smoothstep(-0.08, 0.0, rd.y));
}
`;

export const bakeVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
}`;

export const bakeFragment = /* glsl */ `
precision highp float;
${skyChunk}
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamForward;
uniform vec2 uTanHalf;
uniform float uTime;
uniform vec3 uHaze;
uniform vec3 uForest;
uniform vec3 uMeadow;
uniform vec3 uRock;
uniform vec4 uMassifs[MASSIFS];
uniform vec4 uTowers[TOWERS];
uniform vec4 uPuffs[TOWERS * PUFFS];
uniform float uBlend;
uniform float uWaterData;
uniform vec4 uFalls[2]; // x, z of lip, half width, gorge depth (km)
// Always 0. Added to every loop bound so the Direct3D compiler (ANGLE on Windows) keeps real loops
// instead of unrolling them, which took ≈ 15 s for this shader.
uniform int uZero;
varying vec2 vUv;

const float EYE = 0.9; // km above the valley datum

// ---------------------------------------------------------------- noise
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
// Value noise with analytic derivatives (quintic), in [-1, 1].
vec3 noised(vec2 x) {
  vec2 p = floor(x);
  vec2 f = fract(x);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  float a = hash12(p);
  float b = hash12(p + vec2(1.0, 0.0));
  float c = hash12(p + vec2(0.0, 1.0));
  float d = hash12(p + vec2(1.0, 1.0));
  float k1 = b - a;
  float k2 = c - a;
  float k4 = a - b - c + d;
  return vec3(-1.0 + 2.0 * (a + k1 * u.x + k2 * u.y + k4 * u.x * u.y), 2.0 * du * vec2(k1 + k4 * u.y, k2 + k4 * u.x));
}
float vnoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
const mat2 M2 = mat2(0.8, -0.6, 0.6, 0.8);
const mat3 M3 = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);

// ---------------------------------------------------------------- terrain
// Eroded fbm: slopes damp the higher octaves, which leaves sharp crests and smooth valleys.
float erosion(vec2 x, int octaves) {
  float a = 0.0;
  float b = 1.0;
  vec2 d = vec2(0.0);
  for (int i = 0; i < 12 + uZero; i++) {
    if (i >= octaves) break;
    vec3 n = noised(x);
    d += n.yz;
    a += b * n.x / (1.0 + dot(d, d));
    b *= 0.5;
    x = M2 * x * 2.0;
  }
  return a;
}

// Massif footprint: placed ranges (x, z, height, radius) so the peaks sit where the reference has them.
float massifMask(vec2 p) {
  float m = 0.0;
  for (int i = 0; i < MASSIFS + uZero; i++) {
    vec4 s = uMassifs[i];
    vec2 d = (p - s.xy) / s.w;
    m = max(m, s.z * exp(-dot(d, d)));
  }
  return m;
}

float terrain(vec2 p, int octaves) {
  float m = massifMask(p);
  float e = erosion(p * 0.55 + vec2(3.1, 7.7), octaves);
  // Rolling forested hills everywhere, real relief only inside the massifs.
  float hills = 0.16 + 0.11 * erosion(p * 1.3 + vec2(11.0, 2.0), max(octaves - 2, 2));
  float height = 0.22 + hills + m * (0.62 + 0.38 * e);
  // A narrow ledge and eroded gorge give the water an actual drop in the same heightfield.
  for (int i = 0; i < 2; i++) {
    vec4 fall = uFalls[i];
    float down = p.y - fall.y;
    if (down < -0.04 || down > 2.6 || abs(p.x - fall.x) > 1.2) continue;
    float channelX = fall.x + sin(max(down, 0.0) * 2.0) * 0.18 + max(down, 0.0) * 0.12;
    float gorge = exp(-pow((p.x - channelX) / 0.36, 4.0));
    float ledge = smoothstep(-0.035, 0.055, down) * (1.0 - smoothstep(0.65, 2.6, down));
    height -= fall.w * gorge * ledge;
  }
  return height;
}

// Signed type, cross-flow position, along-flow position, coverage. Empty sky stays empty;
// waterfalls are ray/curtain intersections clipped against the raymarched terrain.
vec4 flowMap(vec3 ro, vec3 rd, float terrainHit, out float waterDepth) {
  vec4 flow = vec4(0.0);
  waterDepth = terrainHit;
  if (terrainHit > 0.0) {
    vec3 p = ro + rd * terrainHit;
    for (int i = 0; i < 2; i++) {
      vec4 fall = uFalls[i];
      float down = p.z - fall.y;
      if (down < -2.0 || down > 2.5) continue;
      float center = down < 0.0 ? fall.x + sin(down * 2.8) * 0.38 + down * 0.16 : fall.x + sin(down * 2.0) * 0.18 + down * 0.12;
      // Catchment stream above the lip, runoff below it; the airborne drop joins the two.
      float width = fall.z * (down < 0.0 ? 0.48 : 0.9 + down * 0.38);
      float across = (p.x - center) / width;
      float mask = (1.0 - smoothstep(0.7, 1.15, abs(across))) * smoothstep(-2.0, -1.6, down) * (1.0 - smoothstep(1.9, 2.5, down));
      if (down > -0.06 && down < 0.16) mask = 0.0;
      if (mask > flow.a) flow = vec4(-1.0, across, down, mask * 0.85);
    }
  }
  for (int i = 0; i < 2; i++) {
    vec4 fall = uFalls[i];
    if (rd.z >= -0.01) continue;
    float t = (fall.y + 0.09 - ro.z) / rd.z;
    if (t <= 0.0 || (terrainHit > 0.0 && t > terrainHit + 0.025)) continue;
    vec3 p = ro + rd * t;
    float across = (p.x - fall.x) / fall.z;
    if (abs(across) > 4.0) continue;
    float top = terrain(vec2(p.x, fall.y - 0.09), 7);
    float bottom = terrain(vec2(fall.x, fall.y + 0.22), 7) + 0.015;
    float along = (top - p.y) / max(top - bottom, 0.08);
    across += sin(along * 5.2) * 0.12 + sin(along * 15.0) * 0.04;
    float edge = 0.82 + along * 0.18 + sin(along * 23.0) * 0.065;
    float core = (1.0 - smoothstep(edge * 0.75, edge * 1.15, abs(across))) * smoothstep(0.0, 0.035, along) * (1.0 - smoothstep(0.94, 1.05, along));
    float mist = exp(-pow(across / 2.2, 2.0) - pow((along - 0.94) / 0.16, 2.0)) * 0.3;
    float mask = max(core, mist);
    if (mask > flow.a) { flow = vec4(1.0, across, along, mask); waterDepth = t; }
  }
  return flow;
}

vec3 terrainNormal(vec3 p, float t) {
  float eps = max(0.0015, 0.0009 * t);
  vec2 dx = vec2(eps, 0.0);
  vec2 dz = vec2(0.0, eps);
  return normalize(vec3(terrain(p.xz - dx, 10) - terrain(p.xz + dx, 10), 2.0 * eps, terrain(p.xz - dz, 10) - terrain(p.xz + dz, 10)));
}

float marchTerrain(vec3 ro, vec3 rd, float tmax) {
  float t = 0.4;
  float lastH = 0.0;
  float lastT = t;
  for (int i = 0; i < 220 + uZero; i++) {
    vec3 p = ro + rd * t;
    float h = p.y - terrain(p.xz, 6);
    if (h < 0.0008 * t) {
      // Refine between the last two samples.
      float a = lastT;
      float b = t;
      for (int k = 0; k < 6 + uZero; k++) {
        float m = 0.5 * (a + b);
        vec3 q = ro + rd * m;
        if (q.y - terrain(q.xz, 7) < 0.0) b = m; else a = m;
      }
      return 0.5 * (a + b);
    }
    lastT = t;
    lastH = h;
    t += max(0.45 * h, 0.004 * t);
    if (t > tmax || p.y > 4.2) break;
  }
  return -1.0;
}

vec3 aerial(vec3 col, float t, vec3 rd, float height) {
  // Haze thins with altitude; warm in-scatter towards the sun.
  float density = 0.034 * exp(-max(height - 0.3, 0.0) * 0.55) * smoothstep(1.0, 9.0, t + 1.0);
  float fog = 1.0 - exp(-t * density);
  float mu = max(dot(rd, uSunDir), 0.0);
  vec3 fogCol = uHaze + uSunColor * (0.05 + 0.18 * pow(mu, 6.0));
  return mix(col, fogCol, fog);
}

vec3 shadeTerrain(vec3 ro, vec3 rd, float t) {
  vec3 p = ro + rd * t;
  vec3 n = terrainNormal(p, t);
  float slope = n.y;
  float fine = erosion(p.xz * 9.0, 4) * 0.5 + 0.5;
  // Tree canopy: small dark clumps with lit crowns, fading into the haze.
  float canopy = vnoise3(vec3(p.xz * 140.0, 0.0)) * 0.6 + vnoise3(vec3(p.xz * 320.0, 3.0)) * 0.4;
  float patches = smoothstep(0.35, 0.75, erosion(p.xz * 2.2 + 4.0, 4) * 0.5 + 0.5);
  vec3 albedo = mix(uForest, uMeadow, patches * 0.4 * smoothstep(0.6, 0.9, slope));
  albedo *= (0.75 + 0.5 * fine) * mix(1.0, 0.55 + 0.9 * canopy, 1.0 - smoothstep(2.5, 9.0, t));
  // Bare rock on the steep high crests.
  float rock = smoothstep(2.2, 3.0, p.y + 0.4 * fine) * (1.0 - smoothstep(0.55, 0.85, slope));
  albedo = mix(albedo, uRock * (0.8 + 0.4 * fine), rock);
  for (int i = 0; i < 2; i++) {
    vec4 fall = uFalls[i];
    float down = p.z - fall.y;
    float bank = exp(-pow((p.x - fall.x) / 0.4, 4.0)) * smoothstep(-0.15, 0.03, down) * (1.0 - smoothstep(0.9, 1.8, down));
    albedo = mix(albedo, uRock * vec3(0.62, 0.72, 0.76) * (0.8 + fine * 0.4), bank * 0.8);
  }
  float dif = clamp(dot(n, uSunDir), 0.0, 1.0);
  float sky = 0.55 + 0.45 * n.y;
  float back = clamp(dot(n, normalize(vec3(-uSunDir.x, 0.0, -uSunDir.z))), 0.0, 1.0);
  vec3 lin = uSunColor * dif * 3.3 + uZenith * sky * 0.85 + uSunColor * back * 0.12;
  return aerial(albedo * lin, t, rd, p.y);
}

// ---------------------------------------------------------------- clouds
// Cumulus: each tower (x, z, bounding radius, top) is a cauliflower of PUFFS spheres (x, y, z, r),
// big at the base and smaller towards the top, unioned and eroded by small billowy noise. The
// creases between puffs self-shadow. Puffs are only visited inside their tower's bounds.
float cumulus(vec3 p, float detail) {
  float field = -1.0;
  for (int i = 0; i < TOWERS + uZero; i++) {
    vec4 s = uTowers[i];
    vec2 dxz = p.xz - s.xy;
    if (p.y < 1.9 || p.y > s.w + 0.3 || dot(dxz, dxz) > s.z * s.z * 2.9) continue;
    for (int k = 0; k < PUFFS + uZero; k++) {
      vec4 b = uPuffs[i * PUFFS + k];
      field = max(field, 1.0 - length(p - b.xyz) / b.w);
    }
  }
  if (field < -0.3) return 0.0;
  // Flat base: clouds sit on a common condensation level.
  float baseCut = smoothstep(1.95, 2.12, p.y);
  vec3 q = p * 2.4 + vec3(uTime * 0.02, -uTime * 0.004, uTime * 0.006);
  float n = vnoise3(q) * 0.6;
  q = M3 * q * 2.07;
  n += vnoise3(q) * 0.28 * detail;
  q = M3 * q * 2.03;
  n += vnoise3(q) * 0.12 * detail;
  float shape = field + 0.16 - n * 0.42;
  return smoothstep(0.0, 0.07, shape) * baseCut;
}

// Sea of clouds lying in the valleys between the ranges.
float seaOfClouds(vec3 p, float detail) {
  float dist = length(p.xz);
  // In the valleys right of the daisy (1000–1300, 500–620) and far left; clear behind the leaves.
  float az = atan(p.x, -p.z);
  float side = max(smoothstep(0.06, 0.16, az), 1.0 - smoothstep(-0.46, -0.36, az));
  float band = smoothstep(5.5, 8.0, dist) * (1.0 - smoothstep(18.0, 30.0, dist)) * side;
  if (band <= 0.0) return 0.0;
  // Valley breeze keeps a narrow, irregular opening through the sea of clouds near each fall.
  for (int i = 0; i < 2; i++) {
    float fallAz = atan(uFalls[i].x, -uFalls[i].y);
    float opening = exp(-pow((az - fallAz) / 0.045, 2.0) - pow((dist - 9.0) / 5.0, 2.0));
    band *= 1.0 - opening * 0.97;
  }
  if (band <= 0.0) return 0.0;
  float cov = 0.5 + 0.5 * erosion(p.xz * 0.28 + vec2(5.0, 1.0), 3);
  float top = 0.95 + 0.55 * cov;
  float hf = clamp((p.y - 0.45) / (top - 0.45), 0.0, 1.0);
  if (p.y > top + 0.2 || p.y < 0.4) return 0.0;
  vec3 q = p * 2.2 + vec3(uTime * 0.015, 0.0, 0.0);
  float n = vnoise3(q) * 0.5 + vnoise3(M3 * q * 2.0) * 0.25 + vnoise3(M3 * M3 * q * 4.1) * 0.125 * detail;
  float shape = cov * 1.25 - hf * 0.95 - n * 0.8;
  return clamp(shape * band * 2.0, 0.0, 1.0);
}

float cloudDensity(vec3 p, float detail) {
  return max(cumulus(p, detail), seaOfClouds(p, detail));
}

float hg(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * 3.14159 * pow(1.0 + g2 - 2.0 * g * c, 1.5));
}

vec4 marchClouds(vec3 ro, vec3 rd, float tmax, float jitter) {
  // The jitter offsets both the view march and the light march (no slicing or contour bands).
  // Only beyond the terrace and below the top of the towers.
  float t0 = 5.5;
  float t1 = tmax;
  if (rd.y > 0.0) t1 = min(t1, (6.2 - ro.y) / rd.y);
  if (t1 <= t0) return vec4(0.0, 0.0, 0.0, 1.0);
  float mu = dot(rd, uSunDir);
  float phase = mix(hg(mu, 0.55), hg(mu, -0.15), 0.35) * 4.0 * 3.14159;
  vec3 scatter = vec3(0.0);
  float trans = 1.0;
  float t = t0;
  float dt = (t1 - t0) / 110.0;
  dt = clamp(dt, 0.06, 0.4);
  t += dt * jitter;
  for (int i = 0; i < 140 + uZero; i++) {
    if (t > t1 || trans < 0.01) break;
    vec3 p = ro + rd * t;
    float d = cloudDensity(p, 1.0);
    if (d > 0.002) {
      // Light towards the sun.
      float od = 0.0;
      float prev = 0.0;
      for (int k = 1; k <= 7 + uZero; k++) {
        float s = (float(k) + jitter - 0.5) * (float(k) + jitter - 0.5) * 0.03 + 0.01;
        od += cloudDensity(p + uSunDir * s, 0.0) * (s - prev);
        prev = s;
      }
      float sigma = 13.0;
      // Multiple scattering (two octaves): deep cloud is grey-white, never dark blue.
      float sunT = exp(-od * sigma * 0.35) + 0.22 * exp(-od * sigma * 0.07);
      float powder = 1.0 - exp(-d * 6.0);
      float hTop = clamp((p.y - 0.5) / 4.5, 0.0, 1.0);
      vec3 amb = mix(vec3(0.3, 0.32, 0.36), vec3(0.6, 0.64, 0.72), hTop);
      vec3 S = (uSunColor * 4.0 * sunT * phase * mix(0.65, 1.0, powder) + amb * (0.85 + 0.3 * hTop)) * d * sigma;
      float stepT = exp(-d * sigma * dt);
      vec3 integ = (S - S * stepT) / (d * sigma);
      // Haze on the clouds themselves, by distance.
      float fog = 1.0 - exp(-t * 0.035);
      integ = mix(integ, uHaze * (1.0 - stepT), fog * 0.55);
      scatter += trans * integ;
      trans *= stepT;
    }
    t += dt * (d > 0.002 ? 1.0 : 1.6);
  }
  return vec4(scatter, trans);
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 rd = normalize(uCamForward + ndc.x * uTanHalf.x * uCamRight + ndc.y * uTanHalf.y * uCamUp);
  vec3 ro = vec3(0.0, EYE, 0.0);
  // White-noise jitter, new every refresh: the blended refreshes average it into smooth gradients.
  float jitter = hash12(gl_FragCoord.xy * 1.37 + vec2(fract(uTime * 0.731) * 517.0, fract(uTime * 0.379) * 291.0));
  float tmax = 60.0;
  float tHit = marchTerrain(ro, rd, tmax);
  if (uWaterData > 0.5) {
    float waterDepth;
    vec4 flow = flowMap(ro, rd, tHit, waterDepth);
    if (flow.a > 0.003) {
      vec4 clouds = marchClouds(ro, rd, waterDepth, 0.5);
      flow.a *= clouds.a * exp(-waterDepth * 0.025);
    }
    gl_FragColor = flow;
    return;
  }
  vec3 bg = tHit > 0.0 ? shadeTerrain(ro, rd, tHit) : skyRadiance(rd);
  vec4 cl = marchClouds(ro, rd, tHit > 0.0 ? tHit : tmax, jitter);
  vec3 col = cl.rgb + bg * cl.a;
  // Progressive refresh: each pass blends into the previous ones, averaging the march jitter.
  gl_FragColor = vec4(col, uBlend);
}`;

/** Visible sky: the baked frustum where the camera can look, the analytic sky elsewhere. */
export const domeVertex = /* glsl */ `
uniform vec3 uCenter;
varying vec3 vDir;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vDir = world.xyz - uCenter;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

export const domeFragment = /* glsl */ `
${skyChunk}
${backgroundWater}
uniform sampler2D tBake;
uniform float uBakeReady;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamForward;
uniform vec2 uTanHalf;
varying vec3 vDir;
void main() {
  vec3 w = normalize(vDir);
  // World (home GLB frame) → stage frame.
  vec3 rd = vec3(-w.z, w.y, w.x);
  vec3 col = skyRadiance(rd);
  float f = dot(rd, uCamForward);
  if (uBakeReady > 0.5 && f > 0.0) {
    vec2 ndc = vec2(dot(rd, uCamRight), dot(rd, uCamUp)) / f / uTanHalf;
    if (abs(ndc.x) <= 1.0 && abs(ndc.y) <= 1.0) {
      vec2 uv = ndc * 0.5 + 0.5;
      vec3 baked = flowingBackground(texture2D(tBake, uv).rgb, uv);
      float edge = 1.0 - smoothstep(0.97, 1.0, max(abs(ndc.x), abs(ndc.y)));
      col = mix(col, baked, edge);
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;
