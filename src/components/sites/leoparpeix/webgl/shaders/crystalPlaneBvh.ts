/** Stackless traversal of the finite face bounds; exit planes and Fresnel are unchanged. */
export const planeBvhFragment = /* glsl */ `
uniform sampler2D uPlaneBvh;
uniform int uPlaneBvhNodes;

bool traceBounds(vec3 p, vec3 d, vec3 lower, vec3 upper, float closest) {
  vec3 safeDirection = mix(vec3(1e-20), d, greaterThan(abs(d), vec3(1e-20)));
  vec3 a = (lower - p) / safeDirection;
  vec3 b = (upper - p) / safeDirection;
  vec3 nearHit = min(a, b);
  vec3 farHit = max(a, b);
  float entry = max(nearHit.x, max(nearHit.y, nearHit.z));
  float exitDistance = min(farHit.x, min(farHit.y, farHit.z));
  return exitDistance >= max(entry, 0.0) && entry <= closest;
}

float traceExit(vec3 p, vec3 d, out vec3 nOut) {
  float tMin = 1e4;
  int firstPlane = TRACE_PLANES;
  nOut = d;
  int node = 0;
  for (int step = 0; step < TRACE_BVH_STEPS; step++) {
    if (node >= uPlaneBvhNodes) break;
    vec4 lower = texelFetch(uPlaneBvh, ivec2(node * 3, 0), 0);
    vec4 upper = texelFetch(uPlaneBvh, ivec2(node * 3 + 1, 0), 0);
    if (!traceBounds(p, d, lower.xyz, upper.xyz, tMin)) {
      node = int(upper.w);
      continue;
    }
    int count = int(lower.w);
    if (count == 0) { node++; continue; }
    vec4 indices = texelFetch(uPlaneBvh, ivec2(node * 3 + 2, 0), 0);
    for (int j = 0; j < 4; j++) {
      if (j >= count) break;
      int index = int(indices[j]);
      vec4 pl = texelFetch(uPlanes, ivec2(index, 0), 0);
      float denom = dot(pl.xyz, d);
      if (denom > 1e-5) {
        float t = (pl.w - dot(pl.xyz, p)) / denom;
        // Preserve the linear scan's first-plane tie break on shared facet borders.
        if (t > 1e-5 && (t < tMin || (t == tMin && index < firstPlane))) {
          tMin = t;
          firstPlane = index;
          nOut = pl.xyz;
        }
      }
    }
    node = int(upper.w);
  }
  return tMin < 1e3 ? tMin : 0.0;
}
`;
