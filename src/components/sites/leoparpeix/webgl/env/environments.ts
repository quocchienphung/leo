import * as THREE from "three";
import { isTabletWidth } from "../../core/env";
import type { AssetsManager } from "../assets";
import { envFragment, envVertex, mountainFragment, treesFragment, treesVertex } from "../shaders/env";
import { ambientLight, pointLight } from "../lights";
import { Clouds, DustParticles, GradientSphere, Leaves, WaterReflector, linearFilter, rawColor } from "./objects";
import { ABOUT_FACE, FlowerFace, HOME_FACE } from "../eyes/flowerFace";

type Route = "home" | "about";

/** Textures sampled with the 5-texel max cross (`yX`). */
const TEXEL_MAX_CROSS: Record<Route, Set<string>> = {
  home: new Set(["TexBibli", "TexProps", "TexWalls"]),
  about: new Set(["TexBook"]),
};
/** Hash-blurred textures and their radius (`IX`, `RX`, default `Q0 = 3`). Desktop only. */
const HASH_BLUR: Record<Route, Record<string, number>> = {
  home: { TexFloor: 3 },
  about: { TexGround: 0, TexMobilier: 3 },
};

function textureSize(tex: THREE.Texture): [number, number] {
  const img = (tex.image ?? (tex.source?.data as { width?: number; height?: number } | undefined)) as
    | { width?: number; height?: number }
    | undefined;
  return [img?.width ?? 1, img?.height ?? 1];
}

/** Source `_createMaterial` for both environments: unlit baked texture. */
function createEnvMaterial(route: Route, name: string, texture: THREE.Texture, transparent = false): THREE.ShaderMaterial {
  linearFilter(texture);
  const blurRadius = HASH_BLUR[route][name];
  const useBlur = blurRadius !== undefined && !isTabletWidth();
  const useMaxCross = TEXEL_MAX_CROSS[route].has(name);
  const defines: Record<string, string | number> = {};
  if (useMaxCross) defines.USE_TEXEL_MAX_CROSS = "";
  if (useBlur) defines.USE_HASH_BLUR = 1;
  const [w, h] = textureSize(texture);
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: envVertex,
    fragmentShader: envFragment,
    uniforms: {
      uTexture: { value: texture },
      uTextureResolution: { value: new THREE.Vector2(w, h) },
      uBlurRadius: { value: useBlur ? blurRadius : 0 },
    },
    transparent,
    defines,
  });
}

export interface Environment extends THREE.Group {
  render(et: number, dt: number): void;
  dispose(): void;
}

/** Home workshop (`WX`, line ~62711). */
export class HomeEnvironment extends THREE.Group implements Environment {
  private clouds: Clouds | null = null;
  private particles: DustParticles;
  private gradient: GradientSphere;
  private materials: THREE.Material[] = [];
  private face: FlowerFace | null = null;

