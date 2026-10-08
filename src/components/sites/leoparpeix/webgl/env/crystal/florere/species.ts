import * as THREE from "three";
import { bead, bellBody, briolette, cutLeaf, ovalOutline, petalChip, ringGem, rockBase, type CutSolid } from "../cut";
import { along, baseWrap, compose, corolla, Figurine, frame, vec, type Kit, type Vec } from "./kit";

/*
 * The six Swarovski Florere figurines (references: docs/research/leoparpeix/implementation/
 * playground-crystal/audit-2026-10-07/references/, measured on the 1000 px product shots).
 * Product units: 1 tall, base foot centred on the origin, front +z. Identity from the products:
 * cut crystal flowers, light green crystal leaves, champagne-gold stems wound round a natural
 * (unfaceted) crystal rock — except Lily of the Valley: green lacquered stems and leaves, clear
 * bells and a faceted base. Unseen sides and hidden joints are designed, not measured.
 */

const deg = THREE.MathUtils.degToRad;
const Z = new THREE.Vector3(0, 0, 1);

/**
 * Crystal colours (sRGB) and the depth, in product units (the figurine is 1 tall), over which the
 * body reaches them: thin edges stay pale, long paths through the stone saturate. Calibrated on
 * the product photos; independent of the scale a figurine is placed at.
 */
const TINT = {
  rose: { tint: 0xf6a9c6, depth: 0.12 },
  leaf: { tint: 0x9fe07a, depth: 0.09 },
  sapphireLight: { tint: 0x86a6ff, depth: 0.055 },
  tanzanite: { tint: 0x9d86ff, depth: 0.045 },
  citrine: { tint: 0xffd21c, depth: 0.035 },
  violet: { tint: 0xa58cff, depth: 0.075 },
  purple: { tint: 0x7a3ee6, depth: 0.025 },
  lilac: { tint: 0xd59cf2, depth: 0.05 },
  jonquil: { tint: 0xffd23c, depth: 0.075 },
  amber: { tint: 0xffa21a, depth: 0.035 },
  sapphire: { tint: 0x5274ff, depth: 0.11 },
} as const;

const CLEAR = { ior: 1.56, spread: 0.012, sparkle: 1, bounces: 3 } as const;

function base(f: Figurine, solid: CutSolid): void {
  f.crystal(solid, { ...CLEAR, backDist: 0.35, sparkle: 1.2 }, [new THREE.Matrix4()]);
}

/** Leaf of light green crystal on a short gold petiole from `at` towards `dir`. */
function leaf(f: Figurine, at: Vec, dir: Vec, opts: { petiole?: number; roll?: number } = {}): THREE.Matrix4 {
  const d = vec(dir).normalize();
  const root = vec(at).addScaledVector(d, opts.petiole ?? 0.03);
  f.wire([at, [root.x, root.y, root.z]], 0.0045, 0.0035);
  const q = along(d, Z.clone().applyAxisAngle(d, opts.roll ?? 0));
  return compose(root, q);
}

// ------------------------------------------------------------------------------------ Rose

