import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  blankCharacter, normalizeCharacter, computeSheet, evaluateInSheet, skillPool, refOptions,
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
  assert.equal(value(sheet, "woundThreshold"), 12);
  assert.equal(value(sheet, "strainThreshold"), 14);
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
  assert.equal(evaluateInSheet(sheet, "woundThreshold").value, 12);
  assert.equal(interpolate(eote.lists.gear.meter.overNote, sheet), "Add 1 setback to Agility and Brawn checks.");
});

test("career skills come from career and specialization, with overrides", () => {
  assert.equal(isCareerSkill(eote, sample, "computers"), true);
  assert.equal(isCareerSkill(eote, sample, "underworld"), true); // specialization only
  assert.equal(isCareerSkill(eote, sample, "charm"), false);
  const overridden = { ...sample, careerSkillOverrides: { charm: true, computers: false } };
  assert.equal(isCareerSkill(eote, overridden, "charm"), true);
  assert.equal(isCareerSkill(eote, overridden, "computers"), false);
});

test("ref options: specializations depend on the chosen career", () => {
  const blank = blankCharacter(eote);
  assert.deepEqual(refOptions(eote, blank, "specialization"), []);
  assert.deepEqual(refOptions(eote, { ...blank, career: "technician" }, "specialization"), [{ id: "slicer", label: "Slicer" }]);
  assert.deepEqual(refOptions(eote, blank, "species"), [{ id: "twilek", label: "Twi'lek" }]);
});

test("blank character: empty, and formulas waiting on species are pending, not errors", () => {
  const blank = blankCharacter(eote);
  assert.equal(blank.system, "eote");
  assert.equal(blank.name, "");
  assert.deepEqual(blank.lists.weapons, []);
  const sheet = computeSheet(eote, blank);
  assert.deepEqual(sheet.errors, []);
  assert.equal(sheet.derived.woundThreshold.status, "pending");
  assert.equal(value(sheet, "soak"), 0);
  assert.equal(value(sheet, "encumbranceThreshold"), 5);
  assert.deepEqual(skillPool(eote, blank, "computers"), { proficiency: 0, ability: 0 });
});

test("every spec formula compiles and evaluates without errors", () => {
  const sheet = computeSheet(eote, sample);
  for (const t of eote.trackers) assert.equal(evaluateInSheet(sheet, t.max).status, "ok", t.id);
  for (const [id, list] of Object.entries(eote.lists)) {
    if (list.meter) {
      assert.equal(evaluateInSheet(sheet, list.meter.value).status, "ok", `${id} meter value`);
      assert.equal(evaluateInSheet(sheet, list.meter.max).status, "ok", `${id} meter max`);
    }
  }
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
