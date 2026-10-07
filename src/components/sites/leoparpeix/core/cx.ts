const LOCAL_NAMES = new Set<string>();

/** True when a class token is a CSS-module (hashed) name produced by `moduleClasses`. */
export function isModuleClass(token: string): boolean {
  return LOCAL_NAMES.has(token);
}

type ClassArg = string | false | null | undefined | Record<string, boolean | undefined>;

/**
 * Class helper for the ported CSS modules. Every class is emitted twice: the module-local
 * (hashed) name and the raw source name. The raw name keeps Vue `:deep()` selectors from
 * parent modules (ported as `:global(.child)`) and global rules such as `.line` working.
 */
export function moduleClasses(styles: Readonly<Record<string, string>>) {
  return (...args: ClassArg[]): string => {
    const out: string[] = [];
    const push = (name: string) => {
      for (const n of name.split(/\s+/)) {
        if (!n) continue;
        const local = styles[n];
        if (local) {
          LOCAL_NAMES.add(local);
          out.push(local);
        }
        out.push(n);
      }
    };
    for (const a of args) {
      if (!a) continue;
      if (typeof a === "string") push(a);
      else for (const [k, v] of Object.entries(a)) if (v) push(k);
    }
    return out.join(" ");
  };
}
