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
 * Sun: behind the colonnade on the right, ≈ 30° high. The reference is a back-lit interior: the
 * fronts of the piers sit in soft shade, the openings blaze, and sunlight falls through a row of
 * columns (off frame, right) onto the floor in long diagonal bands; glass is rim-lit from the right.
 */
export const SUN_STAGE = new THREE.Vector3(0.7, 0.5, -0.5).normalize();

/** Off-frame colonnade on the right whose columns stripe the floor with sun and shade. */
export const SIDE_COLONNADE = { x: 8.1, width: 0.75, depth: 0.75, height: 11, from: -5, to: 4.5, step: 2.15 } as const;
export const SUN_WORLD = new THREE.Vector3(SUN_STAGE.z, SUN_STAGE.y, -SUN_STAGE.x);

const deg = THREE.MathUtils.degToRad;

/**
 * The daisy (stage frame), solved with the rig's exact projection
 * (v = 470.5 − 1448·up/forward, camera pitched up 4.7°):
 * - orb centre (820, 370) → y 2.72; petal tips top v 140 (y 3.99), bottom v 578 (y 1.58),
 *   left u 583 / right u 1067 (x −1.29 / 1.33): tips 1.27 above, 1.14 below and 1.31 beside
 *   the centre — the lower petals are shorter;
 * - stem from under the orb (822, 450) bowing right to u 836 at v 560 and into the base (828, 730);
 * - left leaf base (810, 695) → tip (700, 600); right leaf base (850, 712) → tip (1000, 580);
 * - crystal base u 705 → 965 (x −0.64 → 0.78), top v 725 (y 0.78); glass disc u 645 → 1000.
 */
