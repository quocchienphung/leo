import * as THREE from "three";
import { WORK_HEADER_RIG } from "../../../data/headerCamera";

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
 * The camera now uses Work's measured horizontal rig and lens. Its scroll moves
 * down and forward without changing orientation; object placements stay in the stage frame.
 */
export const STAGE_ORIGIN = new THREE.Vector3(2.75, 0, 0);

export function stageToWorld(x: number, y: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(STAGE_ORIGIN.x + z, y, STAGE_ORIGIN.z - x);
}

/**
 * Same eye height, distance and lens as Work, measured from its GLB camera.
 * A level rig is essential: lowering the eye exposes the foreground without pitching down.
 */
export const RIG = {
  fov: WORK_HEADER_RIG.fov,
  stage: new THREE.Vector3(-WORK_HEADER_RIG.z, WORK_HEADER_RIG.y, WORK_HEADER_RIG.x - STAGE_ORIGIN.x),
  target: new THREE.Vector3(-WORK_HEADER_RIG.z, WORK_HEADER_RIG.y, 0),
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

export const SUN_WORLD = new THREE.Vector3(SUN_STAGE.z, SUN_STAGE.y, -SUN_STAGE.x);

/** Full-scale open palace, 40m deep, with a 14m cornice and five successive vaults. */
export const PALACE = { halfWidth: 4.9, outerWidth: 9.5, spring: 8.3, cornice: 13.7, bays: [-4, -12, -20, -28, -36] } as const;

const deg = THREE.MathUtils.degToRad;

/**
 * The daisy (stage frame): based on the proportions and pose of the home/about daisy, measured on its mesh
 * (`TexFleur` in scene_v9.glb, decoded; the about one is the same sculpt). Home frame → stage:
 * x = −z, y = y, z = x − STAGE_ORIGIN.x.
 * - crown: Ø 2.334, twelve equal 0.8 × 0.43 petals, dome Ø 0.8854, centre y 2.851;
 *   the champagne dome's front bulge is 0.2435, matching the original sculpt;
 * - stem: straight seen from the front, Ø 0.058, from the rock (y 0.45) to behind the head,
 *   bowing back a little in depth;
 * - leaves: 0.85 × 0.45 pointed ovals, ≈ 37° above horizontal, the right one lower;
 * - rock: measured hull ≈ 1.46 wide, 1.58 deep, 0.84 high (desktop cut).
 */
export const FLOWER = {
  head: new THREE.Vector3(0, 2.851, -0.053),
  stem: [
    [0, 0.45, -0.218],
    [0, 0.86, -0.229],
    [0, 1.28, -0.276],
    [0, 1.7, -0.345],
    [0, 2.12, -0.368],
    [0, 2.33, -0.272],
    [0, 2.54, -0.239],
  ] as [number, number, number][],
  stemRadius: 0.029,
  leaves: [
    { base: [0, 0.88, -0.19] as [number, number, number], length: 0.85, width: 0.45, thickness: 0.1, rotation: [0, 0, deg(-53.1)] as [number, number, number] },
    { base: [0, 1.115, -0.21] as [number, number, number], length: 0.85, width: 0.45, thickness: 0.1, rotation: [0, 0, deg(52.3)] as [number, number, number] },
  ],
  rock: { width: 1.44, height: 0.83, depth: 1.485 },
  base: [0, 0, 0] as [number, number, number],
  discRadius: 0.82,
} as const;

/** Shallow pool round the daisy's base; the plinths of the garden stand on the marble around it. */
export const POOL = { left: -2.0, right: 1.7, back: -11.4, front: 0.85, radius: 1.0 } as const;

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
    { position: new THREE.Vector3(-2.45, 0, 3.5), scale: 1.8, seed: 23 },
    { position: new THREE.Vector3(2.65, 0, 3.0), scale: 2.0, seed: 29 },
  ],
} as const;

export type FlorereSpecies = "rose" | "forgetMeNot" | "rozanne" | "lily" | "lilyOfTheValley" | "blueBellflower" | "tulip" | "iris" | "hydrangea" | "wildflower";

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
  { species: "rozanne", at: [3.2, 0, -7.6], scale: 2.35, yaw: -0.2, plinth: { kind: "marble", size: [0.85, 0.8, 0.85], yaw: -0.1 } },
  { species: "lilyOfTheValley", at: [5.3, 0, -3.5], scale: 2.3, yaw: -0.45, plinth: { kind: "marble", size: [0.8, 0.5, 0.8], yaw: 0.2 } },
  { species: "tulip", at: [3.7, 0, 0.4], scale: 2.5, yaw: -0.12, plinth: { kind: "glass", size: [0.72, 0.42, 0.72], yaw: 0.12 } },
  { species: "iris", at: [3.95, 0, -1.5], scale: 2.6, yaw: -0.35, plinth: { kind: "marble", size: [0.9, 0.9, 0.85] } },
  { species: "hydrangea", at: [-4.4, 0, -0.6], scale: 2.45, yaw: 0.12, plinth: { kind: "marble", size: [0.95, 0.68, 0.9], yaw: -0.1 } },
  { species: "wildflower", at: [-3.0, 0, 2.8], scale: 1.4, yaw: 0.1 },
  { species: "wildflower", at: [3.3, 0, 2.4], scale: 1.65, yaw: -0.35 },
  // Repeats behind the main six, so the garden reads in layers.
  { species: "rozanne", at: [-3.8, 0, -9.2], scale: 2.0, yaw: 0.6, plinth: { kind: "marble", size: [0.75, 1.05, 0.75], yaw: 0.25 }, repeat: true },
  { species: "rose", at: [3.8, 0, -11.2], scale: 2.1, yaw: -0.7, plinth: { kind: "marble", size: [0.8, 1.25, 0.8], yaw: -0.2 }, repeat: true },
  { species: "blueBellflower", at: [2.75, 0.28, -16.6], scale: 2.2, yaw: -0.4, plinth: { kind: "glass", size: [0.6, 0.6, 0.6], yaw: 0.4 }, repeat: true },
  { species: "forgetMeNot", at: [-3.0, 0.28, -18.8], scale: 2.3, yaw: 0.2, plinth: { kind: "marble", size: [0.8, 0.8, 0.8] }, repeat: true },
  { species: "lily", at: [3.7, 0.56, -27], scale: 2.4, yaw: -0.2, plinth: { kind: "marble", size: [0.8, 0.7, 0.8] }, repeat: true },
  { species: "rose", at: [-3.7, 0.56, -30.5], scale: 2.4, yaw: 0.5, plinth: { kind: "marble", size: [0.85, 0.75, 0.85] }, repeat: true },
];

/** `?debug=florere`: the six side by side in front of the daisy, as on a product sheet. */
export const LINEUP: GardenSpot[] = (["rose", "forgetMeNot", "rozanne", "lily", "lilyOfTheValley", "blueBellflower", "tulip", "iris", "hydrangea", "wildflower"] as const).map((species, i) => ({
  species,
  at: [-4.3 + i * 0.94, 0.75, -0.6],
  scale: 1.6,
  yaw: 0,
}));