/** Florere Rose 5666973: pink rose (150 facets), two leaves, S-shaped gold stem. */
export function rose(kit: Kit): Figurine {
  const f = new Figurine(kit, "Rose");
  base(f, rockBase(0.3, 0.3, 0.24, 11));
  f.wire(baseWrap(0.3, 0.24, 1, deg(-20)), 0.0055);
  // From the rock's right shoulder: up left, a bulge right, then under the bloom.
  f.wire([[0.04, 0.12, 0.0], [0.07, 0.24, 0.01], [0.03, 0.36, 0.02], [-0.01, 0.48, 0.015], [0.04, 0.62, 0.0], [0.085, 0.72, -0.005], [0.06, 0.79, -0.01], [0.015, 0.83, -0.005]], 0.0068, 0.006);

  const head = compose(vec([-0.01, 0.87, 0.0]), frame(new THREE.Vector3(-0.3, 0.72, 0.63), new THREE.Vector3(0.2, 0.3, -1)));
  const pink = { ...CLEAR, ...TINT.rose, backDist: 0.25 };
  // A full bloom: the spiral heart, then four rings of cupped petals opening outwards (4, 5, 5 and
  // 5 broad guard petals), each ring turned against the last so the petals overlap like a rose.
  const heart = ringGem([{ y: -0.02, r: 0.04, n: 6 }, { y: 0.02, r: 0.05, n: 6, phase: 0.5 }, { y: 0.052, r: 0.03, n: 5 }], { apexTop: 0.068, wobble: 0.04, seed: 3 });
  f.crystal(heart, pink, [head.clone().multiply(compose(new THREE.Vector3(), frame(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1))))]);
  const ring = (length: number, width: number, count: number, tilt: number, root: number, offset: number, cup: number, wobble: number[]) => {
    const chip = petalChip(ovalOutline(length, width, { point: 0.5, belly: 0.6, segments: 14 }), 0.015, 0.013, cup);
    f.crystal(chip, pink, corolla(head, count, { tilt: deg(tilt), root, offset: deg(offset), jitter: (i) => ({ tilt: deg(wobble[i % wobble.length]), scale: 1 + wobble[(i + 2) % wobble.length] * 0.01 }) }));
  };
  ring(0.095, 0.105, 4, 72, 0.024, 20, 0.02, [2, -3, 4, -1]);
  ring(0.12, 0.135, 5, 56, 0.032, 58, 0.026, [3, -5, 2, -2, 5]);
  ring(0.145, 0.16, 5, 38, 0.04, 22, 0.03, [6, -4, 8, -6, 2]);
  ring(0.16, 0.185, 5, 18, 0.048, 52, 0.034, [-4, 6, -2, 8, -6]);
  // Sepals under the bloom and the two small sprouts beside it.
  const green = { ...CLEAR, ...TINT.leaf, backDist: 0.2 };
  const sepal = cutLeaf(0.045, 0.02, 0.009, { rows: 3 });
  f.crystal(sepal, green, corolla(head.clone().multiply(compose(new THREE.Vector3(0, 0, -0.02), new THREE.Quaternion())), 4, { tilt: deg(-55), root: 0.03, offset: deg(30) }));
  const sprout = cutLeaf(0.05, 0.022, 0.01, { rows: 3 });
  f.crystal(sprout, green, [leaf(f, [0.075, 0.8, 0.0], [0.7, 0.75, 0.1], { petiole: 0.008 }), leaf(f, [0.03, 0.81, 0.01], [-0.3, -0.9, 0.3], { petiole: 0.006 })]);
  // Leaves: upper right, lower left.
  const blade = cutLeaf(0.15, 0.085, 0.03, { rows: 5, bend: 0.01, asym: 0.12 });
  f.crystal(blade, { ...green, backDist: 0.25 }, [leaf(f, [0.075, 0.69, 0.0], [1, 0.55, 0.15], { roll: deg(-15) }), leaf(f, [0.005, 0.47, 0.015], [-1, 0.4, 0.2], { roll: deg(20) })]);
  return f.finish();
}

// ------------------------------------------------------------------------------- Forget-me-not

