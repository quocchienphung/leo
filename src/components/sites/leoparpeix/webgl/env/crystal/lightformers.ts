import * as THREE from "three";

/*
 * Lightformers: emissive shapes that exist only while the environment is captured, the way a
 * product photographer surrounds glass with softboxes. Without them the pavilion's environment is
 * almost uniformly bright (marble, sky) and the glass shows no highlight shapes at all; with them
 * the petals, orb and spheres pick up tall arched-window reflections, the right edges catch the
 * sunlit opening, and crystal facets alternate between bright and dark. Stage coordinates.
 */

function arch(width: number, height: number): THREE.ShapeGeometry {
  const r = width / 2;
  const s = new THREE.Shape();
  s.moveTo(-r, 0);
  s.lineTo(-r, height - r);
  s.absarc(0, height - r, r, Math.PI, 0, true);
  s.lineTo(r, 0);
  s.lineTo(-r, 0);
  return new THREE.ShapeGeometry(s, 32);
}

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

  // Behind the camera: a warm shaded wall pierced by three tall arched windows full of daylight.
  add(new THREE.PlaneGeometry(44, 22), new THREE.Color(0.2, 0.17, 0.14), [0, 7, 16], [0, 7, 0]);
  for (const x of [-6.5, 0, 6.5]) add(arch(2.6, 8.5), new THREE.Color(2.6, 2.55, 2.45), [x, 0.8, 15.8], [x, 0.8, 0]);
  // Sunlit opening on the right: the strongest, warmest source after the sun disc.
  add(new THREE.PlaneGeometry(7, 11), sun.clone().multiplyScalar(5), [13, 5, 1], [0, 3, 0]);
  // Soft cool bounce from the left, and a long strip high on the right for crisp top highlights.
  add(new THREE.PlaneGeometry(9, 9), new THREE.Color(0.75, 0.82, 0.92).multiplyScalar(0.9), [-13, 4, 3], [0, 3, 0]);
  add(new THREE.PlaneGeometry(14, 1.2), new THREE.Color(3, 2.9, 2.7), [6, 11, 5], [0, 2.5, 0]);
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
export function createJewelEnvironment(renderer: THREE.WebGLRenderer, sunDirection: THREE.Vector3, sun: THREE.Color): THREE.WebGLRenderTarget {
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
  const target = pmrem.fromScene(scene, 0, 0.1, 100, { size: 256 });
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
