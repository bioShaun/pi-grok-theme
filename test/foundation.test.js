/**
 * foundation.test.js — v0.4 Adaptive Chrome foundation
 *
 * Covers the three foundation pieces before any rendering is migrated:
 * 1. glyphs.ts — one capability-aware vocabulary, explicit visible widths;
 * 2. chrome-theme.ts — the single styling adapter (theme + shim backends);
 * 3. status.ts — semantic activity badge without embedded ANSI.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  MODERN_GLYPHS,
  LEGACY_GLYPHS,
  MODERN_SPINNER_FRAMES,
  LEGACY_SPINNER_FRAMES,
  detectGlyphMode,
  getGlyphs,
} from "../glyphs.ts";
import { createChromeTheme } from "../chrome-theme.ts";
import { ANSI_COLORS, WorkingStateController } from "../status.ts";
import { visibleWidth } from "../footer.ts";

// ---------------------------------------------------------------------------
// Glyph vocabulary
// ---------------------------------------------------------------------------

/**
 * Explicit expected visible widths, pinned so accidental glyph swaps that
 * change chrome layout are caught. Everything is one column except the
 * brand mark (⚡ is width 2 in pi-tui).
 */
const EXPECTED_GLYPH_WIDTHS = {
  workingDot: 1,
  idleDot: 1,
  thinkingMark: 1,
  branchMark: 1,
  tokenArrow: 1,
  disclosureArrow: 1,
  folderMark: 2, // modern 📁; legacy folderMark is width 1
  brandMark: 2, // modern; legacy brandMark is width 1
};

test("glyph vocabulary covers every v0.4 spec key in both modes", () => {
  for (const key of [
    "workingDot",
    "idleDot",
    "thinkingMark",
    "branchMark",
    "tokenArrow",
    "brandMark",
    "disclosureArrow",
    "folderMark",
    "spinnerFrames",
  ]) {
    for (const [mode, set] of [["modern", MODERN_GLYPHS], ["legacy", LEGACY_GLYPHS]]) {
      assert.ok(key in set, `${mode} glyph set must define ${key}`);
      if (key !== "spinnerFrames") {
        const glyph = set[key];
        assert.ok(typeof glyph === "string" && glyph.length > 0, `${mode}.${key} must be a non-empty glyph`);
      }
    }
  }
});

test("modern and legacy fixed-width glyphs have explicit visible widths", () => {
  for (const [mode, set] of [["modern", MODERN_GLYPHS], ["legacy", LEGACY_GLYPHS]]) {
    for (const [key, expected] of Object.entries(EXPECTED_GLYPH_WIDTHS)) {
      if ((key === "brandMark" || key === "folderMark") && mode === "legacy") {
        assert.equal(visibleWidth(set[key]), 1, `legacy ${key} is ASCII width 1`);
        continue;
      }
      assert.equal(
        visibleWidth(set[key]),
        expected,
        `${mode}.${key} must be exactly ${expected} visible column(s)`,
      );
    }
  }
});

test("spinner frames: spec frames at the correct cadence vocabulary, one column each", () => {
  assert.deepEqual(
    [...MODERN_SPINNER_FRAMES],
    ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧"],
    "modern spinner must use the spec Braille frames",
  );
  assert.deepEqual([...LEGACY_SPINNER_FRAMES], ["|", "/", "-", "\\"], "legacy spinner must use ASCII frames");

  for (const frame of MODERN_GLYPHS.spinnerFrames) {
    assert.equal(visibleWidth(frame), 1, `modern frame ${JSON.stringify(frame)} must be exactly 1 column`);
  }
  for (const frame of LEGACY_GLYPHS.spinnerFrames) {
    assert.equal(visibleWidth(frame), 1, `legacy frame ${JSON.stringify(frame)} must be exactly 1 column`);
  }
});

test("token arrow falls back per spec: modern ⇣, legacy ↓", () => {
  assert.equal(MODERN_GLYPHS.tokenArrow, "⇣");
  assert.equal(LEGACY_GLYPHS.tokenArrow, "↓");
});

