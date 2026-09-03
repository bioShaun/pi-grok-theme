import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import registerGrokBuildExtension from "../index.ts";
import { renderHeader } from "../header.ts";
import { renderGrokFooter, visibleWidth, truncateToWidth, shortenModelName, DEFAULT_FOOTER_CONFIG } from "../footer.ts";
import { WorkingStateController } from "../status.ts";
import { hexToOsc12, setCursorColor, resetCursorColor } from "../cursor.ts";

test("Theme JSON validation - all 3 themes", () => {
  const codingTheme = JSON.parse(fs.readFileSync(path.resolve("themes/grok-build-coding.json"), "utf8"));
  const minimalTheme = JSON.parse(fs.readFileSync(path.resolve("themes/grok-build.json"), "utf8"));
  const dayTheme = JSON.parse(fs.readFileSync(path.resolve("themes/grok-build-day.json"), "utf8"));

  assert.equal(codingTheme.name, "grok-build-coding");
  assert.equal(minimalTheme.name, "grok-build");
  assert.equal(dayTheme.name, "grok-build-day");

  assert.ok(codingTheme.colors.accent);
  assert.ok(minimalTheme.colors.accent);
  assert.ok(dayTheme.colors.accent);

  // Validate Markdown heading is cyan across themes
  assert.equal(codingTheme.colors.mdHeading, "cyan");
  assert.equal(minimalTheme.colors.mdHeading, "cyan");
  assert.equal(dayTheme.colors.mdHeading, "cyan");
});

test("cursor.ts OSC 12 helpers", () => {
  assert.equal(hexToOsc12("#E0AF68"), "E0/AF/68");
  assert.equal(hexToOsc12("E0AF68"), "E0/AF/68");
  assert.equal(hexToOsc12("#7AA2F7"), "7A/A2/F7");
  assert.equal(hexToOsc12("invalid"), "E0/AF/68");

  // Verify function calls do not throw
  assert.doesNotThrow(() => setCursorColor());
  assert.doesNotThrow(() => setCursorColor("7A/A2/F7"));
  assert.doesNotThrow(() => resetCursorColor());
});

test("visibleWidth & truncateToWidth calculation", () => {
  assert.equal(visibleWidth("hello"), 5);
  assert.equal(visibleWidth("📁"), 2);
  assert.equal(visibleWidth("\x1b[38;2;122;162;247mhello\x1b[0m"), 5);

  const truncated = truncateToWidth("\x1b[38;2;122;162;247mhello world\x1b[0m", 6);
  assert.equal(visibleWidth(truncated), 6);
});

test("WorkingStateController lifecycle", () => {
  const ctrl = new WorkingStateController();
  assert.equal(ctrl.getState(), "idle");
  assert.equal(ctrl.getBadge().rawText, "○ idle");

  ctrl.startTurn();
  assert.equal(ctrl.getState(), "thinking");

  ctrl.startTool("bash");
  assert.equal(ctrl.getState(), "running_tool");
  assert.ok(ctrl.getBadge().rawText.includes("running bash"));

  ctrl.endTool();
  assert.equal(ctrl.getState(), "working");

  ctrl.endTurn();
  assert.equal(ctrl.getState(), "idle");
});

test("WorkingStateController filterWorkingMessage clear semantics & idle pass-through", () => {
  const ctrl = new WorkingStateController();

  // 1. undefined must return undefined across all lifecycle states (Defect B fix)
  assert.equal(ctrl.getState(), "idle");
  assert.equal(ctrl.filterWorkingMessage(undefined), undefined);

  ctrl.startTurn();
  assert.equal(ctrl.getState(), "thinking");
  assert.equal(ctrl.filterWorkingMessage(undefined), undefined);

  ctrl.startStreaming();
  assert.equal(ctrl.getState(), "streaming");
  assert.equal(ctrl.filterWorkingMessage(undefined), undefined);

  ctrl.startTool("bash");
  assert.equal(ctrl.getState(), "running_tool");
  assert.equal(ctrl.filterWorkingMessage(undefined), undefined);

  ctrl.endTool();
  assert.equal(ctrl.getState(), "working");
  assert.equal(ctrl.filterWorkingMessage(undefined), undefined);

  ctrl.endTurn();
  assert.equal(ctrl.getState(), "idle");
  assert.equal(ctrl.filterWorkingMessage(undefined), undefined);

  // 2. Idle state passes through original message without fabricating working badge
  assert.equal(ctrl.filterWorkingMessage("some breadcrumb"), "some breadcrumb");
  assert.equal(ctrl.filterWorkingMessage("[agent] action · tool · 0.0s"), "[agent] action · tool · 0.0s");

  // 3. Active turn formats messages into Grok tokens
  ctrl.startTurn();
  assert.ok(ctrl.filterWorkingMessage("Executing bash command").includes("running bash"));
  assert.ok(ctrl.filterWorkingMessage("Writing code to file").includes("editing file"));
  assert.ok(ctrl.filterWorkingMessage("Reading file README.md").includes("reading file"));
  assert.ok(ctrl.filterWorkingMessage("Searching codebase").includes("searching"));
  assert.ok(ctrl.filterWorkingMessage("Thinking about architecture").includes("thinking"));
  assert.ok(ctrl.filterWorkingMessage("Custom status message").includes("Custom status message"));
  assert.ok(ctrl.filterWorkingMessage("").includes("thinking"));

  ctrl.endTurn();
});

