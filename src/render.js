// Widgets. Each layout section type in the spec maps to one function here.
// Inputs carry data-* attributes that app.js uses to write edits back to the character.
// Computed values are wrapped in [data-out] so they can refresh without re-rendering inputs.
import {
  computeSheet, evaluateInSheet, skillPool, refOptions, isCareerSkill, interpolate,
} from "./engine/sheet.js";

export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const attrs = (o) => Object.entries(o).filter(([, v]) => v != null && v !== false).map(([k, v]) => (v === true ? k : `${k}="${esc(v)}"`)).join(" ");
const numStr = (v) => (v == null || v === "" ? "" : String(v));
const show = (r) => (r?.status === "ok" ? esc(r.value) : "—");

export function renderSheet(ctx) {
  const { spec, character } = ctx;
  ctx.sheet = computeSheet(spec, character);
  const sections = (spec.layout ?? []).map((sec) => {
    const fn = WIDGETS[sec.type];
    if (!fn) return panel(sec, `<p class="error">Unknown section type “${esc(sec.type)}”.</p>`);
    return fn(ctx, sec);
  });
  const header = sections.shift() ?? "";
  return { header, body: sections.join("") + problems(ctx) };
}

/** Re-render only computed outputs (after typing). */
export function refreshOutputs(ctx, root) {
  ctx.sheet = computeSheet(ctx.spec, ctx.character);
  for (const el of root.querySelectorAll("[data-out]")) {
    const html = OUTPUTS[el.dataset.out.split(":")[0]]?.(ctx, ...el.dataset.out.split(":").slice(1));
    if (html != null && el.innerHTML !== html) el.innerHTML = html;
  }
  const p = root.querySelector("[data-problems]");
  const html = problems(ctx);
  if (p) p.outerHTML = html || '<div data-problems hidden></div>';
}

function panel(sec, inner, title) {
  const span = sec.span ?? (sec.type === "skills" || sec.type === "header" ? "full" : "half");
  return `<section class="panel span-${esc(span)}">${title ? `<h2>${esc(title)}</h2>` : ""}${inner}</section>`;
}

// ---------- field inputs ----------

