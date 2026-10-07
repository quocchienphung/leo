import * as THREE from "three";

/**
 * The source runs three r153 with legacy lighting (intensities scaled by π, no point-light
 * falloff when distance = 0). These helpers reproduce that look on the installed r186.
 */
export function legacyIntensity(intensity: number): number {
  return intensity * Math.PI;
}

export function ambientLight(color: THREE.ColorRepresentation, intensity: number): THREE.AmbientLight {
  return new THREE.AmbientLight(color, legacyIntensity(intensity));
}

export function directionalLight(color: THREE.ColorRepresentation, intensity: number): THREE.DirectionalLight {
  return new THREE.DirectionalLight(color, legacyIntensity(intensity));
}

export function pointLight(color: THREE.ColorRepresentation, intensity: number): THREE.PointLight {
  return new THREE.PointLight(color, legacyIntensity(intensity), 0, 0);
}
