/**
 * chrome-native.test.js — v0.4 theme-native chrome migration
 *
 * Proves footer/header/badge take foreground color from the active Pi
 * theme's semantic tokens (never the hard-coded GrokNight RGB path), that
 * theme switches recolor chrome without reinstalling it, and that the
 * named-theme cursor policy treats bundled and third-party themes
 * differently.
 *
 * The theme doubles emit valid numeric SGR sequences — pi-tui must be able
 * to strip them, otherwise width math sees phantom columns — and each fake
 * theme maps the same semantic token to a DIFFERENT SGR code so recoloring
 * is observable.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { renderGrokFooter, DEFAULT_FOOTER_CONFIG } from "../footer.ts";
import { renderHeader } from "../header.ts";
import { WorkingStateController } from "../status.ts";
import {
  applyCursorPolicy,
  resolveCursorPolicy,
  CURSOR_COLORS_BY_THEME,
} from "../cursor.ts";

/** Per-fake-theme palettes: semantic token → numeric SGR parameter. */
const FAKE_PALETTES = {
  "fake-test-theme": { accent: "94", muted: "37", warning: "93", error: "91", thinkingText: "95", dim: "90", text: "39" },
  "grok-build-coding": { accent: "94", muted: "37", warning: "93", error: "91", thinkingText: "95", dim: "90", text: "39" },
  "grok-build-day": { accent: "34", muted: "90", warning: "33", error: "31", thinkingText: "35", dim: "37", text: "30" },
  "vendor-light": { accent: "32", muted: "90", warning: "95", error: "91", thinkingText: "36", dim: "90", text: "30" },
};

/** Theme double emitting valid, strippable SGR sequences from its palette. */
function fakeTheme(name = "fake-test-theme") {
  const palette = FAKE_PALETTES[name] ?? FAKE_PALETTES["fake-test-theme"];
  return {
    name,
    fg: (color, text) => `\x1b[${palette[color] ?? "39"}m${text}\x1b[39m`,
    bg: (color, text) => `\x1b[48;5;0m${text}\x1b[49m`,
    bold: (text) => `\x1b[1m${text}\x1b[22m`,
    italic: (text) => `\x1b[3m${text}\x1b[23m`,
    underline: (text) => `\x1b[4m${text}\x1b[24m`,
    inverse: (text) => `\x1b[7m${text}\x1b[27m`,
    strikethrough: (text) => `\x1b[9m${text}\x1b[29m`,
    getFgAnsi: (color) => `\x1b[${palette[color] ?? "39"}m`,
    getBgAnsi: () => `\x1b[48;5;0m`,
  };
}

function fakeCtx(overrides = {}) {
  return {
    hasUI: true,
    mode: "tui",
    cwd: process.cwd(),
    model: { name: "claude-3.7-sonnet", id: "anthropic/claude-3.7-sonnet", contextWindow: 200000 },
    getContextUsage: () => ({ usedTokens: 48000, contextWindow: 200000, percent: 24 }),
    ...overrides,
  };
}

