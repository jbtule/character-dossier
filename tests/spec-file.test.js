import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findSpecFile, loadSpecFile } from "../tools/spec-file.mjs";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "spec-"));

test("TOML and JSON specs load to the same object", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "system.toml"), 'id = "x"\n# comment\n[derived]\nsoak = { label = "Soak", formula = \'sumOf("gear", "soak")\' }\n');
  fs.writeFileSync(path.join(dir, "other.json"), JSON.stringify({ id: "x", derived: { soak: { label: "Soak", formula: 'sumOf("gear", "soak")' } } }));
  assert.deepEqual(loadSpecFile(path.join(dir, "system.toml")), loadSpecFile(path.join(dir, "other.json")));
});

test("a folder may hold one spec file, not both", () => {
  const dir = tmp();
  assert.equal(findSpecFile(dir), null);
  fs.writeFileSync(path.join(dir, "system.json"), "{}");
  assert.equal(findSpecFile(dir), path.join(dir, "system.json"));
  fs.writeFileSync(path.join(dir, "system.toml"), "");
  assert.throws(() => findSpecFile(dir), /both/);
});

test("parse errors name the file", () => {
  const file = path.join(tmp(), "system.toml");
  fs.writeFileSync(file, "id = \n");
  assert.throws(() => loadSpecFile(file), (e) => e.message.startsWith(file));
});

test("every system folder has exactly one loadable spec whose id matches", () => {
  const root = fileURLToPath(new URL("../systems/", import.meta.url));
  for (const id of fs.readdirSync(root)) {
    const dir = path.join(root, id);
    if (!fs.statSync(dir).isDirectory()) continue;
    const file = findSpecFile(dir);
    assert.ok(file, `systems/${id} has no spec`);
    assert.equal(loadSpecFile(file).id, id);
  }
});
