// GLSL ported verbatim from the source bundle (lines ~61162–61500, 62509–62650).

/** Baked environment material (`i1`). GLSL3. */
export const envFragment = /* glsl */ `precision highp float;

vec4 sampleTexelMaxCross(sampler2D tex, vec2 uv, vec2 resolution) {
	ivec2 maxCoord = ivec2(resolution) - ivec2(1);
	ivec2 coord = ivec2(uv * resolution);
	coord = clamp(coord, ivec2(0), maxCoord);

	vec4 result = texelFetch(tex, coord, 0);
	result = max(result, texelFetch(tex, clamp(coord + ivec2(1, 0), ivec2(0), maxCoord), 0));
	result = max(result, texelFetch(tex, clamp(coord + ivec2(-1, 0), ivec2(0), maxCoord), 0));
	result = max(result, texelFetch(tex, clamp(coord + ivec2(0, 1), ivec2(0), maxCoord), 0));
	result = max(result, texelFetch(tex, clamp(coord + ivec2(0, -1), ivec2(0), maxCoord), 0));

	return result;
}
#ifndef PI
	#define PI 3.14159265358
#endif
#ifndef TAU
	#define TAU 6.28318530718
#endif
#ifndef BLUR_ITERATIONS
	#define BLUR_ITERATIONS 10
#endif

highp float hashBlurRand(const in vec2 uv) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot(uv.xy, vec2(a, b)), sn = mod(dt, PI);
	return fract(sin(sn) * c);
}

vec2 hashBlurMult(inout vec2 r) {
	r = fract(r * vec2(12.9898, 78.233));
	return sqrt(r.x + 0.001) * vec2(sin(r.y * TAU), cos(r.y * TAU));
}

vec3 hashBlurTexture(sampler2D tex, vec2 uv, float radius, float aspect, vec2 offset) {
	vec2 circle = vec2(radius);
	circle.x *= aspect;
	vec2 rnd = vec2(hashBlurRand(uv + offset));

	vec3 acc = vec3(0.0);
	for (int i = 0; i < BLUR_ITERATIONS; i++) {
		acc += texture(tex, uv + circle * hashBlurMult(rnd)).rgb;
	}

	return acc / float(BLUR_ITERATIONS);
}

in vec2 vUv;

uniform sampler2D uTexture;
uniform vec2 uTextureResolution;
uniform float uBlurRadius;

out vec4 fragColor;

vec4 sampleBaseColor() {
	#if defined(USE_TEXEL_MAX_CROSS)
		return sampleTexelMaxCross(uTexture, vUv, uTextureResolution);
	#else
		return texture(uTexture, vUv);
	#endif
}

void main() {
	vec4 texColor = sampleBaseColor();

	#ifndef USE_HASH_BLUR
		fragColor = texColor;
	#else
		if (uBlurRadius <= 0.0) {
			fragColor = texColor;
		} else {
			float radius = uBlurRadius / uTextureResolution.x;
			float aspect = uTextureResolution.x / uTextureResolution.y;
			vec3 blurred = hashBlurTexture(uTexture, vUv, radius, aspect, vec2(0.0));
			fragColor = vec4(blurred, texColor.a);
		}
	#endif
}`;

export const envVertex = /* glsl */ `out vec2 vUv;

void main() {
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/** About trees (`sX`): wind sway around each tree's centre. GLSL3. */
export const treesFragment = /* glsl */ `precision highp float;

uniform sampler2D uTexture;

in vec2 vUv;

out vec4 fragColor;

void main() {
	fragColor = texture(uTexture, vUv);
}`;

export const treesVertex = /* glsl */ `in vec3 _centerposition;

uniform float uTime;
uniform float uWindStrength;

out vec2 vUv;
out vec3 vPosition;

float hash(float n) {
	return fract(sin(n) * 43758.5453123);
}

