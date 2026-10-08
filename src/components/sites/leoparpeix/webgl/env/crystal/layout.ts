import * as THREE from "three";

/*
 * Playground crystal pavilion — every placement solved from the reference sketch
 * (docs/design-references/playground-crystal-reference.png, 1672 × 941; see
 * docs/research/leoparpeix/implementation/playground-crystal/VISUAL_DECONSTRUCTION.md).
 *
 * Two frames:
 * - world: the home GLB frame. The daisy keeps its `TexFleur` coordinates (faces +X, screen right −Z).
 * - stage: origin on the floor under the daisy, x right, y up, z towards the camera.
 *   world = STAGE_ORIGIN + (s.z, s.y, −s.x)  (stage group rotated π/2 about Y).
 *
 * Inverse projection used for the placements (vertical FOV 36°, f = 1448 px, pitch 4.7°):
 *   d = 8 − s.z, s.x = 0.08 + (u − 836)·d / 1448, s.y = 1.52 + d·tan(atan((470 − v) / 1448) + 4.7°)
 */
export const STAGE_ORIGIN = new THREE.Vector3(2.75, 0, 0);

export function stageToWorld(x: number, y: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(STAGE_ORIGIN.x + z, y, STAGE_ORIGIN.z - x);
}

/**
 * Camera rig solved so the base bottom (y 0) lands on v 870, the head centre (2.85) on ≈ v 350
 * and the top petal (4.02) on ≈ v 145, head at u ≈ 822.
 */
export const RIG = {
  fov: 36,
  stage: new THREE.Vector3(0.08, 1.52, 8),
  target: new THREE.Vector3(0.08, 1.52 + 8 * Math.tan(THREE.MathUtils.degToRad(4.7)), 0),
} as const;

function createRigCamera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(RIG.fov, 16 / 9, 0.05, 1200);
  stageToWorld(RIG.stage.x, RIG.stage.y, RIG.stage.z, cam.position);
  cam.lookAt(stageToWorld(RIG.target.x, RIG.target.y, RIG.target.z));
  cam.name = "camera";
  return cam;
}

/** The playground equivalent of a GLB `camera` node (read by `ModelCamera` / `MainCamera`). */
export const RIG_CAMERA = createRigCamera();

/**
 * Sun: low and behind the pavilion, just beyond the top right corner of the frame (azimuth ≈ 30°
 * right, ≈ 26° high), as in the target image: the scene is back-lit, crystal and petal rims glow,
 * light and shade from the side colonnade run towards the camera across the floor.
 */
export const SUN_STAGE = new THREE.Vector3(0.449, 0.438, -0.778).normalize();

/** Off-frame colonnade on the right whose columns stripe the floor with sun and shade. */
export const SIDE_COLONNADE = { x: 8.1, width: 0.75, depth: 0.75, height: 11, from: -5, to: 4.5, step: 2.15 } as const;
export const SUN_WORLD = new THREE.Vector3(SUN_STAGE.z, SUN_STAGE.y, -SUN_STAGE.x);

const deg = THREE.MathUtils.degToRad;

/**
 * The daisy (stage frame): based on the proportions and pose of the home/about daisy, measured on its mesh
 * (`TexFleur` in scene_v9.glb, decoded; the about one is the same sculpt). Home frame → stage:
 * x = −z, y = y, z = x − 2.84 (the rock's centre on the origin).
 * - pavilion adaptation: fuller 12-petal crown, dome Ø 0.98, centre y 2.74, lower petals slightly
 *   shorter, a deeper champagne dome and a wider right leaf, matching the supplied image;
 * - stem: straight seen from the front, Ø 0.058, from the rock (y 0.45) to behind the head,
 *   bowing back a little in depth;
 * - leaves: 0.85 × 0.45 pointed ovals, ≈ 37° above horizontal, the right one lower;
 * - rock: ≈ 1.46 wide, 1.5 deep, 0.72 high.
 */
export const FLOWER = {
  head: new THREE.Vector3(0, 2.74, -0.143),
  stem: [
    [0, 0.45, -0.308],
    [0, 0.86, -0.319],
    [0, 1.28, -0.366],
    [0, 1.7, -0.435],
    [0, 2.12, -0.458],
    [0, 2.33, -0.362],
    [0, 2.54, -0.329],
  ] as [number, number, number][],
  stemRadius: 0.029,
  leaves: [
    { base: [0, 0.88, -0.31] as [number, number, number], length: 1.12, width: 0.5, thickness: 0.14, rotation: [0, 0, deg(-53.1)] as [number, number, number] },
    { base: [0, 1.0, -0.33] as [number, number, number], length: 0.82, width: 0.446, thickness: 0.12, rotation: [0, 0, deg(52.3)] as [number, number, number] },
  ],
  rock: { width: 1.46, height: 0.72, depth: 1.5 },
  base: [0, 0, 0] as [number, number, number],
  discRadius: 0.98,
} as const;

