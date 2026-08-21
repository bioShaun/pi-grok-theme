import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import registerGrokBuildExtension from "../index.ts";
import { renderHeader } from "../header.ts";
import { renderGrokFooter, visibleWidth, truncateToWidth } from "../footer.ts";
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

  // /grok info / status shows v0.3.0 and cursor color
  notifications = [];
  registeredCommands.grok.handler("info", fakeCtx);
  assert.ok(notifications.some((n) => n.msg.includes("v0.3.0") && n.msg.includes("Amber Gold")));

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
