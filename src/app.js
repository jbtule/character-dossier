// App shell: system picker, saved characters, import/export, and edit handling.
import { blankCharacter, blankItem, normalizeCharacter } from "./engine/sheet.js";
import { renderSheet, refreshOutputs, esc } from "./render.js";
import * as store from "./storage.js";

const $ = (s) => document.querySelector(s);
const asset = (p) => new URL(p, import.meta.url);

const state = { systems: [], specs: {}, ctx: null, currentId: null };

async function loadSystems() {
  const res = await fetch(asset("systems/index.json"));
  if (!res.ok) throw new Error(`Couldn't load the list of systems (${res.status})`);
  state.systems = await res.json();
}

async function loadSpec(id) {
  if (state.specs[id]) return state.specs[id];
  const entry = state.systems.find((s) => s.id === id);
  if (!entry) throw new Error(`Unknown system “${id}”`);
  const res = await fetch(asset(`systems/${entry.path}`));
  if (!res.ok) throw new Error(`Couldn't load the ${entry.name} spec (${res.status})`);
  return (state.specs[id] = await res.json());
}

const systemName = (id) => state.systems.find((s) => s.id === id)?.name ?? id;

// ---------- rendering ----------

function render() {
  renderToolbar();
  const header = $("#header");
  const body = $("#body");
  if (!state.ctx) {
    header.innerHTML = '<div><h1>Character Dossier</h1><p>Pick a game system to start a blank character sheet.</p></div>';
    body.innerHTML = "";
    return;
  }
  const focus = rememberFocus();
  const { header: h, body: b } = renderSheet(state.ctx);
  header.innerHTML = h;
  body.innerHTML = b;
  document.title = `${state.ctx.character.name || "New character"} · Character Dossier`;
  restoreFocus(focus);
}

function renderToolbar() {
  const all = store.list();
  const sel = $("#characters");
  sel.innerHTML = all.length
    ? all.map((c) => `<option value="${esc(c.id)}" ${c.id === state.currentId ? "selected" : ""}>${esc(c.character.name || "Unnamed")} · ${esc(systemName(c.character.system))}</option>`).join("")
    : '<option value="">No characters yet</option>';
  sel.disabled = !all.length;
  $("#export").disabled = !state.ctx;
  $("#delete").disabled = !state.ctx;
}

const FOCUS_KEYS = ["field", "char", "rank", "r", "career", "tracker", "d", "list", "i", "f", "add", "del"];
function rememberFocus() {
  const el = document.activeElement;
  if (!el || !el.dataset) return null;
  const key = FOCUS_KEYS.filter((k) => k in el.dataset).map((k) => `[data-${k}="${CSS.escape(el.dataset[k])}"]`).join("");
  if (!key) return null;
  return { key, start: el.selectionStart, end: el.selectionEnd };
}
function restoreFocus(f) {
  if (!f) return;
  const el = document.querySelector(f.key);
  if (!el) return;
  el.focus({ preventScroll: true });
  try { if (f.start != null) el.setSelectionRange(f.start, f.end); } catch { /* not a text input */ }
}

// ---------- characters ----------

async function openCharacter(id) {
  const saved = store.get(id);
  if (!saved) return;
  const spec = await loadSpec(saved.system);
  state.ctx = { spec, character: normalizeCharacter(spec, saved) };
  state.currentId = id;
  store.setCurrent(id);
  render();
}

async function newCharacter(systemId) {
  const spec = await loadSpec(systemId);
  const character = blankCharacter(spec);
  state.currentId = store.add(character);
  state.ctx = { spec, character };
  store.setCurrent(state.currentId);
  render();
  $("#f-name")?.focus();
}

const save = () => state.currentId && store.put(state.currentId, state.ctx.character);

// ---------- edits ----------

const parseNum = (v) => (v.trim() === "" ? null : Number.isNaN(+v) ? v : +v);

function onInput(e) {
  const t = e.target;
  const ctx = state.ctx;
  if (!ctx) return;
  const ch = ctx.character;
  const d = t.dataset;
  let structural = false;
  if ("field" in d) {
    const f = ctx.spec.fields?.[d.field];
    ch[d.field] = f?.type === "number" ? parseNum(t.value) : t.value;
    if (d.field === "name") renderToolbar();
  } else if ("char" in d) {
    ch.characteristics[d.char] = parseNum(t.value);
  } else if ("career" in d) {
    ch.careerSkills = ch.careerSkills.filter((id) => id !== d.career);
    if (t.checked) ch.careerSkills.push(d.career);
  } else if ("list" in d) {
    const f = ctx.spec.lists[d.list].fields.find((x) => x.id === d.f);
    const item = ch.lists[d.list][+d.i];
    item[d.f] = f.type === "bool" ? t.checked : f.type === "number" ? parseNum(t.value) : t.value;
    structural = f.type === "skillRef";
  } else return;
  save();
  if (structural) render();
  else refreshOutputs(ctx, document.body);
}

