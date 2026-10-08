import * as THREE from "three";
import { bakeFragment, bakeVertex, domeFragment, domeVertex } from "../../shaders/backdrop";
import { RIG, SUN_STAGE } from "./layout";
import { rng } from "./materials";

/*
 * Background beyond the pavilion: sky, cumulus towers, a sea of clouds in the valleys and
 * atmospheric ranges (docs/REFERENCE_MEASUREMENTS.md, "Horizon, light, background").
 *
 * The raymarch is far too heavy to run per pixel per frame on integrated GPUs, and the camera
 * only ever looks through the same frustum (rig ± pointer parallax ± scroll dolly, which keeps
 * the direction). So it is baked into an HDR texture covering that frustum plus a margin, and
 * refreshed a strip at a time: the clouds drift without ever costing a full frame.
 */

/** Extra field of view baked around the camera frustum (pointer parallax, resize). */
const MARGIN = 0.1;
/**
 * Strips per full refresh: one strip per frame (≈ 2 ms on an integrated GPU), the whole sky every
 * ≈ 5 s at 60 fps — plenty for clouds that take minutes to cross the arch.
 */
const STRIPS = 320;
/** Strips for the first, blocking bake (fewer, larger draws). */
const INITIAL_STRIPS = 32;
const MAX_BAKE_WIDTH = 2560;

const deg = THREE.MathUtils.degToRad;

/** Point at azimuth `az`° (right positive) and distance `d` km from the eye, in the stage frame. */
function at(az: number, d: number): [number, number] {
  return [d * Math.sin(deg(az)), -d * Math.cos(deg(az))];
}

/**
 * Ranges, (x, z, relief, radius) in km. Eye 0.9 km above the valley datum, so a summit seen at
 * elevation e and distance d is ≈ 0.9 + d·tan(e) high. Solved from the reference (u, v → az, e):
 * peaks (1600, 330), (1170, 415), (390, 400); forested slopes lower left (300–440, 450–650) and
 * lower right (1150–1300, 540–650); distant blue ridges behind the daisy (640–1000, 470–520).
 */
const MASSIFS: [number, number, number, number][] = [
  [...at(27.8, 15), 3.0, 2.6],
  [...at(34, 17), 2.6, 3.0],
  [...at(13, 12), 1.95, 2.0],
  [...at(18.5, 14.5), 1.8, 2.2],
  [...at(-17, 11.5), 2.0, 2.2],
  [...at(-25, 13), 1.75, 2.8],
  [...at(-6, 17), 2.85, 2.8],
  [...at(4, 19), 3.3, 3.0],
  // Forested foothills: behind the daisy's leaves and base (600–1000, 540–655) and lower right.
  [...at(-18, 6.2), 0.78, 2.2],
  [...at(-9, 4.4), 0.8, 1.4],
  [...at(-2, 4.0), 0.74, 1.3],
  [...at(4, 4.6), 0.7, 1.3],
  [...at(17, 5.2), 0.62, 1.6],
  [...at(10, 7.5), 0.55, 1.4],
];

/**
 * Cumulus towers, (x, z, radius, top altitude) in km, cloud base 2 km. Big billowing banks right
 * of the daisy (1100–1300 and 1430–1672, v 150–450), small ones through the left arch, clear sky
 * above the head. Each becomes a cauliflower of PUFFS spheres (`puffs`).
 */
const TOWERS: [number, number, number, number][] = [
  [...at(11, 17), 1.5, 4.0],
  [...at(14.5, 16.5), 1.9, 4.9],
  [...at(18, 16), 1.6, 4.3],
  [...at(23, 15.5), 1.9, 5.0],
  [...at(27, 14.5), 2.2, 5.5],
  [...at(31.5, 14), 1.8, 4.6],
  [...at(36, 14.5), 2.0, 5.0],
  [...at(-20, 18), 1.0, 3.6],
  [...at(-25, 17), 0.9, 3.2],
  [...at(-30, 14), 1.2, 3.8],
];

