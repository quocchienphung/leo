import * as THREE from "three";
import {
  cloudsFragment,
  cloudsVertex,
  gradientFragment,
  gradientVertex,
  particlesFragment,
  particlesVertex,
  waterFragment,
  waterVertex,
} from "../shaders/env";

/** Raw colour: the source builds colours with `setHex(hex, "srgb-linear")`, i.e. no conversion. */
export function rawColor(hex: number): THREE.Color {
  return new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);
}

/** Source `kh()`: linear filtering, no mip generation. */
export function linearFilter(tex: THREE.Texture | undefined): void {
  if (!tex) return;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
}

/** Background gradient sphere (`s1`). */
export class GradientSphere extends THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  constructor({
    topColor = 0xb4c2cb,
    bottomColor = 0xc2bfae,
    smoothMin = 0,
    smoothMax = 1,
    time,
  }: { topColor?: number; bottomColor?: number; smoothMin?: number; smoothMax?: number; time: THREE.IUniform<number> }) {
    super(
      new THREE.SphereGeometry(1, 16, 16),
      new THREE.ShaderMaterial({
        vertexShader: gradientVertex,
        fragmentShader: gradientFragment,
        uniforms: {
          uTime: time,
          uTopColor: { value: rawColor(topColor) },
          uBottomColor: { value: rawColor(bottomColor) },
          uGradientSmoothMin: { value: smoothMin },
          uGradientSmoothMax: { value: smoothMax },
        },
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
  }
}

export interface CloudsParams {
  count: number;
  rangeX: number;
  rangeY: number;
  rangeZ: number;
  tintColor: THREE.Color;
  randomScale: number;
  translationSpeedFactor: number;
  deformationSpeedFactor: number;
}

/** Instanced billboard clouds (`f1`). */
export class Clouds extends THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial> {
  constructor(params: CloudsParams, textures: THREE.Texture[], noise: THREE.Texture) {
    const plane = new THREE.PlaneGeometry(1, 1, 1, 1);
    plane.rotateY(Math.PI * 0.5);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = plane.index;
    geo.attributes.position = plane.attributes.position;
    geo.attributes.uv = plane.attributes.uv;

    const n = params.count;
    const positions = new Float32Array(n * 3);
    const speed = new Float32Array(n);
    const scale = new Float32Array(n);
    const texIndex = new Float32Array(n);
    const texDir = new Float32Array(n);
    for (const t of textures) {
      linearFilter(t);
      t.generateMipmaps = false;
    }
    linearFilter(noise);
    noise.generateMipmaps = false;
    noise.wrapS = THREE.RepeatWrapping;
    noise.wrapT = THREE.RepeatWrapping;
    for (let i = 0; i < n; i++) {
      positions[i * 3] = Math.random() * params.rangeX - params.rangeX * 0.5;
      positions[i * 3 + 1] = Math.random() * params.rangeY - params.rangeY * 0.5;
      positions[i * 3 + 2] = THREE.MathUtils.randFloat(-params.rangeZ, params.rangeZ);
      speed[i] = Math.random() * 0.5 + 0.5;
      scale[i] = params.randomScale;
      texIndex[i] = Number((Math.random() * (textures.length - 1)).toFixed(0));
      texDir[i] = i % 2;
    }
    geo.setAttribute("aPositions", new THREE.InstancedBufferAttribute(positions, 3, false));
    geo.setAttribute("aRandomSpeed", new THREE.InstancedBufferAttribute(speed, 1, false));
    geo.setAttribute("aRandomScale", new THREE.InstancedBufferAttribute(scale, 1, false));
    geo.setAttribute("aRandomTextureIndex", new THREE.InstancedBufferAttribute(texIndex, 1, false));
    geo.setAttribute("aRandomTextureDirection", new THREE.InstancedBufferAttribute(texDir, 1, false));
    geo.instanceCount = n;

    super(
      geo,
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: cloudsVertex,
        fragmentShader: cloudsFragment,
        uniforms: {
          uTime: { value: 0 },
          uRangeZ: { value: params.rangeZ },
          uTranslationSpeedFactor: { value: params.translationSpeedFactor },
          uDeformationSpeedFactor: { value: params.deformationSpeedFactor },
          uTextures: { value: textures },
          uNoiseTexture: { value: noise },
          uTintColor: { value: params.tintColor },
        },
        transparent: true,
        depthWrite: false,
      }),
    );
    this.frustumCulled = false;
  }

  render(et: number): void {
    this.material.uniforms.uTime.value = et;
  }
}

