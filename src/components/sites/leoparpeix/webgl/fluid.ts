import * as THREE from "three";
import { leo } from "../core/app";

// Stable-fluids cursor simulation, ported from the source (`Iq` + passes, line ~68879–69400).

const FACE_VERT = /* glsl */ `attribute vec3 position;
uniform vec2 px;
uniform vec2 boundarySpace;
varying vec2 uv;
precision highp float;
void main(){
    vec3 pos = position;
    uv = vec2(0.5)+(pos.xy)*0.5;
    gl_Position = vec4(pos, 1.0);
}`;

const ADVECTION_FRAG = /* glsl */ `precision highp float;
uniform sampler2D velocity;
uniform float dt;
uniform float dissipation;
uniform bool isBFECC;
uniform vec2 fboSize;
uniform vec2 px;
varying vec2 uv;
void main(){
    vec2 ratio = max(fboSize.x, fboSize.y) / fboSize;
    if(isBFECC == false){
        vec2 vel = texture2D(velocity, uv).xy;
        vec2 uv2 = uv - vel * dt * ratio;
        vec2 newVel = texture2D(velocity, uv2).xy;
        newVel *= dissipation;
        gl_FragColor = vec4(newVel, 0.0, 0.0);
    } else {
        vec2 spot_new = uv;
        vec2 vel_old = texture2D(velocity, uv).xy;
        vec2 spot_old = spot_new - vel_old * dt * ratio;
        vec2 vel_new1 = texture2D(velocity, spot_old).xy;
        vec2 spot_new2 = spot_old + vel_new1 * dt * ratio;
        vec2 error = spot_new2 - spot_new;
        vec2 spot_new3 = spot_new - error / 2.0;
        vec2 vel_2 = texture2D(velocity, spot_new3).xy;
        vec2 spot_old2 = spot_new3 - vel_2 * dt * ratio;
        vec2 newVel2 = texture2D(velocity, spot_old2).xy;
        newVel2 *= dissipation;
        gl_FragColor = vec4(newVel2, 0.0, 0.0);
    }
}`;

const FORCE_VERT = /* glsl */ `precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform vec2 center;
uniform vec2 scale;
uniform vec2 px;
varying vec2 vUv;
void main(){
    vec2 pos = position.xy * scale * 2.0 * px + center;
    vUv = uv;
    gl_Position = vec4(pos, 0.0, 1.0);
}`;

const FORCE_FRAG = /* glsl */ `precision highp float;
uniform vec2 force;
uniform vec2 center;
uniform vec2 scale;
uniform vec2 px;
varying vec2 vUv;
void main(){
    vec2 circle = (vUv - 0.5) * 2.0;
    float d = 1.0-min(length(circle), 1.0);
    d *= d;
    gl_FragColor = vec4(force * d, 0, 1);
}`;

const DIVERGENCE_FRAG = /* glsl */ `precision highp float;
uniform sampler2D velocity;
uniform float dt;
uniform vec2 px;
varying vec2 uv;
void main(){
    float x0 = texture2D(velocity, uv-vec2(px.x, 0)).x;
    float x1 = texture2D(velocity, uv+vec2(px.x, 0)).x;
    float y0 = texture2D(velocity, uv-vec2(0, px.y)).y;
    float y1 = texture2D(velocity, uv+vec2(0, px.y)).y;
    float divergence = (x1-x0 + y1-y0) / 2.0;
    gl_FragColor = vec4(divergence / dt);
}`;

const POISSON_FRAG = /* glsl */ `precision highp float;
uniform sampler2D pressure;
uniform sampler2D divergence;
uniform vec2 px;
varying vec2 uv;
void main(){
    float p0 = texture2D(pressure, uv+vec2(px.x * 2.0,  0)).r;
    float p1 = texture2D(pressure, uv-vec2(px.x * 2.0, 0)).r;
    float p2 = texture2D(pressure, uv+vec2(0, px.y * 2.0 )).r;
    float p3 = texture2D(pressure, uv-vec2(0, px.y * 2.0 )).r;
    float div = texture2D(divergence, uv).r;
    float newP = (p0 + p1 + p2 + p3) / 4.0 - div;
    gl_FragColor = vec4(newP);
}`;

