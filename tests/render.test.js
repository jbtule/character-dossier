import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { renderSheet } from "../src/render.js";
import { normalizeCharacter } from "../src/engine/sheet.js";

const spec = JSON.parse(fs.readFileSync(new URL("../systems/eote/system.json", import.meta.url), "utf8"));
const character = normalizeCharacter(spec, JSON.parse(fs.readFileSync(new URL("./fixtures/sample-character.json", import.meta.url), "utf8")));
const html = (hidden = []) => { const r = renderSheet({ spec, character, hidden: new Set(hidden) }); return r.header + r.body; };
const tag = (src, re) => src.match(re)?.[0] ?? "";

test("private fields have their own eye, and only that section is hidden", () => {
  const shown = html();
  const hidden = html(["f:motivation", "f:notes", "l:obligations"]);
  assert.match(shown, /data-eye="f:motivation"/);
  assert.match(shown, /data-eye="l:obligations"/);
  assert.doesNotMatch(shown, /data-eye="l:weapons"/);
  const onlyNotes = html(["f:notes"]);
  assert.match(tag(onlyNotes, /<textarea[^>]*data-field="notes"[^>]*>/), /\binert\b/);
  assert.doesNotMatch(tag(onlyNotes, /<textarea[^>]*data-field="motivation"[^>]*>/), /\binert\b/);
  for (const re of [/<textarea[^>]*data-field="motivation"[^>]*>/, /<textarea[^>]*data-field="notes"[^>]*>/]) {
    assert.match(tag(shown, re), /data-private/);
    assert.doesNotMatch(tag(shown, re), /\binert\b/);
    assert.match(tag(hidden, re), /\binert\b/);
  }
  if (character.lists.obligations.length) {
    assert.match(tag(hidden, /<input[^>]*data-list="obligations"[^>]*data-f="type"[^>]*>/), /\binert\b/);
    assert.doesNotMatch(tag(hidden, /<input[^>]*data-list="obligations"[^>]*data-f="magnitude"[^>]*>/), /data-private/);
  }
  assert.doesNotMatch(tag(hidden, /<input[^>]*data-field="name"[^>]*>/), /data-private/);
});