test("setWorkingMessage interceptor & lifecycle cleanup", () => {
  let receivedMessages = [];
  const originalSetWorkingMessage = (msg) => {
    receivedMessages.push(msg);
  };

  const fakeCtx = {
    hasUI: true,
    mode: "tui",
    cwd: process.cwd(),
    ui: {
      setHeader: () => {},
      setFooter: () => {},
      setWorkingMessage: originalSetWorkingMessage,
      notify: () => {},
    },
  };

  const listeners = {};
  const fakePi = {
    on: (evt, handler) => {
      listeners[evt] = handler;
    },
    registerCommand: () => {},
  };

  registerGrokBuildExtension(fakePi);

  // session_start installs interceptor
  listeners.session_start({}, fakeCtx);
  assert.notEqual(fakeCtx.ui.setWorkingMessage, originalSetWorkingMessage, "interceptor should wrap setWorkingMessage");

  // Call setWorkingMessage(undefined) while idle -> must pass undefined through
  receivedMessages = [];
  fakeCtx.ui.setWorkingMessage(undefined);
  assert.deepEqual(receivedMessages, [undefined], "setWorkingMessage(undefined) must pass undefined untouched");

  // Call setWorkingMessage('custom') while idle -> passes through as-is
  receivedMessages = [];
  fakeCtx.ui.setWorkingMessage("custom status");
  assert.deepEqual(receivedMessages, ["custom status"]);

  // Start turn
  listeners.message_start({ message: { role: "assistant" } }, fakeCtx);

  // During turn: setWorkingMessage('running bash') -> filtered into Grok token
  receivedMessages = [];
  fakeCtx.ui.setWorkingMessage("running bash command");
  assert.equal(receivedMessages.length, 1);
  assert.ok(receivedMessages[0].includes("running bash"));

  // During turn: setWorkingMessage(undefined) -> passes undefined through
  receivedMessages = [];
  fakeCtx.ui.setWorkingMessage(undefined);
  assert.deepEqual(receivedMessages, [undefined]);

  // Turn ends via message_end -> clears working message with undefined
  receivedMessages = [];
  listeners.message_end({ message: { role: "assistant" } }, fakeCtx);
  assert.deepEqual(receivedMessages, [undefined], "message_end should clear working message");

  // session_shutdown cleans up and restores original setWorkingMessage
  listeners.session_shutdown({}, fakeCtx);
  assert.equal(fakeCtx.ui.setWorkingMessage, originalSetWorkingMessage, "session_shutdown should restore original setWorkingMessage");
});

