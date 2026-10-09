/** Animated radiance on a static, terrain-occluded flow map (linear HDR). */
export const backgroundWater = /* glsl */ `
uniform sampler2D tWater;
uniform float uWaterTime;

float waterNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  vec4 h = fract(sin(vec4(dot(i, vec2(127.1, 311.7)), dot(i + vec2(1, 0), vec2(127.1, 311.7)), dot(i + vec2(0, 1), vec2(127.1, 311.7)), dot(i + vec2(1), vec2(127.1, 311.7)))) * 43758.5453);
  return mix(mix(h.x, h.y, f.x), mix(h.z, h.w, f.x), f.y);
}

vec3 flowingBackground(vec3 background, vec2 uv) {
  vec4 flow = texture2D(tWater, uv);
  if (flow.a < 0.003) return background;
  float across = flow.g, along = flow.b;
  vec3 water;
  float opacity = flow.a;
  if (flow.r > 0.0) {
    // Stretched, falling filaments. Pattern travels towards increasing fall progress.
    float grain = waterNoise(vec2(across * 19.0, along * 33.0 - uWaterTime * 7.5));
    float threads = waterNoise(vec2(across * 38.0 + sin(along * 11.0) * 0.45, along * 8.0 - uWaterTime * 3.5));
    float body = 1.0 - smoothstep(0.75, 1.12, abs(across));
    float foam = smoothstep(0.72, 1.0, along);
    water = mix(vec3(0.22, 0.39, 0.47), vec3(1.35, 1.48, 1.42), grain * 0.35 + pow(threads, 2.0) * 0.5 + foam * 0.15);
    water += vec3(0.35, 0.33, 0.26) * pow(threads, 8.0) * body;
    // Fine impact mist breathes beside the base rather than making a solid white triangle.
    float spray = waterNoise(vec2(across * 3.5 - uWaterTime * 0.45, along * 8.0 - uWaterTime * 0.7));
    water = mix(vec3(0.72, 0.82, 0.85), water, body);
    opacity *= mix(0.65 + spray * 0.35, 0.5 + grain * 0.5, body);
  } else {
    float ripple = waterNoise(vec2(across * 12.0, along * 65.0 - uWaterTime * 3.0));
    float foam = smoothstep(0.7, 0.93, waterNoise(vec2(across * 9.0, along * 22.0 - uWaterTime * 1.5)));
    water = mix(vec3(0.10, 0.27, 0.30), vec3(0.52, 0.78, 0.82), ripple);
    water = mix(water, vec3(1.15, 1.24, 1.15), foam * 0.7);
  }
  return mix(background, water, clamp(opacity, 0.0, 1.0));
}
`;