function fieldInput(ctx, fieldId, extra = {}) {
  const f = ctx.spec.fields?.[fieldId] ?? { type: "text", label: fieldId };
  const v = ctx.character[fieldId];
  if (f.type === "ref") {
    const opts = refOptions(ctx.spec, ctx.character, fieldId);
    const dependsOn = /\{(\w+)\}/.exec(f.options ?? "")?.[1];
    const disabled = !opts.length;
    const hint = disabled && dependsOn ? `Choose ${ctx.spec.fields?.[dependsOn]?.label ?? dependsOn} first` : "Choose…";
    return `<select ${attrs({ "data-field": fieldId, id: `f-${fieldId}`, disabled, ...extra })}><option value="">${esc(hint)}</option>${opts.map((o) => `<option value="${esc(o.id)}" ${o.id === v ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`;
  }
  if (f.type === "longtext") return `<textarea ${attrs({ "data-field": fieldId, id: `f-${fieldId}`, ...extra })}>${esc(v)}</textarea>`;
  return `<input ${attrs({ "data-field": fieldId, id: `f-${fieldId}`, value: f.type === "number" ? numStr(v) : (v ?? ""), inputmode: f.type === "number" ? "numeric" : null, ...extra })}>`;
}

const label = (ctx, id) => ctx.spec.fields?.[id]?.label ?? ctx.spec.derived?.[id]?.label ?? id;

/** A small stat box: derived values are read-only outputs, fields are inputs. */
function statBox(ctx, id) {
  if (ctx.spec.derived?.[id]) return `<div><output data-out="derived:${esc(id)}">${show(ctx.sheet.derived[id])}</output><small>${esc(label(ctx, id))}</small></div>`;
  return `<div>${fieldInput(ctx, id, { "aria-label": label(ctx, id) })}<small>${esc(label(ctx, id))}</small></div>`;
}

// ---------- dice ----------

function dice(ctx, pool) {
  const out = [];
  for (const [die, n] of Object.entries(pool ?? {})) {
    const d = ctx.spec.dice?.[die] ?? {};
    for (let i = 0; i < n; i++) out.push(`<i class="die die-${esc(d.shape ?? "circle")}" style="--die:${esc(d.color ?? "#888")}" title="${esc(d.label ?? die)}"></i>`);
  }
  const total = Object.entries(pool ?? {}).map(([die, n]) => (n ? `${n} ${ctx.spec.dice?.[die]?.label ?? die}` : "")).filter(Boolean).join(", ");
  return `<span class="sr">${esc(total || "No dice")}</span>${out.join("")}`;
}

// ---------- widgets ----------

const WIDGETS = {
  header(ctx, sec) {
    const [nameId, ...rest] = sec.fields ?? [];
    const name = nameId ? `<h1>${fieldInput(ctx, nameId, { placeholder: label(ctx, nameId), "aria-label": label(ctx, nameId), autocomplete: "off" })}</h1>` : "";
    const ids = rest.map((id) => `<span><label for="f-${esc(id)}">${esc(label(ctx, id))}</label>${fieldInput(ctx, id)}</span>`).join("");
    const badges = (sec.badges ?? []).map((id) => statBox(ctx, id)).join("");
    return `<div>${name}<div class="ids">${ids}</div></div><div class="xp">${badges}</div>`;
  },

  characteristics(ctx, sec) {
    const list = ctx.spec.characteristics ?? [];
    const inner = `<div class="chars" style="--n:${list.length}">${list.map((c) => `<div class="ch"><div class="dial"><input ${attrs({ "data-char": c.id, value: numStr(ctx.character.characteristics?.[c.id]), inputmode: "numeric", "aria-label": c.label })}></div><span>${esc(c.label)}</span></div>`).join("")}</div>`;
    return panel(sec, inner, sec.label ?? "Characteristics");
  },

  trackers(ctx, sec) {
    const gauges = (ctx.spec.trackers ?? []).map((t) => `<div class="g"><b>${esc(t.label)}</b><div data-out="tracker:${esc(t.id)}" class="tw">${OUTPUTS.tracker(ctx, t.id)}</div><span class="ctl"><button class="btn" ${attrs({ "data-tracker": t.id, "data-d": -1, "aria-label": `${t.label} down` })}>−</button><span class="n" data-out="trackerN:${esc(t.id)}">${OUTPUTS.trackerN(ctx, t.id)}</span><button class="btn" ${attrs({ "data-tracker": t.id, "data-d": 1, "aria-label": `${t.label} up` })}>+</button></span></div>`).join("");
    const extra = sec.extra?.length ? `<div class="mini">${sec.extra.map((id) => statBox(ctx, id)).join("")}</div>` : "";
    return panel(sec, `<div class="gauges">${gauges}</div>${extra}`, sec.label ?? "Trackers");
  },

  skills(ctx, sec) {
    const { spec, character } = ctx;
    const max = spec.skillMaxRank ?? 5;
    const abbr = Object.fromEntries((spec.characteristics ?? []).map((c) => [c.id, c.abbr ?? c.label]));
    const row = (s) => {
      const r = character.skills?.[s.id] ?? 0;
      return `<div class="sk"><input type="checkbox" class="car" ${attrs({ "data-career": s.id, checked: isCareerSkill(spec, character, s.id), "aria-label": `${s.label} is a career skill` })}>
        <span class="nm">${esc(s.label)}<em>${esc(abbr[s.characteristic] ?? "")}</em></span>
        <span class="pips">${Array.from({ length: max }, (_, i) => `<button ${attrs({ "data-rank": s.id, "data-r": i + 1, class: i < r ? "on" : null, "aria-label": `${s.label} rank ${i + 1}`, "aria-pressed": String(i < r) })}></button>`).join("")}</span>
        <span class="pool" data-out="pool:${esc(s.id)}">${OUTPUTS.pool(ctx, s.id)}</span></div>`;
    };
    const groupHtml = (g) => `<div class="grp">${esc(g)}</div>` + (spec.skills ?? []).filter((s) => s.group === g).map(row).join("");
    const columns = sec.columns ?? [spec.skillGroups ?? []];
    const usedDice = Object.keys(spec.skillRoll ?? {});
    const key = `<div class="key">${spec.careerSkills ? '<span><input type="checkbox" class="car" checked disabled aria-hidden="true">career skill</span>' : ""}${usedDice.map((d) => `<span>${dice(ctx, { [d]: 1 }).replace(/<span class="sr">.*?<\/span>/, "")}${esc(spec.dice?.[d]?.label ?? d)}</span>`).join("")}</div>`;
    const inner = `<div class="head"><h2>${esc(sec.label ?? "Skills")}</h2>${key}</div><div class="skills" style="--cols:${columns.length}">${columns.map((col) => `<div>${col.map(groupHtml).join("")}</div>`).join("")}</div>`;
    return panel(sec, inner);
  },

  list(ctx, sec) {
    const def = ctx.spec.lists?.[sec.list];
    if (!def) return panel(sec, `<p class="error">No list “${esc(sec.list)}” in the spec.</p>`);
    const items = ctx.character.lists?.[sec.list] ?? [];
    const body = def.display === "cards" ? cards(ctx, sec.list, def, items) : table(ctx, sec.list, def, items);
    const singular = def.itemLabel ?? def.fields?.find((f) => f.role === "title")?.label ?? def.fields?.[0]?.label ?? "item";
    const meter = def.meter ? `<div class="meter" data-out="meter:${esc(sec.list)}" aria-live="polite">${OUTPUTS.meter(ctx, sec.list)}</div>` : "";
    return panel(sec, `${body}<button class="add" data-add="${esc(sec.list)}">Add ${esc(singular.toLowerCase())}</button>${meter}`, sec.label ?? def.label);
  },

  notes(ctx, sec) {
    const ids = sec.fields ?? ["notes"];
    const inner = `<div class="notes">${ids.map((id) => `<div><label for="f-${esc(id)}">${esc(label(ctx, id))}</label>${fieldInput(ctx, id, { class: "big" })}</div>`).join("")}</div>`;
    return panel(sec, inner);
  },
};

function itemInput(ctx, listId, i, f, item, extra = {}) {
  const v = item[f.id];
  const base = { "data-list": listId, "data-i": i, "data-f": f.id, "aria-label": `${f.label} ${i + 1}`, ...extra };
  if (f.type === "bool") return `<input type="checkbox" ${attrs({ ...base, checked: !!v })}>`;
  if (f.type === "longtext") return `<textarea class="te" ${attrs({ ...base, placeholder: f.label })}>${esc(v)}</textarea>`;
  if (f.type === "skillRef") {
    const opts = ctx.spec.skills ?? [];
    return `<select ${attrs(base)}><option value="">Skill…</option>${opts.map((s) => `<option value="${esc(s.id)}" ${s.id === v ? "selected" : ""}>${esc(s.label)}</option>`).join("")}</select>`;
  }
  const list = f.options ? `opt-${listId}-${f.id}` : null;
  return `<input ${attrs({ ...base, value: f.type === "number" ? numStr(v) : (v ?? ""), inputmode: f.type === "number" ? "numeric" : null, list })}>`;
}

function datalists(listId, def) {
  return def.fields.filter((f) => f.options).map((f) => `<datalist id="opt-${esc(listId)}-${esc(f.id)}">${f.options.map((o) => `<option value="${esc(o)}">`).join("")}</datalist>`).join("");
}

function cards(ctx, listId, def, items) {
  if (!items.length) return `<p class="empty">None yet.</p>${datalists(listId, def)}`;
  const fields = def.fields ?? [];
  return `<div class="tl">${items.map((item, i) => {
    const title = fields.find((f) => f.role === "title");
    const badges = fields.filter((f) => f.role === "badge");
    const stats = fields.filter((f) => f.role === "stat");
    const rest = fields.filter((f) => !f.role);
    const head = `<div class="th">${title ? itemInput(ctx, listId, i, title, item, { class: "tn", placeholder: title.label }) : ""}${badges.map((f) => `<label>${esc(f.label)} ${itemInput(ctx, listId, i, f, item, { class: "num" })}</label>`).join("")}<button class="del" ${attrs({ "data-del": listId, "data-i": i, "aria-label": `Remove ${item[title?.id] || `${title?.label ?? "item"} ${i + 1}`}` })}>×</button></div>`;
    const restHtml = rest.map((f) => {
      if (f.type === "longtext") return itemInput(ctx, listId, i, f, item);
      const roll = f.type === "skillRef" && f.showRoll ? `<span class="pool" data-out="itemPool:${esc(listId)}:${i}:${esc(f.id)}">${OUTPUTS.itemPool(ctx, listId, i, f.id)}</span>` : "";
      return `<div class="row">${esc(f.label)} ${itemInput(ctx, listId, i, f, item)}${roll}</div>`;
    });
    // Keep the skill/roll row right under the title, like the reference sheet.
    const firstRef = rest.findIndex((f) => f.type === "skillRef");
    const before = firstRef >= 0 ? restHtml.splice(firstRef, 1) : [];
    const statsHtml = stats.length ? `<div class="stats">${stats.map((f) => `<label>${esc(f.label)}${itemInput(ctx, listId, i, f, item)}</label>`).join("")}</div>` : "";
    return `<div class="tc">${head}${before.join("")}${statsHtml}${restHtml.join("")}</div>`;
  }).join("")}</div>${datalists(listId, def)}`;
}

function table(ctx, listId, def, items) {
  const cols = (def.fields ?? []).filter((f) => f.type !== "longtext");
  const subs = (def.fields ?? []).filter((f) => f.type === "longtext");
  if (!items.length) return `<p class="empty">None yet.</p>${datalists(listId, def)}`;
  const rows = items.map((item, i) => {
    const main = `<tr class="${subs.length ? "has-sub" : ""}">${cols.map((f) => `<td>${itemInput(ctx, listId, i, f, item, { class: f.type === "number" ? "num" : null })}</td>`).join("")}<td><button class="del" ${attrs({ "data-del": listId, "data-i": i, "aria-label": `Remove row ${i + 1}` })}>×</button></td></tr>`;
    const sub = subs.map((f) => `<tr class="sub"><td colspan="${cols.length + 1}">${itemInput(ctx, listId, i, f, item)}</td></tr>`).join("");
    return main + sub;
  }).join("");
  return `<div class="scroll"><table><thead><tr>${cols.map((f) => `<th>${esc(f.label)}</th>`).join("")}<th></th></tr></thead><tbody>${rows}</tbody></table></div>${datalists(listId, def)}`;
}

// ---------- computed outputs ----------

const OUTPUTS = {
  derived: (ctx, id) => show(ctx.sheet.derived[id]),
  pool: (ctx, skillId) => dice(ctx, skillPool(ctx.spec, ctx.character, skillId)),
  itemPool(ctx, listId, i, fieldId) {
    const skillId = ctx.character.lists?.[listId]?.[i]?.[fieldId];
    return skillId ? dice(ctx, skillPool(ctx.spec, ctx.character, skillId)) : "";
  },
  tracker(ctx, id) {
    const t = ctx.spec.trackers.find((x) => x.id === id);
    const max = evaluateInSheet(ctx.sheet, t.max);
    const cur = ctx.character.trackers?.[id] ?? 0;
    const n = max.status === "ok" ? Math.max(1, Math.min(60, max.value)) : 10;
    return `<div class="bar" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i class="${i < cur ? "on" : ""}"></i>`).join("")}</div>`;
  },
  trackerN(ctx, id) {
    const t = ctx.spec.trackers.find((x) => x.id === id);
    return `${esc(ctx.character.trackers?.[id] ?? 0)} / ${show(evaluateInSheet(ctx.sheet, t.max))}`;
  },
  meter(ctx, listId) {
    const m = ctx.spec.lists[listId].meter;
    const v = evaluateInSheet(ctx.sheet, m.value);
    const mx = evaluateInSheet(ctx.sheet, m.max);
    const ok = v.status === "ok" && mx.status === "ok";
    const over = ok && v.value > mx.value;
    const pct = ok ? Math.min(100, mx.value ? (v.value / mx.value) * 100 : 100) : 0;
    const msg = over && m.overNote ? `<span class="warn">${esc(interpolate(m.overNote, ctx.sheet))}</span> ` : "";
    return `<div class="mrow"><b>${esc(m.label)}</b><span class="n">${show(v)} / ${show(mx)}</span></div><div class="mbar"><i class="${over ? "over" : ""}" style="width:${pct}%"></i></div><p class="note">${msg}${esc(m.note ?? "")}</p>`;
  },
};

function problems(ctx) {
  const errs = ctx.sheet.errors;
  if (!errs.length) return "";
  return `<section class="panel span-full problems" data-problems><h2>Formula problems</h2><p class="note">The system spec has formulas that didn’t evaluate. These values show as “—”.</p><ul>${errs.map((e) => `<li><b>${esc(e.where)}</b>${e.formula ? ` <code>${esc(e.formula)}</code>` : ""}: ${esc(e.error)}</li>`).join("")}</ul></section>`;
}