export interface ParticleParams {
  particleCount: number;
  area: THREE.Vector3;
  displacement: THREE.Vector3;
  displacementSpeed: number;
  deformationAmplitude: THREE.Vector3;
  deformationFrequency: THREE.Vector3;
  deformationSpeed: number;
  scale: number;
  opacity: number;
  color: THREE.Color;
}

/** Floating dust points (`QX`). */
export class DustParticles extends THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  constructor(p: ParticleParams) {
    const n = p.particleCount;
    const positions = new Float32Array(n * 3);
    const scale = new Float32Array(n);
    const speed = new Float32Array(n);
    const opacity = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      positions[i * 3] = THREE.MathUtils.randFloatSpread(50);
      positions[i * 3 + 1] = THREE.MathUtils.randFloatSpread(50);
      positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(50);
      scale[i] = THREE.MathUtils.randFloat(0.15, 1);
      speed[i] = THREE.MathUtils.randFloat(1, 4);
      opacity[i] = THREE.MathUtils.randFloat(0.2, 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aScale", new THREE.BufferAttribute(scale, 1));
    geo.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
    geo.setAttribute("aOpacity", new THREE.BufferAttribute(opacity, 1));
    super(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: particlesVertex,
        fragmentShader: particlesFragment,
        uniforms: {
          uTime: { value: 0 },
          uArea: { value: p.area },
          uDisplacement: { value: p.displacement },
          uDisplacementSpeed: { value: p.displacementSpeed },
          uDeformationAmplitude: { value: p.deformationAmplitude },
          uDeformationFrequency: { value: p.deformationFrequency },
          uDeformationSpeed: { value: p.deformationSpeed },
          uScale: { value: p.scale },
          uOpacity: { value: p.opacity },
          uColor: { value: p.color },
        },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.frustumCulled = false;
  }

  render(et: number): void {
    this.material.uniforms.uTime.value = et;
  }
}

export interface LeavesParams {
  particleCount: number;
  area: THREE.Vector3;
  displacement: THREE.Vector3;
  displacementSpeed: number;
  deformationAmplitude: THREE.Vector3;
  deformationFrequency: THREE.Vector3;
  deformationSpeed: number;
  scale: number;
  rotationSpeed: number;
  opacity: number;
  color: THREE.Color;
}

/** Falling leaves (`EX`): instanced quads on a patched MeshPhongMaterial. */
export class Leaves extends THREE.Mesh<THREE.InstancedBufferGeometry, THREE.MeshPhongMaterial> {
  private uniforms: Record<string, THREE.IUniform>;

