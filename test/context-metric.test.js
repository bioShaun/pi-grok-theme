/**
 * context-metric.test.js — v0.4 context pressure metric (spec §4.3)
 *
 * Covers: ⇣ token-arrow vocabulary in wide layouts, percentage-only compact
 * layouts, the 65/80/90 threshold tones, host-percent precedence, clamping,
 * missing-data behavior, and legacy glyph substitution at equal width.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  renderContextMetric,
  renderGrokFooter,
  DEFAULT_FOOTER_CONFIG,
  visibleWidth,
} from "../footer.ts";
import { WorkingStateController } from "../status.ts";
import { createChromeTheme } from "../chrome-theme.ts";
import { MODERN_GLYPHS, LEGACY_GLYPHS } from "../glyphs.ts";

/** Shim chrome with tone→SGR mapping traced via distinct valid codes. */
const TONE_SGR = { muted: "37", accent: "94", warning: "93", error: "91", dim: "90", text: "39" };
function toneChrome() {
  return createChromeTheme({
    name: "tone-probe",
    fg: (color, text) => `\x1b[${TONE_SGR[color] ?? "39"}m${text}\x1b[39m`,
    bold: (t) => `\x1b[1m${t}\x1b[22m`,
    getFgAnsi: (color) => `\x1b[${TONE_SGR[color] ?? "39"}m`,
  });
}

function metric(used, total, percent, opts = {}) {
  const { compact = false, glyphs = MODERN_GLYPHS, chrome = toneChrome() } = opts;
  return renderContextMetric(used, total, percent, compact, chrome, glyphs);
}

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

const TONES = {
  muted: (s) => s.includes("\x1b[37m"),
  accent: (s) => s.includes("\x1b[94m"),
  warning: (s) => s.includes("\x1b[93m"),
  error: (s) => s.includes("\x1b[91m"),
};

test("wide layout shows used/total/percentage with the token arrow", () => {
  const out = metric(48000, 200000, 24);
  assert.equal(stripAnsi(out), "⇣48k/200k (24%)", `got: ${out}`);
  assert.equal(visibleWidth(out), 15);
});

test("compact layout shows percentage only", () => {
  const out = metric(48000, 200000, 24, { compact: true });
  assert.equal(stripAnsi(out), "24%", `got: ${out}`);
  assert.ok(!out.includes("⇣"));
});

test("threshold tones transition at 65, 80, and 90 percent", () => {
  // < 65 → muted
  for (const p of [0, 24, 64]) {
    const out = metric(48000, 200000, p);
    assert.ok(TONES.muted(out), `${p}% must be muted, got ${out}`);
  }
  // 65–79 → accent
  for (const p of [65, 70, 79]) {
    const out = metric(48000, 200000, p);
    assert.ok(TONES.accent(out), `${p}% must be accent, got ${out}`);
  }
  // 80–89 → warning
  for (const p of [80, 85, 89]) {
    const out = metric(48000, 200000, p);
    assert.ok(TONES.warning(out), `${p}% must be warning, got ${out}`);
  }
  // >= 90 → error
  for (const p of [90, 95, 100]) {
    const out = metric(48000, 200000, p);
    assert.ok(TONES.error(out), `${p}% must be error, got ${out}`);
  }
});

test("thresholds apply to computed percentages at the same boundaries", () => {
  // 64% of 200k
  assert.ok(TONES.muted(metric(128000, 200000, undefined)));
  // 65% of 200k
  assert.ok(TONES.accent(metric(130000, 200000, undefined)));
  // 80% of 200k
  assert.ok(TONES.warning(metric(160000, 200000, undefined)));
  // 90% of 200k
  assert.ok(TONES.error(metric(180000, 200000, undefined)));
});

test("host-provided percentages take precedence over computed ones", () => {
  // 48000/200000 computes to 24%, host says 70% (e.g. it accounts for more).
  const out = metric(48000, 200000, 70);
  assert.ok(stripAnsi(out).endsWith("(70%)"), `host percent must win: ${out}`);
  assert.ok(TONES.accent(out), "70% must be accent");
});

test("computed percentages are clamped to 0–100%", () => {
  const high = metric(250000, 200000, undefined);
  assert.ok(stripAnsi(high).endsWith("(100%)"), `over-limit must clamp to 100%: ${high}`);
  assert.ok(TONES.error(high));

  const hostHigh = metric(48000, 200000, 150);
  assert.ok(stripAnsi(hostHigh).endsWith("(100%)"), `host percent above 100 must clamp: ${hostHigh}`);

  const hostLow = metric(48000, 200000, -5);
  assert.ok(stripAnsi(hostLow).endsWith("(0%)"), `negative percent must clamp to 0%: ${hostLow}`);
});

test("missing usage data produces no fabricated context segment", () => {
  assert.equal(metric(undefined, undefined, undefined), "", "no data at all → empty");
  assert.equal(metric(undefined, 200000, undefined), "", "no used tokens → empty");
  assert.equal(metric(48000, undefined, undefined), "", "no total → empty (cannot compute percent)");
  assert.equal(metric(0, 0, undefined), "", "zero total → empty");
  // ContextUsage null fields arrive normalized as undefined upstream.
  assert.equal(metric(null ?? undefined, 200000, undefined), "", "null tokens → empty");
});

test("host percentage alone still renders (no token counts required)", () => {
  const out = metric(undefined, undefined, 42);
  assert.equal(stripAnsi(out), "42%", `got: ${out}`);
  assert.ok(TONES.muted(out), "42% must be muted (below the 65% threshold)");
});

test("legacy glyph mode substitutes ↓ without changing layout width", () => {
  const modern = metric(48000, 200000, 24, { glyphs: MODERN_GLYPHS });
  const legacy = metric(48000, 200000, 24, { glyphs: LEGACY_GLYPHS });

  assert.ok(modern.includes("⇣"));
  assert.ok(legacy.includes("↓"));
  assert.ok(!legacy.includes("⇣"));
  assert.equal(visibleWidth(modern), visibleWidth(legacy), "layout width must not change");

  // Stripped text differs only in the arrow character.
  const stripArrow = (s) => s.replace(/[⇣↓]/g, "");
  assert.equal(stripArrow(modern).replace(/\x1b\[[0-9;]*m/g, ""), stripArrow(legacy).replace(/\x1b\[[0-9;]*m/g, ""));
});

test("footer integration: context uses the wide Grok notation at wide widths", () => {
  const ctx = {
    hasUI: true,
    mode: "tui",
    cwd: process.cwd(),
    model: { name: "claude-3.7-sonnet", id: "anthropic/claude-3.7-sonnet", contextWindow: 200000 },
    getContextUsage: () => ({ usedTokens: 180000, contextWindow: 200000, percent: undefined }),
  };
  const status = new WorkingStateController();
  const [row] = renderGrokFooter(ctx, status, 120, new Map(), DEFAULT_FOOTER_CONFIG, toneChrome());
  assert.match(row, /⇣180k\/200k \(90%\)/, `wide footer must carry the pressure metric: ${row}`);
  assert.match(row, /\x1b\[91m/, "90% must render in the error tone");
});

function toneProbeTheme() {
  return {
    name: "tone-probe",
    fg: (color, text) => `\x1b[${TONE_SGR[color] ?? "39"}m${text}\x1b[39m`,
    bold: (t) => `\x1b[1m${t}\x1b[22m`,
    getFgAnsi: (color) => `\x1b[${TONE_SGR[color] ?? "39"}m`,
  };
}
