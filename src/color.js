// Highlight color math (WCAG 2 contrast). Turns one picked color into the sheet's accent
// tokens for light and dark mode, nudging it until text in that color stays readable and
// choosing whichever text color reads best on top of it.

// Surfaces the highlight is drawn on, per mode (keep in sync with :root in styles.css).
export const SURFACES = {
  light: { bg: "#efe6d2", panel: "#fffaf0", ink: "#1b1915" },
  dark: { bg: "#16191b", panel: "#1f2427", ink: "#1b1915" },
};
export const TEXT_MIN = 4.5; // WCAG AA for body text

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (s) => typeof s === "string" && HEX.test(s);

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

export function luminance(hex) {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Mix `a` toward `b` by t (0 = a, 1 = b), in sRGB. */
export function mix(a, b, t) {
  const [x, y] = [rgb(a), rgb(b)];
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

/** Smallest step from `color` toward `target` that reaches `min` contrast against every background. */
export function ensureContrast(color, backgrounds, target, min = TEXT_MIN) {
  for (let t = 0; t <= 1; t += 0.02) {
    const c = mix(color, target, t);
    if (backgrounds.every((bg) => contrast(c, bg) >= min)) return c;
  }
  return target;
}

/** White or ink, whichever reads better on `bg`. */
export const textOn = (bg, ink = SURFACES.light.ink) => (contrast("#ffffff", bg) >= contrast(ink, bg) ? "#ffffff" : ink);

/**
 * Accent tokens for one picked color, each { light, dark }:
 * lead (text-safe accent), lead2 (tint), fill (the picked color itself, used as a background),
 * onLead (white or ink, whichever reads best on fill).
 */
export function highlightTokens(color) {
  const out = { lead: {}, lead2: {}, fill: {}, onLead: {} };
  for (const [mode, s] of Object.entries(SURFACES)) {
    const lead = ensureContrast(color, [s.bg, s.panel], mode === "light" ? "#000000" : "#ffffff");
    out.lead[mode] = lead;
    out.lead2[mode] = mode === "light" ? mix(lead, "#ffffff", 0.82) : mix(lead, s.bg, 0.7);
    out.fill[mode] = color;
    out.onLead[mode] = textOn(color);
  }
  return out;
}
