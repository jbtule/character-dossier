// Pretty-prints JSON, keeping small objects and arrays on one line so specs stay readable.
// Usage: node tools/format-json.mjs <file.json> [...]
import fs from "node:fs";

const WIDTH = 120;

function oneLine(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(oneLine).join(", ") + "]";
  return "{" + Object.entries(value).map(([k, v]) => JSON.stringify(k) + ": " + oneLine(v)).join(", ") + "}";
}

function fmt(value, indent) {
  const flat = oneLine(value);
  if (value === null || typeof value !== "object" || flat.length + indent.length <= WIDTH) return flat;
  const inner = indent + "  ";
  if (Array.isArray(value)) {
    return "[\n" + value.map((v) => inner + fmt(v, inner)).join(",\n") + "\n" + indent + "]";
  }
  return "{\n" + Object.entries(value).map(([k, v]) => inner + JSON.stringify(k) + ": " + fmt(v, inner)).join(",\n") + "\n" + indent + "}";
}

for (const file of process.argv.slice(2)) {
  fs.writeFileSync(file, fmt(JSON.parse(fs.readFileSync(file, "utf8")), "") + "\n");
}
