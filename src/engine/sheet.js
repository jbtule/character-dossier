// Game-agnostic sheet logic: everything game-specific comes from the system spec.
import { evaluate, identifiers } from "./formula.js";

/** Read a dot path like "careers.{career}.specializations" from the spec, filling {fieldId} from the character. */
export function resolvePath(spec, character, path) {
  let missing = false;
  const filled = path.replace(/\{(\w+)\}/g, (_, id) => {
    const v = character[id];
    if (v == null || v === "") missing = true;
    return v ?? "";
  });
  if (missing) return undefined;
  return filled.split(".").reduce((obj, key) => (obj == null ? undefined : obj[key]), spec);
}

/** Choices for a ref field: [{ id, label }]. Empty when it depends on a field that isn't set yet. */
export function refOptions(spec, character, fieldId) {
  const field = spec.fields?.[fieldId];
  const source = field?.type === "ref" ? resolvePath(spec, character, field.options) : undefined;
  if (!source || typeof source !== "object") return [];
  return Object.entries(source).map(([id, entry]) => ({ id, label: entry?.label ?? id }));
}

/** The spec entry a ref field points at, or undefined if unset or invalid. */
export function refEntry(spec, character, fieldId) {
  const field = spec.fields?.[fieldId];
  const id = character[fieldId];
  if (field?.type !== "ref" || id == null || id === "") return undefined;
  return resolvePath(spec, character, field.options)?.[id];
}

function defaultFor(type) {
  if (type === "number") return null;
  if (type === "bool") return false;
  return "";
}

/** A new, empty character for a spec. */
export function blankCharacter(spec) {
  const ch = { system: spec.id };
  for (const [id, f] of Object.entries(spec.fields ?? {})) ch[id] = defaultFor(f.type);
  ch.characteristics = Object.fromEntries((spec.characteristics ?? []).map((c) => [c.id, null]));
  ch.skills = {};
  ch.careerSkillOverrides = {};
  ch.trackers = Object.fromEntries((spec.trackers ?? []).map((t) => [t.id, 0]));
  ch.lists = Object.fromEntries(Object.keys(spec.lists ?? {}).map((id) => [id, []]));
  return ch;
}

/** A blank item for a list. */
export function blankItem(spec, listId) {
  return Object.fromEntries((spec.lists[listId].fields ?? []).map((f) => [f.id, defaultFor(f.type)]));
}

/** Fill in anything a character file is missing (older files, hand-written files). */
export function normalizeCharacter(spec, character) {
  const blank = blankCharacter(spec);
  const ch = { ...blank, ...character };
  ch.characteristics = { ...blank.characteristics, ...(character.characteristics ?? {}) };
  ch.trackers = { ...blank.trackers, ...(character.trackers ?? {}) };
  ch.lists = { ...blank.lists, ...(character.lists ?? {}) };
  ch.skills ??= {};
  ch.careerSkillOverrides ??= {};
  return ch;
}

const num = (v) => (v == null || v === "" || Number.isNaN(+v) ? 0 : +v);

function itemContext(spec, listId, item) {
  const ctx = {};
  for (const f of spec.lists[listId].fields ?? []) {
    const v = item[f.id];
    ctx[f.id] = f.type === "number" ? num(v) : f.type === "bool" ? !!v : (v ?? "");
  }
  return ctx;
}

/** Item formulas for every list item. Returns { listId: [ { ...fields, ...formulaResults } ] } and errors. */
export function computeItems(spec, character) {
  const errors = [];
  const items = {};
  for (const [listId, def] of Object.entries(spec.lists ?? {})) {
    items[listId] = (character.lists?.[listId] ?? []).map((item, i) => {
      const ctx = itemContext(spec, listId, item);
      const out = { ...ctx };
      for (const [name, expr] of Object.entries(def.itemFormulas ?? {})) {
        const r = evaluate(expr, ctx);
        if (r.error) errors.push({ where: `lists.${listId}.itemFormulas.${name} (item ${i + 1})`, formula: expr, error: r.error });
        out[name] = r.error ? 0 : r.value;
      }
      return out;
    });
  }
  return { items, errors };
}