/** Florere Forget-me-not 5666971: clustered small blue flowers with yellow eyes, two buds. */
export function forgetMeNot(kit: Kit): Figurine {
  const f = new Figurine(kit, "Forget-me-not");
  base(f, rockBase(0.3, 0.29, 0.24, 21));
  f.wire(baseWrap(0.3, 0.24, 2, deg(160)), 0.0055);
  const stem = f.wire([[-0.04, 0.12, 0.0], [-0.07, 0.24, 0.02], [-0.05, 0.38, 0.02], [0.0, 0.52, 0.01], [-0.02, 0.64, 0.0], [-0.08, 0.74, 0.0], [-0.12, 0.82, 0.0]], 0.0068, 0.0058);
  // Two pedicels split off at the top, plus a second wire running beside the stem.
  f.wire([[-0.12, 0.82, 0.0], [-0.17, 0.88, 0.0], [-0.2, 0.93, 0.01]], 0.005, 0.004);
  f.wire([[-0.11, 0.8, 0.0], [-0.07, 0.88, 0.0], [-0.06, 0.95, 0.0]], 0.005, 0.004);
  f.wire([[-0.1, 0.79, 0.0], [-0.03, 0.82, 0.01], [0.0, 0.86, 0.02]], 0.0045, 0.0038);

  const petal = petalChip(ovalOutline(0.036, 0.036, { point: 0.45, belly: 0.6, segments: 10 }), 0.0065, 0.005, 0.004);
  const eye = bead(0.0085, 6);
  const flowers: THREE.Matrix4[] = [];
  const add = (p: Vec, n: Vec, s = 1) => flowers.push(compose(vec(p), frame(vec(n)), s));
  // Three loose clusters (left, top, right-low), facing out and towards the viewer.
  add([-0.24, 0.93, 0.02], [-0.6, 0.3, 0.75]);
  add([-0.2, 0.99, 0.0], [-0.2, 0.75, 0.6], 0.95);
  add([-0.16, 0.92, 0.05], [-0.1, 0.2, 1]);
  add([-0.09, 1.0, 0.01], [0.1, 0.8, 0.6], 0.95);
  add([-0.03, 0.97, 0.03], [0.5, 0.45, 0.75]);
  add([-0.06, 0.92, 0.06], [0.0, 0.1, 1], 1.05);
  add([0.0, 0.88, 0.05], [0.6, 0.0, 0.8]);
  add([-0.05, 0.84, 0.06], [-0.1, -0.3, 0.95], 0.95);
  add([0.03, 0.83, 0.02], [0.75, -0.2, 0.6], 0.9);
  const petals = flowers.flatMap((m, k) => corolla(m, 5, { tilt: deg(16), root: 0.006, offset: deg(k * 23), jitter: (i) => ({ tilt: deg(((i * 7 + k) % 5) - 2) }) }));
  f.crystal(petal, { ...CLEAR, ...TINT.sapphireLight, backDist: 0.15, bounces: 2 }, petals);
  f.crystal(eye, { ...CLEAR, ...TINT.citrine, backDist: 0.1, bounces: 2 }, flowers.map((m) => m.clone().multiply(compose(new THREE.Vector3(0, 0, 0.007), new THREE.Quaternion()))));
  // Buds on the stem.
  const bud = briolette(0.055, 0.018, 7, 4);
  const budAt = (t: number, dir: Vec) => {
    const p = stem.getPointAt(t);
    const d = vec(dir).normalize();
    const tip = p.clone().addScaledVector(d, 0.04);
    f.wire([[p.x, p.y, p.z], [tip.x, tip.y, tip.z]], 0.004, 0.0035);
    return compose(tip, along(d));
  };
  f.crystal(bud, { ...CLEAR, ...TINT.tanzanite, backDist: 0.15 }, [budAt(0.62, [0.7, 0.8, 0.1]), budAt(0.28, [-0.25, 0.9, 0.2])]);
  return f.finish();
}

// ------------------------------------------------------------------------------------ Rozanne