test("Header & Footer Component render interface and /grok commands", () => {
  let headerFactory = null;
  let footerFactory = null;
  let registeredCommands = {};
  let notifications = [];

  const fakeCtx = {
    hasUI: true,
    mode: "tui",
    cwd: process.cwd(),
    model: { name: "claude-3.7-sonnet", id: "anthropic/claude-3.7-sonnet", contextWindow: 200000 },
    getContextUsage: () => ({ usedTokens: 48000, contextWindow: 200000, percent: 24 }),
    ui: {
      setHeader: (factory) => { headerFactory = factory; },
      setFooter: (factory) => { footerFactory = factory; },
      setWorkingMessage: () => {},
      notify: (msg, type) => {
        notifications.push({ msg, type });
      },
    },
  };

  const listeners = {};
  const fakePi = {
    on: (evt, handler) => {
      listeners[evt] = handler;
    },
    registerCommand: (name, def) => {
      registeredCommands[name] = def;
    },
  };

  registerGrokBuildExtension(fakePi);

  // Trigger session_start
  listeners.session_start({}, fakeCtx);

  // Header verification: header is opt-in, disabled by default
  assert.equal(headerFactory, null, "header should not be installed by default (opt-in)");

  // /grok header enables it and notifies
  registeredCommands.grok.handler("header", fakeCtx);
  assert.equal(typeof headerFactory, "function", "setHeader should receive a factory function after /grok header");
  assert.ok(
    notifications.some((n) => n.msg.includes("header: enabled")),
    "/grok header should notify that the header was enabled",
  );

  const headerComp = headerFactory({ requestRender: () => {} }, {});
  assert.equal(typeof headerComp.render, "function", "Header component must implement .render(width)");
  const headerLines = headerComp.render(80);
  assert.equal(headerLines.length, 3);

  // Footer verification
  assert.equal(typeof footerFactory, "function", "setFooter should receive a factory function");
  const footerComp = footerFactory({ requestRender: () => {} }, {}, {
    onBranchChange: () => {},
    getExtensionStatuses: () => new Map([["velocity", "TPS: 45"]]),
  });
  assert.equal(typeof footerComp.render, "function", "Footer component must implement .render(width)");
  const footerLinesWide = footerComp.render(100);
  assert.equal(footerLinesWide.length, 1);
  const footerLinesNarrow = footerComp.render(50);
  assert.equal(footerLinesNarrow.length, 1);

  // Command verification
  assert.ok(registeredCommands.grok, "/grok command must be registered");

  // /grok info / status shows the synced version and cursor color
  notifications = [];
  registeredCommands.grok.handler("info", fakeCtx);
  assert.ok(notifications.some((n) => n.msg.includes("v0.4.0") && n.msg.includes("Amber Gold")));

  // /grok theme lists available themes
  notifications = [];
  registeredCommands.grok.handler("theme", fakeCtx);
  assert.ok(notifications.some((n) => n.msg.includes("grok-build-coding") && n.msg.includes("grok-build-day")));

  // /grok theme day gives activation guide for grok-build-day
  notifications = [];
  registeredCommands.grok.handler("theme day", fakeCtx);
  assert.ok(notifications.some((n) => n.msg.includes("To activate grok-build-day")));

  // session_shutdown cleans up
  assert.doesNotThrow(() => listeners.session_shutdown({}, fakeCtx));
});

test("session_start shell chrome: setTitle + setHiddenThinkingLabel", () => {
  const titleCalls = [];
  const labelCalls = [];

  const fakeCtx = {
    hasUI: true,
    mode: "tui",
    cwd: "/home/user/my-project",
    model: { name: "claude-3.7-sonnet", id: "anthropic/claude-3.7-sonnet", contextWindow: 200000 },
    getContextUsage: () => undefined,
    ui: {
      setHeader: () => {},
      setFooter: () => {},
      setWorkingMessage: () => {},
      notify: () => {},
      setTitle: (t) => titleCalls.push(t),
      setHiddenThinkingLabel: (l) => labelCalls.push(l),
    },
  };

  const listeners = {};
  const fakePi = {
    on: (evt, handler) => {
      listeners[evt] = handler;
    },
    registerCommand: () => {},
  };

  registerGrokBuildExtension(fakePi);
  listeners.session_start({}, fakeCtx);

  // Title: called exactly once, grok format with ⚡ and cwd basename
  assert.equal(titleCalls.length, 1, "setTitle should be called exactly once on session_start");
  assert.ok(titleCalls[0].includes("⚡"), "title should contain the ⚡ glyph");
  assert.ok(titleCalls[0].includes("my-project"), "title should contain the cwd basename");

  // Hidden thinking label: called exactly once, compact, single-line, no ANSI
  assert.equal(labelCalls.length, 1, "setHiddenThinkingLabel should be called exactly once on session_start");
  assert.ok(visibleWidth(labelCalls[0]) <= 16, "label must be ≤16 visible width");
  assert.ok(!labelCalls[0].includes("\x1b"), "label must not contain ANSI escapes");
  assert.ok(!labelCalls[0].includes("\n"), "label must be single-line");

  // Shutdown must not throw and must not reset title/label (core owns them)
  assert.doesNotThrow(() => listeners.session_shutdown({}, fakeCtx));
  assert.equal(titleCalls.length, 1, "session_shutdown must not touch the title");
  assert.equal(labelCalls.length, 1, "session_shutdown must not touch the thinking label");
});

