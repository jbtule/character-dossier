// Builds the static site into dist/.
// Assets go in a folder named after the commit (dist/v-<sha>/) so every deploy gets fresh URLs:
// the browser can't serve a stale app.js, engine module or spec after an update.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { findSpecFile, loadSpecFile } from "./spec-file.mjs";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "dist");

const git = (...args) => {
  try { return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim(); } catch { return ""; }
};

const sha = process.env.GITHUB_SHA || git("rev-parse", "HEAD") || "dev";
const shortSha = sha === "dev" ? "dev" : sha.slice(0, 7);
const repoUrl = process.env.GITHUB_REPOSITORY
  ? `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${process.env.GITHUB_REPOSITORY}`
  : git("remote", "get-url", "origin").replace(/^git@github\.com:/, "https://github.com/").replace(/\.git$/, "") || "#";
const assets = `v-${shortSha}`;
const assetDir = path.join(out, assets);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(assetDir, { recursive: true });

// App and engine
for (const entry of fs.readdirSync(path.join(root, "src"))) {
  if (entry === "index.html") continue;
  fs.cpSync(path.join(root, "src", entry), path.join(assetDir, entry), { recursive: true });
}

// Filtrex (single self-contained ES module)
fs.mkdirSync(path.join(assetDir, "vendor"));
fs.copyFileSync(path.join(root, "node_modules/filtrex/dist/esm/filtrex.mjs"), path.join(assetDir, "vendor/filtrex.mjs"));

// Systems: convert each spec (TOML or JSON) to JSON and write an index for the system picker
const systems = [];
for (const id of fs.readdirSync(path.join(root, "systems")).sort()) {
  const dir = path.join(root, "systems", id);
  if (!fs.statSync(dir).isDirectory()) continue;
  const file = findSpecFile(dir);
  if (!file) continue;
  const spec = loadSpecFile(file);
  if (spec.id !== id) throw new Error(`${path.relative(root, file)} has id "${spec.id}"; it must match the folder name`);
  fs.mkdirSync(path.join(assetDir, "systems", id), { recursive: true });
  fs.writeFileSync(path.join(assetDir, "systems", id, "system.json"), JSON.stringify(spec) + "\n");
  systems.push({ id, name: spec.name, ...(spec.disclaimer && { disclaimer: spec.disclaimer }), path: `${id}/system.json` });
}
fs.writeFileSync(path.join(assetDir, "systems", "index.json"), JSON.stringify(systems, null, 2) + "\n");

// Page
const html = fs.readFileSync(path.join(root, "src/index.html"), "utf8")
  .replaceAll("%ASSETS%", assets)
  .replaceAll("%SHORT_SHA%", shortSha)
  .replaceAll("%SHA%", sha)
  .replaceAll("%REPO_URL%", repoUrl);
fs.writeFileSync(path.join(out, "index.html"), html);
fs.writeFileSync(path.join(out, ".nojekyll"), "");

console.log(`Built dist/ (${assets}, ${systems.length} system${systems.length === 1 ? "" : "s"}: ${systems.map((s) => s.id).join(", ")})`);
