import * as THREE from "three";
import { bead, cutLeaf, ovalOutline, petalChip, rockBase } from "../cut";
import { along, baseWrap, compose, corolla, Figurine, frame, vec, type Kit, type Vec } from "./kit";

// Designed additions from the user's scene board; these are not claimed as scanned product meshes.
const deg = THREE.MathUtils.degToRad;
const CLEAR = { ior: 1.56, spread: 0.01, sparkle: 1.15, bounces: 3 } as const;
const green = { ...CLEAR, tint: 0xaad59b, depth: 0.1, backDist: 0.2 };

function foot(f: Figurine, seed: number): void {
  f.crystal(rockBase(0.3, 0.24, 0.25, seed), { ...CLEAR, backDist: 0.3 }, [new THREE.Matrix4()]);
  f.wire(baseWrap(0.3, 0.25, seed, 0.3), 0.005);
}

function leaf(f: Figurine, at: Vec, dir: Vec, length: number, width: number): void {
  const d = vec(dir).normalize();
  const root = vec(at).addScaledVector(d, 0.02);
  f.wire([at, [root.x, root.y, root.z]], 0.004);
  f.crystal(cutLeaf(length, width, 0.025, { rows: 7, bend: 0.015 }), green, [compose(root, along(d))]);
}

/** Six separate, overlapping cut-glass tepals, open enough to reveal a champagne heart. */
export function tulip(kit: Kit): Figurine {
  const f = new Figurine(kit, "Tulip");
  foot(f, 71);
  f.wire([[0, 0.12, 0], [-0.03, 0.32, 0], [-0.02, 0.5, 0.015], [0.02, 0.7, 0.01], [0.035, 0.78, 0]], 0.007, 0.0055);
  const head = compose(vec([0.035, 0.77, 0]), frame(vec([0.08, 0.97, 0.25])));
  const pink = { ...CLEAR, tint: 0xffbaca, depth: 0.16, backDist: 0.24 };
  const petal = petalChip(ovalOutline(0.29, 0.18, { segments: 18, point: 0.62, belly: 0.62 }), 0.028, 0.019, 0.018);
  f.crystal(petal, pink, [
    ...corolla(head, 3, { tilt: deg(58), root: 0.026, offset: deg(15) }),
    ...corolla(head, 3, { tilt: deg(68), root: 0.02, offset: deg(75), jitter: (i) => ({ scale: 0.95 + i * 0.025 }) }),
  ]);
  f.crystal(bead(0.035, 10), { ...CLEAR, tint: 0xffd68c, depth: 0.09 }, [head]);
  leaf(f, [-0.02, 0.38, 0.01], [-0.6, 0.8, 0.1], 0.34, 0.09);
  leaf(f, [0.0, 0.56, 0.01], [0.75, 0.66, -0.05], 0.27, 0.075);
  return f.finish();
}

/** Tall iris: three upright standards and three broad falling petals, in lavender crystal. */
export function iris(kit: Kit): Figurine {
  const f = new Figurine(kit, "Iris");
  foot(f, 81);
  f.wire([[0, 0.12, 0], [-0.03, 0.35, 0], [0.015, 0.6, 0.015], [0.0, 0.82, 0.01], [0.035, 0.97, -0.01]], 0.007, 0.005);
  const head = compose(vec([0, 0.84, 0.025]), frame(vec([-0.1, 0.35, 1])));
  const lavender = { ...CLEAR, tint: 0xc9adff, depth: 0.12, backDist: 0.2 };
  const violet = { ...CLEAR, tint: 0x9b83ed, depth: 0.1, backDist: 0.22 };
  const standard = petalChip(ovalOutline(0.22, 0.13, { segments: 18, point: 0.65, belly: 0.64 }), 0.021, 0.016, 0.013);
  const fall = petalChip(ovalOutline(0.23, 0.17, { segments: 18, point: 0.5, belly: 0.65 }), 0.021, 0.016, 0.014);
  f.crystal(standard, lavender, corolla(head, 3, { tilt: deg(57), root: 0.015, offset: deg(28) }));
  const falls = corolla(head, 3, { tilt: deg(-18), root: 0.018, offset: deg(88) });
  f.crystal(fall, violet, falls);
  const beard = cutLeaf(0.11, 0.025, 0.012, { rows: 6 });
  f.crystal(beard, { ...CLEAR, tint: 0xffd779, depth: 0.07 }, falls.map((m) => m.clone().multiply(compose(vec([0, 0.025, 0.025]), new THREE.Quaternion()))));
  f.crystal(bead(0.026, 8), lavender, [head]);
  leaf(f, [0, 0.26, 0], [-0.35, 0.94, 0.08], 0.44, 0.055);
  leaf(f, [0, 0.3, 0], [0.42, 0.91, -0.08], 0.53, 0.06);
  f.crystal(bead(0.036, 10), lavender, [compose(vec([0.035, 0.98, -0.01]), along(vec([0.2, 1, 0])), 1)]);
  return f.finish();
}