  constructor(p: LeavesParams, texture: THREE.Texture | undefined) {
    const n = p.particleCount;
    const positions = new Float32Array(n * 3);
    const rotations = new Float32Array(n * 3);
    const scale = new Float32Array(n);
    const speed = new Float32Array(n);
    const opacity = new Float32Array(n);
    const random = new Float32Array(n * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      positions[i * 3] = THREE.MathUtils.randFloatSpread(50);
      positions[i * 3 + 1] = THREE.MathUtils.randFloatSpread(50);
      positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(50);
      v.set(Math.PI * Math.random() * 2, Math.PI * Math.random() * 2, Math.PI * Math.random() * 2).normalize();
      rotations[i * 3] = v.x;
      rotations[i * 3 + 1] = v.y;
      rotations[i * 3 + 2] = v.z;
      scale[i] = THREE.MathUtils.randFloat(0.15, 1);
      speed[i] = THREE.MathUtils.randFloat(1, 4);
      opacity[i] = THREE.MathUtils.randFloat(0.2, 1);
      random[i] = Math.random();
    }
    const plane = new THREE.PlaneGeometry();
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = plane.index;
    geo.attributes.position = plane.attributes.position;
    geo.attributes.normal = plane.attributes.normal;
    geo.attributes.uv = plane.attributes.uv;
    geo.setAttribute("aPositions", new THREE.InstancedBufferAttribute(positions, 3, false));
    geo.setAttribute("aRotations", new THREE.InstancedBufferAttribute(rotations, 3, false));
    geo.setAttribute("aScale", new THREE.InstancedBufferAttribute(scale, 1, false));
    geo.setAttribute("aSpeed", new THREE.InstancedBufferAttribute(speed, 1, false));
    geo.setAttribute("aOpacity", new THREE.InstancedBufferAttribute(opacity, 1, false));
    geo.setAttribute("aRandom", new THREE.InstancedBufferAttribute(random, 1, false));
    geo.instanceCount = n;

    const material = new THREE.MeshPhongMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false });
    super(geo, material);
    const uniforms: Record<string, THREE.IUniform> = {
      uTime: { value: 0 },
      uDisplacementSpeed: { value: p.displacementSpeed },
      uDeformationSpeed: { value: p.deformationSpeed },
      uScale: { value: p.scale },
      uRotationSpeed: { value: p.rotationSpeed },
      uArea: { value: p.area },
      uDisplacement: { value: p.displacement },
      uDeformationAmplitude: { value: p.deformationAmplitude },
      uDeformationFrequency: { value: p.deformationFrequency },
      uTexture: { value: texture ?? null },
      uColor: { value: p.color },
      uOpacity: { value: p.opacity },
    };
    this.uniforms = uniforms;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader.replace(
        "#define PHONG",
        `#define PHONG
				attribute float aScale;
				attribute float aSpeed;
				attribute float aOpacity;
				attribute vec3 aPositions;
				attribute vec3 aRotations;
				attribute float aRandom;

				uniform float uTime;
				uniform float uDisplacementSpeed;
				uniform float uDeformationSpeed;
				uniform float uScale;
				uniform float uRotationSpeed;
				uniform vec3 uArea;
				uniform vec3 uDisplacement;
				uniform vec3 uDeformationAmplitude;
				uniform vec3 uDeformationFrequency;

				varying float vRandomOpacity;
				varying float vFade;
				varying float vRandom;
				varying vec2 vUv;

				mat4 rotate3d(vec3 axis, float angle) {
				axis = normalize(axis);
				float s = sin(angle);
				float c = cos(angle);
				float oc = 1.0 - c;
				return mat4(oc * axis.x * axis.x + c, oc * axis.x * axis.y - axis.z * s, oc * axis.z * axis.x + axis.y * s, 0.0, oc * axis.x * axis.y + axis.z * s, oc * axis.y * axis.y + c, oc * axis.y * axis.z - axis.x * s, 0.0, oc * axis.z * axis.x - axis.y * s, oc * axis.y * axis.z + axis.x * s, oc * axis.z * axis.z + c, 0.0, 0.0, 0.0, 0.0, 1.0);
				}
			`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <beginnormal_vertex>",
        `
				vec3 objectNormal = vec3( normal );

				mat4 rotationMatrix = rotate3d(aRotations.xyz, uTime * aSpeed * uRotationSpeed) * rotate3d(aRotations.zyx, uTime * aSpeed * uRotationSpeed);

				objectNormal = vec4(rotationMatrix * vec4(objectNormal, 1.0)).xyz;

				#ifdef USE_TANGENT
					vec3 objectTangent = vec3( tangent.xyz );
				#endif
			`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
				vec3 transformed = (position * vec3(uScale)) * aScale;

				float displacementSpeed = uTime * aSpeed * uDisplacementSpeed * 0.001;
				float life = mod(displacementSpeed + aOpacity, 1.0);

				vec4 planeParticle = rotationMatrix * vec4(transformed, 1.);

				vec3 instancedPosition = aPositions;
				instancedPosition.x *= uArea.x;
				instancedPosition.y *= uArea.y;
				instancedPosition.z *= uArea.z;

				instancedPosition.x += (life) * uDisplacement.x;
				instancedPosition.y += (life) * uDisplacement.y;
				instancedPosition.z += (life) * uDisplacement.z;

				instancedPosition.x += sin(uTime * uDeformationSpeed * aSpeed + instancedPosition.y * uDeformationFrequency.x) * uDeformationAmplitude.x;
				instancedPosition.y += cos(uTime * uDeformationSpeed * aSpeed + instancedPosition.x * uDeformationFrequency.y) * uDeformationAmplitude.y;
				instancedPosition.z += cos(uTime * uDeformationSpeed * aSpeed + instancedPosition.z * uDeformationFrequency.z) * uDeformationAmplitude.z;

				planeParticle += vec4(instancedPosition, 1.0);

				#ifdef USE_ALPHAHASH
					vPosition = vec3( position );
				#endif

				vRandomOpacity = aOpacity;
				vFade = life;
				vUv = uv;
				vRandom = aRandom;
			`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        `
				 vec4 mvPosition = modelViewMatrix * planeParticle;

				gl_Position = projectionMatrix * mvPosition;
			`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>
				uniform vec3 uColor;
				uniform float uOpacity;
				uniform sampler2D uTexture;
				varying float vFade;
				varying float vRandomOpacity;
				varying float vRandom;
				varying vec2 vUv;`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `
					#include <color_fragment>
					vec4 textureColor = texture2D(uTexture, vUv);

					float fadeIn = smoothstep(0., 0.035, vFade);
					float fadeOut = 1.0 - smoothstep(0.035, 1.0, vFade);
					float fadeRender = fadeIn * fadeOut;

					diffuseColor *= textureColor;
					diffuseColor.a *= fadeRender * uOpacity * vRandomOpacity;
					diffuseColor.rgb *= uColor;
				`,
      );
    };
    this.frustumCulled = false;
  }

  render(et: number): void {
    this.uniforms.uTime.value = et;
  }
}

