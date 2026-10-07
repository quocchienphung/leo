import * as THREE from "three";
import { clamp, mapClamp, offsetRect } from "../../core/math";
import { ambientLight, pointLight } from "../lights";
import type { WebglManager } from "../manager";

// Constants from the source (line ~60239).
const MESH_DEPTH = 10; // RY
const TOUCH_TILT = 0.52; // PY
const TOUCH_SPEED = 1600; // LY
const TOUCH_TILT_GAIN = 0.0015; // OY
const MAX_TILT = 0.6; // hi
const MIN_SPEED = 20; // ow
const MAX_SPIN = 0.2; // aw
const SPIN_GAIN = 5e-6; // FY
const SPIN_ACCEL_GAIN = 5e-6; // NY
const SPIN_DAMPING = 0.965; // kY
const AXIS_RATIO = 0.55; // df
const SPRING_K = 0.2; // UY
const SPRING_DAMP = 0.9; // GY
const TARGET_DECAY = 0.915; // HY
const BASE_Z = 0; // QY
const TILT_Z = 30; // zY
const MOUSE_TILT_GAIN = 2e-4; // rw
const LIGHT_PROGRESS_OFFSETS = [0, 0, 0, 0]; // VY
const LIGHT_OFFSETS = [
  { x: 300, y: 0 },
  { x: 300, y: 0 },
  { x: -300, y: 0 },
  { x: 300, y: 0 },
]; // lw

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
const qc = new THREE.Quaternion();
const qd = new THREE.Quaternion();

interface Flower {
  index: number;
  dom: HTMLElement;
  group: THREE.Group;
  mesh: THREE.Object3D;
  rect: DOMRect | null;
  randomRotation: number;
  baseRotationZ: number;
  domCenterX: number;
  domCenterPageY: number;
  domHalfSize: number;
  spinSignX: number;
  spinSignY: number;
  tilt: { x: number; y: number };
  tiltVel: { x: number; y: number };
  tiltTarget: { x: number; y: number };
  spin: { z: number };
  spinVel: { z: number };
  lightProgress?: number;
}

export interface GestureForce {
  vx: number;
  vy: number;
  speed: number;
  ax: number;
  ay: number;
  dt: number;
  clientX: number;
  clientY: number;
  touchDrag?: boolean;
}

/** About-page daisies rendered in WebGL over DOM placeholders (source `addFlowers` & co). */
export class FlowerField {
  private base: THREE.Group | null = null;
  private flowers: Flower[] = [];
  private pointLight: THREE.PointLight | null = null;
  private ambient: THREE.AmbientLight | null = null;
  private lightBg: HTMLElement | null = null;
  private lightRect: DOMRect | null = null;
  private progress = 0;

  constructor(
    private scene: THREE.Scene,
    private manager: WebglManager,
  ) {}

