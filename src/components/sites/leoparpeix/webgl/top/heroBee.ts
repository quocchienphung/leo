import gsap from "gsap";
import * as THREE from "three";
import { EntityManager, GameEntity, PursuitBehavior, SeekBehavior, Vehicle, Vector3 as YVector3 } from "yuka";
import { isSafari } from "../../core/env";
import { damp, lerp } from "../../core/math";
import { sound } from "../../core/sound";
import type { AssetsManager } from "../assets";
import { directionalLight } from "../lights";
import type { TopCamera } from "../cameras";
import type { TransitionUniforms } from "./overlays";
import { bindPageTransition } from "./transitionMaterial";

export interface BeeParams {
  massPursuer: number;
  maxForcePursuer: number;
  maxSpeedPursuer: number;
  massPursuerClick: number;
  maxForcePursuerClick: number;
  maxSpeedPursuerClick: number;
  massEvader: number;
  maxForceEvader: number;
  maxSpeedEvader: number;
  xRange: number;
  yRange: number;
  zRange: number;
  zTargetPosition: number;
  flapStrength: number;
  flapRotationOffset: number;
  hasCutShadow: boolean;
}

export const HERO_BEE_PARAMS: BeeParams = {
  massPursuer: 0.2,
  maxForcePursuer: 100,
  maxSpeedPursuer: 2.5,
  massPursuerClick: 0.2,
  maxForcePursuerClick: 100,
  maxSpeedPursuerClick: 7,
  massEvader: 1,
  maxForceEvader: 100,
  maxSpeedEvader: 2.5,
  xRange: 3,
  yRange: 0.65,
  zRange: 1.5,
  zTargetPosition: 0.3,
  flapStrength: 1.5,
  flapRotationOffset: 1,
  hasCutShadow: true,
};

export const FOOTER_BEE_PARAMS: BeeParams = { ...HERO_BEE_PARAMS, maxSpeedPursuerClick: 5 };

// Source constants (line ~66390).
const DISAPPEAR_DELAY = 1.25; // Yw
const DISAPPEAR_DURATION = 1.25; // Tm
const FRUIT1_DELAY = 0.05; // b6
const GROUND_Z = 0.06; // T6
const GROUND_Z_SAFARI = 0.02; // C6

type FruitMode = "hidden" | "cursor" | "hiding" | "falling";

const syncMatrix = (entity: GameEntity, mesh: THREE.Object3D) => {
  mesh.matrix.fromArray(entity.worldMatrix.elements as unknown as number[]);
};

/**
 * Hero / footer bee with fruit feeding (`Cm`, line ~66395).
 * A Yuka pursuer (the bee) chases an invisible evader that loops a Lissajous path; when the
 * visitor drops a fruit the bee switches to seek-and-orbit, the fruit falls with gravity,
 * squashes (elastic) and shrinks away.
 */
