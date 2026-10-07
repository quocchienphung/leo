// Playground crystal pavilion (user-requested scene, not part of the source bundle).
// Unlike the baked home/about pipeline, this scene is lit physically: every shader here outputs
// LINEAR HDR colour; `CrystalPost` tone maps (ACES) and encodes to sRGB at the end.

/** Value noise + fbm (2D). */
const noise2 = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm2(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return s;
}
`;

/** Sun shafts / glare: additive soft beams, brightest at the top, shimmering faintly. */
export const shaftVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const shaftFragment = /* glsl */ `
${noise2}
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;
varying vec2 vUv;
void main() {
  float across = smoothstep(0.0, 0.45, vUv.x) * (1.0 - smoothstep(0.55, 1.0, vUv.x));
  float y = clamp(vUv.y, 0.0, 1.0);
  float along = mix(0.35, 1.0, pow(y, 1.6)) * smoothstep(0.0, 0.12, y);
  float shimmer = 0.8 + 0.2 * vnoise(vec2(vUv.x * 6.0, vUv.y * 2.0 - uTime * 0.05));
  gl_FragColor = vec4(uColor * across * along * shimmer * uIntensity, 1.0);
}`;

/** Shallow pool: distorted planar reflection over pale marble, slow ripples and sun glints. */
export const poolVertex = /* glsl */ `
uniform mat4 uTextureMatrix;
varying vec4 vReflUv;
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vReflUv = uTextureMatrix * world;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

export const poolFragment = /* glsl */ `
${noise2}
uniform sampler2D tReflection;
uniform float uTime;
uniform vec3 uBottom;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
varying vec4 vReflUv;
varying vec3 vWorld;
void main() {
  // Very low, slow ripple.
  vec2 p = vWorld.xz * 1.6;
  float t = uTime * 0.12;
  float h = fbm2(p + vec2(t, -t * 0.7));
  float hx = fbm2(p + vec2(t + 0.05, -t * 0.7));
  float hz = fbm2(p + vec2(t, -t * 0.7 + 0.05));
  vec3 n = normalize(vec3((h - hx) * 0.9, 1.0, (h - hz) * 0.9));
  vec3 v = normalize(cameraPosition - vWorld);
  float ndv = clamp(dot(n, v), 0.0, 1.0);
  float fresnel = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
  vec2 uv = vReflUv.xy / vReflUv.w + n.xz * 0.018;
  // Clear water picks up a cool cast from the sky it mirrors.
  vec3 refl = texture2D(tReflection, uv).rgb * vec3(0.86, 0.94, 0.98);
  // Marble seen through a thin layer of water: darker towards the camera.
  vec3 bottom = uBottom * (0.85 + 0.15 * fbm2(vWorld.xz * 0.7));
  vec3 col = mix(bottom, refl, clamp(0.42 + fresnel * 0.55, 0.0, 1.0));
  float glint = pow(max(dot(reflect(-v, n), uSunDir), 0.0), 220.0);
  col += uSunColor * glint * 3.0;
  gl_FragColor = vec4(col, 1.0);
}`;

