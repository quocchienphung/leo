import * as THREE from "three";
import type { TransitionUniforms } from "./overlays";

// Source shader injection (line ~66262): objects inside the page-transition disc are discarded,
// bees/fruits can be scaled for the load reveal, shadows can fade in.

const PARS = /* glsl */ `
uniform float uTransition;
uniform vec2 uResolution;
uniform vec2 uViewport;

float getPageTransitionVisibility(vec2 screenUv, float transition, vec2 resolution) {
	vec2 uv = screenUv - 0.5;
	uv.x *= resolution.x / resolution.y;
	float dist = length(uv);
	float overlayStrength = 1.0 - step(transition, dist);
	return 1.0 - overlayStrength;
}
`;

const LIT = /* glsl */ `
	vec2 pageTransitionScreenUv = gl_FragCoord.xy / uViewport;
	float pageTransitionVisibility = getPageTransitionVisibility(pageTransitionScreenUv, uTransition, uResolution);
	if (pageTransitionVisibility < 0.001) discard;
	outgoingLight *= pageTransitionVisibility;
	diffuseColor.a *= pageTransitionVisibility;
`;

const SHADOW_LINE = "gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );";
const SHADOW = /* glsl */ `
	vec2 pageTransitionScreenUv = gl_FragCoord.xy / uViewport;
	float pageTransitionVisibility = getPageTransitionVisibility(pageTransitionScreenUv, uTransition, uResolution);
	if (pageTransitionVisibility < 0.001) discard;
	gl_FragColor.a *= pageTransitionVisibility;
`;
const SHADOW_REVEAL = /* glsl */ `
	if (uShadowReveal < 0.001) discard;
	vec2 pageTransitionScreenUv = gl_FragCoord.xy / uViewport;
	float pageTransitionVisibility = getPageTransitionVisibility(pageTransitionScreenUv, uTransition, uResolution);
	if (pageTransitionVisibility < 0.001) discard;
	gl_FragColor.a *= pageTransitionVisibility;
`;
const OPAQUE = "#include <opaque_fragment>";
const BEGIN_VERTEX = "#include <begin_vertex>";
const LIGHT_LINE_STANDARD = "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;";

interface BindOptions {
  revealScale?: THREE.IUniform<number>;
  shadowReveal?: THREE.IUniform<number>;
  /** Source `Ww`: multiply MeshStandard outgoing light (fruits ×1.25 / ×1.4). */
  lightMultiplier?: number;
}

/** Source `Hc()`. */
export function bindPageTransition(material: THREE.Material, u: TransitionUniforms, opts: BindOptions = {}): void {
  if (material.userData.pageTransitionBound) return;
  material.userData.pageTransitionBound = true;
  const { revealScale, shadowReveal, lightMultiplier } = opts;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTransition = u.uTransition;
    shader.uniforms.uResolution = u.uResolution;
    shader.uniforms.uViewport = u.uViewport;
    if (lightMultiplier !== undefined) {
      shader.fragmentShader = shader.fragmentShader.replace(
        LIGHT_LINE_STANDARD,
        `${LIGHT_LINE_STANDARD}\n outgoingLight *= ${lightMultiplier.toFixed(2)};`,
      );
    }
    shader.fragmentShader = `${PARS}${shadowReveal ? "uniform float uShadowReveal;\n" : ""}${shader.fragmentShader}`;
    if (shader.fragmentShader.includes(OPAQUE)) {
      shader.fragmentShader = shader.fragmentShader.replace(OPAQUE, `${LIT}${OPAQUE}`);
    } else if (shader.fragmentShader.includes(SHADOW_LINE)) {
      const line = shadowReveal
        ? "gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) * uShadowReveal );"
        : SHADOW_LINE;
      shader.fragmentShader = shader.fragmentShader.replace(SHADOW_LINE, `${line}${shadowReveal ? SHADOW_REVEAL : SHADOW}`);
    }
    if (revealScale) {
      shader.uniforms.uRevealScale = revealScale;
      shader.vertexShader = `uniform float uRevealScale;\n${shader.vertexShader}`.replace(
        BEGIN_VERTEX,
        `${BEGIN_VERTEX}\n\ttransformed *= uRevealScale;`,
      );
    }
    if (shadowReveal) shader.uniforms.uShadowReveal = shadowReveal;
  };
  const key = `${material.type}_pageTransition${revealScale ? "_reveal" : ""}${shadowReveal ? "_shadowReveal" : ""}${
    lightMultiplier !== undefined ? `_l${lightMultiplier}` : ""
  }`;
  material.customProgramCacheKey = () => key;
  material.needsUpdate = true;
}

/** Source `zw()`: transparent shadow catcher bound to the transition + shadow reveal. */
export function createShadowCatcher(geometry: THREE.PlaneGeometry, u: TransitionUniforms): THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial> {
  const m = new THREE.ShadowMaterial({ transparent: true, opacity: 0.25, depthWrite: false });
  bindPageTransition(m, u, { shadowReveal: u.uShadowReveal });
  const mesh = new THREE.Mesh(geometry, m);
  mesh.visible = false;
  mesh.receiveShadow = true;
  return mesh;
}
