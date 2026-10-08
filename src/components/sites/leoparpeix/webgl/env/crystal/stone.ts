import * as THREE from "three";

type Finish = "honed" | "polished" | "wet";

const stoneVertex = /* glsl */ `
varying vec3 vStoneWorld;
varying vec3 vStoneNormal;
`;
const stoneFragment = /* glsl */ `
varying vec3 vStoneWorld;
varying vec3 vStoneNormal;
uniform float uStoneScale;
uniform float uStoneCourse;

vec3 stoneWeights() {
  vec3 w = pow(abs(normalize(vStoneNormal)), vec3(8.0));
  return w / max(w.x + w.y + w.z, 0.0001);
}
vec4 stoneSample(sampler2D tex) {
  vec3 p = vStoneWorld * uStoneScale;
  vec3 w = stoneWeights();
  return texture2D(tex, p.zy) * w.x + texture2D(tex, p.xz) * w.y + texture2D(tex, p.xy) * w.z;
}
// Fine dressed-stone joints. Filter the millimetre-wide line at grazing angles.
float stoneJoint(vec2 p, vec2 block, float stagger) {
  float row = floor(p.y / block.y);
  p.x += mod(row, 2.0) * block.x * stagger;
  vec2 q = mod(p, block);
  vec2 edge = min(q, block - q);
  vec2 aa = max(fwidth(p), vec2(0.0008));
  vec2 seam = 1.0 - smoothstep(vec2(0.0015), vec2(0.0035) + aa, edge);
  return max(seam.x, seam.y);
}
float stoneSeam() {
  vec3 w = stoneWeights();
  vec3 p = vStoneWorld;
  float wall = stoneJoint(p.zy, vec2(2.3, 1.3), 0.5) * w.x
             + stoneJoint(p.xy, vec2(2.3, 1.3), 0.5) * w.z;
  float floorSeam = stoneJoint(p.xz, vec2(1.8), 0.0) * w.y;
  return uStoneCourse * (wall + floorSeam);
}
`;

/** One texture pair per pavilion; materials use world-space projection, including arch reveals. */
export class GranitePalette {
  readonly color = new THREE.Texture();
  readonly surface = new THREE.Texture();
  readonly ready: Promise<void>;
  private disposed = false;

  constructor() {
    const loader = new THREE.TextureLoader();
    const load = async (url: string, into: THREE.Texture, colorSpace: THREE.ColorSpace) => {
      const texture = await loader.loadAsync(url);
      if (this.disposed) {
        texture.dispose();
        return;
      }
      into.copy(texture);
      into.colorSpace = colorSpace;
      // Mirroring makes the generated tile continuous at its boundary without an image seam.
      into.wrapS = into.wrapT = THREE.MirroredRepeatWrapping;
      into.anisotropy = 8;
      into.needsUpdate = true;
      texture.dispose();
    };
    this.ready = Promise.all([
      load("/sites/leoparpeix/textures/crystal/ivory-granite-albedo-v1.webp", this.color, THREE.SRGBColorSpace),
      load("/sites/leoparpeix/textures/crystal/ivory-granite-surface-v1.png", this.surface, THREE.NoColorSpace),
    ]).then(() => undefined);
  }

  material(finish: Finish, courses = false): THREE.MeshPhysicalMaterial {
    const m = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: this.color,
      roughnessMap: this.surface,
      bumpMap: this.surface,
      bumpScale: finish === "honed" ? 0.012 : 0.004,
      roughness: finish === "honed" ? 0.64 : finish === "wet" ? 0.16 : 0.27,
      metalness: 0,
      clearcoat: finish === "honed" ? 0.12 : 0.65,
      clearcoatRoughness: finish === "honed" ? 0.3 : 0.12,
      envMapIntensity: finish === "honed" ? 0.45 : 0.7,
    });
    m.name = `Ivory granite / ${finish}`;
    m.userData.stone = true;
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uStoneScale = { value: 0.65 };
      shader.uniforms.uStoneCourse = { value: courses ? 1 : 0 };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${stoneVertex}`)
        .replace("#include <fog_vertex>", `#include <fog_vertex>
          vStoneWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vStoneNormal = normalize(mat3(modelMatrix) * objectNormal);`);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${stoneFragment}`)
        .replace("#include <map_fragment>", `vec4 stoneTexel = stoneSample(map);
          stoneTexel.rgb = mix(vec3(0.82, 0.78, 0.70), stoneTexel.rgb, 0.62);
          diffuseColor *= stoneTexel;
          diffuseColor.rgb *= 1.0 - stoneSeam() * 0.22;`)
        .replace("#include <roughnessmap_fragment>", "float roughnessFactor = roughness * stoneSample(roughnessMap).g;")
        .replace("#include <bumpmap_pars_fragment>", `#include <bumpmap_pars_fragment>
          #ifdef USE_BUMPMAP
          vec2 stoneGradient() {
            float height = stoneSample(bumpMap).r;
            return vec2(dFdx(height), dFdy(height)) * bumpScale;
          }
          #endif`)
        .replace("#include <normal_fragment_maps>", THREE.ShaderChunk.normal_fragment_maps.replace("dHdxy_fwd()", "stoneGradient()"));
    };
    m.customProgramCacheKey = () => "crystal-granite-triplanar-v1";
    return m;
  }

  dispose(): void {
    this.disposed = true;
    this.color.dispose();
    this.surface.dispose();
  }
}