/** Order derived ids so each comes after the derived values it uses. Throws on a cycle. */
export function derivedOrder(spec) {
  const derived = spec.derived ?? {};
  const ids = Object.keys(derived);
  const deps = Object.fromEntries(ids.map((id) => [id, [...identifiers(derived[id].formula)].filter((n) => n !== id && n in derived)]));
  for (const id of ids) if (identifiers(derived[id].formula).has(id)) throw new Error(`Derived value "${id}" refers to itself`);
  const order = [];
  const state = {};
  const visit = (id, path) => {
    if (state[id] === "done") return;
    if (state[id] === "visiting") throw new Error(`Derived values form a cycle: ${[...path, id].join(" → ")}`);
    state[id] = "visiting";
    for (const d of deps[id]) visit(d, [...path, id]);
    state[id] = "done";
    order.push(id);
  };
  for (const id of ids) visit(id, []);
  return order;
}

function refFieldIds(spec) {
  return Object.entries(spec.fields ?? {}).filter(([, f]) => f.type === "ref").map(([id]) => id);
}

/**
 * Evaluate the whole sheet.
 * derived[id] = { value, status: "ok" | "pending" | "error", error? }
 * "pending" means the formula needs a ref field (like species) that hasn't been chosen yet. It's not a spec bug.
 */
export function computeSheet(spec, character) {
  const errors = [];
  const { items, errors: itemErrors } = computeItems(spec, character);
  errors.push(...itemErrors);

  const refs = refFieldIds(spec);
  const unsetRefs = new Set(refs.filter((id) => refEntry(spec, character, id) === undefined));
  const ctx = {};
  for (const c of spec.characteristics ?? []) ctx[c.id] = num(character.characteristics?.[c.id]);
  for (const id of refs) if (!unsetRefs.has(id)) ctx[id] = refEntry(spec, character, id);

  const sumOf = (listId, field) => {
    if (!(listId in items)) throw new Error(`sumOf: no list "${listId}"`);
    return items[listId].reduce((a, it) => a + num(it[field]), 0);
  };

  const derived = {};
  let order = [];
  try {
    order = derivedOrder(spec);
  } catch (e) {
    errors.push({ where: "derived", formula: "", error: e.message });
  }
  for (const id of order) {
    const expr = spec.derived[id].formula;
    const used = identifiers(expr);
    const waitingOn = [...used].filter((n) => unsetRefs.has(n) || derived[n]?.status === "pending");
    if (waitingOn.length) {
      derived[id] = { value: null, status: "pending", waitingOn };
      continue;
    }
    const r = evaluate(expr, ctx, { sumOf });
    if (r.error) {
      derived[id] = { value: null, status: "error", error: r.error };
      errors.push({ where: `derived.${id}`, formula: expr, error: r.error });
    } else {
      derived[id] = { value: r.value, status: "ok" };
      ctx[id] = r.value;
    }
  }

  return { items, derived, errors, context: ctx };
}

/** Evaluate a formula in the derived context (tracker max, meter value/max). */
export function evaluateInSheet(sheet, expr) {
  const used = identifiers(expr);
  if ([...used].some((n) => sheet.derived[n]?.status === "pending")) return { value: null, status: "pending" };
  const r = evaluate(expr, sheet.context);
  return r.error ? { value: null, status: "error", error: r.error } : { value: r.value, status: "ok" };
}

/** Dice pool for a characteristic value and rank: { dieId: count }. */
export function dicePool(spec, characteristic, rank) {
  const ctx = { characteristic: num(characteristic), rank: num(rank) };
  const pool = {};
  for (const [die, expr] of Object.entries(spec.skillRoll ?? {})) {
    const r = evaluate(expr, ctx);
    pool[die] = r.error ? 0 : Math.max(0, Math.floor(num(r.value)));
  }
  return pool;
}

/** Dice pool for a skill id on this character. */
export function skillPool(spec, character, skillId) {
  const skill = (spec.skills ?? []).find((s) => s.id === skillId);
  if (!skill) return null;
  return dicePool(spec, character.characteristics?.[skill.characteristic], character.skills?.[skillId]);
}

/** Career skills from the chosen ref entries, before per-character overrides. */
export function baseCareerSkills(spec, character) {
  const rule = spec.careerSkills;
  const out = new Set();
  if (!rule) return out;
  for (const fieldId of rule.from ?? []) {
    const entry = refEntry(spec, character, fieldId);
    for (const s of entry?.[rule.key ?? "skills"] ?? []) out.add(s);
  }
  return out;
}

export function isCareerSkill(spec, character, skillId) {
  const o = character.careerSkillOverrides?.[skillId];
  return typeof o === "boolean" ? o : baseCareerSkills(spec, character).has(skillId);
}

/** Fill "{derivedId}" placeholders in text. */
export function interpolate(text, sheet) {
  return String(text ?? "").replace(/\{(\w+)\}/g, (_, id) => {
    const d = sheet.derived[id];
    return d?.status === "ok" ? String(d.value) : "?";
  });
}
