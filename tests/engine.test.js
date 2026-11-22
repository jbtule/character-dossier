import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  blankCharacter, normalizeCharacter, computeSheet, evaluateInSheet, trackerMax, skillPool,
  isCareerSkill, derivedOrder, interpolate,
} from "../src/engine/sheet.js";

const load = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const eote = load("../systems/eote/system.json");
const sample = normalizeCharacter(eote, load("./fixtures/sample-character.json"));
const value = (sheet, id) => {
  assert.equal(sheet.derived[id].status, "ok", `${id}: ${sheet.derived[id].error ?? sheet.derived[id].status}`);
  return sheet.derived[id].value;
};

test("sample character: derived values", () => {
  const sheet = computeSheet(eote, sample);
  assert.deepEqual(sheet.errors, []);
  assert.equal(value(sheet, "soak"), 4);
  assert.equal(value(sheet, "encumbrance"), 8);
  assert.equal(value(sheet, "encumbranceThreshold"), 7);
  assert.equal(value(sheet, "encumbranceOver"), 1);
});

test("sample character: dice pools", () => {
  const pool = (id) => skillPool(eote, sample, id);
  assert.deepEqual(pool("computers"), { proficiency: 1, ability: 3 });
  assert.deepEqual(pool("rangedHeavy"), { proficiency: 2, ability: 1 });
  assert.deepEqual(pool("astrogation"), { proficiency: 2, ability: 2 });
  assert.deepEqual(pool("deception"), { proficiency: 0, ability: 2 });
});

test("sample character: trackers, meter and note text", () => {
  const sheet = computeSheet(eote, sample);
  const tracker = (id) => trackerMax(eote, sample, sheet, eote.trackers.find((t) => t.id === id));
  assert.deepEqual(tracker("wounds"), { value: 12, status: "ok" });
  assert.deepEqual(tracker("strain"), { value: 14, status: "ok" });
  assert.equal(interpolate(eote.lists.gear.meter.overNote, sheet), "Add 1 setback to Agility and Brawn checks.");
});

test("career skills are stored on the character", () => {
  assert.equal(isCareerSkill(sample, "computers"), true);
  assert.equal(isCareerSkill(sample, "charm"), false);
  assert.equal(isCareerSkill(blankCharacter(eote), "computers"), false);
});

test("blank character: every field empty, nothing errors", () => {
  const blank = blankCharacter(eote);
  assert.equal(blank.system, "eote");
  for (const [id, f] of Object.entries(eote.fields)) assert.equal(blank[id], f.type === "number" ? null : "", id);
  assert.deepEqual(blank.careerSkills, []);
  assert.deepEqual(blank.lists.weapons, []);
  const sheet = computeSheet(eote, blank);
  assert.deepEqual(sheet.errors, []);
  assert.equal(trackerMax(eote, blank, sheet, eote.trackers[0]).status, "unset");
  assert.equal(value(sheet, "soak"), 0);
  assert.equal(value(sheet, "encumbranceThreshold"), 5);
  assert.deepEqual(skillPool(eote, blank, "computers"), { proficiency: 0, ability: 0 });
});

test("every spec formula compiles and evaluates without errors", () => {
  const sheet = computeSheet(eote, sample);
  for (const t of eote.trackers) assert.equal(trackerMax(eote, sample, sheet, t).status, "ok", t.id);
  for (const [id, list] of Object.entries(eote.lists)) {
    if (list.meter) {
      assert.equal(evaluateInSheet(sheet, list.meter.value).status, "ok", `${id} meter value`);
      assert.equal(evaluateInSheet(sheet, list.meter.max).status, "ok", `${id} meter max`);
    }
  }
});

test("number fields are available to formulas", () => {
  const spec = { lists: {}, characteristics: [{ id: "brawn" }], fields: { bonus: { type: "number" } }, derived: { total: { formula: "brawn + bonus" } } };
  assert.equal(computeSheet(spec, { characteristics: { brawn: 2 }, bonus: 3, lists: {} }).derived.total.value, 5);
  assert.equal(computeSheet(spec, { characteristics: { brawn: 2 }, bonus: null, lists: {} }).derived.total.value, 2);
});

test("derived cycles are reported", () => {
  const spec = { derived: { a: { formula: "b + 1" }, b: { formula: "a + 1" } } };
  assert.throws(() => derivedOrder(spec), /cycle/);
  const sheet = computeSheet({ ...spec, lists: {}, characteristics: [] }, { lists: {} });
  assert.match(sheet.errors[0].error, /cycle/);
});

test("bad formulas are reported, not rendered as numbers", () => {
  const spec = { lists: {}, characteristics: [{ id: "brawn" }], derived: { x: { formula: "brawn +" }, y: { formula: "nope * 2" } } };
  const sheet = computeSheet(spec, { characteristics: { brawn: 2 }, lists: {} });
  assert.equal(sheet.derived.x.status, "error");
  assert.equal(sheet.derived.y.status, "error");
  assert.equal(sheet.errors.length, 2);
});
