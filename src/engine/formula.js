// Filtrex wrapper: compiles spec formulas once and turns Filtrex's error values into a uniform result.
import { compileExpression, useDotAccessOperator } from "filtrex";

const cache = new Map();

/** Compile `expr` with dot access enabled. Returns a function or throws a parse error. */
export function compile(expr, extraFunctions = {}) {
  const key = expr + "\u0000" + Object.keys(extraFunctions).sort().join(",");
  let fn = cache.get(key);
  if (!fn) {
    fn = compileExpression(expr, { customProp: useDotAccessOperator, extraFunctions });
    // Extra functions are bound at compile time, so only cache formulas without them.
    if (!Object.keys(extraFunctions).length) cache.set(key, fn);
  }
  return fn;
}

/**
 * Evaluate a formula. Never throws.
 * @returns {{ value: any, error: string | null }}
 */
export function evaluate(expr, context, extraFunctions = {}) {
  let fn;
  try {
    fn = compile(String(expr), extraFunctions);
  } catch (e) {
    return { value: null, error: `Syntax error: ${e.message}` };
  }
  let value;
  try {
    value = fn(context);
  } catch (e) {
    return { value: null, error: e.message };
  }
  if (value instanceof Error) return { value: null, error: value.message };
  if (typeof value === "number" && !Number.isFinite(value)) return { value: null, error: `Result is ${value}` };
  return { value, error: null };
}

/** Identifiers a formula refers to (outside string literals). Used for dependency ordering. */
export function identifiers(expr) {
  const withoutStrings = String(expr).replace(/"(?:[^"\\]|\\.)*"/g, '""');
  const names = new Set();
  for (const m of withoutStrings.matchAll(/'([^']+)'|([A-Za-z_$][\w$]*)/g)) names.add(m[1] ?? m[2]);
  return names;
}