/** Florere Rozanne 5693143: geranium 'Rozanne', two violet-blue flowers, buds, straight stem. */
export function rozanne(kit: Kit): Figurine {
  const f = new Figurine(kit, "Rozanne");
  base(f, rockBase(0.33, 0.31, 0.26, 33));
  f.wire(baseWrap(0.33, 0.26, 3, deg(200)), 0.0055);
  const stem = f.wire([[0.0, 0.14, 0.0], [-0.01, 0.3, 0.01], [-0.02, 0.48, 0.02], [-0.015, 0.64, 0.02], [-0.01, 0.74, 0.02], [0.0, 0.86, 0.0], [0.0, 0.93, -0.02]], 0.0068, 0.006);
  f.wire([[-0.012, 0.7, 0.02], [-0.03, 0.75, 0.04], [-0.04, 0.78, 0.05]], 0.0055, 0.005);

  const petal = petalChip(ovalOutline(0.1, 0.1, { point: 0.42, belly: 0.62, segments: 12 }), 0.016, 0.012, 0.012);
  const violet = { ...CLEAR, ...TINT.violet, backDist: 0.2 };
  const main = compose(vec([-0.045, 0.79, 0.055]), frame(new THREE.Vector3(-0.15, 0.25, 1)));
  const top = compose(vec([0.0, 0.95, -0.02]), frame(new THREE.Vector3(0.05, 0.85, 0.5)), 0.92);
  const petals = [main, top].flatMap((m, k) => corolla(m, 5, { tilt: deg(14), root: 0.014, offset: deg(18 + k * 30), jitter: (i) => ({ tilt: deg([4, -3, 6, -5, 1][i]), turn: deg([2, -4, 3, 0, -2][i]) }) }));
  f.crystal(petal, violet, petals);
  const eye = bead(0.022, 8);
  f.crystal(eye, { ...CLEAR, ...TINT.purple, backDist: 0.1 }, [main.clone().multiply(compose(new THREE.Vector3(0, 0, 0.018), new THREE.Quaternion())), top.clone().multiply(compose(new THREE.Vector3(0, 0, 0.018), new THREE.Quaternion()))]);
  // Gold calyx cups behind each flower and bud.
  const calyx = new THREE.CylinderGeometry(0.022, 0.006, 0.03, 10, 1, true);
  calyx.rotateX(Math.PI / 2);
  for (const m of [main, top]) f.metalGeometry(calyx.clone(), kit.gold, m.clone().multiply(compose(new THREE.Vector3(0, 0, -0.016), new THREE.Quaternion())));
  const bud = ringGem([{ y: 0.006, r: 0.016, n: 7 }, { y: 0.028, r: 0.022, n: 7, phase: 0.5 }, { y: 0.05, r: 0.015, n: 7 }], { apexTop: 0.064, apexBottom: 0 });
  const budCalyx = new THREE.CylinderGeometry(0.019, 0.006, 0.026, 10, 1, true);
  budCalyx.translate(0, 0.004, 0);
  const budAt = (t: number, dir: Vec, len: number) => {
    const p = stem.getPointAt(t);
    const d = vec(dir).normalize();
    const tip = p.clone().addScaledVector(d, len);
    f.wire([[p.x, p.y, p.z], [p.x + d.x * len * 0.5, p.y + d.y * len * 0.6, p.z + d.z * len * 0.5], [tip.x, tip.y, tip.z]], 0.0045, 0.004);
    const m = compose(tip, along(d));
    f.metalGeometry(budCalyx.clone(), kit.gold, m);
    return m.clone().multiply(compose(new THREE.Vector3(0, 0.008, 0), new THREE.Quaternion()));
  };
  f.crystal(bud, { ...CLEAR, ...TINT.lilac, backDist: 0.12 }, [budAt(0.84, [1, 0.45, 0.1], 0.13), budAt(0.66, [0.6, 0.6, 0.5], 0.035)]);
  calyx.dispose();
  budCalyx.dispose();
  return f.finish();
}

// --------------------------------------------------------------------------------------- Lily