test("shortenModelName extended mappings (R1)", () => {
  assert.equal(shortenModelName("gpt-4.1-mini"), "gpt-4.1-mini");
  assert.equal(shortenModelName("gpt-4.1-nano"), "gpt-4.1-nano");
  assert.equal(shortenModelName("gpt-4.1"), "gpt-4.1");
  assert.equal(shortenModelName("openai/gpt-5"), "gpt-5");
  assert.equal(shortenModelName("gpt-5-mini"), "gpt-5-mini");
  assert.equal(shortenModelName("gpt-5-nano"), "gpt-5-nano");
  assert.equal(shortenModelName("anthropic/claude-opus-4"), "opus-4");
  assert.equal(shortenModelName("claude-sonnet-4-20250514"), "sonnet-4");
  assert.equal(shortenModelName("claude-haiku-4"), "haiku-4");
  assert.equal(shortenModelName("o1"), "o1");
  assert.equal(shortenModelName("o1-mini"), "o1-mini");
  assert.equal(shortenModelName("o1-pro"), "o1-pro");
  assert.equal(shortenModelName("o3"), "o3");
  assert.equal(shortenModelName("o3-mini"), "o3-mini");
  assert.equal(shortenModelName("o4-mini"), "o4-mini");
  assert.equal(shortenModelName("gemini-2.0-flash"), "gem-2-flash");
  assert.equal(shortenModelName("gemini-2.5-pro"), "gem-2.5-pro");
  assert.equal(shortenModelName("deepseek-v3"), "deepseek-v3");
  assert.equal(shortenModelName("deepseek-r1"), "deepseek-r1");
  assert.equal(shortenModelName("qwen3-coder"), "qwen3-coder");
  assert.equal(shortenModelName("qwen3-max"), "qwen3-max");
  assert.equal(shortenModelName("kimi-k2"), "kimi-k2");
  assert.equal(shortenModelName("minimax-text-01"), "minimax");

  // All short names obey the ≤12 char rule
  const samples = [
    "gpt-4.1-mini", "gpt-5-nano", "claude-opus-4", "o3-mini",
    "gemini-2.5-pro", "deepseek-r1", "qwen3-coder", "kimi-k2",
  ];
  for (const s of samples) {
    assert.ok(shortenModelName(s).length <= 12, `short name for ${s} exceeds 12 chars`);
  }

  // Unknown model IDs keep the fallback: last path segment, no crash
  assert.equal(shortenModelName("somevendor/unknown-model-x"), "unknown-model-x");
  assert.equal(shortenModelName("plain-unknown-id"), "plain-unknown-id");

  // Existing mappings must not regress
  assert.equal(shortenModelName("claude-3.7-sonnet"), "sonnet-3.7");
  assert.equal(shortenModelName("gpt-5.6"), "gpt-5.6");
  assert.equal(shortenModelName("kimi-k3-256k"), "kimi-k3");
});

test("footer width regression with extension status (R2.5)", () => {
  // Same fake ctx shape as the existing footer test (field richness aligned).
  const ctx = {
    hasUI: true,
    mode: "tui",
    cwd: process.cwd(), // inside the repo, so getGitBranch finds a real branch
    model: { name: "claude-3.7-sonnet", id: "anthropic/claude-3.7-sonnet", contextWindow: 200000 },
    getContextUsage: () => ({ usedTokens: 48000, contextWindow: 200000, percent: 24 }),
  };
  const statusController = new WorkingStateController(); // idle -> "○ idle" badge
  // Any extension may inject statuses (e.g. pi-velocity writes "19.6 / 23.2 tps");
  // the footer must survive them at every width without overflowing pi-tui.
  const extensionStatuses = new Map([["velocity", "19.6 / 23.2 tps"]]);

  const widths = [40, 50, 60, 70, 80, 100, 120];
  const rows = new Map();

  for (const width of widths) {
    let lines;
    assert.doesNotThrow(() => {
      lines = renderGrokFooter(ctx, statusController, width, extensionStatuses, DEFAULT_FOOTER_CONFIG);
    }, `width=${width} must not throw`);
    rows.set(width, lines[0]);

    assert.equal(lines.length, 1, `width=${width} footer must stay single-line`);
    assert.ok(
      visibleWidth(lines[0]) <= width,
      `width=${width} actual=${visibleWidth(lines[0])} exceeds budget`,
    );
    assert.notEqual(lines[0].trim(), "", `width=${width} footer must not be empty`);
  }

  // Narrow (50): at least one core field survives — branch glyph, short model, or status dot
  const narrow = rows.get(50);
  assert.ok(
    narrow.includes("⎇") || narrow.includes("sonnet") || narrow.includes("●") || narrow.includes("○"),
    `width=50 must keep at least one core field, got: ${JSON.stringify(narrow)}`,
  );

  // Wide (120): completeness smoke — branch glyph AND status dot both present
  const wide = rows.get(120);
  assert.ok(wide.includes("⎇"), `width=120 must include branch glyph, got: ${JSON.stringify(wide)}`);
  assert.ok(
    wide.includes("●") || wide.includes("○"),
    `width=120 must include status indicator, got: ${JSON.stringify(wide)}`,
  );
});