/** Colonnade (front face at d 14). */
export const WALL = {
  z: -6,
  depth: 1.1,
  left: -10.5,
  right: 5.82, // right pier outer edge, u 1430
  top: 14,
  plinth: 0.3,
  /** Central arch: u 600 → 1300 (jambs), springing above the frame. */
  arch: { left: -2.2, right: 4.57, spring: 6.0 },
  /** Small left arch: u 290 → 445. */
  leftArch: { left: -5.2, right: -3.7, spring: 6.4 },
  /** Behind the curtains: a wide, tall opening; bright daylight glows through the voile. */
  farArch: { left: -10.3, right: -5.6, spring: 6.6 },
} as const;

/** Parapet behind the pool: top at v 655 (y 0.9). */
export const PARAPET = { z: -6.05, depth: 0.55, height: 0.9, right: 45 } as const;

/** Shallow pool round the daisy's base; the plinths of the garden stand on the marble around it. */
export const POOL = { left: -2.0, right: 1.7, back: -2.6, front: 0.85, radius: 1.0 } as const;

export const PROPS = {
  /** Clear glass spheres: on the floor and resting on plinths. */
  spheres: [
    { position: new THREE.Vector3(3.0, 0.28, 1.7), radius: 0.28 },
    { position: new THREE.Vector3(4.9, 0.44, -4.9), radius: 0.44 },
    { position: new THREE.Vector3(-2.4, 1.02, -0.8), radius: 0.12 },
    { position: new THREE.Vector3(3.45, 1.25, -2.6), radius: 0.1 },
    { position: new THREE.Vector3(-1.45, 0.2, 1.55), radius: 0.2 },
    { position: new THREE.Vector3(-2.35, 0.24, 2.3), radius: 0.24 },
  ],
  /** Clusters of clear quartz points (crystal accents of the board) in the gaps behind the pool. */
  clusters: [
    { position: new THREE.Vector3(-1.6, 0, -3.3), scale: 0.85, seed: 11 },
    { position: new THREE.Vector3(2.2, 0, -3.4), scale: 0.8, seed: 19 },
  ],
} as const;

export type FlorereSpecies = "rose" | "forgetMeNot" | "rozanne" | "lily" | "lilyOfTheValley" | "blueBellflower";

export interface GardenSpot {
  species: FlorereSpecies;
  /** Foot of the plinth (or of the figurine) in stage units. */
  at: [number, number, number];
  /** Figurine height (it is modelled 1 tall). */
  scale: number;
  yaw: number;
  plinth?: { kind: "marble" | "glass"; size: [number, number, number]; yaw?: number };
  /** Back-layer repeat: left out on the lite tier. */
  repeat?: boolean;
}

/**
 * The Florere garden in depth layers around the daisy (Crystal Flower Pavilion board: rose left
 * midground, forget-me-not low front left, bellflower back left, lily front right, Rozanne back
 * right, lily of the valley far right). Projected heights ≈ 35–60 % of the daisy's; nothing
 * crosses the daisy's face or the header copy (u 300 → 520, v 700 → 830 at 1672 × 941).
 */
export const GARDEN: GardenSpot[] = [
  { species: "rose", at: [-2.75, 0, -1.1], scale: 2.2, yaw: 0.35, plinth: { kind: "marble", size: [0.9, 0.9, 0.8], yaw: 0.12 } },
  { species: "forgetMeNot", at: [-3.0, 0, 1.45], scale: 1.75, yaw: 0.45, plinth: { kind: "marble", size: [0.72, 0.42, 0.66], yaw: -0.2 } },
  { species: "blueBellflower", at: [-2.75, 0, -4.9], scale: 2.45, yaw: 0.15, plinth: { kind: "marble", size: [0.72, 1.6, 0.72], yaw: 0.05 } },
  { species: "lily", at: [2.25, 0, 0.3], scale: 1.95, yaw: -0.35, plinth: { kind: "glass", size: [0.68, 0.62, 0.68], yaw: 0.3 } },
  { species: "rozanne", at: [3.75, 0, -2.9], scale: 2.25, yaw: -0.2, plinth: { kind: "marble", size: [0.85, 1.15, 0.85], yaw: -0.1 } },
  { species: "lilyOfTheValley", at: [4.2, 0, -0.5], scale: 1.95, yaw: -0.45, plinth: { kind: "marble", size: [0.8, 0.5, 0.8], yaw: 0.2 } },
  // Repeats behind the main six, so the garden reads in layers.
  { species: "rozanne", at: [-4.6, 0, -4.4], scale: 2.0, yaw: 0.6, plinth: { kind: "marble", size: [0.75, 1.05, 0.75], yaw: 0.25 }, repeat: true },
  { species: "rose", at: [5.0, 0, -4.7], scale: 2.1, yaw: -0.7, plinth: { kind: "marble", size: [0.8, 1.25, 0.8], yaw: -0.2 }, repeat: true },
  { species: "blueBellflower", at: [2.75, 0, -4.6], scale: 1.9, yaw: -0.4, plinth: { kind: "glass", size: [0.6, 0.6, 0.6], yaw: 0.4 }, repeat: true },
];

/** `?debug=florere`: the six side by side in front of the daisy, as on a product sheet. */
export const LINEUP: GardenSpot[] = (["rose", "forgetMeNot", "rozanne", "lily", "lilyOfTheValley", "blueBellflower"] as const).map((species, i) => ({
  species,
  at: [-2.4 + i * 0.96, 0.75, 2.6],
  scale: 1.45,
  yaw: 0,
}));