/** Florere Lily 5666972: yellow lily with pointed recurved tepals, stamens, two leaves. */
export function lily(kit: Kit): Figurine {
  const f = new Figurine(kit, "Lily");
  base(f, rockBase(0.3, 0.3, 0.25, 44));
  f.wire(baseWrap(0.3, 0.25, 4, deg(-150)), 0.0055);
  f.wire([[0.03, 0.12, 0.0], [0.07, 0.24, 0.01], [0.02, 0.38, 0.02], [-0.02, 0.5, 0.02], [0.04, 0.63, 0.01], [0.08, 0.74, 0.0], [0.07, 0.81, -0.01], [0.04, 0.85, -0.01]], 0.0068, 0.006);

  // Trumpet facing up, left and towards the viewer.
  const axis = new THREE.Vector3(-0.45, 0.65, 0.6);
  const head = compose(vec([-0.02, 0.89, 0.02]), frame(axis, new THREE.Vector3(0.3, 0.2, -1)));
  const yellow = { ...CLEAR, ...TINT.jonquil, backDist: 0.25 };
  // Six broad pointed tepals in two rings: the outer three open wide, the inner three form the cup.
  const outerT = petalChip(ovalOutline(0.185, 0.1, { point: 1.0, belly: 0.42, segments: 16 }), 0.017, 0.013, 0.02);
  const innerT = petalChip(ovalOutline(0.17, 0.112, { point: 0.9, belly: 0.45, segments: 16 }), 0.017, 0.013, 0.022);
  f.crystal(outerT, yellow, corolla(head, 3, { tilt: deg(16), root: 0.018, offset: deg(10), jitter: (i) => ({ tilt: deg([0, 8, -6][i]) }) }));
  f.crystal(innerT, yellow, corolla(head, 3, { tilt: deg(32), root: 0.014, offset: deg(70), jitter: (i) => ({ tilt: deg([4, -4, 10][i]) }) }));
  // Amber throat.
  const throat = ringGem([{ y: 0, r: 0.022, n: 6 }, { y: 0.02, r: 0.03, n: 6, phase: 0.5 }], { apexBottom: -0.02 });
  f.crystal(throat, { ...CLEAR, ...TINT.amber, backDist: 0.1 }, [head.clone().multiply(compose(new THREE.Vector3(0, 0, -0.006), frame(new THREE.Vector3(0, -1, 0), Z)))]);
  // Stamens: gold filaments arcing out of the throat, pale anthers.
  const anthers: THREE.Matrix4[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const local = (r: number, z: number) => new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z).applyMatrix4(head);
    const p0 = local(0.004, 0.0);
    const p1 = local(0.018, 0.035);
    const p2 = local(0.03, 0.056 + 0.006 * Math.sin(i * 2.1));
    f.wire([[p0.x, p0.y, p0.z], [p1.x, p1.y, p1.z], [p2.x, p2.y, p2.z]], 0.0026, 0.0022);
    anthers.push(compose(p2, new THREE.Quaternion()));
  }
  const anther = bead(0.0075, 6);
  f.crystal(anther, { ...CLEAR, tint: 0xd8e6ff, depth: 0.03, backDist: 0.08, bounces: 2 }, anthers);
  const blade = cutLeaf(0.15, 0.085, 0.03, { rows: 5, bend: 0.01, asym: 0.14 });
  f.crystal(blade, { ...CLEAR, ...TINT.leaf, backDist: 0.25 }, [leaf(f, [0.08, 0.72, 0.0], [0.8, 0.75, 0.1], { roll: deg(-12) }), leaf(f, [-0.015, 0.49, 0.02], [-1, 0.25, 0.25], { roll: deg(18) })]);
  return f.finish();
}

// --------------------------------------------------------------------------- Lily of the Valley

