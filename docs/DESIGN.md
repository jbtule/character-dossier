# Design

## Goal

One engine, many games. Adding a new game should mean writing a new `system.json`, not changing engine code. Adding a character should mean writing a new character file.

## Three layers

1. **System spec** (`systems/<id>/system.json`): the rules. Characteristics, skills and which characteristic each uses, species and careers, derived values as formulas, the dice-pool rule, trackers, list definitions (weapons, talents, gear…), and the sheet layout.
2. **Character file** (any path, e.g. `local/<name>.json`): one character's data. Character files are user data and aren't stored in the repo, except the test fixture in `tests/fixtures/`. References spec entries by id (`"species": "twilek"`, `"skill": "rangedHeavy"`).
3. **Engine**: loads both, evaluates formulas, renders widgets, handles edits and saving.

## Formulas: Filtrex 3

All game logic in a spec is written as [Filtrex](https://github.com/m93a/filtrex) expressions. Filtrex is safe: a spec can't run arbitrary code, so specs can be shared.

Syntax reminders (Filtrex 3):
- Arithmetic `+ - * / ^ mod`, comparisons `== != < <= > >=`, logic `and or not`.
- Conditionals are `if x then y else z` (there is no `?:`).
- Strings are **double-quoted**; single quotes are for symbol names.
- Built-ins include `min`, `max` (variadic), `abs`, `round`, `floor`, `ceil`.
- Dots are **not** property access by default. The engine must compile with `customProp: useDotAccessOperator` so `species.woundBase` works.
- Compiled expressions don't throw at runtime; they return error values. The engine should detect and surface these (e.g. show the formula and error in a dev panel), not render them as numbers.

### Formula contexts

| Where | Context available |
|---|---|
| `derived.*.formula` | Every characteristic id; every derived id computed so far; `species` (the species object); extra function `sumOf(listId, field)` |
| `skillRoll.*` | `characteristic` (the linked characteristic's value), `rank` |
| `lists.*.itemFormulas.*` | The item's own fields (missing optional fields default to 0 / false) |
| tracker `max`, meter `value`/`max` | Same as derived |

`sumOf(listId, field)` sums a field or item formula across a list, e.g. `sumOf("gear", "effectiveEnc")`.

**Evaluation order:** item formulas first, then derived values in dependency order. Detect cycles and report them.

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
| `trackers` | Current / max bars with +/− buttons; `max` is a formula. `extra` lists small stat boxes |
| `skills` | Grouped rows: career checkbox, rank pips (1–`skillMaxRank`), dice pool |
| `list` | Renders `lists[id]` as `cards` or `table` per its `display` |
| `notes` | Free text |

List field `role` hints for cards: `title` (bold heading), `badge` (small inline label + value), `stat` (big boxed number), anything else full width. `longtext` wraps.

A list `meter` shows a bar of `value` against `max`, turning to a warning state over max, with `overNote` text (supports `{derivedId}` interpolation).

## Career skills

Derived, not stored: a skill is a career skill if it's in the character's career `skills` or specialization `skills`. Allow a per-character override list for house rules.

## Saving

Milestone 1: edits are saved to `localStorage`, keyed by character, with Export / Import JSON buttons so the character file can be downloaded and shared. Never mutate the spec at runtime.

## Look and feel

Match the hand-built reference sheet kept in `local/`: sand background, teal header, Chakra Petch for headings and numbers, Inter for text, card-style talents and weapons, light and dark themes. Themes should become a spec option later (`"theme": {...}`), but hard-code this one for milestone 1.

## Milestones

1. **Reproduce the reference sheet.** Engine + EotE spec renders a sheet matching the hand-built reference in `local/`. Tests for derived values and dice pools use `tests/fixtures/sample-character.json`.
2. **Spec validation.** JSON Schema for system and character files; friendly errors for unknown ids, bad formulas and cycles.
3. **Second system.** Write a spec for a different game (e.g. a d20 game) to find what the format can't express. Fix the format, not with special cases.
4. **XP ledger.** Use `xpCosts` formulas to price purchases and track spending.
5. **Character builder.** Create a new character from a spec: pick species/career, place free ranks, spend starting XP.

## Known EotE details the spec already handles

- Worn armor counts 3 less encumbrance (`itemFormulas.effectiveEnc`).
- Soak = Brawn + worn armor soak.
- Encumbrance threshold = 5 + Brawn; over it, add setback dice to Agility and Brawn checks.
- Strain threshold for Twi'leks is 11 + Willpower (some sources list 10; 11 matches the sheet).

## Open questions

- Should species/career data live in the system spec or in separate content packs (`systems/eote/species/*.json`)? Separate files will scale better.
- How to represent talent trees (positions, connections, tier costs) for milestone 5.
