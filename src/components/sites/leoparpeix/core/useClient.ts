"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** Client-only value without a hydration mismatch (server snapshot = `serverValue`). */
export function useClientValue<T>(read: () => T, serverValue: T, subscribe: (cb: () => void) => () => void = noopSubscribe): T {
  return useSyncExternalStore(subscribe, read, () => serverValue);
}