void main() {
	vUv = uv;

	vec3 pos = position;

	vec3 localPos = pos - _centerposition;
	float height = localPos.y;

	vPosition = localPos;

	float seed = dot(_centerposition.xz, vec2(12.9898, 78.233));
	float phase = hash(seed) * 6.2831;
	float speed = mix(0., 1., hash(seed + 1.0)) + 1.0;

	float ondulation = uTime * 0.002 * speed + phase;

	if (height > 0.) {
		pos.z -= sin(height * 1. + ondulation) * 0.025;
	}

	gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}`;

/** About mountain (`cX`). GLSL3. */
export const mountainFragment = /* glsl */ `precision highp float;

in vec2 vUv;

uniform sampler2D uTexture;

out vec4 fragColor;

void main() {
	float dist = smoothstep(0.3, 0.4, vUv.y);

	vec4 texColor = texture(uTexture, vUv);

	fragColor = vec4(texColor.rgb, texColor.a * dist);
}`;

/** Background gradient sphere (`pX`). GLSL1. */
export const gradientFragment = /* glsl */ `precision highp float;

uniform float uTime;
uniform vec3 uTopColor;
uniform vec3 uBottomColor;
uniform float uGradientSmoothMin;
uniform float uGradientSmoothMax;

varying vec2 vUv;

void main() {
	float dist = vUv.y;
	float gradientMix = smoothstep(uGradientSmoothMin, uGradientSmoothMax, dist);
	vec3 color = mix(uBottomColor, uTopColor, gradientMix);

	gl_FragColor = vec4(color, 1.0);
}`;

export const gradientVertex = /* glsl */ `uniform float uTime;

varying vec2 vUv;

void main() {
  vUv = uv;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);

}`;

/** Instanced clouds (`vX`). GLSL3. */
export const cloudsFragment = /* glsl */ `precision highp float;

uniform float uTime;
uniform float uDeformationSpeedFactor;
uniform vec3 uTintColor;
uniform sampler2D uTextures[6];
uniform sampler2D uNoiseTexture;

flat in float vRandomTextureIndex;
flat in float vRandomTextureDirection;
in vec2 vUv;

out vec4 fragColor;

void main() {
	float time = -uTime * 0.00004 * uDeformationSpeedFactor;

	vec2 uv = vUv;
	uv.x -= time;

	vec4 noiseTexture = texture(uNoiseTexture, uv * 0.05);
	float cloudDeformation = noiseTexture.r * 0.04;

	vec2 baseUv = vRandomTextureDirection < 0.5 ? vUv : vec2(1.0 - vUv.x, vUv.y);
	vec2 textureUv = baseUv + cloudDeformation;

	vec2 uvDx = dFdx(baseUv);
	vec2 uvDy = dFdy(baseUv);

	vec4 randomTexture;
	int intRandomTextureIndex = int(vRandomTextureIndex);

	if(intRandomTextureIndex == 0) {
		randomTexture = textureGrad(uTextures[0], textureUv, uvDx, uvDy);
	} else if(intRandomTextureIndex == 1) {
		randomTexture = textureGrad(uTextures[1], textureUv, uvDx, uvDy);
	} else if(intRandomTextureIndex == 2) {
		randomTexture = textureGrad(uTextures[2], textureUv, uvDx, uvDy);
	} else if(intRandomTextureIndex == 3) {
		randomTexture = textureGrad(uTextures[3], textureUv, uvDx, uvDy);
	} else if(intRandomTextureIndex == 4) {
		randomTexture = textureGrad(uTextures[4], textureUv, uvDx, uvDy);
	} else if(intRandomTextureIndex == 5) {
		randomTexture = textureGrad(uTextures[5], textureUv, uvDx, uvDy);
	}

	fragColor = vec4(randomTexture.rgb * uTintColor, randomTexture.a);
}`;

export const cloudsVertex = /* glsl */ `in float aRandomSpeed;
in float aRandomScale;
in float aRandomTextureIndex;
in float aRandomTextureDirection;
in vec3 aPositions;