test("glyph mode selection: env override beats win32 auto-detection", () => {
  const baseEnv = { TERM: "dumb" };

  // Non-Windows defaults to modern regardless of terminal.
  assert.equal(detectGlyphMode(baseEnv, "linux"), "modern");

  // win32 auto-detection.
  assert.equal(detectGlyphMode(baseEnv, "win32"), "legacy", "unknown win32 terminal is legacy");
  assert.equal(detectGlyphMode({ WT_SESSION: "abc" }, "win32"), "modern", "Windows Terminal is modern");
  assert.equal(detectGlyphMode({ WT_PROFILE_ID: "x" }, "win32"), "modern");
  assert.equal(detectGlyphMode({ TERM_PROGRAM: "vscode" }, "win32"), "modern", "VS Code terminal is modern");

  // Explicit overrides win.
  assert.equal(detectGlyphMode({ ...baseEnv, PI_GROK_LEGACY_GLYPHS: "1" }, "linux"), "legacy");
  assert.equal(detectGlyphMode({ ...baseEnv, PI_GROK_LEGACY_GLYPHS: "0" }, "win32"), "modern");
  assert.equal(detectGlyphMode({ ...baseEnv, PI_GROK_LEGACY_GLYPHS: "1" }, "win32"), "legacy");

  // getGlyphs honors an explicit mode and defaults to detection.
  assert.equal(getGlyphs("legacy"), LEGACY_GLYPHS);
  assert.equal(getGlyphs("modern"), MODERN_GLYPHS);
  assert.equal(getGlyphs(detectGlyphMode({ PI_GROK_LEGACY_GLYPHS: "1" }, "linux")), LEGACY_GLYPHS);
});

// ---------------------------------------------------------------------------
// Chrome theme adapter
// ---------------------------------------------------------------------------

/** Minimal Theme double recording fg/bold calls. */
function fakeTheme() {
  const calls = [];
  return {
    calls,
    fg(color, text) {
      calls.push(["fg", color, text]);
      return `<${color}>${text}\x1b[39m`;
    },
    bold(text) {
      calls.push(["bold", text]);
      return `<b>${text}</b>`;
    },
    getFgAnsi(color) {
      calls.push(["getFgAnsi", color]);
      return `<ansi:${color}>`;
    },
  };
}

test("theme-backed adapter maps tones to semantic Pi theme tokens", () => {
  const theme = fakeTheme();
  const chrome = createChromeTheme(/** @type {any} */ (theme));

  assert.equal(chrome.theme, theme);
  assert.equal(chrome.fg("muted", "hello"), "<muted>hello\x1b[39m");
  assert.equal(chrome.fg("thinking", "x"), "<thinkingText>x\x1b[39m");
  assert.equal(chrome.fg("accent", "y"), "<accent>y\x1b[39m");
  assert.equal(chrome.fg("warning", "z"), "<warning>z\x1b[39m");
  assert.equal(chrome.bold("go"), "<b>go</b>");

  // Semantic token mapping per spec §4.1.
  assert.deepEqual(
    theme.calls.map(([op, color]) => (op === "bold" ? ["bold", undefined] : [op, color])),
    [
      ["fg", "muted"],
      ["fg", "thinkingText"],
      ["fg", "accent"],
      ["fg", "warning"],
      ["bold", undefined],
    ],
  );

  assert.equal(chrome.fgOpen("error"), "<ansi:error>");
  assert.equal(chrome.fgClose(), "\x1b[39m", "adapter owns the reset");
});

test("adapter degrades to unstyled instead of crashing on a broken theme", () => {
  const brokenTheme = {
    fg() {
      throw new Error("Unknown theme color");
    },
    bold() {
      throw new Error("boom");
    },
    getFgAnsi() {
      throw new Error("Unknown theme color");
    },
  };
  const chrome = createChromeTheme(/** @type {any} */ (brokenTheme));
  assert.equal(chrome.fg("accent", "safe"), "safe");
  assert.equal(chrome.bold("safe"), "safe");
  assert.equal(chrome.fgOpen("accent"), "");
});

test("shim backend (no theme) reproduces the v0.3 ANSI palette", () => {
  const chrome = createChromeTheme(null);
  assert.equal(chrome.theme, null);

  assert.equal(chrome.fg("muted", "x"), `${ANSI_COLORS.muted}x${ANSI_COLORS.reset}`);
  assert.equal(chrome.fg("text", "y"), `${ANSI_COLORS.fg}y${ANSI_COLORS.reset}`);
  assert.equal(chrome.fg("dim", "s"), `${ANSI_COLORS.dim}s${ANSI_COLORS.reset}`);
  assert.equal(chrome.fgOpen("warning"), ANSI_COLORS.amber);
  assert.equal(chrome.fgClose(), ANSI_COLORS.reset);
  assert.equal(chrome.bold("b"), `${ANSI_COLORS.bold}b${ANSI_COLORS.reset}`);
});

