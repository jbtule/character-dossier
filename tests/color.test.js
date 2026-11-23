import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { contrast, highlightTokens, textOn, SURFACES, TEXT_MIN } from "../src/color.js";

test("contrast matches known WCAG values", () => {
  assert.equal(contrast("#000000", "#ffffff").toFixed(1), "21.0");
  assert.equal(contrast("#777777", "#ffffff").toFixed(2), "4.48");
});

test("picked colors become readable highlight text in both modes", () => {
  for (const c of ["#ffff00", "#e9b81d", "#000080", "#111111", "#ffffff", "#ff00ff", "#0e6a80"]) {
    const t = highlightTokens(c);
    for (const [mode, s] of Object.entries(SURFACES)) {
      for (const bg of [s.bg, s.panel]) assert.ok(contrast(t.lead[mode], bg) >= TEXT_MIN, `${c} ${mode} on ${bg}`);
    }
  }
});

test("text on the highlight picks the better of white and ink", () => {
  assert.equal(textOn("#ffff00"), SURFACES.light.ink);
  assert.equal(textOn("#000080"), "#ffffff");
  for (const c of ["#ffff00", "#e9b81d", "#000080", "#ff00ff", "#808080"]) {
    const t = highlightTokens(c);
    for (const mode of ["light", "dark"]) {
      assert.equal(t.fill[mode], c);
      assert.ok(contrast(t.onLead[mode], c) >= 3, `${c} ${mode}`);
    }
  }
});

test("stylesheet defaults agree with the contrast rule", () => {
  const css = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const lead = css.match(/--lead:light-dark\((#\w+),(#\w+)\)/);
  const onLead = css.match(/--on-lead:light-dark\((#\w+),(#\w+)\)/);
  assert.ok(lead && onLead, "default --lead and --on-lead are declared");
  assert.equal(onLead[1], textOn(lead[1]));
  assert.equal(onLead[2], textOn(lead[2]));
});
