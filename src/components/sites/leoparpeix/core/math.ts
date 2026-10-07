export function lerp(a: number, b: number, t: number): number {
  return (1 - t) * a + t * b;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

/** Source `sd()`: unclamped linear map. */
export function mapRange(v: number, [a, b]: readonly [number, number], [c, d]: readonly [number, number]): number {
  return c + (d - c) * ((v - a) / (b - a));
}

/** Source `Kn()`: linear map clamped to the output range. */
export function mapClamp(v: number, from: readonly [number, number], to: readonly [number, number]): number {
  return clamp(mapRange(v, from, to), Math.min(...to), Math.max(...to));
}

export function degToRad(d: number): number {
  return (d * Math.PI) / 180;
}

/** Frame-rate independent damping factor, source `1 - exp(-k * dt)`. */
export function damp(k: number, dt: number): number {
  return 1 - Math.exp(-k * dt);
}

/** Source `xs()`: document-space rect built from offsetTop/offsetLeft chains. */
export function offsetRect(el: HTMLElement): DOMRect {
  let left = 0;
  let top = 0;
  let node: HTMLElement | null = el;
  while (node) {
    left += node.offsetLeft;
    top += node.offsetTop;
    const parent = node.offsetParent as HTMLElement | null;
    if (!parent) break;
    node = parent;
    top -= node.scrollTop;
    left -= node.scrollLeft;
  }
  return new DOMRect(left, top, el.offsetWidth, el.offsetHeight);
}

export function pick<T>(list: readonly T[], exclude?: T | null): T {
  const pool = exclude == null ? list : list.filter((v) => v !== exclude);
  const src = pool.length ? pool : list;
  return src[Math.floor(Math.random() * src.length)];
}