  constructor(assets: AssetsManager, time: THREE.IUniform<number>) {
    super();
    const model = assets.get<THREE.Group>("homeModel");
    const names = ["TexFleur", "TexProps", "TexMobilier", "TexTableaux", "TexBibli", "TexFloor", "TexWalls"];
    const byName = new Map<string, THREE.ShaderMaterial>();
    for (const n of names) {
      const tex = assets.get<THREE.Texture>(`home${n}`);
      if (tex) {
        const m = createEnvMaterial("home", n, tex);
        byName.set(n, m);
        this.materials.push(m);
      }
    }
    model?.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const [n, m] of byName) if (mesh.name.includes(n)) mesh.material = m;
    });
    // The daisy wears the bloub eyes instead of its sculpted face (see eyes/flowerFace.ts).
    const fleur = model?.getObjectByName("TexFleur") as THREE.Mesh | undefined;
    const fleurTex = assets.get<THREE.Texture>("homeTexFleur");
    if (fleur?.isMesh && fleurTex) this.face = FlowerFace.attach(fleur, fleurTex, HOME_FACE);
    if (model) this.add(model);

    this.gradient = new GradientSphere({ topColor: 11649739, bottomColor: 12763054, smoothMin: 0, smoothMax: 1, time });
    this.gradient.position.set(-10, 3, 0);
    this.add(this.gradient);
    this.applyGradientScale();

    const cloudTextures = [1, 2, 3, 4, 5, 6].map((i) => assets.get<THREE.Texture>(`cloud${i}`)).filter(Boolean) as THREE.Texture[];
    const noise = assets.get<THREE.Texture>("noise");
    if (cloudTextures.length === 6 && noise) {
      this.clouds = new Clouds(
        {
          count: 25,
          rangeX: 19,
          rangeY: 13,
          rangeZ: 20,
          tintColor: rawColor(0xf7efe4),
          randomScale: (Math.random() * 0.25 + 0.85) * 10,
          translationSpeedFactor: 0.5,
          deformationSpeedFactor: 1,
        },
        cloudTextures,
        noise,
      );
      this.clouds.position.set(-10, 3, 0);
      this.add(this.clouds);
    }

    this.particles = new DustParticles({
      particleCount: 2000,
      area: new THREE.Vector3(0.1, 0.15, 0.5),
      displacement: new THREE.Vector3(0, 0, -8.2),
      displacementSpeed: 0.04,
      deformationAmplitude: new THREE.Vector3(0, 0.25, 0),
      deformationFrequency: new THREE.Vector3(0.3, 0.2, 0.3),
      deformationSpeed: 0.001,
      scale: isTabletWidth() ? 0.49 : 0.7,
      opacity: 1,
      color: rawColor(16052459),
    });
    this.particles.position.set(3, 3, 0);
    this.add(this.particles);
  }

  applyGradientScale(): void {
    const y = isTabletWidth() ? 8 : 4;
    this.gradient.scale.set(16, y, 16);
  }

  render(et: number): void {
    this.clouds?.render(et);
    this.particles.render(et);
  }

  /** Eyes need the main camera to aim at the pointer. */
  renderFace(et: number, camera: THREE.Camera): void {
    this.face?.update(et, camera);
  }

  dispose(): void {
    for (const m of this.materials) m.dispose();
    this.face?.dispose();
  }
}

/** About landscape (`LX`, line ~62249). */
export class AboutEnvironment extends THREE.Group implements Environment {
  private clouds: Clouds | null = null;
  private leavesLeft: Leaves;
  private leavesRight: Leaves;
  private reflector: WaterReflector | null = null;
  private treesFront: THREE.ShaderMaterial | null = null;
  private treesBack: THREE.ShaderMaterial | null = null;
  private gradient: GradientSphere;
  private materials: THREE.Material[] = [];
  private face: FlowerFace | null = null;

