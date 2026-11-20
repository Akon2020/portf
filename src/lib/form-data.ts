/**
 * Turns FormData into a nested object for Zod.
 *   title.fr              { title: { fr } }
 *   results[0].label.fr   { results: [{ label: { fr } }] }
 *   categories[]          { categories: [..all values] }
 * Checkboxes are rendered with a hidden "0" input followed by a "1" checkbox,
 * so the last value wins and listed boolean keys become true or false.
 */
export function parseFormData(formData: FormData, options: { booleans?: string[] } = {}): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  const booleans = new Set(options.booleans ?? []);

  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const values = formData.getAll(key).filter((value): value is string => typeof value === "string");
    if (key.endsWith("[]")) {
      setPath(root, tokenize(key.slice(0, -2)), values.filter((value) => value !== ""));
      continue;
    }
    const last = values.at(-1) ?? "";
    setPath(root, tokenize(key), booleans.has(key) ? last === "1" || last === "true" || last === "on" : last);
  }
  return toArrays(root) as Record<string, unknown>;
}

function tokenize(key: string): string[] {
  return key.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
}

const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function setPath(target: Record<string, unknown>, path: string[], value: unknown): void {
  let node = target;
  path.forEach((segment, index) => {
    if (FORBIDDEN_KEYS.has(segment)) return;
    if (index === path.length - 1) {
      node[segment] = value;
      return;
    }
    if (typeof node[segment] !== "object" || node[segment] === null) node[segment] = {};
    node = node[segment] as Record<string, unknown>;
  });
}

/** Objects whose keys are all integers become arrays, in index order. */
function toArrays(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toArrays);
  if (typeof value !== "object" || value === null) return value;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 0 && entries.every(([key]) => /^\d+$/.test(key))) {
    return entries.sort(([a], [b]) => Number(a) - Number(b)).map(([, item]) => toArrays(item));
  }
  return Object.fromEntries(entries.map(([key, item]) => [key, toArrays(item)]));
}

/** Flattens Zod issues into "path.to.field": message. */
export function issuesToErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".");
    errors[key] ??= issue.message;
  }
  return errors;
}
