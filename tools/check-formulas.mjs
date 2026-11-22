// Evaluates a system spec against a character using the engine and prints derived values and dice pools.
// Usage: node tools/check-formulas.mjs systems/eote/system.json tests/fixtures/sample-character.json
import fs from "node:fs";
import { computeSheet, normalizeCharacter, skillPool } from "../src/engine/sheet.js";

const spec = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const character = normalizeCharacter(spec, JSON.parse(fs.readFileSync(process.argv[3], "utf8")));
const sheet = computeSheet(spec, character);

for (const [id, d] of Object.entries(sheet.derived)) console.log(id, d.status === "ok" ? d.value : `(${d.status}${d.error ? ": " + d.error : ""})`);
for (const s of spec.skills ?? []) if (character.skills?.[s.id]) console.log(s.id, skillPool(spec, character, s.id));
for (const e of sheet.errors) console.error(`ERROR ${e.where}: ${e.error}`);
process.exitCode = sheet.errors.length ? 1 : 0;
