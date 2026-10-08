import * as THREE from "three";

/*
 * Lightformers: emissive shapes that exist only while the environment is captured, the way a
 * product photographer surrounds glass with softboxes. Without them the pavilion's environment is
 * almost uniformly bright (marble, sky) and the glass shows no highlight shapes at all; with them
 * the right edges catch the sunlit opening, the tops a crisp strip, and crystal facets pick up
 * scattered warm points of light. Stage coordinates.
 */

export function createLightformers(sun: THREE.Color): THREE.Group {
  const group = new THREE.Group();
  group.name = "Lightformers";
  const basic = (color: THREE.Color) => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false });
  const add = (geometry: THREE.BufferGeometry, color: THREE.Color, position: [number, number, number], lookAt: [number, number, number]) => {
    const m = new THREE.Mesh(geometry, basic(color));
    m.position.set(...position);
    m.lookAt(new THREE.Vector3(...lookAt));
    group.add(m);
  };

  // Behind the camera: the sunlit, warm side of the pavilion (no window shapes: those drew the
  // same arched reflection on every petal and on the orb).
  add(new THREE.PlaneGeometry(44, 22), new THREE.Color(0.62, 0.5, 0.36), [0, 7, 16], [0, 7, 0]);
  // Two tall narrow openings behind the camera, off to each side: each rounded petal catches them
  // as a long bright streak down its length.
  // Glass reflects ≈ 4 % head-on: they must be far brighter than the walls to read.
  for (const x of [-7.5, 8.5]) add(new THREE.PlaneGeometry(1.1, 10), new THREE.Color(6, 5.8, 5.4), [x, 4, 15.6], [x * 0.6, 4, 0]);
  // Shaded openings give glass a dark reflected edge beside the bright strip, like a product
  // photographed in the pavilion. These cards only exist in the environment capture.
  add(new THREE.PlaneGeometry(4, 7), new THREE.Color(0.06, 0.065, 0.07), [-6, 3, 11], [0, 3, 0]);
  add(new THREE.PlaneGeometry(5, 2), new THREE.Color(0.12, 0.105, 0.085), [3, 0.5, 9], [0, 2.5, 0]);
  // Sunlit opening on the right: the strongest, warmest source after the sun disc.
  add(new THREE.PlaneGeometry(7, 11), sun.clone().multiplyScalar(3.2), [13, 5, 1], [0, 3, 0]);
  // Soft cool bounce from the left, and a long strip high on the right for crisp top highlights.
  add(new THREE.PlaneGeometry(9, 9), new THREE.Color(0.75, 0.82, 0.92).multiplyScalar(0.6), [-13, 4, 3], [0, 3, 0]);
  add(new THREE.PlaneGeometry(14, 0.6), new THREE.Color(5.5, 5.3, 5), [6, 11, 5], [0, 2.5, 0]);
  // Small sunlit things all round (polished stone edges, glass, water): seen in cut facets they
  // become the scattered warm points of light of real crystal in the sun.
  const random = (() => {
    let a = 91;
    return () => ((a = (a * 16807) % 2147483647) - 1) / 2147483646;
  })();
  const dot = new THREE.CircleGeometry(0.32, 16);
  for (let i = 0; i < 14; i++) {
    const az = random() * Math.PI * 2;
    const el = -0.35 + random() * 1.1;
    const d = 11 + random() * 5;
    const p: [number, number, number] = [Math.cos(az) * Math.cos(el) * d, 3 + Math.sin(el) * d, Math.sin(az) * Math.cos(el) * d];
    add(dot.clone(), sun.clone().multiplyScalar(3 + random() * 5), p, [0, 3, 0]);
  }
  dot.dispose();
  return group;
}

export function disposeLightformers(group: THREE.Group): void {
  group.traverse((o) => {
    const m = o as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
    if (m.isMesh) {
      m.geometry.dispose();
      m.material.dispose();
    }
  });
}

/**
 * Jewel environment for the cut crystal only (leaves, base, cube): the way jewellery is shot, a
 * dark warm surround with a pale sky above, a few bright softboxes, a gold bounce from the sunlit
 * floor and the sun itself. The pavilion is almost uniformly cream, so crystal reflecting it reads
 * as white plaster; against this surround its facets alternate dark and brilliant. Stage frame.
 */
export function createJewelEnvironment(renderer: THREE.WebGLRenderer, sunDirection: THREE.Vector3, sun: THREE.Color, size = 256): THREE.WebGLRenderTarget {
  const scene = new THREE.Scene();
  // Built in the stage frame; environment maps are looked up in world space.
  const stage = new THREE.Group();
  stage.rotation.y = Math.PI / 2;
  scene.add(stage);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(40, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { uSky: { value: new THREE.Color(0.62, 0.74, 0.95) }, uHorizon: { value: new THREE.Color(0.2, 0.18, 0.16) }, uGround: { value: new THREE.Color(0.05, 0.045, 0.04) } },
      vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSky; uniform vec3 uHorizon; uniform vec3 uGround; varying vec3 vDir;
        void main() {
          float y = normalize(vDir).y;
          vec3 c = y > 0.0 ? mix(uHorizon, uSky, smoothstep(0.05, 0.6, y)) : mix(uHorizon, uGround, 1.0 - smoothstep(-0.25, 0.0, y));
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  stage.add(dome);
  const panel = (w: number, h: number, color: THREE.Color, at: THREE.Vector3) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.copy(at);
    m.lookAt(0, 0, 0);
    stage.add(m);
  };
  // Softboxes: front left, front right, overhead, and a narrow strip behind.
  panel(6, 9, new THREE.Color(3.2, 3.15, 3.05), new THREE.Vector3(-9, 3, 12));
  panel(5, 8, new THREE.Color(4, 3.9, 3.7), new THREE.Vector3(10, 4, 9));
  panel(8, 3, new THREE.Color(2.4, 2.4, 2.4), new THREE.Vector3(0, 14, 2));
  panel(1.2, 10, new THREE.Color(2.2, 2.25, 2.4), new THREE.Vector3(-4, 3, -14));
  // Gold bounce from the sunlit marble, low on the sun side.
  panel(16, 3, new THREE.Color(1.6, 1.1, 0.55), new THREE.Vector3(8, -4, 4));
  // The sun.
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.4, 32), new THREE.MeshBasicMaterial({ color: sun.clone().multiplyScalar(40) }));
  disc.position.copy(sunDirection).multiplyScalar(30);
  disc.lookAt(0, 0, 0);
  stage.add(disc);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0, 0.1, 100, { size });
  pmrem.dispose();
  scene.traverse((o) => {
    const m = o as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
    if (m.isMesh) {
      m.geometry.dispose();
      m.material.dispose();
    }
  });
  return target;
}