  onAssetsReady(): void {
    const model = this.manager.assets.get<THREE.Group>("flowerModel");
    const tex = this.manager.assets.get<THREE.Texture>("flowerTex");
    if (!model || !tex || this.base) return;
    tex.flipY = false;
    const base = model.clone();
    base.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.material = new THREE.MeshPhongMaterial({ map: tex });
      m.geometry = m.geometry.clone();
      m.geometry.scale(0.25, 0.25, 0.25);
    });
    this.base = base;
  }

  /** Background element whose scroll range drives the light (source `needLight` background). */
  setupLights(background: HTMLElement): void {
    this.lightBg = background;
    this.lightRect = offsetRect(background);
    if (this.pointLight) return;
    const point = pointLight("#ffffff", 1);
    const ambient = ambientLight(0xffffff, 0.9);
    point.position.z = -400;
    point.layers.enable(1);
    ambient.layers.enable(1);
    this.scene.add(point, ambient);
    this.pointLight = point;
    this.ambient = ambient;
    this.updateLight(this.progress);
  }

  add(dom: HTMLElement, index: number): void {
    if (!this.base) return;
    const group = new THREE.Group();
    const mesh = this.base.clone();
    group.add(mesh);
    group.layers.set(1);
    mesh.traverse((o) => o.layers.set(1));
    this.scene.add(group);
    const f: Flower = {
      index,
      dom,
      group,
      mesh,
      rect: null,
      randomRotation: Math.random() * 0.5 + 0.5,
      baseRotationZ: 0,
      domCenterX: 0,
      domCenterPageY: 0,
      domHalfSize: 1,
      spinSignX: 1,
      spinSignY: 1,
      tilt: { x: 0, y: 0 },
      tiltVel: { x: 0, y: 0 },
      tiltTarget: { x: 0, y: 0 },
      spin: { z: 0 },
      spinVel: { z: 0 },
    };
    this.flowers.push(f);
    this.layout(f);
  }

  private layout(f: Flower): void {
    const r = offsetRect(f.dom);
    f.rect = r;
    const depth = Math.max(Math.min(r.width, r.height) * 0.12, 2);
    f.mesh.scale.set(r.width, r.height, depth * MESH_DEPTH);
    f.group.position.x = r.left - window.innerWidth / 2 + r.width / 2;
    f.group.position.y = -r.top + window.innerHeight / 2 - r.height / 2;
    f.domCenterX = r.left + r.width / 2;
    f.domCenterPageY = r.top + r.height / 2;
    f.domHalfSize = Math.min(r.width, r.height) / 2;
    if (this.lightRect) {
      const centre = r.top + r.height / 2 - window.innerHeight / 2;
      f.lightProgress =
        mapClamp(centre, [this.lightRect.top - window.innerHeight, this.lightRect.top + this.lightRect.height], [-1, 1]) +
        (LIGHT_PROGRESS_OFFSETS[f.index] ?? 0);
    }
  }

  private keyframes(): { progress: number; x: number; y: number }[] {
    const sorted = [...this.flowers].sort((a, b) => a.index - b.index);
    const n = Math.min(sorted.length, LIGHT_OFFSETS.length);
    const out: { progress: number; x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const f = sorted[i];
      if (f.lightProgress === undefined) continue;
      const o = LIGHT_OFFSETS[i] ?? { x: 0, y: 0 };
      out.push({ progress: f.lightProgress, x: f.group.position.x + o.x, y: f.group.position.y + o.y });
    }
    return out.sort((a, b) => a.progress - b.progress);
  }

  private updateLight(progress: number): void {
    if (!this.pointLight) return;
    const k = this.keyframes();
    if (!k.length) return;
    if (k.length === 1) {
      this.pointLight.position.x = k[0].x;
      this.pointLight.position.y = k[0].y;
      return;
    }
    const seg = (a: (typeof k)[0], b: (typeof k)[0], smooth = false) => {
      const span = b.progress - a.progress;
      let t = span > 0 ? (progress - a.progress) / span : 0;
      if (smooth) {
        const c = clamp(t, 0, 1);
        t = c * c * (3 - 2 * c);
      }
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    };
    let r: { x: number; y: number } | undefined;
    if (progress <= k[0].progress) r = seg(k[0], k[1]);
    else if (progress >= k[k.length - 1].progress) r = seg(k[k.length - 2], k[k.length - 1]);
    else {
      for (let i = 0; i < k.length - 1; i++) {
        if (progress >= k[i].progress && progress <= k[i + 1].progress) {
          r = seg(k[i], k[i + 1], true);
          break;
        }
      }
    }
    if (r) {
      this.pointLight.position.x = r.x;
      this.pointLight.position.y = r.y;
    }
  }

  private spring(cur: number, target: number, vel: number, f: number) {
    vel += (target - cur) * SPRING_K * f;
    vel *= Math.pow(SPRING_DAMP, f);
    cur += vel * f;
    return { cur, vel };
  }

  /** Source `setFlowersProgress`: called on scroll with the flowers block progress. */
  setProgress(progress: number): void {
    this.progress = progress;
  }

  render(_et: number, dt: number): void {
    if (!this.flowers.length) return;
    const progress = this.progress;
    this.updateLight(progress);
    const f60 = dt * 60;
    const decay = Math.pow(TARGET_DECAY, f60);
    for (const o of this.flowers) {
      const rotZ = progress * 3 * o.randomRotation;
      o.baseRotationZ = rotZ;
      o.tiltTarget.x *= decay;
      o.tiltTarget.y *= decay;
      const sx = this.spring(o.tilt.x, o.tiltTarget.x, o.tiltVel.x, f60);
      o.tilt.x = sx.cur;
      o.tiltVel.x = sx.vel;
      const sy = this.spring(o.tilt.y, o.tiltTarget.y, o.tiltVel.y, f60);
      o.tilt.y = sy.cur;
      o.tiltVel.y = sy.vel;
      o.spinVel.z *= Math.pow(SPIN_DAMPING, f60);
      o.spin.z += o.spinVel.z * f60;
      qb.setFromAxisAngle(AXIS_Y, o.tilt.y);
      qa.setFromAxisAngle(AXIS_X, o.tilt.x);
      qc.setFromAxisAngle(AXIS_Z, o.spin.z);
      qd.copy(qb).multiply(qa).multiply(qc);
      o.mesh.quaternion.copy(qd);
      o.group.rotation.z = rotZ;
      o.group.position.z = BASE_Z + Math.max(Math.abs(o.tilt.x), Math.abs(o.tilt.y)) * TILT_Z;
    }
  }

  private spinDirection(e: Flower, cx: number, cy: number, vx: number, vy: number, speed: number, nx: number, ny: number, horiz: boolean, vert: boolean): number {
    const dx = cx - e.domCenterX;
    const dy = cy - (e.domCenterPageY - window.scrollY);
    if (speed < 1) return 0;
    const cos = Math.cos(-e.baseRotationZ);
    const sin = Math.sin(-e.baseRotationZ);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    const lvx = vx * cos - vy * sin;
    const lvy = vx * sin + vy * cos;
    const cross = lx * lvy - ly * lvx;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), e.domHalfSize * 0.3);
    if (Math.abs(lx) > 2) e.spinSignX = Math.sign(lx);
    if (Math.abs(ly) > 2) e.spinSignY = Math.sign(ly);
    const m = cross / (dist * speed);
    if (Math.abs(m) > 0.08) return clamp(m, -1, 1);
    if (horiz) return clamp(-nx * (ly !== 0 ? Math.sign(-ly) : e.spinSignY), -1, 1);
    if (vert) return clamp(-ny * (lx !== 0 ? Math.sign(lx) : e.spinSignX), -1, 1);
    const sy = ly !== 0 ? Math.sign(-ly) : e.spinSignY;
    const sx = lx !== 0 ? Math.sign(lx) : e.spinSignX;
    return clamp((-nx * sy + -ny * sx) * 0.5, -1, 1);
  }

  private spinImpulse(e: Flower, dir: number, speed: number, accel: number, f: number): void {
    const k = speed * SPIN_GAIN + Math.abs(accel) * SPIN_ACCEL_GAIN;
    e.spinVel.z += -dir * k * f;
    e.spinVel.z = clamp(e.spinVel.z, -MAX_SPIN, MAX_SPIN);
  }

  applyMouseForce(dom: HTMLElement, g: GestureForce): void {
    const e = this.flowers.find((f) => f.dom === dom);
    if (!e) return;
    const speed = Math.hypot(g.vx, g.vy);
    if (speed < MIN_SPEED) return;
    const over = g.speed - MIN_SPEED;
    const nx = g.vx / speed;
    const ny = g.vy / speed;
    const gain = clamp(over * (g.touchDrag ? TOUCH_TILT_GAIN : MOUSE_TILT_GAIN), 0, MAX_TILT);
    const f = g.dt * 60;
    const ax = Math.abs(nx);
    const ay = Math.abs(ny);
    const vert = ay > ax * AXIS_RATIO;
    const horiz = ax > ay * AXIS_RATIO;
    const dir = this.spinDirection(e, g.clientX, g.clientY, g.vx, g.vy, speed, nx, ny, horiz, vert);
    const cos = Math.cos(-e.baseRotationZ);
    const sin = Math.sin(-e.baseRotationZ);
    const lnx = nx * cos - ny * sin;
    if (vert) {
      e.tiltTarget.x = clamp(ny * gain, -MAX_TILT, MAX_TILT);
      this.spinImpulse(e, dir, over, g.ay, f);
    } else if (horiz) {
      e.tiltTarget.y = clamp(lnx * gain, -MAX_TILT, MAX_TILT);
      this.spinImpulse(e, dir, over, g.ax, f);
    } else {
      e.tiltTarget.x = clamp(ny * gain, -MAX_TILT, MAX_TILT);
      e.tiltTarget.y = clamp(lnx * gain, -MAX_TILT, MAX_TILT);
      this.spinImpulse(e, dir, over, Math.hypot(g.ax, g.ay), f);
    }
  }

  applyTouchImpulse(dom: HTMLElement, clientX: number, clientY: number, strength = 1): void {
    const e = this.flowers.find((f) => f.dom === dom);
    if (!e) return;
    const dx = clientX - e.domCenterX;
    const dy = clientY - (e.domCenterPageY - window.scrollY);
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    const tilt = TOUCH_TILT * strength;
    const speed = TOUCH_SPEED * strength;
    const vx = nx * speed;
    const vy = ny * speed;
    const ax = Math.abs(nx);
    const ay = Math.abs(ny);
    const vert = ay > ax * AXIS_RATIO;
    const horiz = ax > ay * AXIS_RATIO;
    const dir = this.spinDirection(e, clientX, clientY, vx, vy, speed, nx, ny, horiz, vert);
    const cos = Math.cos(-e.baseRotationZ);
    const sin = Math.sin(-e.baseRotationZ);
    const lnx = nx * cos - ny * sin;
    if (vert) {
      e.tiltTarget.x = clamp(ny * tilt, -MAX_TILT, MAX_TILT);
      this.spinImpulse(e, dir, speed, vy * 18, 1);
    } else if (horiz) {
      e.tiltTarget.y = clamp(lnx * tilt, -MAX_TILT, MAX_TILT);
      this.spinImpulse(e, dir, speed, vx * 18, 1);
    } else {
      e.tiltTarget.x = clamp(ny * tilt, -MAX_TILT, MAX_TILT);
      e.tiltTarget.y = clamp(lnx * tilt, -MAX_TILT, MAX_TILT);
      this.spinImpulse(e, dir, speed, speed * 0.04, 1);
    }
  }

  resize(): void {
    if (this.lightBg) this.lightRect = offsetRect(this.lightBg);
    for (const f of this.flowers) this.layout(f);
  }

  cleanup(): void {
    for (const f of this.flowers) {
      f.mesh.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
      this.scene.remove(f.group);
    }
    this.flowers = [];
    if (this.pointLight) this.scene.remove(this.pointLight);
    if (this.ambient) this.scene.remove(this.ambient);
    this.pointLight = null;
    this.ambient = null;
    this.lightBg = null;
    this.lightRect = null;
    this.progress = 0;
  }
}