const PRESSURE_FRAG = /* glsl */ `precision highp float;
uniform sampler2D pressure;
uniform sampler2D velocity;
uniform vec2 px;
uniform float dt;
varying vec2 uv;
void main(){
    float step = 1.0;
    float p0 = texture2D(pressure, uv+vec2(px.x * step, 0)).r;
    float p1 = texture2D(pressure, uv-vec2(px.x * step, 0)).r;
    float p2 = texture2D(pressure, uv+vec2(0, px.y * step)).r;
    float p3 = texture2D(pressure, uv-vec2(0, px.y * step)).r;
    vec2 v = texture2D(velocity, uv).xy;
    vec2 gradP = vec2(p0 - p1, p2 - p3) * 0.5;
    v = v - gradP * dt;
    gl_FragColor = vec4(v, 0.0, 1.0);
}`;

/** Final pass (`pY`): brighten where the fluid moves. */
export const FLUID_FINAL_FRAG = /* glsl */ `varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform sampler2D tVelocity;

void main()
{
	vec2 vel = texture2D(tVelocity, vUv).xy;
	vec4 color = texture2D(tDiffuse, vUv);

	color.rgb = mix(color.rgb, vec3(color.rgb * 1.25), length(vel) * 0.75);

	gl_FragColor = vec4(color.rgb, 1.0);
}`;

/** Distortion + velocity blur pass (`mY`). */
export const FLUID_BLUR_FRAG = /* glsl */ `precision highp float;

varying vec2 vUv;

uniform sampler2D tDiffuse;
uniform sampler2D tVelocity;
uniform vec2 uResolution;
uniform float uBlurRadius;
uniform float uDistortionStrength;
uniform float uVelocityBlurScale;

#ifndef PI
	#define PI 3.14159265358
#endif
#ifndef TAU
	#define TAU 6.28318530718
#endif
#ifndef BLUR_ITERATIONS
	#define BLUR_ITERATIONS 15
#endif

highp float rand(const in vec2 uv) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot(uv.xy, vec2(a, b)), sn = mod(dt, PI);
	return fract(sin(sn) * c);
}

vec2 mult(inout vec2 r) {
	r = fract(r * vec2(12.9898, 78.233));
	return sqrt(r.x + 0.001) * vec2(sin(r.y * TAU), cos(r.y * TAU));
}

vec3 hashBlurTexture(sampler2D tex, vec2 uv, float radius, float aspect, vec2 offset) {
	vec2 circle = vec2(radius);
	circle.x *= aspect;
	vec2 rnd = vec2(rand(uv + offset));

	vec3 acc = vec3(0.0);
	for (int i = 0; i < BLUR_ITERATIONS; i++) {
		acc += texture2D(tex, uv + circle * mult(rnd)).rgb;
	}

	return acc / float(BLUR_ITERATIONS);
}

void main() {
	vec2 vel = texture2D(tVelocity, vUv).xy;
	float velMag = length(vel);

	vec2 uv = vUv + vel * uDistortionStrength;
	vec4 texColor = texture2D(tDiffuse, uv);

	float blurRadius = uBlurRadius + velMag * uVelocityBlurScale;

	if (blurRadius <= 0.0) {
		gl_FragColor = texColor;
		return;
	}

	float radius = blurRadius / uResolution.x;
	float aspect = uResolution.x / uResolution.y;
	vec3 blurred = hashBlurTexture(tDiffuse, uv, radius * 1.5, aspect, vec2(velMag));

	gl_FragColor = vec4(blurred, texColor.a);
}`;

const OPTIONS = {
  iterationsPoisson: 1,
  mouseForce: 80,
  resolution: 0.2,
  cursorSize: 40,
  dt: 0.015,
  deltaFactor: 1.75,
  dissipation: 0.98,
};
const REFERENCE_WIDTH = 1440; // Tq
const STEP = 1 / 120; // sb
const MAX_STEPS = 8; // Mq

