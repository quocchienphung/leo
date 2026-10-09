/** Spatial index of the finite faces of a convex solid. Optical planes stay unchanged. */
type Vec3 = [number, number, number];
interface Plane { x: number; y: number; z: number; w: number }
interface Face { index: number; min: Vec3; max: Vec3 }
interface Node { min: Vec3; max: Vec3; faces: number[]; escape: number }

export interface PlaneBvh {
  /** Three RGBA texels per node: minimum/count, maximum/escape, four plane indices. */
  data: Float32Array;
  nodeCount: number;
}

const dot = (p: Plane, v: Vec3) => p.x * v[0] + p.y * v[1] + p.z * v[2];
const interpolate = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Clip a polygon to a half-space. All calculations here are build-time doubles. */
function clip(polygon: Vec3[], plane: Plane): Vec3[] {
  const output: Vec3[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const da = dot(plane, a) - plane.w;
    const db = dot(plane, b) - plane.w;
    if (da <= 0) output.push(a);
    if ((da <= 0) !== (db <= 0)) output.push(interpolate(a, b, da / (da - db)));
  }
  return output;
}

/**
 * Reconstruct each bounded face from the same half-spaces used by the shader.
 * A ray starting inside a convex solid exits through one of these finite faces.
 * Return null for invalid/unbounded input so the caller can keep the linear scan.
 */
export function buildPlaneBvh(planes: readonly Plane[], positions: ArrayLike<number>): PlaneBvh | null {
  if (!planes.length || !positions.length) return null;
  let radius = 0;
  for (let i = 0; i < positions.length; i += 3) {
    radius = Math.max(radius, Math.hypot(positions[i], positions[i + 1], positions[i + 2]));
  }
  if (!Number.isFinite(radius) || radius <= 0) return null;
  const extent = radius * 8;
  // Include mesh/plane merge tolerances and outward float32 rounding in the bounds.
  const padding = Math.max(radius * 0.01, 1e-5);
  const faces: Face[] = [];
  for (let index = 0; index < planes.length; index++) {
    const p = planes[index];
    const length = Math.hypot(p.x, p.y, p.z);
    if (!Number.isFinite(length) || Math.abs(length - 1) > 1e-4 || !Number.isFinite(p.w)) return null;
    const n: Vec3 = [p.x, p.y, p.z];
    const inverse = 1 / Math.hypot(Math.abs(n[0]) < 0.8 ? n[2] : n[1], Math.abs(n[0]) < 0.8 ? n[1] : n[0]);
    // n × X, or n × Z when n is close to X.
    const u: Vec3 = Math.abs(n[0]) < 0.8 ? [0, n[2] * inverse, -n[1] * inverse] : [n[1] * inverse, -n[0] * inverse, 0];
    const v: Vec3 = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    const origin: Vec3 = [n[0] * p.w, n[1] * p.w, n[2] * p.w];
    let polygon: Vec3[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => [
      origin[0] + extent * (u[0] * x + v[0] * y),
      origin[1] + extent * (u[1] * x + v[1] * y),
      origin[2] + extent * (u[2] * x + v[2] * y),
    ]);
    for (let j = 0; j < planes.length && polygon.length; j++) {
      if (j !== index) polygon = clip(polygon, planes[j]);
    }
    if (!polygon.length) continue; // Redundant half-space: never the first exit.
    const min: Vec3 = [Infinity, Infinity, Infinity];
    const max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const point of polygon) {
      const delta: Vec3 = [point[0] - origin[0], point[1] - origin[1], point[2] - origin[2]];
      const alongU = delta[0] * u[0] + delta[1] * u[1] + delta[2] * u[2];
      const alongV = delta[0] * v[0] + delta[1] * v[1] + delta[2] * v[2];
      if (Math.abs(alongU) >= extent * 0.999 || Math.abs(alongV) >= extent * 0.999) return null;
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], point[axis] - padding);
        max[axis] = Math.max(max[axis], point[axis] + padding);
      }
    }
    faces.push({ index, min, max });
  }
  if (!faces.length) return null;

  const nodes: Node[] = [];
  const append = (items: Face[]): void => {
    const min: Vec3 = [Infinity, Infinity, Infinity];
    const max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const face of items) {
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], face.min[axis]);
        max[axis] = Math.max(max[axis], face.max[axis]);
      }
    }
    const node: Node = { min, max, faces: [], escape: 0 };
    nodes.push(node);
    if (items.length <= 4) node.faces = items.map((f) => f.index);
    else {
      let axis = 0;
      for (let i = 1; i < 3; i++) if (max[i] - min[i] > max[axis] - min[axis]) axis = i;
      items.sort((a, b) => a.min[axis] + a.max[axis] - b.min[axis] - b.max[axis]);
      const middle = Math.floor(items.length / 2);
      append(items.slice(0, middle));
      append(items.slice(middle));
    }
    node.escape = nodes.length;
  };
  append(faces);
  const data = new Float32Array(nodes.length * 12);
  nodes.forEach((node, i) => {
    data.set([...node.min, node.faces.length, ...node.max, node.escape, ...Array.from({ length: 4 }, (_, k) => node.faces[k] ?? -1)], i * 12);
  });
  return { data, nodeCount: nodes.length };
}
