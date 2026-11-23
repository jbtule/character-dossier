# Design

## Goal

One engine, many games. Adding a new game should mean writing a new `system.json`, not changing engine code. Adding a character should mean writing a new character file.

## Three layers

1. **System spec** (`systems/<id>/system.json`): the rules. Character fields, characteristics, skills and which characteristic each uses, derived values as formulas, the dice-pool rule, trackers, list definitions (weapons, talents, gear…), and the sheet layout. A spec can also carry a `disclaimer`: plain text with the game's trademark and affiliation notice, shown in the system picker and the sheet footer. Each game's owners differ, so the notice belongs to the spec, not the engine.
2. **Character file** (any path, e.g. `local/<name>.json`): one character's data. Character files are user data and aren't stored in the repo, except the test fixture in `tests/fixtures/`. Refers to spec entries by id where the spec defines them (`"skill": "rangedHeavy"`); things the spec doesn't catalog (species, career) are plain text.
3. **Engine**: loads both, evaluates formulas, renders widgets, handles edits and saving.

### Code layout

| Path | Role |
|---|---|
| `src/engine/formula.js` | Filtrex wrapper: compile cache, error values to `{ value, error }`, identifier scan for dependency order |
| `src/engine/sheet.js` | Game-agnostic logic: blank characters, item formulas, derived values, tracker maximums, dice pools. No DOM; tested in Node |
| `src/render.js` | One function per layout widget type, plus computed outputs (`data-out`) that refresh while typing |
| `src/app.js`, `src/storage.js` | System picker, saved characters, import/export, edit handling |
| `tools/build.mjs` | Builds `dist/`: copies `src/`, Filtrex and every `systems/<id>/system.json`, and writes `systems/index.json` for the picker |

Adding a game: add `systems/<id>/system.json` (its `id` must match the folder). The build picks it up and it appears in the picker. No engine changes.

### Character fields

`fields` declares the character's top-level fields: `text`, `number` or `longtext`. Number fields are available in formulas by id (unset = 0).

The spec doesn't carry catalogs of species, careers, talents or gear: the player types them in, as on a printed sheet. Values that a catalog would have supplied (like a species' wound base) are entered directly, e.g. the wound and strain thresholds are number fields.

A new character is blank: every field empty, characteristics unset, no ranks, no career skills, empty lists.

## Formulas: Filtrex 3

All game logic in a spec is written as [Filtrex](https://github.com/m93a/filtrex) expressions. Filtrex is safe: a spec can't run arbitrary code, so specs can be shared.

Syntax reminders (Filtrex 3):
- Arithmetic `+ - * / ^ mod`, comparisons `== != < <= > >=`, logic `and or not`.
- Conditionals are `if x then y else z` (there is no `?:`).
- Strings are **double-quoted**; single quotes are for symbol names.
- Built-ins include `min`, `max` (variadic), `abs`, `round`, `floor`, `ceil`.
- Dots are **not** property access by default. The engine must compile with `customProp: useDotAccessOperator` for nested values (e.g. `item.stats.soak`). The engine compiles this way.
- Compiled expressions don't throw at runtime; they return error values. The engine should detect and surface these (e.g. show the formula and error in a dev panel), not render them as numbers.

### Formula contexts

| Where | Context available |
|---|---|
| `derived.*.formula` | Every characteristic id and number field (unset = 0); every derived id computed so far; extra function `sumOf(listId, field)` |
| `skillRoll.*` | `characteristic` (the linked characteristic's value), `rank` |
| `lists.*.itemFormulas.*` | The item's own fields (missing optional fields default to 0 / false) |
| tracker `max`, meter `value`/`max` | Same as derived, plus all derived values |

`sumOf(listId, field)` sums a field or item formula across a list, e.g. `sumOf("gear", "effectiveEnc")`.

**Evaluation order:** item formulas first, then derived values in dependency order. Cycles are reported.

A formula that fails shows “—” and is listed in a “Formula problems” panel on the sheet.

### Dice pools

`skillRoll` maps die ids (from `dice`) to formulas. For EotE:
- proficiency = `min(characteristic, rank)`
- ability = `max(characteristic, rank) - min(characteristic, rank)`

Shown next to every skill, and next to any list field of type `skillRef` with `showRoll: true` (weapons).

## Widgets

The `layout` array lists sections in order. Each `type` maps to a widget:

| Type | Renders |
|---|---|
| `header` | Name (large), labeled fields in a row (species, career, specialization, player), badges (XP, credits) |
| `characteristics` | Dials |
| `trackers` | Current / max bars with +/− buttons. A tracker's maximum is either `maxField` (a number field the player types in, editable on the tracker) or `max` (a formula). `extra` lists small stat boxes |
| `skills` | Grouped rows: rank pips (1–`skillMaxRank`) and dice pool; `careerSkills: true` adds a career checkbox per skill |
| `list` | Renders `lists[id]` as `cards` or `table` per its `display` |
| `notes` | Large text areas for the `longtext` fields listed in `fields` |

Each section takes `span`: `full` or `half` (two halves share a row). `label` overrides the section heading.

Lists take `itemLabel` for the “Add …” button. List field `role` hints for cards: `title` (bold heading), `badge` (small inline label + value), `stat` (big boxed number), anything else full width. `longtext` wraps.

A list `meter` shows a bar of `value` against `max`, turning to a warning state over max, with `overNote` text (supports `{derivedId}` interpolation) and an always-shown `note`.

## Career skills

Stored on the character as `careerSkills: ["computers", …]`, ticked by the player. Without career data in the spec there's nothing to derive them from.

## Saving

Edits are saved to `localStorage` (several characters, any system), with Export / Import JSON buttons so a character file can be downloaded and shared. Imported files are filled out with any fields the spec defines that the file lacks. Never mutate the spec at runtime.

## Look and feel

Match the hand-built reference sheet kept in `local/`: sand background, teal header, Chakra Petch for headings and numbers, Inter for text, card-style talents and weapons, light and dark themes. Themes should become a spec option later (`"theme": {...}`), but hard-code this one for milestone 1.

## Milestones

1. ✅ **Reproduce the reference sheet.** Engine + EotE spec renders a sheet matching the hand-built reference in `local/`. Tests for derived values and dice pools use `tests/fixtures/sample-character.json`.
2. **Spec validation.** JSON Schema for system and character files; friendly errors for unknown ids, bad formulas and cycles.
3. **Second system.** Write a spec for a different game (e.g. a d20 game) to find what the format can't express. Fix the format, not with special cases.
4. **XP ledger.** Use `xpCosts` formulas to price purchases and track spending.
5. **Character builder.** Guided creation (free ranks, starting XP), possibly with optional content packs.

## Known EotE details the spec already handles

- Worn armor counts 3 less encumbrance (`itemFormulas.effectiveEnc`).
- Soak = Brawn + worn armor soak.
- Encumbrance threshold = 5 + Brawn; over it, add setback dice to Agility and Brawn checks.
- Wound and strain thresholds are entered by the player (species base + Brawn / Willpower).

## Deployment

GitHub Pages, built by `.github/workflows/pages.yml` on every push to `main`. The build puts all assets in `dist/v-<short sha>/` so each deploy gets fresh URLs (cache busting for modules and specs, not just the entry script); only `index.html` is at a stable URL. The footer badge shows the commit and links to the repo.

## Open questions

- Optional content packs (species, careers, talents) could later offer suggestions or fill in thresholds, without being required.
- How to represent talent trees (positions, connections, tier costs) for milestone 5.
