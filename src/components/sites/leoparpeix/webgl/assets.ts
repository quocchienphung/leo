import * as THREE from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import {
  aboutGroundNormal,
  aboutLeaves,
  aboutMountain,
  cloudTextures,
  decoders,
  globalKtx,
  models,
  projectTexture,
  sceneTexture,
  type GlobalKtxKey,
} from "../data/media";

export const HOME_TEXTURES = ["TexFleur", "TexProps", "TexMobilier", "TexDecor", "TexTableaux", "TexBibli", "TexFloor", "TexWalls"] as const;
export const ABOUT_TEXTURES = [
  "TexBook",
  "TexFleur",
  "TexGround",
  "TexRock",
  "TexProps",
  "TexDecor",
  "TexMobilier",
  "TexArbresFront",
  "TexArbresBack",
] as const;
export const PROJECT_COUNTS = [12, 12, 11, 9, 10, 11] as const;

type ModelKey = keyof typeof models;

/**
 * Port of the source asset manager (bundle ~28150). All textures are stored with
 * `NoColorSpace` and `flipY=false`: the whole pipeline is "raw" so baked atlases reach the
 * screen unchanged.
 */
export class AssetsManager {
  private gltf: GLTFLoader;
  private ktx2: KTX2Loader;
  private draco: DRACOLoader;
  private textureLoader = new THREE.TextureLoader();
  private cache = new Map<string, Promise<unknown>>();
  private resolved = new Map<string, unknown>();
  private width: number;
  private progressTotal = 0;
  private progressDone = 0;
  onProgress: ((p: number) => void) | null = null;

  constructor(renderer: THREE.WebGLRenderer) {
    this.width = window.innerWidth;
    this.draco = new DRACOLoader();
    this.draco.setDecoderPath(decoders.draco);
    this.gltf = new GLTFLoader();
    this.gltf.setDRACOLoader(this.draco);
    this.ktx2 = new KTX2Loader();
    this.ktx2.setTranscoderPath(decoders.basis);
    this.ktx2.detectSupport(renderer);
  }

  get<T>(key: string): T | undefined {
    return this.resolved.get(key) as T | undefined;
  }

  private track<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = this.cache.get(key);
    if (existing) return existing as Promise<T>;
    this.progressTotal++;
    const p = factory().then((v) => {
      this.resolved.set(key, v);
      this.progressDone++;
      if (process.env.NODE_ENV !== "production") console.debug(`[assets] ${key} ${this.progressDone}/${this.progressTotal}`);
      this.onProgress?.(this.progressDone / this.progressTotal);
      return v;
    });
    p.catch((err: unknown) => {
      console.error(`[assets] failed ${key}`, err);
      this.cache.delete(key);
    });
    this.cache.set(key, p);
    return p;
  }

  private rawTexture(tex: THREE.Texture, flipY = false): THREE.Texture {
    tex.colorSpace = THREE.NoColorSpace;
    tex.flipY = flipY;
    tex.needsUpdate = true;
    return tex;
  }

  loadKtx(key: string, url: string): Promise<THREE.Texture> {
    return this.track(key, () => this.ktx2.loadAsync(url).then((t) => this.rawTexture(t)));
  }

  loadImage(key: string, url: string): Promise<THREE.Texture> {
    // webp textures keep three's default flipY (true) like the source webp loader.
    return this.track(key, () =>
      this.textureLoader.loadAsync(url).then((t) => {
        t.colorSpace = THREE.NoColorSpace;
        return t;
      }),
    );
  }

  loadModel(key: ModelKey): Promise<THREE.Group> {
    return this.track(`${key}Model`, () => this.gltf.loadAsync(models[key]).then((g) => g.scene));
  }

  loadGlobalKtx(key: GlobalKtxKey): Promise<THREE.Texture> {
    return this.loadKtx(key, globalKtx(key, this.width));
  }

  /** Assets every route needs (source `_F` + `vF`): flower/bee/noise textures and global models. */
  loadGlobal(): Promise<unknown> {
    return Promise.all([
      this.loadGlobalKtx("flowerTex"),
      this.loadGlobalKtx("beeTex"),
      this.loadGlobalKtx("noise"),
      this.loadModel("bee"),
      this.loadModel("flower"),
      this.loadModel("orange"),
      this.loadModel("raisin"),
    ]);
  }

  loadClouds(): Promise<unknown> {
    return Promise.all(cloudTextures.map((url, i) => this.loadImage(`cloud${i + 1}`, url)));
  }

  ensureHome(): Promise<unknown> {
    return Promise.all([
      ...HOME_TEXTURES.map((t) => this.loadKtx(`home${t}`, sceneTexture("home", t, this.width))),
      this.loadClouds(),
      this.loadModel("home"),
    ]);
  }

  ensureAbout(): Promise<unknown> {
    return Promise.all([
      ...ABOUT_TEXTURES.map((t) => this.loadKtx(`about${t}`, sceneTexture("about", t, this.width))),
      this.loadGlobalKtx("waterDeformation"),
      this.loadGlobalKtx("aboutGroundRoughness"),
      this.loadGlobalKtx("aboutGroundAo"),
      this.loadGlobalKtx("aboutGroundDiffuse"),
      this.loadImage("aboutTexLeaves", aboutLeaves(this.width)),
      this.loadImage("aboutGroundNormal", aboutGroundNormal(this.width)),
      this.loadImage("abouttexMontagne", aboutMountain),
      this.loadClouds(),
      this.loadModel("about"),
    ]);
  }

  ensureProject(projectIndex: number): Promise<THREE.Texture[]> {
    const count = PROJECT_COUNTS[projectIndex] ?? 0;
    return Promise.all(
      Array.from({ length: count }, (_, i) =>
        this.loadKtx(`homeProject${projectIndex + 1}_${i + 1}`, projectTexture(projectIndex, i, this.width)),
      ),
    );
  }

  dispose(): void {
    this.ktx2.dispose();
    this.draco.dispose();
  }
}