export interface ReflectorParams {
  color: THREE.Color;
  textureWidth: number;
  clipBias: number;
  multisample: number;
  updateInterval: number;
  tDeformation: THREE.Texture;
  tNoise: THREE.Texture;
  waveStrength: number;
  waveSpeed: number;
  opacity: number;
  blurRadius: number;
  noiseRepeat: number;
  contrast: number;
  saturation: number;
  brightness: number;
}

/** Planar reflector with animated distortion (`MX`). Re-renders every `updateInterval` frames. */
export class WaterReflector extends THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> {
  renderTarget: THREE.WebGLRenderTarget;
  private textureMatrix = new THREE.Matrix4();
  private frameCounter = 0;

  constructor(geometry: THREE.BufferGeometry, p: ReflectorParams) {
    const renderTarget = new THREE.WebGLRenderTarget(p.textureWidth, p.textureWidth, {
      samples: p.multisample,
      type: THREE.HalfFloatType,
    });
    const textureMatrix = new THREE.Matrix4();
    super(
      geometry,
      new THREE.ShaderMaterial({
        vertexShader: waterVertex,
        fragmentShader: waterFragment,
        uniforms: {
          tDiffuse: { value: renderTarget.texture },
          tDeformation: { value: p.tDeformation },
          tNoise: { value: p.tNoise },
          tWaterShadow: { value: null },
          uColor: { value: p.color },
          uTime: { value: 0 },
          uTextureMatrix: { value: textureMatrix },
          uWaveStrength: { value: p.waveStrength },
          uWaveSpeed: { value: p.waveSpeed },
          uOpacity: { value: p.opacity },
          uContrast: { value: p.contrast },
          uSaturation: { value: p.saturation },
          uBrightness: { value: p.brightness },
          uBlurRadius: { value: p.blurRadius },
          uNoiseRepeat: { value: p.noiseRepeat },
        },
        transparent: true,
        side: THREE.FrontSide,
      }),
    );
    this.renderTarget = renderTarget;
    this.textureMatrix = textureMatrix;

    const reflectorPlane = new THREE.Plane();
    const normal = new THREE.Vector3();
    const reflectorWorldPosition = new THREE.Vector3();
    const cameraWorldPosition = new THREE.Vector3();
    const rotationMatrix = new THREE.Matrix4();
    const lookAtPosition = new THREE.Vector3(0, 0, -1);
    const clipPlane = new THREE.Vector4();
    const view = new THREE.Vector3();
    const target = new THREE.Vector3();
    const q = new THREE.Vector4();
    const virtualCamera = new THREE.PerspectiveCamera();

    this.onBeforeRender = (renderer, scene, camera) => {
      reflectorWorldPosition.setFromMatrixPosition(this.matrixWorld);
      cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);
      rotationMatrix.extractRotation(this.matrixWorld);
      normal.set(0, 0, 1);
      normal.applyMatrix4(rotationMatrix);
      view.subVectors(reflectorWorldPosition, cameraWorldPosition);
      if (view.dot(normal) > 0) return;
      view.reflect(normal).negate();
      view.add(reflectorWorldPosition);
      rotationMatrix.extractRotation(camera.matrixWorld);
      lookAtPosition.set(0, 0, -1);
      lookAtPosition.applyMatrix4(rotationMatrix);
      lookAtPosition.add(cameraWorldPosition);
      target.subVectors(reflectorWorldPosition, lookAtPosition);
      target.reflect(normal).negate();
      target.add(reflectorWorldPosition);
      virtualCamera.position.copy(view);
      virtualCamera.up.set(0, 1, 0);
      virtualCamera.up.applyMatrix4(rotationMatrix);
      virtualCamera.up.reflect(normal);
      virtualCamera.lookAt(target);
      virtualCamera.far = (camera as THREE.PerspectiveCamera).far;
      virtualCamera.updateMatrixWorld();
      virtualCamera.projectionMatrix.copy(camera.projectionMatrix);
      this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      this.textureMatrix.multiply(virtualCamera.projectionMatrix);
      this.textureMatrix.multiply(virtualCamera.matrixWorldInverse);
      this.textureMatrix.multiply(this.matrixWorld);
      reflectorPlane.setFromNormalAndCoplanarPoint(normal, reflectorWorldPosition);
      reflectorPlane.applyMatrix4(virtualCamera.matrixWorldInverse);
      clipPlane.set(reflectorPlane.normal.x, reflectorPlane.normal.y, reflectorPlane.normal.z, reflectorPlane.constant);
      const projectionMatrix = virtualCamera.projectionMatrix;
      q.x = (Math.sign(clipPlane.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0];
      q.y = (Math.sign(clipPlane.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5];
      q.z = -1;
      q.w = (1 + projectionMatrix.elements[10]) / projectionMatrix.elements[14];
      clipPlane.multiplyScalar(2 / clipPlane.dot(q));
      projectionMatrix.elements[2] = clipPlane.x;
      projectionMatrix.elements[6] = clipPlane.y;
      projectionMatrix.elements[10] = clipPlane.z + 1 - p.clipBias;
      projectionMatrix.elements[14] = clipPlane.w;
      this.frameCounter++;
      if (this.frameCounter % p.updateInterval !== 0) return;
      this.visible = false;
      const currentRenderTarget = renderer.getRenderTarget();
      const currentXr = renderer.xr.enabled;
      const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;
      renderer.xr.enabled = false;
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(this.renderTarget);
      renderer.state.buffers.depth.setMask(true);
      if (renderer.autoClear === false) renderer.clear();
      renderer.render(scene, virtualCamera);
      renderer.xr.enabled = currentXr;
      renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;
      renderer.setRenderTarget(currentRenderTarget);
      const viewport = (camera as THREE.Camera & { viewport?: THREE.Vector4 }).viewport;
      if (viewport !== undefined) renderer.state.viewport(viewport);
      this.visible = true;
    };
  }

  update(et: number): void {
    this.material.uniforms.uTime.value = et;
  }

  dispose(): void {
    this.renderTarget.dispose();
    this.material.dispose();
  }
}
