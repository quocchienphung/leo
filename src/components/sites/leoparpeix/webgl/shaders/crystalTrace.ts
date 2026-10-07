// Traced crystal: real light paths through a convex cut stone, for MeshPhysicalMaterial.
//
// Every crystal drawn with it is a closed convex solid whose faces are given as object-space planes
// (n·x = w, outward n). Per fragment, the view ray refracts in through the visible facet, then
// bounces inside the stone: at each face it meets, Fresnel (or total internal reflection) splits it
// into a part that leaves the stone (refracted out, one direction per colour channel → genuine
// fire) and a part reflected back in. Exits after the first look at the environment map; the first
// exit looks at the refraction buffer (the scene behind the stone), like three's own transmission.
// Facets seen through the stone are therefore its real back faces, stable as the camera moves —
// not a pattern painted on top.
//
// Limits: one stone at a time (other transmissive objects are not in the refraction buffer),
// environment exits have no parallax, no caustics. Uniform scale only. Works with InstancedMesh:
// the stone's transform reaches the fragment as flat varyings.

export const traceVertexPars = /* glsl */ `
flat varying vec3 vTraceX;
flat varying vec3 vTraceY;
flat varying vec3 vTraceZ;
flat varying vec3 vTraceT;
`;

/** Injected after worldpos_vertex. */
export const traceVertexMain = /* glsl */ `
{
  mat4 traceModel = modelMatrix;
  #ifdef USE_INSTANCING
    traceModel = modelMatrix * instanceMatrix;
  #endif
  vTraceX = traceModel[0].xyz;
  vTraceY = traceModel[1].xyz;
  vTraceZ = traceModel[2].xyz;
  vTraceT = traceModel[3].xyz;
}
`;

export const traceFragmentPars = /* glsl */ `
flat varying vec3 vTraceX;
flat varying vec3 vTraceY;
flat varying vec3 vTraceZ;
flat varying vec3 vTraceT;
uniform vec4 uPlanes[TRACE_PLANES];
uniform int uPlaneCount;
uniform float uTraceIor;
uniform float uSpread;
uniform vec3 uAbsorb;
uniform float uBackDist;
uniform float uSparkle;
uniform float uEnvGain;

float traceExit(vec3 p, vec3 d, out vec3 nOut) {
  float tMin = 1e4;
  nOut = d;
  for (int i = 0; i < TRACE_PLANES; i++) {
    if (i >= uPlaneCount) break;
    vec4 pl = uPlanes[i];
    float denom = dot(pl.xyz, d);
    if (denom > 1e-5) {
      float t = (pl.w - dot(pl.xyz, p)) / denom;
      if (t > 1e-5 && t < tMin) {
        tMin = t;
        nOut = pl.xyz;
      }
    }
  }
  return tMin < 1e3 ? tMin : 0.0;
}

// Unpolarised dielectric Fresnel; eta = n_outside / n_inside for a ray leaving the stone.
float traceFresnel(float cosi, float eta) {
  float c = abs(cosi);
  float g = eta * eta - 1.0 + c * c;
  if (g < 0.0) return 1.0;
  g = sqrt(g);
  float a = (g - c) / (g + c);
  float b = (c * (g + c) - 1.0) / (c * (g - c) + 1.0);
  return clamp(0.5 * a * a * (1.0 + b * b), 0.0, 1.0);
}

vec3 traceEnv(vec3 dirW) {
  #if defined(USE_ENVMAP) && defined(ENVMAP_TYPE_CUBE_UV)
    return textureCubeUV(envMap, envMapRotation * dirW, 0.0).rgb * envMapIntensity * uEnvGain;
  #else
    return vec3(0.5);
  #endif
}

vec3 traceScreen(vec3 posW, vec3 dirW, int c) {
  vec4 ndc = projectionMatrix * viewMatrix * vec4(posW + dirW * uBackDist, 1.0);
  vec2 uv = (ndc.xy / ndc.w) * 0.5 + 0.5;
  // Off-screen or behind the camera: the surroundings instead.
  if (ndc.w <= 0.0 || any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return traceEnv(dirW);
  return getTransmissionSample(uv, 0.0, uTraceIor).rgb;
}

vec3 traceSun(vec3 dirW) {
  #if NUM_DIR_LIGHTS > 0
    vec3 L = transformDirectionByInverseViewMatrix(directionalLights[0].direction, viewMatrix);
    float a = max(dot(dirW, L), 0.0);
    return directionalLights[0].color * (pow(a, 1600.0) * 6.0 + pow(a, 90.0) * 0.12) * uSparkle;
  #else
    return vec3(0.0);
  #endif
}

/** Light leaving the stone towards the eye at a front facet (world normal nW, view vW). */
vec3 crystalTrace(vec3 nW, vec3 vW, vec3 posW) {
  mat3 M = mat3(vTraceX, vTraceY, vTraceZ);
  float s = length(M[0]);
  mat3 toWorld = M / s;
  mat3 toObject = transpose(toWorld);
  vec3 p = toObject * (posW - vTraceT) / s;
  vec3 n = normalize(toObject * nW);
  vec3 d = refract(-normalize(toObject * vW), n, 1.0 / uTraceIor);
  vec3 throughput = vec3(1.0);
  vec3 acc = vec3(0.0);
  for (int b = 0; b < TRACE_BOUNCES; b++) {
    vec3 nOut;
    float t = traceExit(p, d, nOut);
    p += d * t;
    throughput *= exp(-uAbsorb * t * s);
    float R = traceFresnel(dot(d, nOut), 1.0 / uTraceIor);
    if (R < 1.0) {
      vec3 exitW = vTraceT + toWorld * p * s;
      vec3 col;
      for (int c = 0; c < 3; c++) {
        vec3 o = refract(d, -nOut, uTraceIor + float(c - 1) * uSpread);
        if (dot(o, o) < 1e-6) o = reflect(d, nOut);
        vec3 oW = normalize(toWorld * o);
        vec3 seen = (b == 0 ? traceScreen(exitW, oW, c) : traceEnv(oW)) + traceSun(oW);
        col[c] = seen[c];
      }
      acc += throughput * (1.0 - R) * col;
    }
    throughput *= R;
    d = reflect(d, nOut);
  }
  // What is still trapped after the last bounce leaves roughly where it is heading.
  acc += throughput * traceEnv(normalize(toWorld * d));
  return acc;
}
`;

/** Replaces three's `transmission_fragment` (same outputs: totalDiffuse, transmissionAlpha). */
export const traceFragmentMain = /* glsl */ `
#ifdef USE_TRANSMISSION
  material.transmission = transmission;
  material.transmissionAlpha = 1.0;
  material.thickness = thickness;
  material.attenuationDistance = attenuationDistance;
  material.attenuationColor = attenuationColor;
  {
    vec3 pos = vWorldPosition;
    vec3 v = normalize(cameraPosition - pos);
    vec3 n = transformNormalByInverseViewMatrix(normal, viewMatrix);
    vec3 traced = crystalTrace(n, v, pos);
    vec3 F = EnvironmentBRDF(n, v, material.specularColorBlended, material.specularF90, material.roughness);
    totalDiffuse = mix(totalDiffuse, (1.0 - F) * material.diffuseContribution * traced, material.transmission);
  }
#endif
`;
