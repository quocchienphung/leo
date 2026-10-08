/** Small diffraction streaks from HDR highlights only; evaluated at quarter resolution. */
export const glintFragment = /* glsl */ `
uniform sampler2D tBright;
uniform vec2 uStep;
varying vec2 vUv;
void main() {
  vec3 glow = vec3(0.0);
  for (int arm = 0; arm < 4; arm++) {
    float a = float(arm) * 0.78539816 + 0.15;
    vec2 dir = vec2(cos(a), sin(a)) * uStep;
    for (int tap = 1; tap <= 3; tap++) {
      float t = float(tap);
      float radius = t * t * 2.5;
      float weight = exp(-t * 1.25) * (arm == 0 || arm == 2 ? 1.0 : 0.35);
      glow += (texture2D(tBright, vUv + dir * radius).rgb
             + texture2D(tBright, vUv - dir * radius).rgb) * weight;
    }
  }
  gl_FragColor = vec4(glow, 1.0);
}`;
