import type { Ref } from "react";

/** Forward a DOM node to an optional external ref (callback or object). */
export function setRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (!ref) return;
  if (typeof ref === "function") ref(value);
  else (ref as { current: T | null }).current = value;
}
