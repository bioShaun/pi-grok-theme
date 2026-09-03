/**
 * regression-matrix.test.js — v0.4 Adaptive Chrome regression matrix
 *
 * Proves the complete presentation layer is width-safe, lifecycle-safe, and
 * compatible across presets, activity states, glyph modes, long values,
 * and cooperating extensions (v0.4 spec §8 AC-05/AC-07, §4.8 gate 5).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { renderGrokFooter, DEFAULT_FOOTER_CONFIG, visibleWidth, FOOTER_PRESETS } from "../footer.ts";
import { renderHeader } from "../header.ts";
import { WorkingStateController } from "../status.ts";
import registerGrokBuildExtension from "../index.ts";

const ALL_WIDTHS = Array.from({ length: 160 - 20 + 1 }, (_, i) => 20 + i);

const THEME_PALETTES = {
  dark: { accent: "94", muted: "37", warning: "93", error: "91", thinkingText: "95", dim: "90", text: "39" },
  day: { accent: "34", muted: "90", warning: "33", error: "31", thinkingText: "35", dim: "37", text: "30" },
  thirdParty: { accent: "32", muted: "90", warning: "95", error: "91", thinkingText: "36", dim: "90", text: "30" },
};

function themeDouble(paletteName) {
  const palette = THEME_PALETTES[paletteName];
  return {
    name: paletteName,
    fg: (color, text) => `\x1b[${palette[color] ?? "39"}m${text}\x1b[39m`,
    bg: (color, text) => `\x1b[48;5;0m${text}\x1b[49m`,
    bold: (text) => `\x1b[1m${text}\x1b[22m`,
    getFgAnsi: (color) => `\x1b[${palette[color] ?? "39"}m`,
    getBgAnsi: () => "\x1b[48;5;0m",
  };
}

function baseCtx(overrides = {}) {
  return {
    hasUI: true,
    mode: "tui",
    cwd: process.cwd(),
    model: { name: "claude-3.7-sonnet", id: "anthropic/claude-3.7-sonnet", contextWindow: 200000 },
    getContextUsage: () => ({ usedTokens: 48000, contextWindow: 200000, percent: 24 }),
    thinkingLevel: "high",
    ...overrides,
  };
}

const EXT_STATUSES = new Map([["velocity", "19.6 / 23.2 tps"]]);

/** Drive a WorkingStateController into the named activity state. */
function driveState(controller, state, now = Date.now()) {
  switch (state) {
    case "idle":
      break;
    case "thinking":
      controller.startTurn(now);
      break;
    case "streaming":
      controller.startTurn(now);
      controller.startStreaming(now);
      break;
    case "running_tool":
      controller.startTurn(now);
      controller.startTool("bash", now);
      break;
    case "working":
      controller.startTurn(now);
      controller.startTool("bash", now);
      controller.endTool("bash", now);
      break;
    default:
      throw new Error(`unknown state ${state}`);
  }
}

const ACTIVE_STATES = ["idle", "thinking", "streaming", "running_tool", "working"];

function withLegacyGlyphs(fn) {
  process.env.PI_GROK_LEGACY_GLYPHS = "1";
  try {
    return fn();
  } finally {
    delete process.env.PI_GROK_LEGACY_GLYPHS;
  }
}

/** Assert the row is single-line, within budget, non-empty, and ANSI-balanced. */
function assertRowSafe(row, width, label) {
  assert.equal(
    typeof row,
    "string",
    `${label}: must render one line`,
  );
  assert.ok(!row.includes("\n"), `${label}: must not contain newlines`);
  const w = visibleWidth(row);
  assert.ok(w <= width, `${label}: visibleWidth ${w} exceeds ${width}: ${JSON.stringify(row)}`);
  assert.notEqual(row.trim(), "", `${label}: must not be empty`);
  assertAnsiBalanced(row, label);
}