/** Marble floor: injected into MeshStandardMaterial (lit, shadowed) to add the wet reflection. */
export const floorVertexPars = /* glsl */ `
uniform mat4 uTextureMatrix;
varying vec4 vReflUv;
varying vec3 vFloorWorld;
`;
export const floorVertexMain = /* glsl */ `
vec4 floorWorld = modelMatrix * vec4(transformed, 1.0);
vFloorWorld = floorWorld.xyz;
vReflUv = uTextureMatrix * floorWorld;
`;
export const floorFragmentPars = /* glsl */ `
${noise2}
uniform sampler2D tReflection;
uniform float uReflectivity;
uniform float uFloorTime;
uniform vec3 uSunColor;
varying vec4 vReflUv;
varying vec3 vFloorWorld;

// Light caustics thrown by the glass and crystal: bright webs that slowly crawl.
float caustic(vec2 p, float t) {
  vec2 q = p;
  float c = 0.0;
  for (int i = 0; i < 3; i++) {
    q += vec2(sin(q.y * 1.7 + t * 0.6 + float(i)), cos(q.x * 1.4 - t * 0.5 - float(i) * 1.3));
    c += 1.0 / (1.0 + 22.0 * abs(sin(q.x) * sin(q.y)));
  }
  return c / 3.0;
}
`;
export const floorFragmentMain = /* glsl */ `
{
  // Stage frame (x right, z towards the camera) from the home GLB frame.
  vec2 sp = vec2(-vFloorWorld.z, vFloorWorld.x - 2.75);
  float ndv = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
  // Polished, wet marble: a strong mirror at the grazing angles the camera sees it from.
  float fresnel = 0.05 + 0.95 * pow(1.0 - ndv, 4.0);
  float wet = smoothstep(0.3, 0.7, fbm2(vFloorWorld.xz * 0.3));
  vec2 uv = vReflUv.xy / vReflUv.w + (vec2(fbm2(vFloorWorld.xz * 3.0), fbm2(vFloorWorld.zx * 3.0)) - 0.5) * 0.004;
  // Reflections of bright things stretch vertically across a wet floor: a short, mostly vertical
  // blur that grows towards the camera.
  float stretch = mix(0.002, 0.009, wet) * (0.5 + 0.5 * smoothstep(-6.0, 3.0, sp.y));
  vec3 refl = texture2D(tReflection, uv).rgb * 0.24;
  refl += texture2D(tReflection, uv + vec2(0.0, stretch)).rgb * 0.17;
  refl += texture2D(tReflection, uv - vec2(0.0, stretch)).rgb * 0.17;
  refl += texture2D(tReflection, uv + vec2(stretch * 0.15, stretch * 2.2)).rgb * 0.11;
  refl += texture2D(tReflection, uv - vec2(stretch * 0.15, stretch * 2.2)).rgb * 0.11;
  refl += texture2D(tReflection, uv + vec2(0.0, stretch * 3.6)).rgb * 0.1;
  refl += texture2D(tReflection, uv - vec2(0.0, stretch * 3.6)).rgb * 0.1;
  float k = clamp(uReflectivity * mix(0.7, 1.0, wet) * (0.4 + 0.6 * fresnel), 0.0, 1.0);
  vec3 albedo = outgoingLight;
  outgoingLight = albedo * (1.0 - 0.55 * k) + refl * k;

  // Caustics in front of the crystal base, the big sphere and the glass blocks, faintly rainbow.
  float m = exp(-dot(sp - vec2(0.1, 1.0), sp - vec2(0.1, 1.0)) / 2.2);
  m += 0.8 * exp(-dot(sp - vec2(-4.0, 0.9), sp - vec2(-4.0, 0.9)) / 0.9);
  m += 0.7 * exp(-dot(sp - vec2(4.6, 1.6), sp - vec2(4.6, 1.6)) / 1.6);
  float cs = caustic(sp * 3.2, uFloorTime);
  vec3 prism = 0.6 + 0.4 * cos(6.2831 * (sp.x * 0.35 + sp.y * 0.5 + vec3(0.0, 0.33, 0.67)));
  outgoingLight += uSunColor * prism * pow(cs, 3.0) * m * 0.9;
}
`;

export const quadVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
}`;

export const brightFragment = /* glsl */ `
uniform sampler2D tInput;
uniform float uThreshold;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tInput, vUv).rgb;
  // Guard: a single NaN / Inf texel would spread through the blur (min/max drop NaN on GPUs).
  c = min(max(c, vec3(0.0)), vec3(64.0));
  float l = max(c.r, max(c.g, c.b));
  float k = max(l - uThreshold, 0.0) / max(l, 1e-4);
  gl_FragColor = vec4(c * k, 1.0);
}`;

export const blurFragment = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uDirection;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tInput, vUv).rgb * 0.227027;
  c += texture2D(tInput, vUv + uDirection * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tInput, vUv - uDirection * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tInput, vUv + uDirection * 3.2307692308).rgb * 0.0702702703;
  c += texture2D(tInput, vUv - uDirection * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;

/** HDR → display: chromatic fringe (barely), bloom, exposure, ACES filmic, sRGB. */
export const finalFragment = /* glsl */ `
uniform sampler2D tInput;
uniform sampler2D tBloom0;
uniform sampler2D tBloom1;
uniform sampler2D tBloom2;
uniform vec3 uBloom;
uniform float uExposure;
uniform float uAspect;
uniform vec3 uGlowColor;
uniform float uAberration;
uniform float uVignette;
varying vec2 vUv;

vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 acesFilmic(vec3 color) {
  const mat3 ACESInputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= uExposure / 0.6;
  color = ACESInputMat * color;
  color = RRTAndODTFit(color);
  color = ACESOutputMat * color;
  return clamp(color, 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec2 d = vUv - 0.5;
  vec2 off = d * uAberration;
  vec3 c;
  c.r = texture2D(tInput, vUv + off).r;
  c.g = texture2D(tInput, vUv).g;
  c.b = texture2D(tInput, vUv - off).b;
  c = min(max(c, vec3(0.0)), vec3(64.0));
  vec3 bloom = texture2D(tBloom0, vUv).rgb * uBloom.x + texture2D(tBloom1, vUv).rgb * uBloom.y + texture2D(tBloom2, vUv).rgb * uBloom.z;
  c += min(max(bloom, vec3(0.0)), vec3(64.0));
  // Back-light haze: the low sun beyond the right pier floods the right of the frame and blooms
  // around the pier's glass (reference: glowing upper right, warm veil across the arch).
  vec2 g = vec2((vUv.x - 0.845) * uAspect, vUv.y - 0.9);
  c += uGlowColor * (0.32 * exp(-dot(g, g) / 0.025) + 0.04 * exp(-dot(g, g) / 0.3));
  c = acesFilmic(c);
  // Contrast (gentle S on the mid-tones) and a touch more colour.
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.32);
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(luma), c, 1.12), 0.0);
  // Golden-hour grade: warm cream highlights and mid-tones, a hint of cool in the deep shade.
  c *= mix(vec3(0.98, 0.99, 1.02), vec3(1.05, 0.995, 0.92), smoothstep(0.2, 0.85, luma));
  c *= 1.0 - dot(d, d) * uVignette;
  gl_FragColor = vec4(toSRGB(c), 1.0);
}`;

/**
 * Frosted, milky body: the refracted background keeps its brightness but loses most of its hue
 * and some contrast, as if scattered inside the glass. Applied to three's transmission chunk.
 */
/**
 * Cut crystal: every facet bends the view through the stone in its own direction, so neighbouring
 * facets show unrelated pieces of the sky, ranges and stone behind it (the clear, kaleidoscopic
 * look of the reference) instead of one softly shifted image.
 */
export function facetedTransmission(chunk: string): string {
  const line = "vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );";
  if (!chunk.includes(line)) return chunk;
  return chunk.replace(
    line,
    `${line}
    {
      vec3 fj = vec3(facetHash(n * 5.3 + 1.0), facetHash(n * 7.1 + 2.0), facetHash(n * 9.7 + 3.0)) - 0.5;
      n = normalize(n + fj * uScatter);
    }`,
  );
}

export function milkTransmission(chunk: string): string {
  const line = "totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );";
  if (!chunk.includes(line)) return chunk;
  return chunk.replace(
    line,
    `{
      float milkLuma = dot(transmitted.rgb, vec3(0.2126, 0.7152, 0.0722));
      transmitted.rgb = mix(transmitted.rgb, uMilkColor * milkLuma, uMilk);
      // Thick rounded rim: a longer, refracted path through the glass reads darker.
      float rim = pow(1.0 - saturate(dot(n, v)), 1.25);
      transmitted.rgb *= 1.0 - uMilkEdge * rim;
    }
    ${line}`,
  );
}

/**
 * Sunlight diffusing through thin translucent glass (petals, orb): a wrapped lit side, light
 * reaching through to the shaded side, and a lobe towards the viewer when back-lit.
 */
export const translucencyPars = /* glsl */ `
uniform vec3 uTransColor;
uniform float uTransScale;
uniform float uTransPower;
uniform float uTransDistortion;
uniform float uTransAmbient;
`;
export const translucencyMain = /* glsl */ `
{
  vec3 trans = vec3(0.0);
  #if NUM_DIR_LIGHTS > 0
    DirectionalLight tl = directionalLights[0];
    float nl = dot(geometryNormal, tl.direction);
    float lit = saturate((nl + 0.3) / 1.3);
    float through = saturate((0.2 - nl) / 1.2);
    vec3 tH = normalize(tl.direction + geometryNormal * uTransDistortion);
    float lobe = pow(saturate(dot(geometryViewDir, -tH)), uTransPower);
    trans += tl.color * uTransScale * (0.5 * lit + 0.3 * through + 0.6 * lobe);
  #endif
  float face = saturate(dot(geometryNormal, geometryViewDir));
  trans += vec3(uTransAmbient * (0.2 + 0.8 * pow(face, 1.5)));
  outgoingLight += uTransColor * trans;
}
`;

/** Petal glitter: fine flakes fixed in the petal (object space) that flash when they face the sun. */
export const glitterVertexPars = /* glsl */ `
varying vec3 vGlitterPos;
`;
export const glitterVertexMain = /* glsl */ `
vGlitterPos = position;
`;
export const glitterFragmentPars = /* glsl */ `
uniform vec3 uGlitterSun;
uniform float uGlitter;
varying vec3 vGlitterPos;
float glitterHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
`;
export const glitterFragmentMain = /* glsl */ `
#ifdef USE_TRANSMISSION
{
  vec3 cell = floor(vGlitterPos * 230.0);
  float g = glitterHash(cell);
  vec3 tilt = vec3(glitterHash(cell + 1.7), glitterHash(cell + 3.1), glitterHash(cell + 5.3)) - 0.5;
  vec3 nW = normalize(inverseTransformDirection(geometryNormal, viewMatrix));
  vec3 flake = normalize(nW + tilt * 1.4);
  vec3 vW = normalize(cameraPosition - vWorldPosition);
  float spark = pow(saturate(dot(reflect(-vW, flake), uGlitterSun)), 60.0);
  float present = step(0.9, g);
  outgoingLight += vec3(1.0, 0.96, 0.9) * present * (0.07 + spark * 3.0) * uGlitter;
  // Thin bright outline: light caught along the rounded rim of thick glass.
  float rimLine = pow(1.0 - saturate(dot(geometryNormal, geometryViewDir)), 5.0);
  outgoingLight += vec3(1.0, 0.97, 0.92) * rimLine * 0.55;
}
#endif
`;

/**
 * Cut crystal: each facet (flat normal) gets its own brightness, and facets that refract the sun
 * towards the eye flash with a restrained spectral fire.
 */
export const crystalVertexPars = /* glsl */ `
attribute vec3 aBary;
varying vec3 vBary;
`;
export const crystalVertexMain = /* glsl */ `
vBary = aBary;
`;
export const crystalFirePars = /* glsl */ `
uniform float uFire;
uniform float uInner;
uniform float uScatter;
uniform float uShade;
uniform float uInternal;
uniform float uCellScale;
varying vec3 vBary;