  constructor(assets: AssetsManager, planeGeometry: THREE.PlaneGeometry, time: THREE.IUniform<number>) {
    super();
    const model = assets.get<THREE.Group>("aboutModel");
    const names = ["TexBook", "TexFleur", "texMontagne", "TexGround", "TexRock", "TexProps", "TexDecor", "TexMobilier", "TexArbresFront", "TexArbresBack"];
    const cache = new Map<string, THREE.Material>();
    const material = (n: string): THREE.Material | null => {
      const existing = cache.get(n);
      if (existing) return existing;
      let m: THREE.Material | null = null;
      if (n === "texMontagne") {
        const tex = assets.get<THREE.Texture>("abouttexMontagne");
        if (!tex) return null;
        tex.flipY = false;
        linearFilter(tex);
        m = new THREE.ShaderMaterial({
          glslVersion: THREE.GLSL3,
          vertexShader: envVertex,
          fragmentShader: mountainFragment,
          uniforms: { uTexture: { value: tex } },
          side: THREE.BackSide,
          transparent: true,
        });
      } else if (n === "TexArbresFront" || n === "TexArbresBack") {
        const tex = assets.get<THREE.Texture>(`about${n}`);
        if (!tex) return null;
        linearFilter(tex);
        const sm = new THREE.ShaderMaterial({
          glslVersion: THREE.GLSL3,
          vertexShader: treesVertex,
          fragmentShader: treesFragment,
          uniforms: { uTime: { value: 0 }, uTexture: { value: tex } },
        });
        if (n === "TexArbresFront") this.treesFront = sm;
        else this.treesBack = sm;
        m = sm;
      } else {
        const tex = assets.get<THREE.Texture>(`about${n}`);
        if (!tex) return null;
        m = createEnvMaterial("about", n, tex);
      }
      cache.set(n, m);
      this.materials.push(m);
      return m;
    };
    model?.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const n of names) {
        const key = n === "texMontagne" ? "TexMontagne" : n;
        if (!mesh.name.includes(key)) continue;
        const m = material(n);
        if (m) mesh.material = m;
        if (key === "TexMontagne") mesh.position.y = -10;
      }
    });
    // Same bloub eyes as the home daisy (see eyes/flowerFace.ts).
    const fleur = model?.getObjectByName("TexFleur") as THREE.Mesh | undefined;
    const fleurTex = assets.get<THREE.Texture>("aboutTexFleur");
    if (fleur?.isMesh && fleurTex) this.face = FlowerFace.attach(fleur, fleurTex, ABOUT_FACE);
    if (model) this.add(model);

    this.gradient = new GradientSphere({ topColor: 9484505, bottomColor: 13687514, smoothMin: 0.15, smoothMax: 0.663, time });
    this.gradient.position.set(-300, 86.8, 0);
    this.gradient.scale.set(0.1, 65.5, 320);
    this.add(this.gradient);

    const cloudTextures = [1, 2, 3, 4, 5, 6].map((i) => assets.get<THREE.Texture>(`cloud${i}`)).filter(Boolean) as THREE.Texture[];
    const noise = assets.get<THREE.Texture>("noise");
    if (cloudTextures.length === 6 && noise) {
      this.clouds = new Clouds(
        {
          count: 45,
          rangeX: 2,
          rangeY: 50,
          rangeZ: 350,
          tintColor: rawColor(16777215),
          randomScale: 100,
          translationSpeedFactor: 3,
          deformationSpeedFactor: 0.75,
        },
        cloudTextures,
        noise,
      );
      this.clouds.position.set(-250, 40, 0);
      this.clouds.rotation.z = -0.085;
      this.add(this.clouds);
    }

    const leavesTexture = assets.get<THREE.Texture>("aboutTexLeaves");
    const leaves = (left: boolean) => {
      const l = new Leaves(
        {
          particleCount: 500,
          area: new THREE.Vector3(4, 0.18, 0.5),
          displacement: new THREE.Vector3(-15, -7, left ? -14.4 : 14.4),
          displacementSpeed: 0.1,
          deformationAmplitude: new THREE.Vector3(0, 0.8, 0),
          deformationFrequency: new THREE.Vector3(0.3, 0.125, 0.3),
          deformationSpeed: 0.00125,
          scale: 0.8,
          rotationSpeed: 6e-4,
          opacity: 1,
          color: rawColor(16777215),
        },
        leavesTexture,
      );
      l.position.set(left ? -60 : -70, 0, left ? 15 : -15);
      this.add(l);
      return l;
    };
    this.leavesLeft = leaves(true);
    this.leavesRight = leaves(false);

    // Lights only affect the Phong leaves; the baked environment is unlit.
    this.add(ambientLight("#ffffff", 1));
    const point = pointLight("#ffffff", 1);
    point.position.set(-32.61, 8.7, 17.39);
    this.add(point);

    const deformation = assets.get<THREE.Texture>("waterDeformation");
    if (noise && deformation) {
      deformation.wrapS = deformation.wrapT = THREE.RepeatWrapping;
      linearFilter(deformation);
      noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
      linearFilter(noise);
      this.reflector = new WaterReflector(planeGeometry, {
        color: new THREE.Color("#ffffff"),
        textureWidth: 1024,
        clipBias: 0.03,
        multisample: 4,
        updateInterval: 3,
        tDeformation: deformation,
        tNoise: noise,
        waveStrength: 0.2,
        waveSpeed: 0.1,
        opacity: 1,
        blurRadius: isTabletWidth() ? 0 : 0.239,
        noiseRepeat: 40.3,
        contrast: 0.72,
        saturation: 1,
        brightness: 1.22,
      });
      this.reflector.rotation.x = -Math.PI * 0.5;
      this.reflector.scale.set(275, 275, 275);
      this.reflector.position.set(-132.416, -3.7, 0);
      this.add(this.reflector);
    }
  }

  render(et: number): void {
    if (this.treesFront) this.treesFront.uniforms.uTime.value = et;
    if (this.treesBack) this.treesBack.uniforms.uTime.value = et;
    this.clouds?.render(et);
    this.leavesLeft.render(et);
    this.leavesRight.render(et);
    this.reflector?.update(et);
  }

  /** Eyes need the main camera to aim at the pointer. */
  renderFace(et: number, camera: THREE.Camera): void {
    this.face?.update(et, camera);
  }

  dispose(): void {
    this.face?.dispose();
    for (const m of this.materials) m.dispose();
    this.reflector?.dispose();
  }
}
