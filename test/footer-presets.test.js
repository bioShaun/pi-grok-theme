/**
 * footer-presets.test.js — v0.4 responsive footer presets (spec §4.5/§5.2/§6)
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFooterSegments,
  fitFooterSegments,
  renderGrokFooter,
  DEFAULT_FOOTER_CONFIG,
  FOOTER_PRESETS,
  visibleWidth,
} from "../footer.ts";
import { WorkingStateController } from "../status.ts";
import { MODERN_GLYPHS } from "../glyphs.ts";
import registerGrokBuildExtension from "../index.ts";

function ctx(overrides = {}) {
  return {
    hasUI: true,
    mode: "tui",
    cwd: process.cwd(), // inside the repo so branch detection finds a branch
    model: { name: "claude-3.7-sonnet", id: "anthropic/claude-3.7-sonnet", contextWindow: 200000 },
    getContextUsage: () => ({ usedTokens: 48000, contextWindow: 200000, percent: 24 }),
    thinkingLevel: "high",
    ...overrides,
  };
}

const chrome = { fg: (_tone, t) => t, bold: (t) => t }; // unstyled probe adapter
const statuses = new Map([
  ["velocity", "19.6 tps"],
  ["watcher", "3 changes"],
]);

function segments(preset, overrides = {}) {
  const config = { ...DEFAULT_FOOTER_CONFIG, preset, ...overrides };
  const status = new WorkingStateController();
  status.startTurn(Date.now());
  status.startStreaming();
  return buildFooterSegments(ctx(overrides.ctx ?? {}), status, statuses, config, chrome, MODERN_GLYPHS);
}

test("auto preset includes every eligible segment (except turn time)", () => {
  const ids = segments("auto").map((s) => s.id);
  assert.ok(ids.includes("cwd"));
  assert.ok(ids.includes("branch"));
  assert.ok(ids.includes("model"));
  assert.ok(ids.includes("context"));
  assert.ok(ids.includes("thinking"));
  assert.ok(ids.includes("extension:velocity"));
  assert.ok(ids.includes("extension:watcher"));
  assert.ok(ids.includes("status"));
  assert.ok(!ids.includes("turn"), "turn time is a full-preset segment");
});

test("minimal preset shows only model · context · status", () => {
  const ids = segments("minimal").map((s) => s.id);
  assert.deepEqual(ids.sort(), ["context", "model", "status"]);
});

test("full preset includes the spec segment set including turn time", () => {
  const ids = segments("full").map((s) => s.id);
  for (const expected of ["cwd", "branch", "model", "context", "thinking", "turn", "extension:velocity", "extension:watcher", "status"]) {
    assert.ok(ids.includes(expected), `full preset must include ${expected}`);
  }
});

test("turn time appears only in the full preset and only when turn data exists", () => {
  // Idle controller has no turnElapsedMs → no turn segment even in full.
  const config = { ...DEFAULT_FOOTER_CONFIG, preset: "full" };
  const idleSegments = buildFooterSegments(ctx(), new WorkingStateController(), statuses, config, chrome, MODERN_GLYPHS);
  assert.ok(!idleSegments.some((s) => s.id === "turn"), "no fabricated turn time while idle");

  const active = new WorkingStateController();
  active.startTurn(Date.now());
  const activeSegments = buildFooterSegments(ctx(), active, statuses, config, chrome, MODERN_GLYPHS);
  assert.ok(activeSegments.some((s) => s.id === "turn"), "turn time present when active in full preset");

  const autoConfig = { ...DEFAULT_FOOTER_CONFIG, preset: "auto" };
  const autoSegments = buildFooterSegments(ctx(), active, statuses, autoConfig, chrome, MODERN_GLYPHS);
  assert.ok(!autoSegments.some((s) => s.id === "turn"), "auto preset never shows turn time");
});

// ---------------------------------------------------------------------------
// Fitting algorithm (metadata-driven, spec §5.2/§6)
// ---------------------------------------------------------------------------

function seg(id, priority, wide, extra = {}) {
  return { id, priority, required: false, wide, ...extra };
}

test("fitting drops lowest-priority optional segments first; required segments survive", () => {
  const list = [
    seg("cwd", 8, "cwd-block"),
    seg("thinking", 6, "✻ high"),
    seg("status", 1, "● working", { required: true }),
    seg("model", 2, "very-long-model-name", { required: true, compact: "short" }),
  ];
  const out = fitFooterSegments(list, 30, " · ");
  assert.ok(!out.includes("cwd-block"), "cwd (p8) drops first");
  assert.ok(!out.includes("✻ high"), "thinking (p6) drops next");
  assert.ok(out.includes("● working"), "status is never dropped");
  assert.ok(out.includes("very-long-model-name") || out.includes("short"), "model survives (drop or shrink)");
});

test("fitting compacts context before dropping it; model shrinks but is never dropped", () => {
  const list = [
    seg("model", 2, "claude-opus-4-20250514", { required: true, compact: "opus-4" }),
    seg("context", 4, "⇣180k/200k (90%)", { compact: "90%" }),
    seg("status", 1, "● working (9.9s)", { required: true }),
  ];
  // Wide enough for everything wide.
  const wide = fitFooterSegments(list, 200, " · ");
  assert.ok(wide.includes("⇣180k/200k (90%)"));
  assert.ok(wide.includes("claude-opus-4-20250514"));

  // Narrow: context compacts first, model shortens, neither is dropped.
  const narrow = fitFooterSegments(list, 40, " · ");
  assert.ok(narrow.includes("90%"), "context compact form used");
  assert.ok(!narrow.includes("⇣180k/200k"), "wide context dropped after compaction");
  assert.ok(narrow.includes("opus-4"), "model shrunk to short name");
  assert.ok(narrow.includes("● working"), "status survives");
});

test("extension statuses are individually droppable and cannot push core fields off-screen", () => {
  const list = [
    seg("cwd", 8, "c"),
    seg("model", 2, "gpt-5", { required: true, compact: "gpt-5" }),
    seg("extension:a", 5, "EXT-A-LONG-STATUS-AAAAAAAA"),
    seg("extension:b", 5, "EXT-B"),
    seg("status", 1, "● ok", { required: true }),
  ];
  const out = fitFooterSegments(list, 30, " · ");
  assert.ok(out.includes("gpt-5"), "model survives");
  assert.ok(out.includes("● ok"), "status survives");
  const extCount = (out.match(/EXT-/g) ?? []).length;
  assert.ok(extCount <= 1, `at most one ext status fits at width 30, got ${extCount}: ${out}`);
});

test("every preset renders a single line within budget at all tested widths", () => {
  const status = new WorkingStateController();
  status.startTurn(Date.now());
  status.startTool("bash");

  for (const preset of FOOTER_PRESETS) {
    for (const width of [20, 24, 30, 40, 50, 60, 79, 80, 100, 120, 160]) {
      let lines;
      assert.doesNotThrow(() => {
        lines = renderGrokFooter(ctx(), status, width, statuses, { ...DEFAULT_FOOTER_CONFIG, preset });
      }, `width=${width} preset=${preset} must not throw`);
      assert.equal(lines.length, 1, `preset=${preset} width=${width} must stay single-line`);
      assert.ok(
        visibleWidth(lines[0]) <= width,
        `preset=${preset} width=${width}: ${visibleWidth(lines[0])} exceeds budget: ${JSON.stringify(lines[0])}`,
      );
      assert.notEqual(lines[0].trim(), "", `preset=${preset} width=${width} must not be empty`);
    }
  }
});

test("model and active status remain the last core fields at extreme narrowness", () => {
  const status = new WorkingStateController();
  status.startTurn(Date.now());
  status.startTool("bash");

  const [row] = renderGrokFooter(ctx(), status, 24, statuses, { ...DEFAULT_FOOTER_CONFIG, preset: "minimal" });
  assert.ok(row.includes("●"), "status marker survives at width 24");
  assert.ok(row.includes("sonnet") || row.includes("claude"), "model survives at width 24");
});

// ---------------------------------------------------------------------------
// /grok footer command
// ---------------------------------------------------------------------------

test("/grok footer reports the current preset and switches immediately", () => {
  const notifications = [];
  const listeners = {};
  let footerFactory = null;
  let renderRequests = 0;

  let registered_grok;
  const fakePi = {
    on: (evt, handler) => {
      listeners[evt] = handler;
    },
    registerCommand: (name, def) => {
      registered_grok = def;
    },
  };

  const fakeCtx = {
    hasUI: true,
    mode: "tui",
    cwd: process.cwd(),
    model: { name: "claude-3.7-sonnet", id: "anthropic/claude-3.7-sonnet", contextWindow: 200000 },
    getContextUsage: () => ({ usedTokens: 48000, contextWindow: 200000, percent: 24 }),
    ui: {
      setFooter: (factory) => {
        footerFactory = factory;
      },
      setHeader: () => {},
      setWorkingMessage: () => {},
      notify: (msg, type) => notifications.push({ msg, type }),
    },
  };

  registerGrokBuildExtension(fakePi);

  listeners.session_start({}, fakeCtx);
  const footer = footerFactory(
    { requestRender: () => renderRequests++ },
    undefined,
    { onBranchChange: () => {}, getExtensionStatuses: () => new Map() },
  );

  // Report: no argument.
  notifications.length = 0;
  registered_grok.handler("footer", fakeCtx);
  assert.ok(
    notifications.some((n) => n.msg.includes("Current:") && n.msg.includes("auto")),
    "reports the current preset (auto)",
  );
  assert.ok(notifications.some((n) => n.msg.includes("minimal") && n.msg.includes("full")), "lists available presets");

  // Switch to minimal — applies immediately.
  notifications.length = 0;
  registered_grok.handler("footer minimal", fakeCtx);
  assert.ok(notifications.some((n) => n.msg.includes("footer preset: minimal")));
  assert.ok(renderRequests > 0, "preset change requests a render");

  const minimalRow = footer.render(120)[0];
  assert.ok(!minimalRow.includes("~/"), "minimal preset drops cwd");
  assert.ok(!minimalRow.includes("⎇"), "minimal preset drops branch");
  assert.ok(minimalRow.includes("24%") || minimalRow.includes("48k"), "minimal keeps context");
  assert.ok(minimalRow.includes("●") || minimalRow.includes("○"), "minimal keeps status");

  // Switch back to auto.
  registered_grok.handler("footer auto", fakeCtx);
  const autoRow = footer.render(120)[0];
  assert.ok(autoRow.includes("~/"), "auto preset restores cwd");

  // Unknown preset warns and leaves the preset unchanged.
  notifications.length = 0;
  registered_grok.handler("footer fancy", fakeCtx);
  assert.ok(notifications.some((n) => n.type === "warning" && n.msg.includes("fancy")));
  registered_grok.handler("footer", fakeCtx);
  assert.ok(notifications.some((n) => n.msg.includes("Current:") && n.msg.includes("auto")), "preset unchanged after unknown");
});