/** Rounded hydrangea cluster: individual four-petal cut-glass florets, not one opaque sphere. */
export function hydrangea(kit: Kit): Figurine {
  const f = new Figurine(kit, "Hydrangea");
  foot(f, 91);
  f.wire([[0, 0.12, 0], [0.025, 0.35, 0], [-0.025, 0.56, 0], [0, 0.77, 0]], 0.008, 0.006);
  const flowers: THREE.Matrix4[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < 26; i++) {
    const y = 1 - 2 * (i + 0.5) / 26;
    const r = Math.sqrt(1 - y * y);
    const d = vec([Math.cos(i * golden) * r, y, Math.sin(i * golden) * r]);
    const p = d.clone().multiplyScalar(0.155).add(vec([0, 0.84, 0]));
    flowers.push(compose(p, frame(d.clone().multiplyScalar(0.65).add(vec([0, 0.1, 0.65]))), 0.9 + (i % 3) * 0.07));
    if (i % 4 === 0) f.wire([[0, 0.7, 0], [p.x * 0.5, p.y - 0.04, p.z * 0.5], [p.x, p.y, p.z]], 0.003, 0.0025);
  }
  const petal = petalChip(ovalOutline(0.054, 0.054, { segments: 12, point: 0.48, belly: 0.6 }), 0.01, 0.007, 0.003);
  f.crystal(petal, { ...CLEAR, tint: 0xc6e2ff, depth: 0.1, backDist: 0.12, bounces: 2 }, flowers.flatMap((m, i) => corolla(m, 4, { tilt: deg(12), root: 0.006, offset: deg(i * 19) })));
  f.crystal(bead(0.008, 6), { ...CLEAR, tint: 0xffe7ac, depth: 0.06, bounces: 2 }, flowers);
  leaf(f, [0.015, 0.48, 0], [-0.8, 0.55, 0.15], 0.21, 0.14);
  leaf(f, [-0.01, 0.59, 0], [0.85, 0.4, -0.12], 0.19, 0.13);
  return f.finish();
}

/** Airy gold stems carrying white/champagne crystal flowers at several heights. */
export function wildflower(kit: Kit): Figurine {
  const f = new Figurine(kit, "Wildflower");
  foot(f, 101);
  const flowers: THREE.Matrix4[] = [];
  for (let i = 0; i < 8; i++) {
    const x = Math.sin(i * 2.3) * 0.2;
    const y = 0.62 + i * 0.052;
    const z = Math.cos(i * 1.8) * 0.06;
    f.wire([[0, 0.13, 0], [x * 0.15, 0.42, z * 0.3], [x * 0.7, y - 0.1, z], [x, y, z]], 0.0048, 0.0028);
    flowers.push(compose(vec([x, y, z]), frame(vec([x * 1.5, 0.35, 1])), 0.82 + (i % 3) * 0.1));
  }
  const petal = petalChip(ovalOutline(0.052, 0.037, { segments: 12, point: 0.55, belly: 0.65 }), 0.009, 0.006, 0.004);
  f.crystal(petal, { ...CLEAR, tint: 0xfff4dd, depth: 0.1, bounces: 2 }, flowers.flatMap((m, i) => corolla(m, 5, { tilt: deg(14), root: 0.007, offset: deg(i * 27) })));
  f.crystal(bead(0.011, 8), { ...CLEAR, tint: 0xffcd66, depth: 0.055, bounces: 2 }, flowers);
  leaf(f, [0, 0.41, 0], [-0.7, 0.7, 0], 0.12, 0.045);
  leaf(f, [0.03, 0.56, 0], [0.8, 0.6, 0.1], 0.11, 0.04);
  return f.finish();
}