function onClick(e) {
  const b = e.target.closest("button");
  if (!b || !state.ctx) return;
  const ch = state.ctx.character;
  const d = b.dataset;
  if ("rank" in d) {
    const r = +d.r;
    ch.skills[d.rank] = (ch.skills[d.rank] ?? 0) === r ? r - 1 : r;
    if (!ch.skills[d.rank]) delete ch.skills[d.rank];
  } else if ("tracker" in d) {
    ch.trackers[d.tracker] = Math.max(0, (+ch.trackers[d.tracker] || 0) + +d.d);
  } else if ("add" in d) {
    ch.lists[d.add].push(blankItem(state.ctx.spec, d.add));
  } else if ("del" in d) {
    ch.lists[d.del].splice(+d.i, 1);
  } else return;
  save();
  render();
  if ("add" in d) {
    const items = document.querySelectorAll(`[data-list="${CSS.escape(d.add)}"][data-i="${ch.lists[d.add].length - 1}"]`);
    items[0]?.focus();
  }
}

// ---------- toolbar ----------

function showPicker({ cancellable }) {
  const dlg = $("#picker");
  $("#systems").innerHTML = state.systems.map((s) => `<button class="sys" data-system="${esc(s.id)}"><b>${esc(s.name)}</b><small>Start a blank character sheet</small></button>`).join("");
  $("#picker-cancel").hidden = !cancellable;
  dlg.dataset.cancellable = cancellable ? "1" : "";
  dlg.showModal();
}

function slug(s) {
  return String(s || "character").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "character";
}

function exportCharacter() {
  const ch = state.ctx.character;
  const blob = new Blob([JSON.stringify(ch, null, 2) + "\n"], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${slug(ch.name)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importFile(file) {
  const msg = $("#message");
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== "object" || !data.system) throw new Error("This file isn't a character: it has no “system”.");
    if (!state.systems.some((s) => s.id === data.system)) throw new Error(`This character uses the “${data.system}” system, which isn't available here.`);
    const spec = await loadSpec(data.system);
    const character = normalizeCharacter(spec, data);
    state.currentId = store.add(character);
    state.ctx = { spec, character };
    store.setCurrent(state.currentId);
    msg.textContent = "";
    render();
  } catch (err) {
    msg.textContent = `Couldn't import ${file.name}: ${err.message}`;
  }
}

function wire() {
  document.addEventListener("input", onInput);
  document.addEventListener("click", onClick);
  $("#characters").addEventListener("change", (e) => openCharacter(e.target.value));
  $("#new").addEventListener("click", () => showPicker({ cancellable: true }));
  $("#export").addEventListener("click", exportCharacter);
  $("#import").addEventListener("click", () => $("#file").click());
  $("#file").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ""; });
  $("#delete").addEventListener("click", async () => {
    const name = state.ctx.character.name || "this character";
    if (!confirm(`Delete ${name} from this browser? Export it first if you want to keep a copy.`)) return;
    store.remove(state.currentId);
    state.ctx = null;
    state.currentId = null;
    const next = store.list()[0];
    if (next) await openCharacter(next.id);
    else { render(); showPicker({ cancellable: false }); }
  });
  $("#systems").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-system]");
    if (!b) return;
    $("#picker").close();
    await newCharacter(b.dataset.system);
  });
  $("#picker-cancel").addEventListener("click", () => $("#picker").close());
  $("#picker").addEventListener("cancel", (e) => { if (!$("#picker").dataset.cancellable) e.preventDefault(); });
}

async function main() {
  wire();
  try {
    await loadSystems();
  } catch (err) {
    $("#message").textContent = err.message;
    return;
  }
  const current = store.getCurrent();
  const first = current && store.get(current) ? current : store.list()[0]?.id;
  if (first) {
    try { await openCharacter(first); } catch (err) { $("#message").textContent = err.message; render(); }
  } else {
    render();
    showPicker({ cancellable: false });
  }
  if (!store.available) $("#message").textContent = "This browser isn't saving data (private mode?). Export your character before closing the page.";
}

main();
