/**
 * working-indicator.test.js — v0.4 Grok working animation (spec §4.2)
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  coloredSpinnerFrames,
  applyWorkingIndicator,
  restoreWorkingIndicator,
  WORKING_INDICATOR_INTERVAL_MS,
} from "../working-indicator.ts";
import { MODERN_SPINNER_FRAMES, LEGACY_SPINNER_FRAMES } from "../glyphs.ts";
import { visibleWidth } from "../footer.ts";
import { WorkingStateController } from "../status.ts";
import { renderGrokFooter, DEFAULT_FOOTER_CONFIG } from "../footer.ts";

const ACCENT_THEME = {
  name: "accent-probe",
  fg: (color, text) => (color === "accent" ? `\x1b[94m${text}\x1b[39m` : `\x1b[39m${text}\x1b[39m`),
  bold: (t) => `\x1b[1m${t}\x1b[22m`,
  getFgAnsi: (color) => (color === "accent" ? "\x1b[94m" : "\x1b[39m"),
};

const OTHER_ACCENT_THEME = {
  ...ACCENT_THEME,
  name: "other-accent",
  fg: (color, text) => (color === "accent" ? `\x1b[95m${text}\x1b[39m` : `\x1b[39m${text}\x1b[39m`),
  getFgAnsi: (color) => (color === "accent" ? "\x1b[95m" : "\x1b[39m"),
};

function indicatorCtx({ theme = ACCENT_THEME, env } = {}) {
  const calls = [];
  const ui = {
    setWorkingIndicator: (...args) => calls.push(args),
    setWorkingMessage: () => {},
    notify: () => {},
  };
  if (theme) ui.theme = theme;
  const ctx = { hasUI: true, mode: "tui", cwd: process.cwd(), ui };
  if (env) {
    process.env.PI_GROK_LEGACY_GLYPHS = env.PI_GROK_LEGACY_GLYPHS;
  }
  return {
    ctx,
    calls,
    cleanup() {
      delete process.env.PI_GROK_LEGACY_GLYPHS;
    },
  };
}

test("cadence constant matches the spec (120ms)", () => {
  assert.equal(WORKING_INDICATOR_INTERVAL_MS, 120);
});

test("supported Pi versions receive the Braille frames at the spec cadence", () => {
  const { ctx, calls, cleanup } = indicatorCtx();
  try {
    const installed = applyWorkingIndicator(ctx);
    assert.ok(installed, "indicator installs when the API exists");
    assert.equal(calls.length, 1);
    const [options] = calls[0];
    assert.equal(options.intervalMs, 120);
    assert.deepEqual(
      options.frames.map((f) => f.replace(/\x1b\[[0-9;]*m/g, "")),
      [...MODERN_SPINNER_FRAMES],
      "frames are the spec Braille set",
    );
    assert.match(options.frames[0], /\x1b\[94m/, "frames are colored with the theme accent");
  } finally {
    cleanup();
  }
});

test("every modern and legacy frame occupies exactly one visible column even when colored", () => {
  for (const theme of [ACCENT_THEME, OTHER_ACCENT_THEME, null]) {
    for (const frame of coloredSpinnerFrames(theme)) {
      assert.equal(visibleWidth(frame), 1, `colored frame ${JSON.stringify(frame)} must be 1 column`);
    }
  }
});

test("forced legacy glyph mode uses the ASCII fallback frames", () => {
  const { ctx, calls, cleanup } = indicatorCtx({ env: { PI_GROK_LEGACY_GLYPHS: "1" } });
  try {
    applyWorkingIndicator(ctx);
    const [options] = calls[0];
    assert.deepEqual(
      options.frames.map((f) => f.replace(/\x1b\[[0-9;]*m/g, "")),
      [...LEGACY_SPINNER_FRAMES],
    );
    assert.match(options.frames[0], /\x1b\[94m/, "legacy frames still carry the theme accent");
  } finally {
    cleanup();
  }
});

test("spinner frames are reapplied with the new accent after a theme change", () => {
  const { ctx, calls, cleanup } = indicatorCtx({ theme: ACCENT_THEME });
  try {
    applyWorkingIndicator(ctx); // initial theme
    ctx.ui.theme = OTHER_ACCENT_THEME;
    applyWorkingIndicator(ctx); // after switch
    assert.equal(calls.length, 2);
    assert.match(calls[0][0].frames[0], /\x1b\[94m/, "first theme accent");
    assert.match(calls[1][0].frames[0], /\x1b\[95m/, "second theme accent");
  } finally {
    cleanup();
  }
});

test("older Pi versions without the API keep v0.3 behavior without errors", () => {
  const ctx = { hasUI: true, mode: "tui", cwd: process.cwd(), ui: { setWorkingMessage: () => {} } };
  assert.equal(applyWorkingIndicator(ctx), false, "no API → no install, no throw");
  assert.doesNotThrow(() => restoreWorkingIndicator(ctx));

  const throwingCtx = {
    hasUI: true,
    mode: "tui",
    cwd: process.cwd(),
    ui: {
      setWorkingIndicator: () => {
        throw new Error("host failure");
      },
    },
  };
  assert.equal(applyWorkingIndicator(throwingCtx), false, "host errors are swallowed");
  assert.doesNotThrow(() => restoreWorkingIndicator(throwingCtx));
});

test("session shutdown restores Pi's default working indicator (no arguments)", () => {
  const { ctx, calls, cleanup } = indicatorCtx();
  try {
    applyWorkingIndicator(ctx);
    restoreWorkingIndicator(ctx);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].length, 0, "setWorkingIndicator() with no args restores the default");
  } finally {
    cleanup();
  }
});

test("the footer keeps a static marker and never renders a second animated spinner", () => {
  const ctx = {
    hasUI: true,
    mode: "tui",
    cwd: process.cwd(),
    model: { name: "claude-3.7-sonnet", id: "anthropic/claude-3.7-sonnet", contextWindow: 200000 },
    getContextUsage: () => ({ usedTokens: 48000, contextWindow: 200000, percent: 24 }),
  };
  const status = new WorkingStateController();
  status.startTurn(Date.now());

  const [row] = renderGrokFooter(ctx, status, 120, new Map(), DEFAULT_FOOTER_CONFIG, ACCENT_THEME);
  for (const frame of MODERN_SPINNER_FRAMES) {
    assert.ok(!row.includes(frame), `footer must not contain spinner frame ${frame}`);
  }
  // Deterministic: identical inputs render identical output (no animation).
  const [row2] = renderGrokFooter(ctx, status, 120, new Map(), DEFAULT_FOOTER_CONFIG, ACCENT_THEME);
  assert.equal(row, row2);
});