uniform float uTime;
uniform float uRangeZ;
uniform float uTranslationSpeedFactor;

flat out float vRandomTextureIndex;
flat out float vRandomTextureDirection;
out vec2 vUv;

void main() {
  float time = -uTime * 0.0004 * aRandomSpeed * uTranslationSpeedFactor;

  vec3 transformedPositions = aPositions;

  transformedPositions.z += time;
  transformedPositions.z = mod(transformedPositions.z + uRangeZ, uRangeZ * 2.0) - uRangeZ;

  vec4 basePosition = vec4(position * aRandomScale, 0.);

  vec4 finalPositions = basePosition + vec4(transformedPositions, 1.);

  vec4 mv = modelViewMatrix * finalPositions;

  gl_Position = projectionMatrix * mv;

  vRandomTextureIndex = aRandomTextureIndex;
  vRandomTextureDirection = aRandomTextureDirection;
  vUv = uv;
}`;

/** Floating dust (`QX`). GLSL1, gl.POINTS. */
export const particlesFragment = /* glsl */ `uniform vec3 uColor;

varying float vFade;
varying float vRandomOpacity;
varying float vCameraFade;

void main() {
	float fadeIn = smoothstep(0., 0.035, vFade);
	float fadeOut = 1.0 - smoothstep(0.035, 1.0, vFade);
	float fadeRender = fadeIn * fadeOut;

	vec2 uv = gl_PointCoord;

	float strength = distance(uv, vec2(0.5));
	strength = 1.0 - strength;
	strength = pow(strength, 3.0);

	gl_FragColor.rgb = uColor;
	gl_FragColor.a = strength * fadeRender * vRandomOpacity;
}`;

export const particlesVertex = /* glsl */ `attribute float aScale;
attribute float aSpeed;
attribute float aOpacity;
attribute vec3 aPositions;

uniform float uTime;
uniform float uDisplacementSpeed;
uniform float uDeformationSpeed;
uniform float uScale;
uniform vec3 uArea;
uniform vec3 uDisplacement;
uniform vec3 uDeformationAmplitude;
uniform vec3 uDeformationFrequency;

varying float vRandomOpacity;
varying float vFade;
varying float vCameraFade;

void main() {
  float displacementSpeed = uTime * aSpeed * uDisplacementSpeed * 0.001;
  float life = mod(displacementSpeed + aOpacity, 1.0);

  vec3 particlePosition = position;

  particlePosition.x *= uArea.x;
  particlePosition.y *= uArea.y;
  particlePosition.z *= uArea.z;

  particlePosition.x += (life) * uDisplacement.x;
  particlePosition.y += (life) * uDisplacement.y;
  particlePosition.z += (life) * uDisplacement.z;

  particlePosition.x += sin(uTime * uDeformationSpeed * aSpeed + particlePosition.y * uDeformationFrequency.x) * uDeformationAmplitude.x;
  particlePosition.y += cos(uTime * uDeformationSpeed * aSpeed + particlePosition.x * uDeformationFrequency.y) * uDeformationAmplitude.y;
  particlePosition.z += cos(uTime * uDeformationSpeed * aSpeed + particlePosition.z * uDeformationFrequency.z) * uDeformationAmplitude.z;

  vec4 mv = modelViewMatrix * vec4(particlePosition, 1.0);
  gl_Position = projectionMatrix * mv;

  vRandomOpacity = aOpacity;
  vFade = life;
  vCameraFade = 1.0 - smoothstep(0.45, 0.55, min(10., (10. / length(mv.xyz))));

  gl_PointSize = 10.0 * aScale * uScale;
}`;

/** Planar water reflector (`CX`). GLSL1 with three chunks. */
export const waterFragment = /* glsl */ `uniform float uTime;
uniform float uWaveStrength;
uniform float uWaveSpeed;
uniform float uOpacity;
uniform vec3 uColor;
uniform float uContrast;
uniform float uSaturation;
uniform float uBrightness;
uniform float uBlurRadius;
uniform float uNoiseRepeat;
uniform sampler2D tDiffuse;
uniform sampler2D tDeformation;
uniform sampler2D tNoise;
uniform sampler2D tWaterShadow;