export const FLOWER = {
  head: new THREE.Vector3(0, 2.72, 0),
  /** Petal length factors: top, sides, bottom. */
  petalReach: { top: 0.965, side: 1, bottom: 0.87 },
  stem: [
    [0.036, 0.55, 0.0],
    [0.064, 1.19, 0.01],
    [0.08, 1.68, 0.02],
    [0.047, 2.01, 0.03],
    [0.004, 2.35, 0.04],
    [0.0, 2.6, 0.05],
  ] as [number, number, number][],
  leaves: [
    { base: [-0.06, 0.95, 0.04] as [number, number, number], length: 0.82, width: 0.42, thickness: 0.16, rotation: [deg(-6), deg(10), deg(50)] as [number, number, number], seed: 5 },
    { base: [0.157, 0.85, 0.04] as [number, number, number], length: 1.12, width: 0.5, thickness: 0.18, rotation: [deg(-6), deg(-12), deg(-48.6)] as [number, number, number], seed: 9 },
  ],
  base: [0.075, 0, 0] as [number, number, number],
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

/**
 * Shallow pool around the base: far edge v 785 (z −3.4), left edge u ≈ 430 (x −2.8), right border
 * curving from (1175, 800) to (1390, 830) (x 2.6 → 3.7), water up to v ≈ 880 in front of the disc.
 */
export const POOL = { left: -2.8, right: 3.9, back: -3.4, front: 0.5, radius: 1.4 } as const;

export const PROPS = {
  /** Big clear sphere, centre (62, 795) r 68 px → on the floor at d 8.1. */
  bigSphere: { position: new THREE.Vector3(-4.27, 0.38, -0.1), radius: 0.38 },
  /** Marble ledge on glass blocks, top at v 655 (y 1.16), u 0 → 420. */
  ledge: { left: -5.4, right: -2.2, back: -0.8, front: 1.3, top: 1.18, thickness: 0.12 },
  /** Small orb on the ledge, (288, 600) r 27. */
  smallOrb: { position: new THREE.Vector3(-3.1, 1.34, -0.45), radius: 0.16 },
  /** Vertical glass prism on the ledge, u 280 → 380, v 510 → 650. */
  prism: { position: new THREE.Vector3(-3.05, 1.6, -0.75), size: new THREE.Vector3(0.6, 0.84, 0.3) },
  /** Vase + olive tree, u 0 → 135 (vase), tree up to v 140. */
  vase: { position: new THREE.Vector3(-3.62, 1.18, 0.75), radius: 0.34, height: 0.72 },
  /** Right glass pedestal u 1365 → 1512, top v 515 (y 2.03) at d 10. */
  pedestal: { position: new THREE.Vector3(4.24, 0, -2), size: new THREE.Vector3(1, 2.03, 1) },
  /** Cut crystal cube balanced on a corner on the pedestal, x 1365 → 1505, v 378 → 515. */
  cube: { position: new THREE.Vector3(4.24, 2.51, -2), size: 0.68 },
  /** Floor orb (1335, 710) r 48 → d 13.2. */
  floorOrb: { position: new THREE.Vector3(4.6, 0.44, -5.0), radius: 0.44 },
  /** Glass blocks lower right (top v 690 → y 0.9) and the bowl on them (v 595 → 695). */
  blocks: [
    { min: new THREE.Vector3(3.95, 0, -1.7), max: new THREE.Vector3(7.2, 0.9, 0.35) },
    { min: new THREE.Vector3(4.15, 0, 0.55), max: new THREE.Vector3(6.4, 0.52, 1.5) },
  ],
  bowl: { position: new THREE.Vector3(5.4, 0.9, -0.65), radius: 0.62, height: 0.42 },
  /** Low glass blocks under the ledge, u 150 → 415. */
  ledgeBlocks: [
    { min: new THREE.Vector3(-4.95, 0, -0.55), max: new THREE.Vector3(-4.2, 1.06, 1.1) },
    { min: new THREE.Vector3(-2.95, 0, -0.55), max: new THREE.Vector3(-2.3, 1.06, 1.1) },
  ],
} as const;

/** Distant olive trees right of the right pier (u 1500 → 1672, v 460 → 650, d ≈ 18). */
export const DISTANT_TREES = [
  { position: new THREE.Vector3(9.6, 2.0, -12), radius: 0.8 },
  { position: new THREE.Vector3(10.8, 2.5, -13), radius: 1.0 },
  { position: new THREE.Vector3(12.4, 2.1, -12.5), radius: 0.95 },
  { position: new THREE.Vector3(14.2, 2.4, -14), radius: 1.1 },
  { position: new THREE.Vector3(11.6, 2.2, -15.5), radius: 1.0 },
] as const;

export type FlorereSpecies = "rose" | "forgetMeNot" | "rozanne" | "lily" | "lilyOfTheValley" | "blueBellflower";

export interface GardenSpot {
  species: FlorereSpecies;
  /** Foot of the plinth (or of the figurine) in stage units. */
  at: [number, number, number];
  /** Figurine height (it is modelled 1 tall). */
  scale: number;
  yaw: number;
  plinth?: { kind: "marble" | "glass"; size: [number, number, number]; yaw?: number };
}

/**
 * The Florere garden in depth layers around the daisy (Crystal Flower Pavilion board: rose left
 * midground, forget-me-not low front left, bellflower back left, lily front right, Rozanne back
 * right, lily of the valley far right). Projected heights ≈ 35–60 % of the daisy's; nothing
 * crosses the daisy's face or the header copy (u 300 → 520, v 700 → 830 at 1672 × 941).
 */
export const GARDEN: GardenSpot[] = [
  { species: "rose", at: [-2.7, 0, -1.25], scale: 1.75, yaw: 0.35, plinth: { kind: "marble", size: [0.9, 0.95, 0.8], yaw: 0.12 } },
  { species: "forgetMeNot", at: [-3.75, 0, 1.0], scale: 1.5, yaw: 0.45, plinth: { kind: "marble", size: [0.75, 0.48, 0.7], yaw: -0.2 } },
  { species: "blueBellflower", at: [-2.05, 0, -4.0], scale: 1.7, yaw: 0.1, plinth: { kind: "marble", size: [0.75, 1.35, 0.75], yaw: 0.05 } },
  { species: "lily", at: [2.15, 0, 0.35], scale: 1.6, yaw: -0.35, plinth: { kind: "glass", size: [0.7, 0.66, 0.7], yaw: 0.3 } },
  { species: "rozanne", at: [3.35, 0, -2.75], scale: 1.75, yaw: -0.2, plinth: { kind: "marble", size: [0.85, 1.3, 0.85], yaw: -0.1 } },
  { species: "lilyOfTheValley", at: [4.3, 0, -0.35], scale: 1.6, yaw: -0.45, plinth: { kind: "marble", size: [0.8, 0.55, 0.8], yaw: 0.2 } },
];

/** `?debug=florere`: the six side by side in front of the daisy, as on a product sheet. */
export const LINEUP: GardenSpot[] = (["rose", "forgetMeNot", "rozanne", "lily", "lilyOfTheValley", "blueBellflower"] as const).map((species, i) => ({
  species,
  at: [-2.4 + i * 0.96, 0.75, 2.6],
  scale: 1.45,
  yaw: 0,
}));