const GROKNIGHT_TRUECOLOR = /\x1b\[38;2;\d+;\d+;\d+m/;

// ---------------------------------------------------------------------------
// Cursor policy
// ---------------------------------------------------------------------------

test("cursor policy: bundled darks amber, day darker amber, unknown restores default", () => {
  assert.deepEqual(resolveCursorPolicy("grok-build-coding"), {
    color: "#E0AF68",
    restoreDefault: false,
  });
  assert.deepEqual(resolveCursorPolicy("grok-build"), { color: "#E0AF68", restoreDefault: false });
  assert.deepEqual(resolveCursorPolicy("grok-build-day"), { color: "#B45309", restoreDefault: false });

  // Unknown / third-party / missing theme must not adopt a bundled color.
  assert.deepEqual(resolveCursorPolicy("someone-elses-theme"), { restoreDefault: true });
  assert.deepEqual(resolveCursorPolicy(undefined), { restoreDefault: true });
  assert.deepEqual(resolveCursorPolicy(null), { restoreDefault: true });

  // Sanity: the day cursor differs from the dark cursor and both are hex.
  assert.notEqual(CURSOR_COLORS_BY_THEME["grok-build-day"], CURSOR_COLORS_BY_THEME["grok-build"]);
});

test("applyCursorPolicy emits OSC 12 for bundled themes and OSC 112 otherwise", () => {
  const written = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = (chunk) => {
    written.push(chunk.toString());
    return true;
  };

  try {
    applyCursorPolicy("grok-build-coding");
    applyCursorPolicy("grok-build");
    applyCursorPolicy("grok-build-day");
    applyCursorPolicy("someone-elses-theme");
    applyCursorPolicy(undefined);
  } finally {
    process.stdout.write = originalWrite;
  }

  assert.deepEqual(written, [
    "\x1b]12;rgb:E0/AF/68\x07",
    "\x1b]12;rgb:E0/AF/68\x07",
    "\x1b]12;rgb:B4/53/09\x07",
    "\x1b]112\x07",
    "\x1b]112\x07",
  ]);
});

// ---------------------------------------------------------------------------
// Theme-native footer
// ---------------------------------------------------------------------------

test("footer colors come from semantic theme tokens, not GrokNight RGB constants", () => {
  const theme = fakeTheme();
  const ctx = fakeCtx();
  const status = new WorkingStateController();
  status.startTurn(Date.now());
  status.startTool("bash");

  const [row] = renderGrokFooter(ctx, status, 120, new Map(), DEFAULT_FOOTER_CONFIG, theme);

  assert.match(row, /\x1b\[94m/, "branch should use the accent token");
  assert.match(row, /\x1b\[37m/, "secondary metadata should use the muted token");
  assert.match(row, /\x1b\[93m/, "running-tool badge should use the warning token");
  assert.ok(!GROKNIGHT_TRUECOLOR.test(row), `footer must not emit fixed truecolor ANSI: ${row}`);
});

test("idle footer badge uses the muted token and idle circle", () => {
  const theme = fakeTheme();
  const ctx = fakeCtx();
  const status = new WorkingStateController();

  const [row] = renderGrokFooter(ctx, status, 120, new Map(), DEFAULT_FOOTER_CONFIG, theme);
  assert.match(row, /\x1b\[37m○\x1b\[39m \x1b\[37midle/);
  assert.ok(!GROKNIGHT_TRUECOLOR.test(row));
});

test("thinking badge uses the thinkingText token", () => {
  const theme = fakeTheme();
  const ctx = fakeCtx();
  const status = new WorkingStateController();
  status.startTurn(Date.now());

  const [row] = renderGrokFooter(ctx, status, 120, new Map(), DEFAULT_FOOTER_CONFIG, theme);
  assert.match(row, /\x1b\[95m●/);
  assert.ok(!GROKNIGHT_TRUECOLOR.test(row));
});

test("switching between dark and day themes recolors chrome without reinstalling", () => {
  const ctx = fakeCtx();
  const status = new WorkingStateController();
  status.startTurn(Date.now());
  status.startTool("bash");

  const darkRow = renderGrokFooter(ctx, status, 120, new Map(), DEFAULT_FOOTER_CONFIG, fakeTheme("grok-build-coding"))[0];
  const dayRow = renderGrokFooter(ctx, status, 120, new Map(), DEFAULT_FOOTER_CONFIG, fakeTheme("grok-build-day"))[0];

  // Same content skeleton, different theme-provided styling.
  const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
  assert.notEqual(darkRow, dayRow);
  assert.equal(strip(darkRow), strip(dayRow));
  assert.match(darkRow, /\x1b\[94m/, "dark theme accent");
  assert.match(dayRow, /\x1b\[34m/, "day theme accent differs");
});

test("third-party themes keep their own semantic tokens (legibility)", () => {
  const ctx = fakeCtx();
  const status = new WorkingStateController();

  const [row] = renderGrokFooter(ctx, status, 120, new Map(), DEFAULT_FOOTER_CONFIG, fakeTheme("vendor-light"));
  assert.match(row, /\x1b\[32m/, "chrome uses the third-party theme's accent");
  assert.ok(!GROKNIGHT_TRUECOLOR.test(row));
});

test("footer without a theme falls back to the v0.3 shim palette", () => {
  const ctx = fakeCtx();
  const status = new WorkingStateController();
  status.startTurn(Date.now());
  status.startTool("bash");

  const [row] = renderGrokFooter(ctx, status, 120, new Map(), DEFAULT_FOOTER_CONFIG, undefined);
  assert.match(row, /\x1b\[38;2;\d+;\d+;\d+m/, "shim emits the v0.3 palette when no theme is available");
});

// ---------------------------------------------------------------------------
// Theme-native header
// ---------------------------------------------------------------------------

test("header colors come from semantic tokens; brand title is accent+bold", () => {
  const theme = fakeTheme();
  const ctx = fakeCtx();

  const lines = renderHeader(ctx, 80, undefined, theme);
  assert.equal(lines.length, 3);
  const all = lines.join("\n");
  assert.match(all, /\x1b\[94m/);
  assert.match(all, /\x1b\[37m/);
  assert.match(all, /\x1b\[90m/, "borders/separators use the dim token");
  assert.ok(!GROKNIGHT_TRUECOLOR.test(all), `header must not emit fixed truecolor ANSI: ${all}`);
});