// ---------------------------------------------------------------------------
// Semantic status badge
// ---------------------------------------------------------------------------

test("status badge is semantic: state, tone, icon, label, phase and turn time", () => {
  const ctrl = new WorkingStateController();

  const idle = ctrl.getBadge();
  assert.equal(idle.state, "idle");
  assert.equal(idle.tone, "muted");
  assert.equal(idle.icon, "idleDot");
  assert.equal(idle.label, "idle");
  assert.equal(idle.phaseElapsedMs, undefined);
  assert.equal(idle.turnElapsedMs, undefined);
  for (const field of ["formattedText", "rawText"]) {
    assert.equal(typeof idle[field], "string", `idle badge keeps shim field ${field}`);
  }

  const t0 = 1_000_000;
  ctrl.startTurn(t0);
  const badge = ctrl.getBadge(t0 + 5_000);
  assert.equal(badge.state, "thinking");
  assert.equal(badge.tone, "thinking");
  assert.equal(badge.icon, "workingDot");
  assert.equal(badge.phaseElapsedMs, 5_000);
  assert.equal(badge.turnElapsedMs, 5_000);
  assert.ok(badge.label.startsWith("thinking"));
  assert.ok(!badge.label.includes("\x1b"), "semantic label carries no ANSI");

  // Semantic fields stay ANSI-free across every active state.
  const probes = [
    (c) => c.startStreaming(),
    (c) => c.startTool("bash"),
    (c) => c.endTool(),
  ];
  for (const step of probes) {
    step(ctrl);
    const b = ctrl.getBadge(t0 + 6_000);
    assert.equal(typeof b.state, "string");
    assert.equal(typeof b.tone, "string");
    assert.ok(!JSON.stringify({ s: b.state, t: b.tone, l: b.label, i: b.icon }).includes("\\u001b"));
  }

  // Tool running maps to the warning tone.
  ctrl.startTool("bash", t0 + 7_000);
  assert.equal(ctrl.getBadge(t0 + 7_500).tone, "warning");
  assert.equal(ctrl.getBadge(t0 + 7_500).state, "running_tool");
  ctrl.endTurn();
});

test("phase clock resets on state transitions; repeated streaming updates do not reset it", () => {
  const ctrl = new WorkingStateController();
  const t0 = 2_000_000;

  ctrl.startTurn(t0);
  assert.equal(ctrl.getBadge(t0 + 1_000).phaseElapsedMs, 1_000);

  ctrl.startThinking(t0 + 1_500); // same state: no phase reset
  assert.equal(ctrl.getBadge(t0 + 2_000).phaseElapsedMs, 2_000);

  ctrl.startStreaming(t0 + 2_500); // thinking -> streaming: phase reset
  assert.equal(ctrl.getBadge(t0 + 3_000).phaseElapsedMs, 500);
  assert.equal(ctrl.getBadge(t0 + 3_000).turnElapsedMs, 3_000, "turn clock is continuous");

  ctrl.startStreaming(t0 + 3_200); // repeated update: no reset
  assert.equal(ctrl.getBadge(t0 + 3_500).phaseElapsedMs, 1_000);

  ctrl.startTool("bash", t0 + 4_000); // -> running_tool: phase reset
  assert.equal(ctrl.getBadge(t0 + 4_500).phaseElapsedMs, 500);

  ctrl.endTool(undefined, t0 + 5_000); // -> working: phase reset
  assert.equal(ctrl.getBadge(t0 + 5_500).phaseElapsedMs, 500);
  assert.equal(ctrl.getBadge(t0 + 5_500).turnElapsedMs, 5_500);

  ctrl.endTurn(t0 + 6_000);
  assert.equal(ctrl.getPhaseElapsedMs(t0 + 6_100), undefined);
  assert.equal(ctrl.getTurnElapsedMs(t0 + 6_100), undefined);
});