// 3D cellular noise: F1, F2 and the id of the nearest cell. Cell boundaries are planes, so any
// slice through it is a set of straight-edged polygons — the facets seen inside a cut stone.
vec3 cellHash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453);
}
vec3 crystalCells(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  float f1 = 8.0;
  float f2 = 8.0;
  vec3 best = vec3(0.0);
  for (int k = 0; k < 27; k++) {
    vec3 o = vec3(float(k % 3), float((k / 3) % 3), float(k / 9)) - 1.0;
    vec3 c = o + cellHash3(i + o);
    float d = dot(c - f, c - f);
    if (d < f1) {
      f2 = f1;
      f1 = d;
      best = i + o;
    } else if (d < f2) {
      f2 = d;
    }
  }
  return vec3(sqrt(f2) - sqrt(f1), cellHash3(best * 1.31 + 7.0).xy);
}
float facetHash(vec3 n) {
  return fract(sin(dot(floor(n * 7.0 + 0.5), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}
`;
export const crystalFireMain = /* glsl */ `
{
  vec3 fN = geometryNormal;
  vec3 fV = geometryViewDir;
  vec3 nW = inverseTransformDirection(fN, viewMatrix);
  float h = facetHash(nW);
  float h2 = facetHash(nW * 1.7 + 3.1);
  float h3 = facetHash(nW * 2.3 + 7.7);
  // Clear stone: facets stay bright; only a few look into a darker part of the room.
  outgoingLight *= mix(1.0, 1.0 - uShade + uShade * 1.6 * h3, uFire);
  #if defined(USE_ENVMAP) && defined(ENVMAP_TYPE_CUBE_UV)
    // One internal bounce: into the stone, off a back facet, out towards another part of the
    // surroundings. Neighbouring facets show unrelated, sharp pieces of the room.
    vec3 vW = inverseTransformDirection(fV, viewMatrix);
    vec3 inside = refract(-vW, nW, 1.0 / 1.9);
    vec3 tilt = vec3(facetHash(nW * 3.3 + 1.0), facetHash(nW * 5.1 + 2.0), facetHash(nW * 7.7 + 3.0)) - 0.5;
    vec3 bounce = reflect(inside, normalize(-nW + tilt * 1.6));
    vec3 inner = textureCubeUV(envMap, envMapRotation * bounce, 0.0).rgb * envMapIntensity;
    outgoingLight = mix(outgoingLight, inner * (0.35 + 0.8 * h * h), uInner);
  #endif
  #if NUM_DIR_LIGHTS > 0
    // Sunlight trapped in the stone: facets turned between the sun and the eye glow warm gold to
    // white, a few split it into a restrained spectrum (fire), the best aligned flash (glints).
    vec3 L = directionalLights[0].direction;
    vec3 sunC = directionalLights[0].color;
    vec3 Hs = normalize(L + fV);
    float toward = saturate(dot(fN, Hs));
    // Each facet sends its trapped light in its own direction: only a few line up with the eye.
    vec3 jitterN = normalize(fN + (vec3(h, h2, h3) - 0.5) * 1.1);
    float caught = pow(saturate(dot(jitterN, Hs)), 4.0);
    vec3 warm = mix(vec3(1.0, 0.82, 0.55), vec3(1.0, 0.97, 0.92), h2);
    outgoingLight += warm * sunC * caught * 0.22 * uFire;
    float gate = smoothstep(0.42, 0.75, h2);
    // Prismatic fire across neighbouring facets: orange, gold, a little green, cyan to blue
    // (the reference leaf carries a full band of it); never pink.
    float hue = fract(h * 0.9 + dot(fN, fV) * 1.3 + vBary.x * 0.25);
    vec3 spectrum = clamp(abs(fract(hue * 0.62 + vec3(0.0, 0.92, 0.84)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
    spectrum = mix(vec3(1.0), spectrum, 0.75);
    outgoingLight += spectrum * pow(saturate(dot(jitterN, Hs)), 2.5) * gate * 0.3 * sunC * uFire;
    outgoingLight += pow(saturate(dot(jitterN, Hs)), 60.0) * 2.5 * sunC * uFire;
  #endif
  // Internal facets: the view ray, bent into the stone, crosses the stone's back facets. Each
  // shows its own piece of light — dark, mid or sunlit — separated by fine dark and bright lines.
  {
    vec3 vWi = normalize(cameraPosition - vWorldPosition);
    vec3 inside = refract(-vWi, nW, 1.0 / 1.9);
    vec3 cells = crystalCells((vWorldPosition + inside * 0.35) * uCellScale);
    float line = 1.0 - smoothstep(0.0, 0.035 + 1.5 * fwidth(cells.x), cells.x);
    float r = cells.y;
    vec3 tone = r < 0.18 ? vec3(0.55, 0.55, 0.57) : r < 0.7 ? vec3(0.96, 0.95, 0.94) : vec3(1.3, 1.2, 1.02);
    // A few cells split the light (fire).
    if (cells.z > 0.93) tone *= 0.85 + 0.6 * clamp(abs(fract(cells.z * 5.0 + vec3(0.0, 0.33, 0.67)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
    vec3 lit = outgoingLight * tone;
    lit = mix(lit, lit * (r < 0.5 ? 0.45 : 1.6), line);
    outgoingLight = mix(outgoingLight, lit, uInternal);
  }
  // Cut edges: a faint darker seam where facets meet (not on facets only a few pixels wide,
  // where it would only shimmer).
  float edge = min(min(vBary.x, vBary.y), vBary.z);
  float w = fwidth(edge);
  float seam = (1.0 - smoothstep(0.5 * w, 2.0 * w, edge)) * (1.0 - smoothstep(0.08, 0.2, w));
  outgoingLight *= 1.0 - 0.12 * seam * uFire;
}
`;
