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

  // Caustics where sunlight leaves the crystal (towards the camera and left of each piece, the
  // way the sun falls): the daisy's base, the lily's glass block, the floor spheres; faintly rainbow.
  float m = exp(-dot(sp - vec2(-0.2, 1.2), sp - vec2(-0.2, 1.2)) / 1.6);
  m += 0.7 * exp(-dot(sp - vec2(1.8, 0.95), sp - vec2(1.8, 0.95)) / 0.35);
  m += 0.6 * exp(-dot(sp - vec2(2.6, 2.15), sp - vec2(2.6, 2.15)) / 0.25);
  m += 0.5 * exp(-dot(sp - vec2(-1.75, 1.9), sp - vec2(-1.75, 1.9)) / 0.15);
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

/**
 * HDR → display: soft bloom (only what is far brighter than sunlit marble: glints, the sun), the
 * sun's glare at the top right, ACES filmic, a contrast-adaptive sharpen, grade, sRGB. No full-frame
 * veil, no drawn light beams or star streaks: the light comes from the scene itself.
 */
export const finalFragment = /* glsl */ `
uniform sampler2D tInput;
uniform sampler2D tBloom0;
uniform sampler2D tBloom1;
uniform sampler2D tBloom2;
uniform sampler2D tGlints;
uniform float uGlints;
uniform vec3 uBloom;
uniform vec2 uTexel;
uniform float uSharpen;
uniform float uExposure;
uniform float uAspect;
uniform vec3 uGlowColor;
uniform vec3 uGlare;
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
vec3 scene(vec2 uv) {
  return min(max(texture2D(tInput, uv).rgb, vec3(0.0)), vec3(64.0));
}
float lumaOf(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}
void main() {
  vec2 d = vUv - 0.5;
  vec2 off = d * uAberration;
  vec3 c;
  c.r = scene(vUv + off).r;
  c.g = scene(vUv).g;
  c.b = scene(vUv - off).b;
  vec3 bloom = texture2D(tBloom0, vUv).rgb * uBloom.x + texture2D(tBloom1, vUv).rgb * uBloom.y + texture2D(tBloom2, vUv).rgb * uBloom.z;
  c += min(max(bloom, vec3(0.0)), vec3(64.0));
  // The low sun just beyond the top right corner: a warm glare kept to that corner (a wide halo
  // washed out the figurines on the right).
  vec2 g = vec2((vUv.x - uGlare.x) * uAspect, vUv.y - uGlare.y);
  float r2 = dot(g, g);
  c += uGlowColor * uGlare.z * (exp(-r2 / 0.014) + 0.05 * exp(-r2 / 0.05));
  c += texture2D(tGlints, vUv).rgb * uGlints;
  vec3 col = acesFilmic(c);
  // Contrast-adaptive sharpen (display space, limited to the local range: no halos).
  if (uSharpen > 0.0) {
    vec3 n0 = acesFilmic(scene(vUv + vec2(uTexel.x, 0.0)));
    vec3 n1 = acesFilmic(scene(vUv - vec2(uTexel.x, 0.0)));
    vec3 n2 = acesFilmic(scene(vUv + vec2(0.0, uTexel.y)));
    vec3 n3 = acesFilmic(scene(vUv - vec2(0.0, uTexel.y)));
    vec3 base = acesFilmic(scene(vUv));
    vec3 lo = min(min(min(n0, n1), min(n2, n3)), base);
    vec3 hi = max(max(max(n0, n1), max(n2, n3)), base);
    float amp = clamp(min(lumaOf(lo), 1.0 - lumaOf(hi)) / max(lumaOf(hi), 1e-3), 0.0, 1.0);
    vec3 sharp = base + (base - 0.25 * (n0 + n1 + n2 + n3)) * uSharpen * sqrt(amp);
    col += clamp(sharp, lo, hi) - base;
  }
  // Contrast (gentle S on the mid-tones) and a touch more colour.
  col = clamp(col, 0.0, 1.0);
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.36);
  float luma = lumaOf(col);
  col = max(mix(vec3(luma), col, 1.16), 0.0);
  // Golden hour: warm cream highlights, a little cool in the shade.
  col *= mix(vec3(0.965, 0.985, 1.035), vec3(1.035, 1.0, 0.95), smoothstep(0.15, 0.85, luma));
  col *= 1.0 - dot(d, d) * uVignette;
  gl_FragColor = vec4(toSRGB(clamp(col, 0.0, 1.0)), 1.0);
}`;