export class HeroBee extends THREE.Object3D {
  readonly enterScaleGroup = new THREE.Group();
  readonly directionalLight: THREE.DirectionalLight;
  private meshPursuer: THREE.Object3D;
  private pursuer = new Vehicle();
  private evader = new Vehicle();
  private evaderTarget = new YVector3();
  private target = new GameEntity();
  private pursuit: PursuitBehavior;
  private seek: SeekBehavior;
  private entities = new EntityManager();
  private groupTarget = new THREE.Group();
  private mouse = new THREE.Vector2();
  private pointerNdc = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();
  private hit = new THREE.Vector3();
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.48);
  private fruitCounter = 0;
  private selectedFruit: THREE.Object3D | null = null;
  private fruitTl: gsap.core.Timeline | null = null;
  private spawnTl: gsap.core.Timeline | gsap.core.Tween | null = null;
  private scaleTl: gsap.core.Tween | null = null;
  private impactTl: gsap.core.Timeline | null = null;
  private disappearTl: gsap.core.Timeline | null = null;
  private fruit1Call: gsap.core.Tween | null = null;
  private fruitMode: FruitMode = "hidden";
  private isChasing = false;
  private isSpawning = false;
  private cursorFruitHidden = false;
  private spawnWhileFalling = false;
  private playFruit2OnDisappear = false;
  private previousPointer = { x: 0, y: 0 };
  private hasPointerHistory = false;
  private targetRotationZ = 0;
  private currentRotationZ = 0;
  private lastPointerMove = 0;
  private targetSpeedScale = 1;
  private currentSpeedScale = 1;
  private readonly fruitGroundZ = isSafari() ? GROUND_Z_SAFARI : GROUND_Z;
  private readonly fruitHoverZ = 0.48;
  private fallVelocityZ = 0;
  private fallLand = { x: 0, y: 0 };
  private fallHasLanded = false;
  private fallDisappearStarted = false;
  private dropCallback: (() => void) | null = null;
  phaseOffset = 0;

  constructor(
    readonly params: BeeParams,
    private uniforms: TransitionUniforms,
    assets: AssetsManager,
    private camera: TopCamera,
  ) {
    super();
    this.add(this.enterScaleGroup);
    this.directionalLight = this.createLight();
    this.meshPursuer = this.createBee(assets);
    this.pursuer.setRenderComponent(this.meshPursuer, syncMatrix);
    this.pursuer.mass = params.massPursuer;
    this.pursuer.maxForce = params.maxForcePursuer;
    this.pursuer.maxSpeed = params.maxSpeedPursuer;
    const evaderMesh = new THREE.Object3D();
    evaderMesh.matrixAutoUpdate = false;
    this.evader.setRenderComponent(evaderMesh, syncMatrix);
    this.evader.mass = params.massEvader;
    this.evader.maxForce = params.maxForceEvader;
    this.evader.maxSpeed = params.maxSpeedEvader;
    this.pursuit = new PursuitBehavior(this.evader, 5);
    this.pursuer.steering.add(this.pursuit);
    this.evader.steering.add(new SeekBehavior(this.evaderTarget));
    this.seek = new SeekBehavior(this.target.position);
    this.entities.add(this.pursuer);
    this.entities.add(this.evader);
    this.createFruits(assets);
  }

  private createLight(): THREE.DirectionalLight {
    const l = directionalLight(0xffffff, 0.5);
    l.position.z = 5;
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.camera.near = 0.05;
    l.shadow.camera.far = 6;
    this.add(l);
    this.syncShadowFrustum(this.camera.dimensions);
    return l;
  }

  syncShadowFrustum(d: { width: number; height: number }): void {
    const c = this.directionalLight?.shadow.camera;
    if (!c) return;
    c.top = this.params.hasCutShadow ? d.height * 0.5 : d.height * 0.5 * 2;
    c.right = d.width * 0.5;
    c.bottom = -d.height * 0.5 * 2;
    c.left = -d.width * 0.5;
    c.updateProjectionMatrix();
  }

  private createBee(assets: AssetsManager): THREE.Object3D {
    const model = assets.get<THREE.Group>("beeModel");
    const tex = assets.get<THREE.Texture>("beeTex");
    const bee = model ? model.clone() : new THREE.Group();
    if (tex) tex.flipY = false;
    bee.matrixAutoUpdate = false;
    bee.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (m.name.includes("bee")) {
        const mat = new THREE.MeshPhongMaterial({ map: tex ?? null });
        bindPageTransition(mat, this.uniforms, { revealScale: this.uniforms.uBeeRevealScale });
        m.material = mat;
        m.castShadow = true;
      } else if (m.name.includes("aile")) {
        const mat = new THREE.MeshPhongMaterial({ transparent: true, opacity: 0.7 });
        bindPageTransition(mat, this.uniforms, { revealScale: this.uniforms.uBeeRevealScale });
        m.material = mat;
        m.castShadow = true;
      }
    });
    this.enterScaleGroup.add(bee);
    return bee;
  }

  private createFruits(assets: AssetsManager): void {
    const make = (key: string, name: string, mult: number) => {
      const model = assets.get<THREE.Group>(key);
      if (!model) return;
      const f = model.clone(true);
      f.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mat = (m.material as THREE.MeshStandardMaterial).clone();
        bindPageTransition(mat, this.uniforms, { revealScale: this.uniforms.uFruitRevealScale, lightMultiplier: mult });
        mat.roughness = 1;
        mat.metalness = 0;
        m.material = mat;
        m.castShadow = true;
      });
      f.scale.set(0, 0, 0);
      f.visible = false;
      f.name = name;
      this.groupTarget.add(f);
    };
    make("orangeModel", "orange", 1.25);
    make("raisinModel", "raisin", 1.4);
  }

  setFruitsVisible(v: boolean): void {
    for (const n of ["orange", "raisin"]) {
      const f = this.groupTarget.getObjectByName(n);
      if (f) f.visible = v;
    }
  }

  setCastShadowEnabled(v: boolean): void {
    this.directionalLight.castShadow = v;
    this.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = v;
    });
  }

  private screenToWorld(x: number, y: number, z: number): { x: number; y: number } {
    this.pointerNdc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    this.plane.constant = -z;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const p = this.raycaster.ray.intersectPlane(this.plane, this.hit);
    return p ? { x: p.x, y: p.y } : { x: this.mouse.x, y: this.mouse.y };
  }

  private hideAllFruits(): void {
    this.groupTarget.children.forEach((f) => {
      f.scale.set(0, 0, 0);
      f.position.set(0, 0, 0);
    });
    this.selectedFruit = null;
  }

  private anchorMinZ(f: THREE.Object3D): number {
    if (f.userData.anchorMinZ !== undefined) return f.userData.anchorMinZ as number;
    const s = f.scale.clone();
    const p = f.position.clone();
    const k = (f.userData.targetScale as number) ?? 1;
    f.scale.set(k, k, k);
    f.position.set(0, 0, 0);
    f.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(f);
    f.userData.anchorMinZ = box.min.z / k;
    f.scale.copy(s);
    f.position.copy(p);
    return f.userData.anchorMinZ as number;
  }

  private pickNextFruit(): { mesh: THREE.Object3D | undefined; targetScale: number } {
    const orange = this.fruitCounter % 2 === 0;
    this.fruitCounter++;
    return { mesh: this.groupTarget.getObjectByName(orange ? "orange" : "raisin"), targetScale: orange ? 1.25 : 2 };
  }

  private killSpawn(): void {
    this.spawnTl?.kill();
    this.spawnTl = null;
    this.isSpawning = false;
  }

  private playSpawn(f: THREE.Object3D, s: number): void {
    this.killSpawn();
    sound.playSfx("fruit2");
    this.isSpawning = true;
    gsap.killTweensOf(f.scale);
    gsap.killTweensOf(f.position);
    f.rotation.set(0, 0, 0);
    f.position.set(0, 0, 0);
    f.scale.set(0, 0, 0);
    const tl = gsap.timeline({
      onComplete: () => {
        this.isSpawning = false;
        this.spawnTl = null;
      },
    });
    tl.to(f.scale, { x: s, y: s, z: s, duration: 0.5, ease: "power3.out" }, 0);
    this.spawnTl = tl;
  }

  canPlaceFruit(): boolean {
    return this.fruitMode === "hidden";
  }

  canDropHeldFruit(): boolean {
    return this.fruitMode === "cursor" && !!this.selectedFruit;
  }

  isInteractionLocked(): boolean {
    return this.isChasing || this.fruitMode === "falling";
  }

  enterZone(): void {}

  leaveZone(): void {}

  showCursorFruit({ hidden = false }: { hidden?: boolean } = {}): void {
    if (this.fruitMode !== "hidden") return;
    this.fruitTl?.kill();
    this.killSpawn();
    this.enterScaleGroup.add(this.groupTarget);
    this.hideAllFruits();
    const { mesh, targetScale } = this.pickNextFruit();
    if (!mesh) return;
    this.selectedFruit = mesh;
    mesh.userData.targetScale = targetScale;
    delete mesh.userData.anchorMinZ;
    this.fruitMode = "cursor";
    this.cursorFruitHidden = hidden;
    this.groupTarget.position.set(this.mouse.x, this.mouse.y, this.fruitHoverZ);
    this.groupTarget.rotation.set(0, 0, 0);
    this.groupTarget.scale.set(1, 1, 1);
    this.targetRotationZ = this.currentRotationZ = 0;
    this.targetSpeedScale = this.currentSpeedScale = 1;
    this.hasPointerHistory = false;
    this.groupTarget.children.forEach((c) => {
      gsap.killTweensOf(c.scale);
      gsap.killTweensOf(c.position);
    });
    mesh.rotation.set(0, 0, 0);
    mesh.position.set(0, 0, 0);
    if (hidden) {
      mesh.scale.set(0, 0, 0);
      return;
    }
    this.playSpawn(mesh, targetScale);
  }

  hideCursorFruit(done?: () => void): void {
    if (this.fruitMode !== "cursor" || !this.selectedFruit) return;
    this.fruitTl?.kill();
    this.killSpawn();
    const f = this.selectedFruit;
    const s = (f.userData.targetScale as number) ?? f.scale.x;
    this.fruitMode = "hiding";
    const tl = gsap.timeline({
      onComplete: () => {
        this.hideAllFruits();
        this.groupTarget.rotation.set(0, 0, 0);
        this.groupTarget.scale.set(1, 1, 1);
        this.targetRotationZ = this.currentRotationZ = 0;
        this.targetSpeedScale = this.currentSpeedScale = 1;
        this.cursorFruitHidden = false;
        this.fruitMode = "hidden";
        this.enterScaleGroup.remove(this.groupTarget);
        done?.();
      },
    });
    tl.to(f.scale, { x: 0, y: 0, z: 0, duration: 0.22, ease: "power2.out" }, 0);
    tl.to(this.groupTarget.scale, { x: 0.55, y: 0.55, z: 0.55, duration: 0.22, ease: "power2.in" }, 0);
    f.userData.targetScale = s;
    this.fruitTl = tl;
  }

  updatePointer(x: number, y: number, { skipVelocity = false }: { skipVelocity?: boolean } = {}): void {
    if (this.isInteractionLocked()) return;
    const w = this.screenToWorld(x, y, this.fruitHoverZ);
    this.mouse.set(w.x, w.y);
    if (!skipVelocity) {
      const dx = x - this.previousPointer.x;
      const dy = y - this.previousPointer.y;
      if (this.hasPointerHistory && (dx !== 0 || dy !== 0)) {
        const d = Math.sqrt(dx * dx + dy * dy);
        const signed = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? d : -d) : dy > 0 ? d : -d;
        const k = Math.max(-1, Math.min(signed * 0.02, 1));
        this.targetRotationZ = k;
        this.targetSpeedScale = 1 + Math.abs(k);
        this.lastPointerMove = performance.now();
      }
      if (!this.hasPointerHistory) {
        this.hasPointerHistory = true;
        this.lastPointerMove = performance.now();
      }
    }
    this.previousPointer = { x, y };
  }

  private baseScale(): number {
    return (this.selectedFruit?.userData.targetScale as number) ?? 1;
  }

  private applyCursorFruitVisual(): void {
    if (!this.selectedFruit || this.isSpawning || this.cursorFruitHidden) return;
    const rz = this.currentRotationZ * 110 * (Math.PI / 180);
    const s = this.baseScale() * this.currentSpeedScale;
    this.groupTarget.rotation.set(0, 0, rz);
    this.groupTarget.scale.set(1, 1, 1);
    this.selectedFruit.rotation.set(0, 0, 0);
    this.selectedFruit.position.set(0, 0, 0);
    this.selectedFruit.scale.set(s, s, s);
  }

  private updateCursorRotation(dt: number): void {
    if (performance.now() - this.lastPointerMove > 50) {
      this.targetRotationZ = 0;
      this.targetSpeedScale = 1;
    }
    this.currentRotationZ = lerp(this.currentRotationZ, this.targetRotationZ, damp(6, dt));
    this.currentSpeedScale = lerp(this.currentSpeedScale, this.targetSpeedScale, damp(6, dt));
    if (this.cursorFruitHidden) return;
    if (this.isSpawning) {
      this.groupTarget.rotation.set(0, 0, this.currentRotationZ * 110 * (Math.PI / 180));
      this.selectedFruit?.rotation.set(0, 0, 0);
      return;
    }
    this.applyCursorFruitVisual();
  }

  private followCursor(dt: number): void {
    const t = damp(14, dt);
    this.groupTarget.position.x += (this.mouse.x - this.groupTarget.position.x) * t;
    this.groupTarget.position.y += (this.mouse.y - this.groupTarget.position.y) * t;
    this.groupTarget.position.z += (this.fruitHoverZ - this.groupTarget.position.z) * t;
  }

  private updateFallStretch(): void {
    if (!this.selectedFruit || this.fallHasLanded || this.spawnWhileFalling) return;
    const k = this.baseScale();
    const s = Math.min(Math.abs(this.fallVelocityZ) * 0.028, 0.35);
    this.selectedFruit.position.set(0, 0, 0);
    this.selectedFruit.scale.set(k * (1 - s * 0.25), k * (1 - s * 0.25), k * (1 + s));
  }

  private alignToFruitBottom(): void {
    if (!this.selectedFruit) return;
    const f = this.selectedFruit;
    const k = this.baseScale();
    const n = this.anchorMinZ(f);
    f.position.set(0, 0, 0);
    f.scale.set(k, k, k);
    f.updateMatrixWorld(true);
    const bottom = this.groupTarget.position.z + n * k;
    this.groupTarget.position.z += this.fruitGroundZ - bottom;
  }

  private landSquash(): void {
    if (!this.selectedFruit || this.fallHasLanded) return;
    const f = this.selectedFruit;
    const k = this.baseScale();
    const n = this.anchorMinZ(f);
    this.fallHasLanded = true;
    this.fallVelocityZ = 0;
    this.groupTarget.rotation.set(0, 0, 0);
    f.rotation.set(0, 0, 0);
    this.impactTl?.kill();
    this.scheduleDisappear();
    f.scale.set(k * 1.4, k * 1.4, k * 0.5);
    f.position.z = -n * k * 0.5;
    const tl = gsap.timeline();
    tl.to(f.scale, { x: k, y: k, z: k, duration: 1.25, ease: "elastic.out(1.25)" }, 0);
    tl.to(f.position, { z: -n * k, duration: 1.25, ease: "elastic.out(1.25)" }, 0);
    this.impactTl = tl;
  }

  private scheduleDisappear(): void {
    if (this.fallDisappearStarted || !this.selectedFruit) return;
    this.fallDisappearStarted = true;
    const f = this.selectedFruit;
    f.userData.targetScale = (f.userData.targetScale as number) ?? f.scale.x;
    this.disappearTl?.kill();
    this.anchorMinZ(f);
    const tl = gsap.timeline({
      delay: DISAPPEAR_DELAY,
      onStart: () => this.impactTl?.kill(),
      onComplete: () => {
        this.disappearTl = null;
        this.onFallComplete();
      },
    });
    tl.to(f.scale, { x: 0, y: 0, z: 0, duration: DISAPPEAR_DURATION, ease: "elastic.in(1)" }, 0);
    tl.to(f.position, { z: 0, duration: DISAPPEAR_DURATION, ease: "elastic.in(1)" }, 0);
    this.disappearTl = tl;
  }

  dropFruit(done?: () => void, { spawnWhileFalling = false }: { spawnWhileFalling?: boolean } = {}): boolean {
    if (this.fruitMode !== "cursor" || !this.selectedFruit) return false;
    this.fruitTl?.kill();
    this.killSpawn();
    this.impactTl?.kill();
    this.disappearTl?.kill();
    this.scaleTl?.kill();
    const f = this.selectedFruit;
    const s = (f.userData.targetScale as number) ?? f.scale.x;
    f.userData.targetScale = s;
    f.position.set(0, 0, 0);
    this.cursorFruitHidden = false;
    gsap.killTweensOf(f.scale);
    if (spawnWhileFalling) {
      this.spawnWhileFalling = true;
      f.scale.set(0, 0, 0);
      this.spawnTl = gsap.to(f.scale, {
        x: s,
        y: s,
        z: s,
        duration: 0.5,
        ease: "power3.out",
        onComplete: () => {
          this.spawnWhileFalling = false;
          this.spawnTl = null;
        },
      });
    } else {
      this.spawnWhileFalling = false;
      f.scale.set(s, s, s);
    }
    this.fallLand = { x: this.groupTarget.position.x, y: this.groupTarget.position.y };
    this.fallVelocityZ = -1.2;
    this.groupTarget.rotation.set(0, 0, 0);
    f.rotation.set(0, 0, 0);
    this.fallDisappearStarted = false;
    this.fallHasLanded = false;
    this.dropCallback = done ?? null;
    this.playFruit2OnDisappear = spawnWhileFalling;
    this.fruit1Call?.kill();
    this.fruit1Call = gsap.delayedCall(FRUIT1_DELAY, () => {
      this.fruit1Call = null;
      sound.playSfx("fruit1");
    });
    this.fruitMode = "falling";
    this.isChasing = true;
    this.mouse.set(this.fallLand.x, this.fallLand.y);
    this.pursuer.steering.remove(this.pursuit);
    this.pursuer.steering.add(this.seek);
    gsap.to(this.pursuer, {
      mass: this.params.massPursuerClick,
      maxForce: this.params.maxForcePursuerClick,
      maxSpeed: this.params.maxSpeedPursuerClick,
      duration: 0.4,
      ease: "power2.out",
      overwrite: true,
    });
    this.groupTarget.scale.set(0.75, 0.75, 0.75);
    this.scaleTl = gsap.to(this.groupTarget.scale, {
      x: 1.5,
      y: 1.5,
      z: 1.5,
      duration: 0.5 + DISAPPEAR_DELAY + DISAPPEAR_DURATION,
      ease: "power1.out",
    });
    return true;
  }

  private onFallComplete(): void {
    if (this.playFruit2OnDisappear) {
      this.playFruit2OnDisappear = false;
      sound.playSfx("fruit2");
    }
    this.hideAllFruits();
    this.groupTarget.rotation.set(0, 0, 0);
    this.groupTarget.scale.set(1, 1, 1);
    this.fruitMode = "hidden";
    this.cursorFruitHidden = false;
    this.fallDisappearStarted = false;
    this.fallHasLanded = false;
    this.fallVelocityZ = 0;
    this.isSpawning = false;
    this.spawnWhileFalling = false;
    this.scaleTl?.kill();
    this.impactTl?.kill();
    this.disappearTl?.kill();
    this.enterScaleGroup.remove(this.groupTarget);
    const cb = this.dropCallback;
    this.dropCallback = null;
    cb?.();
  }

  resetDefaultMovement(): void {
    if (this.fruitMode !== "falling") this.fruitTl?.kill();
    this.isChasing = false;
    this.pursuer.steering.add(this.pursuit);
    this.pursuer.steering.remove(this.seek);
    gsap.to(this.pursuer, {
      mass: this.params.massPursuer,
      maxForce: this.params.maxForcePursuer,
      maxSpeed: this.params.maxSpeedPursuer,
      duration: 0.4,
      ease: "power2.inOut",
    });
  }

  abortFruitInteraction(): void {
    this.dropCallback = null;
    this.fruit1Call?.kill();
    this.fruitTl?.kill();
    this.killSpawn();
    this.impactTl?.kill();
    this.disappearTl?.kill();
    this.scaleTl?.kill();
    if (this.selectedFruit) {
      gsap.killTweensOf(this.selectedFruit.scale);
      gsap.killTweensOf(this.selectedFruit.position);
    }
    this.hideAllFruits();
    this.groupTarget.rotation.set(0, 0, 0);
    this.groupTarget.scale.set(1, 1, 1);
    this.fruitMode = "hidden";
    this.cursorFruitHidden = false;
    this.fallDisappearStarted = false;
    this.fallHasLanded = false;
    this.fallVelocityZ = 0;
    this.isSpawning = false;
    this.spawnWhileFalling = false;
    this.playFruit2OnDisappear = false;
    this.isChasing = false;
    this.targetRotationZ = this.currentRotationZ = 0;
    this.targetSpeedScale = this.currentSpeedScale = 1;
    this.enterScaleGroup.remove(this.groupTarget);
  }

  resetInteraction(): void {
    this.abortFruitInteraction();
    gsap.killTweensOf(this.pursuer);
    gsap.killTweensOf(this.groupTarget);
    gsap.killTweensOf(this.groupTarget.scale);
    this.pursuer.mass = this.params.massPursuer;
    this.pursuer.maxForce = this.params.maxForcePursuer;
    this.pursuer.maxSpeed = this.params.maxSpeedPursuer;
    this.pursuer.velocity.set(0, 0, 0);
    this.hasPointerHistory = false;
    this.pursuer.steering.remove(this.seek);
    if (!this.pursuer.steering.behaviors.includes(this.pursuit)) this.pursuer.steering.add(this.pursuit);
  }

  render(et: number, dt: number): void {
    this.entities.update(dt);
    const t = et * 0.001;
    const p = this.params;
    this.evaderTarget.x = Math.cos(t) * Math.sin(t * 0.2) * p.xRange;
    this.evaderTarget.y = Math.sin(t * 0.8) * p.yRange;
    this.evaderTarget.z = p.zTargetPosition + Math.abs(Math.sin(t)) * p.zRange;
    if (this.isChasing) {
      this.target.position.x = this.mouse.x + Math.cos(t * 9) * 0.75;
      this.target.position.y = this.mouse.y + Math.sin(t * 9) * 0.75;
      this.target.position.z = p.zTargetPosition;
    }
    if (this.fruitMode === "falling") {
      if (!this.fallHasLanded) {
        this.groupTarget.position.x = this.fallLand.x;
        this.groupTarget.position.y = this.fallLand.y;
        this.fallVelocityZ -= 18 * dt;
        this.groupTarget.position.z += this.fallVelocityZ * dt;
        this.updateFallStretch();
        if (this.groupTarget.position.z <= this.fruitGroundZ) {
          this.groupTarget.position.z = this.fruitGroundZ;
          this.alignToFruitBottom();
          this.landSquash();
        }
      }
    } else if (this.fruitMode === "cursor" || this.fruitMode === "hiding") {
      this.followCursor(dt);
      if (this.fruitMode === "cursor") this.updateCursorRotation(dt);
      else {
        this.currentRotationZ = lerp(this.currentRotationZ, 0, damp(12, dt));
        this.currentSpeedScale = lerp(this.currentSpeedScale, 1, damp(12, dt));
        this.applyCursorFruitVisual();
      }
    }
    const flap = 2 * this.pursuer.getSpeedSquared() + 15;
    const wings = this.meshPursuer.children;
    if (wings[0]) wings[0].rotation.z = Math.abs(Math.sin(t * flap)) * p.flapStrength - p.flapRotationOffset;
    if (wings[1]) wings[1].rotation.z = Math.abs(Math.cos(t * flap)) * p.flapStrength - p.flapRotationOffset;
    wings[0]?.updateMatrix();
    wings[1]?.updateMatrix();
  }

  destroy(): void {
    this.resetInteraction();
  }
}
