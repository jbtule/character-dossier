# Character Sheet Engine — starter kit

A generic, spec-driven character sheet engine for tabletop RPGs. A **system spec** describes a game's rules. A **character file** holds one character's data. The **engine** reads both and renders an interactive sheet.

Character files are user data, not part of the project. Keep your own in `local/`, which is gitignored.

## What's here

| Path | What it is |
|---|---|
| `docs/DESIGN.md` | Architecture, spec format, formula rules, widgets, milestones |
| `systems/eote/system.json` | Edge of the Empire system spec (draft) |
| `tests/fixtures/sample-character.json` | Made-up character used by tests |
| `tools/check-formulas.mjs` | Evaluates the spec's Filtrex formulas against a character |
| `site/` | Static site deployed to GitHub Pages. For now, the hand-built mockup filled with the sample character |
| `.github/workflows/` | Pages deploy, and zizmor security audit of the workflows |
| `local/` | Gitignored. Your own characters and hand-built reference sheets |

## Check the formulas

```sh
npm i filtrex@3
node tools/check-formulas.mjs systems/eote/system.json tests/fixtures/sample-character.json
```

Expected for the sample character:

| Value | Expected |
|---|---|
| Wound threshold | 12 |
| Strain threshold | 14 |
| Soak | 4 |
| Encumbrance | 8 / 7, over by 1 |
| Computers | 1 proficiency, 3 ability |
| Ranged (Heavy) | 2 proficiency, 1 ability |
| Astrogation | 2 proficiency, 2 ability |
| Deception (untrained) | 0 proficiency, 2 ability |

## CI

- **Pages:** every push to `main` deploys `site/` to GitHub Pages.
- **zizmor:** audits the workflows on every push and pull request; findings appear under Security → Code scanning. Run it locally with `zizmor --persona pedantic .github/`.
- **Dependabot:** keeps the pinned action SHAs up to date weekly.

## Kickoff prompt for Claude Code

> Read README.md and docs/DESIGN.md. Build milestone 1: a browser app that loads a system spec and a character file and renders an interactive sheet. Use `systems/eote/system.json` with my character in `local/`, and match the hand-built reference sheet in `local/` in look and behavior. Use Filtrex for all formulas as described in the design doc. Keep the engine free of Edge of the Empire–specific code: anything game-specific must come from the spec. Add tests using `tests/fixtures/sample-character.json` that check the derived values and dice pools listed in the README. The built app should be served from `site/` so the Pages workflow deploys it; keep actions pinned to commit SHAs and keep `zizmor --persona pedantic .github/` clean. Never commit anything from `local/`.