const PUFFS = 7;
const CLOUD_BASE = 2;

/** Cauliflower: three wide puffs on the base, two in the middle, two smaller ones on top. */
function puffs(): THREE.Vector4[] {
  const random = rng(77);
  const out: THREE.Vector4[] = [];
  for (const [x, z, r, top] of TOWERS) {
    const h = top - CLOUD_BASE;
    const j = () => 1 + (random() - 0.5) * 0.3;
    const add = (dx: number, y: number, dz: number, pr: number) => out.push(new THREE.Vector4(x + dx * r * j(), y, z + dz * r * j(), pr * r * j()));
    add(-0.58, CLOUD_BASE + 0.4 * r, 0.15, 0.56);
    add(0.04, CLOUD_BASE + 0.5 * r, -0.05, 0.7);
    add(0.62, CLOUD_BASE + 0.38 * r, -0.12, 0.52);
    add(-0.3, CLOUD_BASE + 0.5 * h, 0.1, 0.55);
    add(0.34, CLOUD_BASE + 0.55 * h, -0.1, 0.5);
    add(-0.06, top - 0.42 * r, 0.0, 0.44);
    add(0.4, top - 0.68 * r, 0.12, 0.36);
  }
  return out;
}

export const SKY_COLORS = {
  // A clear Mediterranean morning: saturated blue overhead, pale only at the horizon.
  zenith: new THREE.Color(0.1, 0.3, 0.86),
  horizon: new THREE.Color(0.6, 0.74, 0.92),
  haze: new THREE.Color(0.48, 0.6, 0.78),
  ground: new THREE.Color(0.5, 0.46, 0.4),
  sun: new THREE.Color(1.0, 0.87, 0.7),
} as const;

/** Camera basis in the stage frame, from the solved rig. */
function rigBasis(): { right: THREE.Vector3; up: THREE.Vector3; forward: THREE.Vector3 } {
  const forward = RIG.target.clone().sub(RIG.stage).normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  return { right, up, forward };
}