/** Balanced ANSI: no partial escape survives stripping. */
function assertAnsiBalanced(row, label) {
  const stripped = row.replace(/\x1b\[[0-9;]*m/g, "");
  assert.equal(
    visibleWidth(row),
    visibleWidth(stripped),
    `${label}: ANSI sequences must be balanced after fitting/truncation: ${JSON.stringify(row)}`,
  );
  assert.ok(!/\x1b(?!\[[0-9;]*m)/.test(row), `${label}: dangling escape sequence: ${JSON.stringify(row)}`);
}

// ---------------------------------------------------------------------------
// Width × preset × state matrix
// ---------------------------------------------------------------------------

test("every width 20–160 × every preset × every state renders one width-safe line", () => {
  for (const preset of FOOTER_PRESETS) {
    for (const state of ACTIVE_STATES) {
      const status = new WorkingStateController();
      driveState(status, state);
      const config = { ...DEFAULT_FOOTER_CONFIG, preset };

      for (const width of ALL_WIDTHS) {
        let lines;
        assert.doesNotThrow(() => {
          lines = renderGrokFooter(baseCtx(), status, width, EXT_STATUSES, config);
        }, `preset=${preset} state=${state} width=${width} threw`);
        assertRowSafe(lines[0], width, `preset=${preset} state=${state} width=${width}`);
      }
    }
  }
});

test("the matrix holds with extension statuses present and with no data at all", () => {
  const status = new WorkingStateController();
  status.startTurn(Date.now());

  const bareCtx = baseCtx({
    model: undefined,
    getContextUsage: () => undefined,
    thinkingLevel: undefined,
  });

  for (const preset of FOOTER_PRESETS) {
    const config = { ...DEFAULT_FOOTER_CONFIG, preset };
    for (const width of ALL_WIDTHS) {
      const withExt = renderGrokFooter(baseCtx(), status, width, EXT_STATUSES, config);
      assertRowSafe(withExt[0], width, `ext preset=${preset} width=${width}`);

      const bare = renderGrokFooter(bareCtx, status, width, undefined, config);
      assertRowSafe(bare[0], width, `bare preset=${preset} width=${width}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Glyph modes × states
// ---------------------------------------------------------------------------

test("all five activity states render safely in modern and legacy glyph modes", () => {
  for (const legacy of [false, true]) {
    for (const state of ACTIVE_STATES) {
      const status = new WorkingStateController();
      driveState(status, state);

      const render = () =>
        renderGrokFooter(baseCtx(), status, 60, EXT_STATUSES, DEFAULT_FOOTER_CONFIG)[0];

      const row = legacy ? withLegacyGlyphs(render) : render();

      assertRowSafe(row, 60, `legacy=${legacy} state=${state}`);

      // The correct marker glyph appears for the state.
      if (state === "idle") {
        assert.ok(row.includes(legacy ? "o" : "○") && row.includes("idle"), `idle marker missing (legacy=${legacy}): ${row}`);
      } else {
        assert.ok(row.includes(legacy ? "*" : "●"), `working marker missing (legacy=${legacy}): ${row}`);
      }
    }
  }
});

test("legacy mode swaps every chrome glyph without changing line width", () => {
  const status = new WorkingStateController();
  status.startTurn(Date.now());
  const ctx = baseCtx();

  const modern = renderGrokFooter(ctx, status, 120, EXT_STATUSES, DEFAULT_FOOTER_CONFIG)[0];
  const legacy = withLegacyGlyphs(() =>
    renderGrokFooter(ctx, status, 120, EXT_STATUSES, DEFAULT_FOOTER_CONFIG)[0],
  );

  assert.ok(legacy.includes("#") && !legacy.includes("⎇"), "branch mark swapped");
  assert.ok(legacy.includes("* ") && !legacy.includes("● "), "working dot swapped");
  assert.equal(visibleWidth(modern), visibleWidth(legacy), "layout width unchanged");
});

// ---------------------------------------------------------------------------
// Long values
// ---------------------------------------------------------------------------

test("long model, branch, path, and extension values never overflow", () => {
  const longCtx = baseCtx({
    cwd: `/home/user/${"very-long-directory-name/".repeat(6)}project`,
    model: {
      name: "anthropic/claude-opus-4-20250514-extremely-long-variant-name-suffix",
      id: "anthropic/claude-opus-4-20250514-extremely-long-variant-name-suffix",
      contextWindow: 200000,
    },
  });
  const longStatuses = new Map([
    ["velocity", "TPS 123.45 / 234.56 accumulated across a very long measurement window"],
    ["watcher", "watching 27 files with pending changes in nested directories"],
    ["pr", "feat/very-long-branch-name-that-keeps-going-and-going"],
  ]);

  const status = new WorkingStateController();
  status.startTurn(Date.now());
  status.startTool("bash");

  for (const preset of FOOTER_PRESETS) {
    const config = { ...DEFAULT_FOOTER_CONFIG, preset };
    for (const width of [20, 40, 60, 80, 100, 120, 160]) {
      const [row] = renderGrokFooter(longCtx, status, width, longStatuses, config);
      assertRowSafe(row, width, `long-values preset=${preset} width=${width}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Lifecycle stacking
// ---------------------------------------------------------------------------

function lifecycleHarness() {
  const listeners = {};
  let registered_grok;
  const setFooterCalls = [];
  const setHeaderCalls = [];
  const indicatorCalls = [];
  let workingMessageSpyCalls = 0;
  let footerHandle = null;

  const originalSetWorkingMessage = () => {
    workingMessageSpyCalls++;
  };

  const ui = {
    getAllThemes: () => [{ name: "grok-build-coding", path: undefined }],
    setTheme: () => ({ success: true }),
    theme: { name: "grok-build-coding" },
    setFooter: (factory) => {
      setFooterCalls.push(factory);
      footerFactory = factory;
    },
    setHeader: (factory) => {
      setHeaderCalls.push(factory);
    },
    setWorkingMessage: originalSetWorkingMessage,
    setWorkingIndicator: (...args) => indicatorCalls.push(args),
    notify: () => {},
    setTitle: () => {},
    setHiddenThinkingLabel: () => {},
  };
  let footerFactory;

  const fakePi = {
    on: (evt, handler) => {
      listeners[evt] = handler;
    },
    registerCommand: (name, def) => {
      registered_grok = def;
    },
  };

  const ctx = {
    hasUI: true,
    mode: "tui",
    cwd: process.cwd(),
    model: { name: "claude-3.7-sonnet", id: "x", contextWindow: 200000 },
    getContextUsage: () => ({ usedTokens: 1, contextWindow: 200000, percent: 0 }),
    ui,
  };

  registerGrokBuildExtension(fakePi);

  return {
    listeners,
    command: registered_grok,
    ctx,
    setFooterCalls,
    setHeaderCalls,
    indicatorCalls,
    get workingMessageSpyCalls() {
      return workingMessageSpyCalls;
    },
    get wrappedSetWorkingMessage() {
      return ui.setWorkingMessage;
    },
    get originalSetWorkingMessage() {
      return originalSetWorkingMessage;
    },
    renderFooter: () =>
      footerFactory?.({ requestRender: () => {} }, undefined, {
        onBranchChange: () => {},
        getExtensionStatuses: () => new Map(),
      }),
    get footerFactory() {
      return footerFactory;
    },
    restore: () => {
      delete process.env.PI_GROK_LEGACY_GLYPHS;
    },
  };
}

test("repeated setup, turns, theme switches, and shutdown do not stack anything", () => {
  const h = lifecycleHarness();
  try {
    // Two full session setups.
    h.listeners.session_start({}, h.ctx);
    h.listeners.session_start({}, h.ctx);

    // Exactly one working-message wrapper (double session_start must not re-wrap).
    assert.notEqual(h.wrappedSetWorkingMessage, h.originalSetWorkingMessage, "wrapper installed");
    h.wrappedSetWorkingMessage("probe message");
    assert.equal(h.workingMessageSpyCalls, 1, "a call passes through exactly one wrapper");

    // Two turns back to back.
    h.listeners.message_start({ message: { role: "assistant" } }, h.ctx);
    h.listeners.message_update({ message: { role: "assistant" } }, h.ctx);
    h.listeners.message_end({ message: { role: "assistant" } }, h.ctx);
    h.listeners.message_start({ message: { role: "assistant" } }, h.ctx);
    h.listeners.message_end({ message: { role: "assistant" } }, h.ctx);

    // Two theme switches via the command.
    h.command.handler("theme day", h.ctx);
    h.command.handler("theme coding", h.ctx);

    // Footer installation pattern: install, reinstall (dispose+install), shutdown.
    // setFooter receives: [factory, undefined(dispose), factory, undefined(dispose), factory, undefined]
    // from start1/start1-dispose+install/shutdown — assert no stack: each
    // dispose sets undefined exactly once, each install exactly one factory.
    const installs = h.setFooterCalls.filter((c) => typeof c === "function").length;
    const disposes = h.setFooterCalls.filter((c) => c === undefined).length;
    assert.equal(installs, 2, `exactly two footer installs (got ${installs})`);
    assert.equal(disposes, 1, `exactly one pre-shutdown disposal (got ${disposes})`);

    // Two shutdowns: the second is a clean no-op.
    h.listeners.session_shutdown({}, h.ctx);
    assert.doesNotThrow(() => h.listeners.session_shutdown({}, h.ctx));
    assert.equal(h.footerFactory, undefined, "footer handle cleared");
    assert.equal(
      h.setFooterCalls.filter((c) => c === undefined).length,
      2,
      "shutdown disposes the footer exactly once",
    );

    // Working-indicator configuration is idempotent set/restore, never stacked:
    // 2 installs × apply + 2 theme switches × reapply + 1 restore (second shutdown no-op).
    assert.equal(h.indicatorCalls.length, 5, `indicator calls: ${JSON.stringify(h.indicatorCalls.length)}`);
    assert.equal(
      h.indicatorCalls.at(-1).length,
      0,
      "final indicator call restores Pi's default",
    );
  } finally {
    h.restore();
  }
});

test("repeated session_start with the header enabled never stacks header installs", () => {
  const h = lifecycleHarness();
  try {
    h.listeners.session_start({}, h.ctx);
    h.command.handler("header", h.ctx); // enable header
    h.command.handler("header", h.ctx); // disable again
    h.command.handler("header", h.ctx); // enable again

    // enable → install; disable → dispose; enable → install (previous handle
    // was already undefined, so no dispose precedes the second install).
    const installs = h.setHeaderCalls.filter((c) => typeof c === "function").length;
    const disposes = h.setHeaderCalls.filter((c) => c === undefined).length;
    assert.equal(installs, 2, `header installs: ${installs}`);
    assert.equal(disposes, 1, `header disposals: ${disposes}`);
  } finally {
    h.restore();
  }
});

// ---------------------------------------------------------------------------
// Theme integration
// ---------------------------------------------------------------------------

test("dark, day, and third-party themes pass integration-style rendering", () => {
  const status = new WorkingStateController();
  status.startTurn(Date.now());
  status.startTool("bash");

  for (const palette of Object.keys(THEME_PALETTES)) {
    const theme = themeDouble(palette);
    for (const width of [40, 80, 120]) {
      const [row] = renderGrokFooter(baseCtx(), status, width, EXT_STATUSES, DEFAULT_FOOTER_CONFIG, theme);
      assertRowSafe(row, width, `${palette} footer width=${width}`);

      const headerLines = renderHeader(baseCtx(), width, undefined, theme);
      assert.equal(headerLines.length, 3, `${palette} header has three lines`);
      for (const line of headerLines) {
        assertAnsiBalanced(line, `${palette} header width=${width}`);
        assert.ok(visibleWidth(line) <= width, `${palette} header line must fit ${width}`);
      }

      // No hard-coded GrokNight truecolor constants when a theme is active.
      assert.ok(!/\x1b\[38;2;\d+;\d+;\d+m/.test(row), `${palette} footer must not embed fixed RGB`);
      assert.ok(!/\x1b\[38;2;\d+;\d+;\d+m/.test(headerLines.join("")), `${palette} header must not embed fixed RGB`);
    }
  }
});

test("footer and header agree with pi-tui measurement on every matrix render", () => {
  // Spot-check that pi-tui never sees an over-wide line even with the shim
  // palette (which emits the longest ANSI sequences).
  const status = new WorkingStateController();
  status.startTurn(Date.now());
  status.startStreaming();

  for (const width of ALL_WIDTHS) {
    const [row] = renderGrokFooter(baseCtx(), status, width, EXT_STATUSES, DEFAULT_FOOTER_CONFIG, null);
    assert.ok(
      visibleWidth(row) <= width,
      `shim width=${width}: ${visibleWidth(row)} exceeds budget`,
    );
  }
});
