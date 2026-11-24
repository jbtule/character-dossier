// Reads a system spec from disk. Specs are written in TOML (system.toml); plain JSON
// (system.json) is still accepted. Either way the result is the object the app loads.
import fs from "node:fs";
import path from "node:path";
import { parse } from "smol-toml";

export const SPEC_FILES = ["system.toml", "system.json"];

/** The spec file in a system folder, or null. Throws if the folder has both. */
export function findSpecFile(dir) {
  const found = SPEC_FILES.map((f) => path.join(dir, f)).filter((f) => fs.existsSync(f));
  if (found.length > 1) throw new Error(`${dir} has both ${SPEC_FILES.join(" and ")}; keep one`);
  return found[0] ?? null;
}

/** Parse a spec file (.toml or .json) into a plain object. */
export function loadSpecFile(file) {
  const text = fs.readFileSync(file, "utf8");
  try {
    // Round-trip through JSON so the app only ever sees plain JSON values (TOML dates become strings).
    return file.endsWith(".toml") ? JSON.parse(JSON.stringify(parse(text))) : JSON.parse(text);
  } catch (err) {
    throw new Error(`${file}: ${err.message}`);
  }
}