export class Backdrop extends THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  readonly target: THREE.WebGLRenderTarget;
  private readonly bakeMaterial: THREE.ShaderMaterial;
  private readonly bakeScene = new THREE.Scene();
  private readonly bakeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly tanHalf: THREE.Vector2;
  private strip = 0;
  private dirty = true;

  constructor(center: THREE.Vector3) {
    const { right, up, forward } = rigBasis();
    const sun = SUN_STAGE.clone();
    const shared = {
      uSunDir: { value: sun },
      uSunColor: { value: SKY_COLORS.sun },
      uZenith: { value: SKY_COLORS.zenith },
      uHorizon: { value: SKY_COLORS.horizon },
      uGround: { value: SKY_COLORS.ground },
      uSunDisc: { value: 0 },
      uCamRight: { value: right },
      uCamUp: { value: up },
      uCamForward: { value: forward },
    };
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    const tanHalf = new THREE.Vector2(1, 1);
    const material = new THREE.ShaderMaterial({
      vertexShader: domeVertex,
      fragmentShader: domeFragment,
      uniforms: {
        ...shared,
        uCenter: { value: center.clone() },
        tBake: { value: target.texture },
        uBakeReady: { value: 0 },
        uTanHalf: { value: tanHalf },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });
    super(new THREE.SphereGeometry(900, 64, 32), material);
    this.name = "Backdrop";
    this.position.copy(center);
    this.frustumCulled = false;
    this.renderOrder = -10;
    this.target = target;
    this.tanHalf = tanHalf;

    this.bakeMaterial = new THREE.ShaderMaterial({
      vertexShader: bakeVertex,
      fragmentShader: bakeFragment,
      defines: { MASSIFS: MASSIFS.length, TOWERS: TOWERS.length, PUFFS },
      uniforms: {
        ...shared,
        uTanHalf: { value: tanHalf },
        uTime: { value: 0 },
        uBlend: { value: 1 },
        uZero: { value: 0 },
        uHaze: { value: SKY_COLORS.haze },
        uForest: { value: new THREE.Color(0.03, 0.065, 0.025) },
        uMeadow: { value: new THREE.Color(0.11, 0.16, 0.05) },
        uRock: { value: new THREE.Color(0.17, 0.175, 0.18) },
        uMassifs: { value: MASSIFS.map((m) => new THREE.Vector4(...m)) },
        uTowers: { value: TOWERS.map((t) => new THREE.Vector4(...t)) },
        uPuffs: { value: puffs() },
      },
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: THREE.NormalBlending,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.bakeMaterial);
    quad.frustumCulled = false;
    this.bakeScene.add(quad);
  }

  /** Sun disc strength in the analytic sky (only for the environment capture). */
  set sunDisc(v: number) {
    this.material.uniforms.uSunDisc.value = v;
  }

  /**
   * Bake for this camera's frustum (fov, zoom, aspect) widened by MARGIN, at about the
   * display's resolution. Call on resize; the next `update` re-bakes everything.
   */
  setView(camera: THREE.PerspectiveCamera, cssWidth: number, cssHeight: number, dpr: number): void {
    const tanY = Math.tan(deg(camera.fov / 2)) / camera.zoom;
    this.tanHalf.set(tanY * camera.aspect * (1 + MARGIN), tanY * (1 + MARGIN));
    const scale = Math.min(dpr, 1.5) * (1 + MARGIN);
    let w = Math.round(cssWidth * scale);
    let h = Math.round(cssHeight * scale);
    if (w > MAX_BAKE_WIDTH) {
      h = Math.round((h * MAX_BAKE_WIDTH) / w);
      w = MAX_BAKE_WIDTH;
    }
    if (w !== this.target.width || h !== this.target.height) this.target.setSize(Math.max(1, w), Math.max(1, h));
    this.dirty = true;
  }

  private renderStrip(renderer: THREE.WebGLRenderer, index: number, count: number): void {
    const h = this.target.height;
    const y0 = Math.floor((index / count) * h);
    const y1 = Math.floor(((index + 1) / count) * h);
    if (y1 <= y0) return;
    this.target.scissor.set(0, y0, this.target.width, y1 - y0);
    this.target.scissorTest = true;
    renderer.setRenderTarget(this.target);
    renderer.render(this.bakeScene, this.bakeCamera);
  }

  /** Per frame: the whole bake when the view changed, otherwise the next strip. */
  update(renderer: THREE.WebGLRenderer, et: number): void {
    this.bakeMaterial.uniforms.uTime.value = et / 1000;
    const previous = renderer.getRenderTarget();
    if (this.dirty) {
      // Several draws so no single one stalls the GPU long enough to trip a driver reset.
      this.bakeMaterial.uniforms.uBlend.value = 1;
      for (let i = 0; i < INITIAL_STRIPS; i++) this.renderStrip(renderer, i, INITIAL_STRIPS);
      this.bakeMaterial.uniforms.uBlend.value = 0.3;
      this.dirty = false;
      this.strip = 0;
      this.material.uniforms.uBakeReady.value = 1;
    } else {
      this.renderStrip(renderer, this.strip, STRIPS);
      this.strip = (this.strip + 1) % STRIPS;
    }
    this.target.scissorTest = false;
    renderer.setRenderTarget(previous);
  }

  /** Compile the bake shader in the background (see PlaygroundEnvironment.precompile). */
  compile(renderer: THREE.WebGLRenderer): Promise<unknown> {
    return renderer.compileAsync(this.bakeScene, this.bakeCamera);
  }

  get ready(): boolean {
    return !this.dirty;
  }

  dispose(): void {
    this.target.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.bakeMaterial.dispose();
    this.bakeScene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
  }
}
