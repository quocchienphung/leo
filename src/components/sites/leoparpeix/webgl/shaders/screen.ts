// Full-screen / overlay shaders ported from the source (lines ~59942, 60155, 67977, 68156).

/** Composite pass with film grain (`hY`). */
export const grainFragment = /* glsl */ `uniform sampler2D tDiffuse;
uniform float uNoiseStrength;
uniform float uTime;

varying vec2 vUv;

float hash21(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

void main() {
	vec4 render = texture2D(tDiffuse, vUv);

	if (uNoiseStrength > 0.0) {
		float noise = hash21(gl_FragCoord.xy + uTime * vec2(0.017, 0.013)) - 0.5;
		render.rgb += noise * uNoiseStrength;
	}

	gl_FragColor = render;
}`;

export const quadVertex = /* glsl */ `varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/** Flat colour plane (`wY`) used for section backgrounds when fluid effects are on. */
export const flatColorFragment = /* glsl */ `uniform vec3 uColor;

void main() {
	gl_FragColor = vec4(uColor, 1.0);
}`;

export const flatColorVertex = /* glsl */ `void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/** Loader rounded-card mask (`nq`). The mask is opaque OUTSIDE the card. */
export const loaderMaskFragment = /* glsl */ `varying vec2 vUv;

uniform float uGlobalProgress;
uniform float uScaleProgress;
uniform float uFinalProgress;
uniform vec2 uResolution;
uniform vec3 uColor;

float box(vec2 position, vec2 halfSize, float cornerRadius) {
   position = abs(position) - halfSize + cornerRadius;
   return length(max(position, 0.0)) + min(max(position.x, position.y), 0.0) - cornerRadius;
}

vec3 rotateX(vec3 p, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}

vec3 rotateZ(vec3 p, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z);
}

void main() {
	vec2 uv = vUv - 0.5;

	float aspect = uResolution.x / uResolution.y;

	float verticalOffset = -0.13;

	float firstOffsetProgressY = mix(1., verticalOffset, uGlobalProgress);
	float lastOffsetProgressY = mix(verticalOffset, 0.0, uFinalProgress);

	float finalOffsetProgressY = mix(firstOffsetProgressY, lastOffsetProgressY, uFinalProgress);

	float lastOffsetProgressX = mix(0.0, 0.0, uFinalProgress);

	float firstOffsetProgressX = mix(0.0, 0.0, uGlobalProgress);

	vec2 pos2D = uv + vec2(firstOffsetProgressX, finalOffsetProgressY);

	vec3 pos3D = vec3(pos2D, 0.0);

	float PI = 3.1415926535897932384626433832795;

	float rotateProgressZ = mix(-PI * 0.3, 0.0, uGlobalProgress);
	float rotateProgressX = mix(-PI * 0.4, 0.0, uGlobalProgress);

	vec3 rotated = rotateZ(pos3D, rotateProgressZ);
	rotated = rotateX(rotated, rotateProgressX);

	float perspective = 2.0;
	float z = max(rotated.z + perspective, 1.0);
	vec2 projected = rotated.xy / z * perspective;

	projected.x *= aspect;

	float firstEndScale = 0.5;
	float firstScaleRatio = 1.0 / 2.0;

	float firstScaleProgress = mix(0.0, firstEndScale, uScaleProgress);

	float firstHalfSize = firstScaleProgress * firstScaleRatio;
	vec2 firstBoxScale = vec2(firstHalfSize, firstHalfSize);

	float lastEndScale = max(0.95, 0.5 * max(aspect, 1.0) * 1.02);
	float finalScaleRatio = 1.0;
	float lastHalfSize = lastEndScale * finalScaleRatio;
	vec2 lastBoxScale = vec2(lastHalfSize, lastHalfSize);

	vec2 finalBoxScale = mix(firstBoxScale, lastBoxScale, uFinalProgress);

	float cornerRadius = 0.05;

	float sdf = box(projected, finalBoxScale, cornerRadius);

	float mask = step(0.0, sdf);

	gl_FragColor = vec4(uColor, mask);
}`;

/** Page transition disc (`lq`): opaque inside radius `uTransition`. */
export const transitionFragment = /* glsl */ `varying vec2 vUv;

uniform float uTransition;
uniform vec2 uResolution;
uniform vec3 uColor;

void main() {
	vec2 uv = vUv - 0.5;

	float aspect = uResolution.x / uResolution.y;
	uv.x *= aspect;

	float dist = length(uv);

	float mask = step(uTransition, dist);
	float strength = 1.0 - mask;

	gl_FragColor = vec4(uColor, strength);
}`;

/** Slider media plane (`IY`): cover-fit, parallax and drag push. */
export const sliderFragment = /* glsl */ `precision highp float;

uniform float uTime;
uniform float uDragForce;
uniform float uParallaxProgress;
uniform float uParallaxX;
uniform float uDragScaleStrength;
uniform float uDragColorStrength;
uniform float uCoverBleed;
uniform vec2 uPlaneSizes;
uniform vec2 uTextureSizes;
uniform sampler2D uTexture;

varying vec2 vScreenSpace;
varying vec2 vUv;

void main() {

	vec2 ratio = vec2(min((uPlaneSizes.x / uPlaneSizes.y) / (uTextureSizes.x / uTextureSizes.y), 1.0), min((uPlaneSizes.y / uPlaneSizes.x) / (uTextureSizes.y / uTextureSizes.x), 1.0));

	vec2 uv = vec2(vUv.x * ratio.x + (1.0 - ratio.x) * 0.5, vUv.y * ratio.y + (1.0 - ratio.y) * 0.5);

	uv = (uv - 0.5) / uCoverBleed + 0.5;

	uv.x = uv.x * 2.0 - 1.0;
	uv.x = uv.x * 0.5 + 0.5;
	uv.y += uParallaxProgress * 0.085;
	uv.x += uParallaxX * 0.085;
	uv.y = 1.0 - uv.y;

	vec4 texture = texture2D(uTexture, uv);

	gl_FragColor = texture;
}`;

export const sliderVertex = /* glsl */ `uniform float uTime;
uniform float uDragForce;
uniform float uDragScaleStrength;
uniform float uDragScaleStrengthZ;
uniform float scrollDeformationDirection;

varying vec2 vScreenSpace;
varying vec2 vUv;

void main() {

  vec4 tmpGlPosition = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

  vScreenSpace = (tmpGlPosition.xy) / tmpGlPosition.w;
  float dist = smoothstep(0., 5.5, length(vec2(vScreenSpace.x, position.y)));
  float worldSpaceDist = 1. - smoothstep(0., 3., length(vec2(position.x, vScreenSpace.y)));
  vUv = uv;

  vec3 transformedPositions = position.xyz;

  transformedPositions.z -= dist * uDragForce * uDragScaleStrengthZ;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformedPositions, 1.0);
}`;