class Pass {
  scene = new THREE.Scene();
  camera = new THREE.Camera();
  material: THREE.RawShaderMaterial;

  constructor(vertex: string, fragment: string, uniforms: Record<string, THREE.IUniform>, geometry: THREE.BufferGeometry, blending?: THREE.Blending) {
    // Only pass `blending` when given: an explicit undefined makes three warn on every pass.
    this.material = new THREE.RawShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms, ...(blending !== undefined && { blending }) });
    this.scene.add(new THREE.Mesh(geometry, this.material));
  }

  run(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget): void {
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(null);
  }
}

/**
 * Cursor-driven stable fluid at 20% resolution. `velocity` feeds the distortion/brighten
 * passes of the main composite (desktop and non-touch only, like the source).
 */
export class FluidSimulation {
  private fbos: Record<"vel0" | "vel1" | "div" | "p0" | "p1", THREE.WebGLRenderTarget>;
  private fboSize = new THREE.Vector2(1, 1);
  private cellScale = new THREE.Vector2(1, 1);
  private boundary = new THREE.Vector2(1, 1);
  private quad = new THREE.PlaneGeometry(2, 2);
  private advection: Pass;
  private force: Pass;
  private divergence: Pass;
  private poisson: Pass;
  private pressure: Pass;
  private accumulator = 0;
  private mouseDiff = new THREE.Vector2();
  private coords = new THREE.Vector2();
  private coordsOld = new THREE.Vector2();
  private diff = new THREE.Vector2();

  constructor(private renderer: THREE.WebGLRenderer) {
    const type = /(iPad|iPhone|iPod)/g.test(navigator.userAgent) ? THREE.HalfFloatType : THREE.FloatType;
    const mk = () => new THREE.WebGLRenderTarget(1, 1, { type, depthBuffer: false });
    this.fbos = { vel0: mk(), vel1: mk(), div: mk(), p0: mk(), p1: mk() };
    this.advection = new Pass(
      FACE_VERT,
      ADVECTION_FRAG,
      {
        boundarySpace: { value: this.cellScale },
        px: { value: this.cellScale },
        fboSize: { value: this.fboSize },
        velocity: { value: this.fbos.vel0.texture },
        dt: { value: OPTIONS.dt },
        dissipation: { value: 0.98 },
        isBFECC: { value: false },
      },
      this.quad,
    );
    const forceGeo = new THREE.PlaneGeometry(1, 1);
    this.force = new Pass(
      FORCE_VERT,
      FORCE_FRAG,
      {
        px: { value: this.cellScale },
        force: { value: new THREE.Vector2() },
        center: { value: new THREE.Vector2() },
        scale: { value: new THREE.Vector2(OPTIONS.cursorSize, OPTIONS.cursorSize) },
      },
      forceGeo,
      THREE.AdditiveBlending,
    );
    this.divergence = new Pass(
      FACE_VERT,
      DIVERGENCE_FRAG,
      { boundarySpace: { value: this.boundary }, velocity: { value: this.fbos.vel1.texture }, px: { value: this.cellScale }, dt: { value: OPTIONS.dt } },
      this.quad,
    );
    this.poisson = new Pass(
      FACE_VERT,
      POISSON_FRAG,
      { boundarySpace: { value: this.boundary }, pressure: { value: this.fbos.p0.texture }, divergence: { value: this.fbos.div.texture }, px: { value: this.cellScale } },
      this.quad,
    );
    this.pressure = new Pass(
      FACE_VERT,
      PRESSURE_FRAG,
      {
        boundarySpace: { value: this.boundary },
        pressure: { value: this.fbos.p0.texture },
        velocity: { value: this.fbos.vel1.texture },
        px: { value: this.cellScale },
        dt: { value: OPTIONS.dt },
      },
      this.quad,
    );
    window.addEventListener("mousemove", (e) => this.setCoords(e.clientX, e.clientY));
    window.addEventListener("touchmove", (e) => e.touches.length === 1 && this.setCoords(e.touches[0].pageX, e.touches[0].pageY), { passive: true });
  }