/** Florere Lily of the Valley 5721541: clear bells on green lacquered stems, faceted base. */
export function lilyOfTheValley(kit: Kit): Figurine {
  const f = new Figurine(kit, "Lily of the Valley");
  // Faceted base: wide low, tapering to a small collar (unlike the natural rocks of the others).
  const stone = ringGem(
    [
      { y: 0, r: 0.088, n: 12 },
      { y: 0.035, r: 0.114, n: 12, phase: 0.5 },
      { y: 0.1, r: 0.112, n: 12 },
      { y: 0.17, r: 0.094, n: 12, phase: 0.5 },
      { y: 0.235, r: 0.064, n: 10 },
      { y: 0.275, r: 0.032, n: 8, phase: 0.5 },
    ],
    { depth: 0.96 },
  );
  f.crystal(stone, { ...CLEAR, backDist: 0.35, sparkle: 1.3, bounces: 4 }, [new THREE.Matrix4()]);
  const collar = new THREE.TorusGeometry(0.03, 0.009, 8, 24);
  collar.rotateX(Math.PI / 2);
  collar.translate(0, 0.283, 0);
  f.metalGeometry(collar, kit.lacquer);
  // Two arching stems ending in a crook, leaning out.
  const left = f.wire([[-0.004, 0.28, 0.0], [-0.02, 0.45, 0.0], [-0.06, 0.62, 0.0], [-0.1, 0.78, 0.0], [-0.135, 0.9, 0.0], [-0.13, 0.97, 0.0], [-0.1, 0.99, 0.0]], 0.0085, 0.0055, kit.lacquer);
  const right = f.wire([[0.004, 0.28, 0.0], [0.02, 0.45, 0.0], [0.05, 0.62, 0.01], [0.09, 0.78, 0.01], [0.12, 0.9, 0.0], [0.135, 0.975, 0.0], [0.17, 0.99, 0.0]], 0.0085, 0.0055, kit.lacquer);
  // Long blades.
  const blade = (dir: number, tip: Vec, width: number) => {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(dir * 0.004, 0.28, 0.005), new THREE.Vector3(tip[0] * 0.35, 0.5, 0.03), vec(tip));
    const pos: number[] = [];
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const side = new THREE.Vector3().crossVectors(tan, Z).normalize();
      const w = width * Math.sin(Math.PI * Math.min(1, t * 1.15) ** 0.8) * (1 - t * 0.2);
      const fold = new THREE.Vector3(0, 0, w * 0.35);
      const a = p.clone().addScaledVector(side, w);
      const b = p.clone().add(fold);
      const c = p.clone().addScaledVector(side, -w);
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    }
    const idx: number[] = [];
    for (let i = 0; i < n; i++) {
      const r0 = i * 3;
      const r1 = r0 + 3;
      idx.push(r0, r1, r0 + 1, r1, r1 + 1, r0 + 1, r0 + 1, r1 + 1, r0 + 2, r1 + 1, r1 + 2, r0 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    f.metalGeometry(g, kit.lacquer);
  };
  blade(-1, [-0.19, 0.64, 0.04], 0.032);
  blade(1, [0.23, 0.75, -0.01], 0.034);

  // Bells hang from short arched pedicels along each stem; pearls at the tips.
  const bell = bellBody(0.05, 0.017, 0.03, 8);
  const bells: THREE.Matrix4[] = [];
  const pearls: THREE.Matrix4[] = [];
  const hang = (curve: THREE.CatmullRomCurve3, t: number, side: number, drop: number) => {
    const p = curve.getPointAt(t);
    const out = new THREE.Vector3(side * 0.045, 0.012, 0.012);
    const top = p.clone().add(out);
    const end = top.clone().add(new THREE.Vector3(side * 0.01, -drop, 0.004));
    f.wire([[p.x, p.y, p.z], [top.x - side * 0.01, top.y + 0.004, top.z], [end.x, end.y, end.z]], 0.0035, 0.003, kit.lacquer);
    bells.push(compose(end, frame(Z), 1).multiply(compose(new THREE.Vector3(), new THREE.Quaternion().setFromAxisAngle(Z, side * deg(14)))));
  };
  hang(left, 0.83, -1, 0.02);
  hang(left, 0.7, 1, 0.022);
  hang(left, 0.6, -1, 0.02);
  hang(left, 0.5, 1, 0.024);
  hang(right, 0.86, -1, 0.02);
  hang(right, 0.74, 1, 0.022);
  hang(right, 0.62, -1, 0.024);
  hang(right, 0.52, 1, 0.02);
  for (const c of [left, right]) {
    const tip = c.getPointAt(1);
    pearls.push(compose(tip.clone().add(new THREE.Vector3(0, -0.012, 0)), new THREE.Quaternion()));
  }
  pearls.push(compose(left.getPointAt(0.96).add(new THREE.Vector3(-0.03, -0.01, 0.01)), new THREE.Quaternion(), 0.85));
  const pearlMat = new THREE.MeshPhysicalMaterial({ color: 0xfbfaf6, transmission: 0.6, roughness: 0.38, ior: 1.5, thickness: 0.02, specularIntensity: 1, envMapIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.08 });
  f.materials.push(pearlMat);
  f.crystal(bell, { ...CLEAR, backDist: 0.12, sparkle: 1.4 }, bells);
  f.place(new THREE.IcosahedronGeometry(0.016, 2), pearlMat, pearls);
  return f.finish();
}