/**
 * Frosted, milky body: the refracted background keeps its brightness but loses most of its hue
 * and some contrast, as if scattered inside the glass. Applied to three's transmission chunk.
 */
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
 * Sunlight diffusing through translucent glass. `uTransBody` 1 lights the whole body (the orb,
 * glowing from within); 0 keeps the glow to the thick rim, where light travels along the glass
 * (petals, stem): the body stays clear instead of being washed over with white.
 */
export const translucencyPars = /* glsl */ `
uniform vec3 uTransColor;
uniform float uTransScale;
uniform float uTransPower;
uniform float uTransDistortion;
uniform float uTransAmbient;
uniform float uTransBody;
`;
export const translucencyMain = /* glsl */ `
{
  vec3 trans = vec3(0.0);
  float ndv = saturate(dot(geometryNormal, geometryViewDir));
  float edge = pow(1.0 - ndv, 1.6);
  float shape = mix(edge, 1.0, uTransBody);
  #if NUM_DIR_LIGHTS > 0
    DirectionalLight tl = directionalLights[0];
    float nl = dot(geometryNormal, tl.direction);
    float lit = saturate((nl + 0.3) / 1.3);
    float through = saturate((0.2 - nl) / 1.2);
    vec3 tH = normalize(tl.direction + geometryNormal * uTransDistortion);
    float lobe = pow(saturate(dot(geometryViewDir, -tH)), uTransPower);
    trans += tl.color * uTransScale * (0.5 * lit * uTransBody + 0.3 * through + 0.6 * lobe) * shape;
  #endif
  trans += vec3(uTransAmbient * mix(edge, 0.2 + 0.8 * pow(ndv, 1.5), uTransBody));
  outgoingLight += uTransColor * trans;
}
`;

/**
 * Petal glitter: flakes fixed in the petal (object space) that flash when they face the sun, and a
 * thin bright rim line (uGlitterRim). A flake layer fades out where its cells get smaller than
 * a pixel, so it never crawls or shimmers at low resolution.
 */
export const glitterVertexPars = /* glsl */ `
varying vec3 vGlitterPos;
`;
export const glitterVertexMain = /* glsl */ `
vGlitterPos = position;
`;
export const glitterFragmentPars = /* glsl */ `
uniform vec3 uGlitterSun;
uniform float uGlitter;
uniform float uGlitterRim;
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
  vec3 nW = normalize(transformDirectionByInverseViewMatrix(geometryNormal, viewMatrix));
  vec3 vW = normalize(cameraPosition - vWorldPosition);
  vec3 footprint = fwidth(vGlitterPos);
  float perUnit = max(max(footprint.x, footprint.y), footprint.z);
  for (int k = 0; k < 2; k++) {
    float scale = k == 0 ? 120.0 : 60.0;
    // Cells per pixel: fade the layer out before a flake drops under ≈ 1.5 pixels.
    float visible = 1.0 - smoothstep(0.55, 0.85, perUnit * scale);
    vec3 cell = floor(vGlitterPos * scale + float(k) * 17.0);
    float g = glitterHash(cell);
    vec3 tilt = vec3(glitterHash(cell + 1.7), glitterHash(cell + 3.1), glitterHash(cell + 5.3)) - 0.5;
    vec3 flake = normalize(nW + tilt * 1.5);
    float spark = pow(saturate(dot(reflect(-vW, flake), uGlitterSun)), k == 0 ? 20.0 : 60.0);
    float present = step(k == 0 ? 0.8 : 0.9, g);
    outgoingLight += vec3(1.0, 0.97, 0.92) * present * visible * ((k == 0 ? 0.03 : 0.05) + spark * (k == 0 ? 1.0 : 3.0)) * uGlitter;
  }
  float rimLine = pow(1.0 - saturate(dot(geometryNormal, geometryViewDir)), 5.0);
  outgoingLight += vec3(1.0, 0.97, 0.92) * rimLine * uGlitterRim;
}
#endif
`;
