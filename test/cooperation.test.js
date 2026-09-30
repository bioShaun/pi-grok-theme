import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import register from "../index.ts";

function harness() {
  const tmp = path.join(process.cwd(), ".scratch/test-tmp");
  fs.mkdirSync(tmp, { recursive: true });
  const notifications = [], listeners = {}, timers = [], gitCounts = [], headers = [];
  let footer, command;
  const theme = { name: "grok-build" };
  const ui = {
    theme,
    setFooter(factory) {
      if (footer?.component) footer.component.dispose();
      footer = factory ? { factory, component: factory({ requestRender() {} }, theme, {}) } : null;
    },
    setHeader: (...args) => headers.push(args),
    setWorkingIndicator: (...args) => indicatorCalls.push(args),
    setTitle() {}, setHiddenThinkingLabel() {}, setWorkingMessage() {},
    notify: (msg, type) => notifications.push({ msg, type }),
  };
  const indicatorCalls = [];
  const pi = { on: (name, fn) => listeners[name] = fn, registerCommand: (_n, def) => command = def };
  const ctx = { hasUI: true, mode: "tui", cwd: process.cwd(), ui };
  register(pi, {
    settingsPath: path.join(tmp, `cooperation-${process.pid}-${Math.random()}.json`),
    gitReader: async (_cwd, { counts }) => { gitCounts.push(counts); return { state: "not-repo" }; },
    renderClock: { setTimer: (fn) => { timers.push(fn); return { unref() {} }; }, clearTimer() {}, requestRender() {} },
  });
  const originalWrite = process.stdout.write;
  const writes = [];
  process.stdout.write = (chunk) => { writes.push(chunk.toString()); return true; };
  listeners.session_start({}, ctx);
  return { listeners, command, ctx, ui, footer: () => footer, timers, gitCounts, notifications, headers, writes, indicatorCalls,
    restore: () => { process.stdout.write = originalWrite; listeners.session_shutdown({}, ctx); } };
}

test("yields footer ownership, preserves chrome, and reinstalls for a new session", async () => {
  const h = harness();
  try {
    h.ui.setFooter(() => ({ dispose() {} }));
    h.listeners.agent_start({}, h.ctx);
    assert.equal(h.timers.length, 0);
    await new Promise((r) => setTimeout(r, 10));
    assert.ok(h.gitCounts.includes(false));
    h.command.handler("info", h.ctx);
    assert.match(h.notifications.at(-1).msg, /yielded/);
    const headerCalls = h.headers.length;
    h.command.handler("header on", h.ctx);
    assert.match(h.notifications.at(-1).msg, /not installed/);
    assert.equal(h.headers.length, headerCalls);
    h.listeners.session_shutdown({}, h.ctx);
    assert.ok(h.footer());
    h.listeners.session_start({}, h.ctx);
    assert.ok(h.footer());
  } finally { h.restore(); }
});

test("retains normal footer behavior and synchronizes changed active themes", () => {
  const h = harness();
  try {
    h.listeners.agent_start({}, h.ctx);
    assert.ok(h.timers.length > 0);
    assert.ok(h.gitCounts.includes(true));
    h.writes.length = 0;
    const before = h.indicatorCalls.length;
    h.ctx.ui.theme.name = "grok-build-day";
    h.listeners.agent_start({}, h.ctx);
    assert.ok(h.writes.join("").includes("\x1b]12;rgb:B4/53/09\x07"));
    assert.equal(h.indicatorCalls.length, before + 1);
    const writes = h.writes.length;
    h.listeners.agent_start({}, h.ctx);
    assert.equal(h.writes.length, writes);
    h.listeners.session_shutdown({}, h.ctx);
    assert.equal(h.footer(), null);
  } finally { h.restore(); }
});