  get velocity(): THREE.Texture {
    return this.fbos.vel0.texture;
  }

  private setCoords(x: number, y: number): void {
    this.coords.set((x / leo.viewport.width) * 2 - 1, -(y / leo.viewport.height) * 2 + 1);
  }

  resize(width: number, height: number): void {
    const w = Math.floor(width * OPTIONS.resolution);
    const h = Math.floor(height * OPTIONS.resolution);
    this.cellScale.set(1 / w, 1 / h);
    this.boundary.copy(this.cellScale);
    this.fboSize.set(w, h);
    for (const f of Object.values(this.fbos)) f.setSize(w, h);
  }

  private cursorSize(): number {
    const ref = Math.floor(REFERENCE_WIDTH * OPTIONS.resolution);
    return !ref || !this.fboSize.x ? OPTIONS.cursorSize : OPTIONS.cursorSize * (this.fboSize.x / ref);
  }

  /** Per-frame input sampling (source `pc.update`). */
  tickInput(): void {
    this.diff.subVectors(this.coords, this.coordsOld);
    this.coordsOld.copy(this.coords);
    if (this.coordsOld.x === 0 && this.coordsOld.y === 0) this.diff.set(0, 0);
  }

  update(dt: number): void {
    const t = Math.min(Math.max(dt, 0), 1 / 15);
    this.mouseDiff.add(this.diff);
    this.accumulator += t;
    let n = 0;
    while (this.accumulator >= STEP && n < MAX_STEPS) {
      this.accumulator -= STEP;
      n++;
    }
    if (n === 0) return;
    for (let i = 0; i < n; i++) this.step(1 / n);
    this.mouseDiff.set(0, 0);
  }

  private step(share: number): void {
    const r = this.renderer;
    const k = 0.5 * OPTIONS.deltaFactor;
    const dt = OPTIONS.dt * k;
    const a = this.advection.material.uniforms;
    a.dt.value = dt;
    a.dissipation.value = Math.pow(OPTIONS.dissipation, k);
    a.velocity.value = this.fbos.vel0.texture;
    this.advection.run(r, this.fbos.vel1);

    const f = this.force.material.uniforms;
    const cx = Math.min(Math.max(this.coords.x, -1), 1);
    const cy = Math.min(Math.max(this.coords.y, -1), 1);
    const size = Math.min(this.cursorSize(), Math.max(0, (1 - Math.abs(cx)) / this.cellScale.x), Math.max(0, (1 - Math.abs(cy)) / this.cellScale.y));
    const force = OPTIONS.mouseForce * OPTIONS.deltaFactor;
    (f.force.value as THREE.Vector2).set((this.mouseDiff.x / 2) * force * share, (this.mouseDiff.y / 2) * force * share);
    (f.center.value as THREE.Vector2).set(cx, cy);
    (f.scale.value as THREE.Vector2).set(size, size);
    r.setRenderTarget(this.fbos.vel1);
    r.autoClear = false;
    r.render(this.force.scene, this.force.camera);
    r.setRenderTarget(null);

    this.divergence.material.uniforms.velocity.value = this.fbos.vel1.texture;
    this.divergence.material.uniforms.dt.value = dt;
    this.divergence.run(r, this.fbos.div);

    let out = this.fbos.p1;
    for (let i = 0; i < OPTIONS.iterationsPoisson; i++) {
      const src = i % 2 === 0 ? this.fbos.p0 : this.fbos.p1;
      out = i % 2 === 0 ? this.fbos.p1 : this.fbos.p0;
      this.poisson.material.uniforms.pressure.value = src.texture;
      this.poisson.run(r, out);
    }

    const p = this.pressure.material.uniforms;
    p.velocity.value = this.fbos.vel1.texture;
    p.pressure.value = out.texture;
    p.dt.value = dt;
    this.pressure.run(r, this.fbos.vel0);
  }

  dispose(): void {
    for (const f of Object.values(this.fbos)) f.dispose();
  }
}
