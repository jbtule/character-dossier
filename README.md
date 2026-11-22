# Character Dossier

A spec-driven character sheet engine for tabletop RPGs. A **system spec** describes a game's rules. A **character file** holds one character's data. The **engine** reads both and renders an interactive sheet.

**Live:** https://tools.tuley.name/character-dossier/ (pick a system, fill in a blank sheet; characters are saved in your browser and can be exported as JSON).

Character files are user data, not part of the project. Keep your own in `local/`, which is gitignored, and load them with **Import**.

## What's here

| Path | What it is |
|---|---|
| `docs/DESIGN.md` | Architecture, spec format, formula rules, widgets, milestones |
| `systems/<id>/system.json` | System specs. Each one shows up in the system picker. Currently: Edge of the Empire |
| `src/engine/` | Game-agnostic engine (formulas, derived values, dice pools). No DOM |
| `src/` | Browser app: widgets, system picker, saving, import/export |
| `tests/` | Engine tests; `tests/fixtures/sample-character.json` is a made-up character |
| `tools/` | Build, dev server, formula checker, JSON formatter |
| `local/` | Gitignored. Your own characters and hand-built reference sheets |

## Develop

```sh
npm ci
npm test          # engine tests
npm run dev       # build to dist/ and serve at http://localhost:8080/
```

Check a spec against a character from the command line:

```sh
node tools/check-formulas.mjs systems/eote/system.json tests/fixtures/sample-character.json
```

Expected for the sample character:

| Value | Expected |
|---|---|
| Soak | 4 |
| Encumbrance | 8 / 7, over by 1 |
| Computers | 1 proficiency, 3 ability |
| Ranged (Heavy) | 2 proficiency, 1 ability |
| Astrogation | 2 proficiency, 2 ability |
| Deception (untrained) | 0 proficiency, 2 ability |

Specs are kept compact with `node tools/format-json.mjs systems/<id>/system.json`.

## CI

- **Pages:** every push to `main` runs the tests, builds, and deploys `dist/`. Assets go in a folder named after the commit SHA for cache busting; the footer badge shows the SHA and links here.
- **Test:** pull requests run the tests and build.
- **zizmor:** audits the workflows on every push and pull request; findings appear under Security → Code scanning. Run it locally with `zizmor --persona pedantic .github/`.
- **Dependabot:** weekly updates for the pinned action SHAs and npm packages.

## Working on this with Claude Code

Develop against your own character in `local/` (import it in the dev server), and compare against the hand-built reference sheet in `local/`. Keep the engine free of game-specific code: anything game-specific must come from the spec. Tests use `tests/fixtures/sample-character.json`. Keep actions pinned to commit SHAs and `zizmor --persona pedantic .github/` clean. Never commit anything from `local/`.
