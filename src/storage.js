// Characters saved in this browser's localStorage. Falls back to memory if storage is blocked.
const KEY = "character-dossier:v1";

let memory = { characters: {}, current: null };
export let available = true;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) memory = JSON.parse(raw);
  } catch {
    available = false;
  }
  memory.characters ??= {};
  return memory;
}

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    available = false;
  }
}

read();

const newId = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Saved characters, most recently edited first: [{ id, character, updated }] */
export function list() {
  return Object.entries(memory.characters)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0));
}

export const get = (id) => memory.characters[id]?.character;

export function add(character) {
  const id = newId();
  memory.characters[id] = { character, updated: Date.now() };
  write();
  return id;
}

export function put(id, character) {
  memory.characters[id] = { character, updated: Date.now() };
  write();
}

export function remove(id) {
  delete memory.characters[id];
  if (memory.current === id) memory.current = null;
  write();
}

/** Small per-browser UI preferences (not part of any character). */
export const getPref = (key) => memory.prefs?.[key];
export function setPref(key, value) {
  memory.prefs = { ...memory.prefs, [key]: value };
  write();
}

export const getCurrent = () => memory.current;
export function setCurrent(id) {
  memory.current = id;
  write();
}
