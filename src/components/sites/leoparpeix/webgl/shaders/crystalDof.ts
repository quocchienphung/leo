/** View-depth driven, signed circle of confusion in pixels at the reference height (941px). */
const depthPars = /* glsl */ `
uniform sampler2D tDepth;
uniform vec2 uNearFar;
uniform float uFocus;
uniform float uAperture;
uniform float uMaxBlur;
uniform float uFarBlurScale;
uniform float uNearBlurScale;
uniform float uFocusBand;
uniform vec2 uPixel;
varying vec2 vUv;
float viewDepth(vec2 uv) {
  float d = textureLod(tDepth, uv, 0.0).r;
  return uNearFar.x * uNearFar.y / max(uNearFar.y - d * (uNearFar.y - uNearFar.x), 0.0001);
}
float cocAt(float z) {
  // A generous sharp band retains the whole flower, from its leaves to its front dome.
  float delta = max(abs(z - uFocus) - uFocusBand, 0.0);
  float coc = clamp(sign(z - uFocus) * uAperture * delta / max(z, 0.01), -uMaxBlur, uMaxBlur);
  return coc > 0.0 ? coc * uFarBlurScale : coc * uNearBlurScale;
}
`;

export const dofGatherFragment = /* glsl */ `
${depthPars}
uniform sampler2D tInput;
void main() {
  float depth = viewDepth(vUv);
  float coc = cocAt(depth);
  vec3 center = textureLod(tInput, vUv, 0.0).rgb;
  if (abs(coc) < 0.6) { gl_FragColor = vec4(center, coc); return; }
  vec3 sum = center;
  float total = 1.0;
  // Fixed Vogel disk: no animated noise, no cross-shaped blur or full-frame softening.
  for (int i = 0; i < DOF_TAPS; i++) {
    float fi = float(i) + 0.5;
    float angle = fi * 2.39996323;
    float radius = sqrt(fi / float(DOF_TAPS));
    vec2 uv = clamp(vUv + vec2(cos(angle), sin(angle)) * radius * abs(coc) * uPixel, uPixel, 1.0 - uPixel);
    float sampleDepth = viewDepth(uv);
    float sampleCoc = cocAt(sampleDepth);
    // A background gather must not pull sharp petals/branches across their silhouettes.
    float foreground = smoothstep(0.5, 1.5, depth - sampleDepth);
    float weight = 1.0 - foreground * (1.0 - smoothstep(0.6, 2.5, abs(sampleCoc)) * 0.25);
    vec3 color = min(max(textureLod(tInput, uv, 0.0).rgb, vec3(0.0)), vec3(64.0));
    sum += color * weight;
    total += weight;
  }
  gl_FragColor = vec4(sum / total, coc);
}`;

export const dofCompositeFragment = /* glsl */ `
${depthPars}
uniform sampler2D tInput;
uniform sampler2D tBlur;
uniform vec2 uBlurTexel;
uniform float uDebug;
void main() {
  float coc = cocAt(viewDepth(vUv));
  if (uDebug > 0.5) {
    // Green is in focus, blue is behind it, amber is the near bokeh layer.
    vec3 zone = coc < 0.0 ? vec3(1.0, 0.36, 0.04) : vec3(0.04, 0.26, 1.0);
    gl_FragColor = vec4(mix(vec3(0.05, 0.8, 0.22), zone, clamp(abs(coc) / 6.0, 0.0, 1.0)), 1.0);
    return;
  }
  vec3 sharp = textureLod(tInput, vUv, 0.0).rgb;
  float amount = smoothstep(0.6, 2.0, abs(coc));
  if (amount < 0.001) { gl_FragColor = vec4(sharp, 1.0); return; }
  // Bilateral upsample: depth discontinuities never receive a neighbouring sharp object's blur.
  vec3 sum = vec3(0.0);
  float total = 0.0;
  for (int y = 0; y < 2; y++) {
    for (int x = 0; x < 2; x++) {
      vec4 s = textureLod(tBlur, vUv + (vec2(float(x), float(y)) - 0.5) * uBlurTexel, 0.0);
      float w = 1.0 / (0.25 + abs(s.a - coc));
      sum += s.rgb * w;
      total += w;
    }
  }
  gl_FragColor = vec4(mix(sharp, sum / max(total, 0.001), amount), 1.0);
}`;