// ------------------------------------------------------------------------------ Blue Bellflower

/** Florere Blue Bellflower 5719807: three nodding deep blue bells, two buds, gold crook stem. */
export function blueBellflower(kit: Kit): Figurine {
  const f = new Figurine(kit, "Blue Bellflower");
  base(f, rockBase(0.3, 0.27, 0.25, 55));
  f.wire(baseWrap(0.3, 0.25, 5, deg(-40)), 0.0055);
  const stem = f.wire([[0.0, 0.12, 0.0], [-0.02, 0.28, 0.01], [-0.025, 0.42, 0.02], [0.0, 0.56, 0.02], [0.03, 0.7, 0.01], [0.055, 0.84, 0.0], [0.07, 0.95, -0.01], [0.04, 0.99, -0.01], [0.0, 0.97, 0.0], [-0.03, 0.93, 0.01]], 0.0068, 0.0052);
  const blue = { ...CLEAR, ...TINT.sapphire };
  const bell = bellBody(0.088, 0.026, 0.043, 10);
  const lobe = petalChip(ovalOutline(0.034, 0.034, { point: 1.0, belly: 0.5, segments: 10 }), 0.006, 0.005, 0.004);
  const bells: THREE.Matrix4[] = [];
  const hangBell = (at: THREE.Vector3, tilt: number, turn: number) => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(deg(12), turn, tilt));
    bells.push(compose(at, q));
  };
  // At the crook, off a short pedicel to the right, and lower on the left.
  hangBell(stem.getPointAt(1).add(new THREE.Vector3(-0.012, -0.014, 0.0)), deg(-28), deg(10));
  const right = stem.getPointAt(0.8);
  const rTip = right.clone().add(new THREE.Vector3(0.07, 0.02, 0.01));
  f.wire([[right.x, right.y, right.z], [right.x + 0.04, right.y + 0.03, right.z], [rTip.x, rTip.y, rTip.z]], 0.0042, 0.0038);
  hangBell(rTip.clone().add(new THREE.Vector3(0.008, -0.012, 0)), deg(18), deg(-20));
  const low = stem.getPointAt(0.68);
  const lTip = low.clone().add(new THREE.Vector3(-0.07, 0.0, 0.02));
  f.wire([[low.x, low.y, low.z], [low.x - 0.035, low.y + 0.02, low.z + 0.01], [lTip.x, lTip.y, lTip.z]], 0.0042, 0.0038);
  hangBell(lTip.clone().add(new THREE.Vector3(-0.006, -0.012, 0)), deg(-14), deg(30));
  f.crystal(bell, { ...blue, backDist: 0.15 }, bells);
  // Five lobes flare out round each mouth.
  const mouth = (m: THREE.Matrix4) => m.clone().multiply(compose(new THREE.Vector3(0, -0.084, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)));
  f.crystal(lobe, { ...blue, backDist: 0.1, bounces: 2 }, bells.flatMap((m, k) => corolla(mouth(m), 5, { tilt: deg(-30), root: 0.03, offset: deg(k * 20) })));
  // Buds on side branches.
  const bud = briolette(0.065, 0.022, 7, 4);
  const budOn = (t: number, dir: Vec, len: number) => {
    const p = stem.getPointAt(t);
    const d = vec(dir).normalize();
    const tip = p.clone().addScaledVector(d, len);
    f.wire([[p.x, p.y, p.z], [p.x + d.x * len * 0.5, p.y + d.y * len * 0.55, p.z + d.z * len * 0.5], [tip.x, tip.y, tip.z]], 0.0045, 0.004);
    return compose(tip, along(d));
  };
  f.crystal(bud, { ...blue, backDist: 0.15 }, [budOn(0.42, [-0.75, 0.65, 0.1], 0.12), budOn(0.58, [0.75, 0.6, 0.1], 0.1)]);
  return f.finish();
}

export const SPECIES = { rose, forgetMeNot, rozanne, lily, lilyOfTheValley, blueBellflower } as const;
export type SpeciesName = keyof typeof SPECIES;