varying vec2 vUv;
varying vec4 vUvRefraction;

#include <logdepthbuf_pars_fragment>

#define PI 3.14159265358
#define TAU 6.28318530718
#define BLUR_ITERATIONS 10

vec3 contrastSaturationBrightness(vec3 color, float con, float sat, float brt) {
	const float AvgLumR = 0.5;
	const float AvgLumG = 0.5;
	const float AvgLumB = 0.5;

	const vec3 LumCoeff = vec3(0.2125, 0.7154, 0.0721);

	vec3 AvgLumin = vec3(AvgLumR, AvgLumG, AvgLumB);
	vec3 brtColor = color * brt;
	vec3 intensity = vec3(dot(brtColor, LumCoeff));
	vec3 satColor = mix(intensity, brtColor, sat);
	vec3 conColor = mix(AvgLumin, satColor, con);

	return conColor;
}

highp float rand(const in vec2 uv) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot(uv.xy, vec2(a, b)), sn = mod(dt, PI);
	return fract(sin(sn) * c);
}

vec2 mult(inout vec2 r) {
	r = fract(r * vec2(12.9898, 78.233));
	return sqrt(r.x + 0.001) * vec2(sin(r.y * TAU), cos(r.y * TAU));
}

vec3 hashBlurTexture(sampler2D tex, vec4 uv, float radius, float aspect, vec2 offset) {
	vec2 circle = vec2(radius);
	circle.x *= aspect;
	vec2 rnd = vec2(rand(vec2(uv.xy + offset)));

	vec3 acc = vec3(0.0);
	for (int i = 0; i < BLUR_ITERATIONS; i++) {
		acc += texture2DProj(tex, uv + vec4(vec2(circle * mult(rnd)), 0.0, 0.0)).xyz;
	}

	return acc / float(BLUR_ITERATIONS);
}

void main() {
	#include <logdepthbuf_fragment>

	float texRepeat = 10.0;

	vec2 distortedUv = texture2D(tDeformation, vec2(vUv.x * texRepeat + (uTime * uWaveSpeed * 0.0001), vUv.y * texRepeat + (uTime * uWaveSpeed * 0.0001))).rg * uWaveStrength;
	distortedUv = vUv.xy + vec2(distortedUv.x, distortedUv.y + uTime * uWaveSpeed * 0.0001);
	vec2 distortion = (texture2D(tDeformation, distortedUv).rg * 2.0 - 1.0) * uWaveStrength;

	vec4 fullReflect = vec4(vUvRefraction);
	fullReflect.xy += distortion;

	float noiseValue = texture2D(tNoise, vUv * uNoiseRepeat).r;

	vec3 reflect;
	if (uBlurRadius <= 0.0) {
		reflect = texture2DProj(tDiffuse, fullReflect).rgb;
	} else {
		float blurRadius = uBlurRadius * noiseValue;
		reflect = hashBlurTexture(tDiffuse, fullReflect, blurRadius, 1.0, vec2(noiseValue));
	}

	reflect = contrastSaturationBrightness(reflect, uContrast, uSaturation, uBrightness);

	gl_FragColor.rgb = reflect;
	gl_FragColor.a = uOpacity;

	#include <tonemapping_fragment>
}`;

export const waterVertex = /* glsl */ `uniform mat4 uTextureMatrix;
varying vec2 vUv;
varying vec4 vUvRefraction;

#include <common>
#include <logdepthbuf_pars_vertex>

void main() {
     vUv = uv;
     vUvRefraction = uTextureMatrix * vec4(position, 1.0);

     gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

    #include <logdepthbuf_vertex>
}`;
