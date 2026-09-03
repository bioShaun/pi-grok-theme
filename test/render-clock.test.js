/**
 * render-clock.test.js — v0.4 coalesced render clock and dual timing
 *
 * Uses a controllable clock: fake timers are captured and fired manually, so
 * cadence, coalescing, and cleanup are deterministic. Lifecycle idempotency
 * (repeated starts/stops/turn calls) is proven explicitly.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { RenderClock, RENDER_INTERVAL_MS } from "../render-clock.ts";
import { WorkingStateController } from "../status.ts";
import registerGrokBuildExtension from "../index.ts";

/** Fake timer wheel capturing armed timers for manual ticking. */
function fakeTimerWheel() {
  const armed = [];
  let seq = 0;
  return {
    armed,
    unrefCalls: 0,
    setTimer(callback, ms) {
      const handle = {
        id: ++seq,
        callback,
        ms,
        unref: () => {
          this.unrefCalls++;
        },
      };
      armed.push(handle);
      return handle;
    },
    clearTimer(timer) {
      const idx = armed.indexOf(timer);
      if (idx >= 0) armed.splice(idx, 1);
    },
    /** Fire the most recently armed timer once; no-op when nothing is armed. */
    tick() {
      const timer = armed[armed.length - 1];
      if (!timer) return;
      armed.pop();
      timer.callback();
    },
  };
}

test("clock interval defaults to the spec's 250ms budget", () => {
  assert.equal(RENDER_INTERVAL_MS, 250);
});

test("start() arms exactly one timer; repeated starts never stack", () => {
  const wheel = fakeTimerWheel();
  const renders = [];
  const clock = new RenderClock({
    requestRender: () => renders.push("r"),
    setTimer: (cb, ms) => wheel.setTimer(cb, ms),
    clearTimer: (t) => wheel.clearTimer(t),
  });

  clock.start();
  clock.start();
  clock.start();

  assert.equal(wheel.armed.length, 1, "exactly one timer exists");
  assert.equal(wheel.armed[0].ms, 250);
  assert.equal(wheel.unrefCalls, 1, "timer is unref'd so it cannot keep Node alive");
});

test("ticks render at the bounded cadence and re-arm", () => {
  const wheel = fakeTimerWheel();
  const renders = [];
  const clock = new RenderClock({
    requestRender: () => renders.push("r"),
    setTimer: (cb, ms) => wheel.setTimer(cb, ms),
    clearTimer: (t) => wheel.clearTimer(t),
  });

  clock.start();
  wheel.tick();
  wheel.tick();
  wheel.tick();

  assert.equal(renders.length, 3, "one render per tick");
  assert.equal(wheel.armed.length, 1, "clock re-arms after every tick");
  assert.ok(clock.isRunning);
});

test("stop() clears the timer; ticks after stop render nothing; stop is idempotent", () => {
  const wheel = fakeTimerWheel();
  const renders = [];
  const clock = new RenderClock({
    requestRender: () => renders.push("r"),
    setTimer: (cb, ms) => wheel.setTimer(cb, ms),
    clearTimer: (t) => wheel.clearTimer(t),
  });

  clock.start();
  assert.equal(wheel.armed.length, 1);
  clock.stop();
  clock.stop();
  assert.equal(wheel.armed.length, 0, "timer cleared");
  assert.ok(!clock.isRunning);

  wheel.tick();
  assert.equal(renders.length, 0, "no renders after stop");
});

test("markDirty coalesces while running and renders immediately while stopped", () => {
  const wheel = fakeTimerWheel();
  const renders = [];
  const clock = new RenderClock({
    requestRender: () => renders.push("r"),
    setTimer: (cb, ms) => wheel.setTimer(cb, ms),
    clearTimer: (t) => wheel.clearTimer(t),
  });

  clock.markDirty();
  assert.equal(renders.length, 1, "idle: isolated updates render immediately");

  clock.start();
  for (let i = 0; i < 30; i++) clock.markDirty();
  assert.equal(renders.length, 1, "running: updates are coalesced, not rendered per token");

  wheel.tick();
  assert.equal(renders.length, 2, "the tick flushes the coalesced dirty state");
});

test("timers without unref support do not crash the clock", () => {
  const renders = [];
  const clock = new RenderClock({
    requestRender: () => renders.push("r"),
    setTimer: (cb) => ({ callback: cb }), // no unref
    clearTimer: () => {},
  });
  assert.doesNotThrow(() => clock.start());
  clock.stop();
});

// ---------------------------------------------------------------------------
// Dual timing semantics (controllable clock via injected timestamps)
// ---------------------------------------------------------------------------

test("phase clock resets on transitions; turn clock stays continuous; lifecycle calls are idempotent", () => {
  const ctrl = new WorkingStateController();
  const t0 = 10_000_000;

  // Repeated turn starts do not corrupt the clock.
  ctrl.startTurn(t0);
  ctrl.startTurn(t0);
  assert.equal(ctrl.getBadge(t0 + 1_000).turnElapsedMs, 1_000);

  ctrl.startStreaming(t0 + 2_000);
  ctrl.startStreaming(t0 + 2_100); // per-token repeat: no phase reset
  assert.equal(ctrl.getBadge(t0 + 3_000).phaseElapsedMs, 1_000);
  assert.equal(ctrl.getBadge(t0 + 3_000).turnElapsedMs, 3_000, "turn time continuous across phases");

  ctrl.startTool("bash", t0 + 4_000);
  ctrl.startTool("bash", t0 + 4_100); // repeated tool_start: phase restarts at the new transition
  assert.equal(ctrl.getBadge(t0 + 4_500).phaseElapsedMs, 400);

  ctrl.endTool("bash", t0 + 5_000);
  ctrl.endTool("bash", t0 + 5_100); // repeated endTool: idempotent
  assert.equal(ctrl.getState(), "working");

  ctrl.endTurn(t0 + 6_000);
  ctrl.endTurn(t0 + 6_100); // double endTurn: idempotent
  assert.equal(ctrl.getState(), "idle");
  assert.equal(ctrl.getBadge().label, "idle");
});

// ---------------------------------------------------------------------------
// Extension lifecycle integration (fake pi/ctx, fake timers)
// ---------------------------------------------------------------------------

function extensionHarness(renderClock) {
  const wheel = fakeTimerWheel();
  const listeners = {};
  const registered = {};
  const requestRenderCalls = [];
  let footerHandle = null;

  const fakePi = {
    on: (evt, handler) => {
      listeners[evt] = handler;
    },
    registerCommand: (name, def) => {
      registered[name] = def;
    },
  };

  const fakeCtx = {
    hasUI: true,
    mode: "tui",
    cwd: process.cwd(),
    model: { name: "claude-3.7-sonnet", id: "anthropic/claude-3.7-sonnet", contextWindow: 200000 },
    getContextUsage: () => undefined,
    ui: {
      setFooter: (factory) => {
        footerHandle = factory(
          { requestRender: () => requestRenderCalls.push("tui") },
          undefined,
          { onBranchChange: () => {}, getExtensionStatuses: () => new Map() },
        );
      },
      setHeader: () => {},
      setWorkingMessage: () => {},
      notify: () => {},
    },
  };

  registerGrokBuildExtension(fakePi, {
    renderClock: {
      ...(renderClock ?? {}),
      setTimer: (cb, ms) => (renderClock?.setTimer ? renderClock.setTimer(cb, ms) : wheel.setTimer(cb, ms)),
      clearTimer: (t) => (renderClock?.clearTimer ? renderClock.clearTimer(t) : wheel.clearTimer(t)),
    },
  });

  return {
    wheel,
    listeners,
    registered,
    requestRenderCalls,
    get footer() {
      return footerHandle;
    },
    fakeCtx,
  };
}

test("message_update bursts produce bounded renders; message_end stops and renders once finally", () => {
  const h = extensionHarness();

  h.listeners.session_start({}, h.fakeCtx);
  assert.ok(h.footer, "footer installed");

  const tuiRenders = () => h.requestRenderCalls.length;

  // Turn start: immediate render + clock armed.
  h.listeners.message_start({ message: { role: "assistant" } }, h.fakeCtx);
  const afterStart = tuiRenders();
  assert.ok(afterStart >= 1, "turn start requests an immediate render");
  assert.equal(h.wheel.armed.length, 1, "render clock armed");

  // Token burst: 40 updates coalesce into zero extra immediate renders.
  for (let i = 0; i < 40; i++) {
    h.listeners.message_update({ message: { role: "assistant" } }, h.fakeCtx);
  }
  assert.equal(tuiRenders(), afterStart, "updates must not force unbounded renders");

  // One clock tick flushes.
  h.wheel.tick();
  assert.equal(tuiRenders(), afterStart + 1, "tick coalesces the burst into one render");

  // Turn end: final render, timer stopped.
  h.listeners.message_end({ message: { role: "assistant" } }, h.fakeCtx);
  const afterEnd = tuiRenders();
  assert.equal(h.wheel.armed.length, 0, "clock stopped at turn end");
  assert.ok(afterEnd > afterStart + 1, "final render requested after turn end");

  // Ticks after end: nothing.
  h.wheel.tick();
  assert.equal(tuiRenders(), afterEnd, "no renders after the turn ended");
});

test("session_shutdown stops the timer and teardown is repeatable", () => {
  const h = extensionHarness();

  h.listeners.session_start({}, h.fakeCtx);
  h.listeners.message_start({ message: { role: "assistant" } }, h.fakeCtx);
  assert.equal(h.wheel.armed.length, 1);

  const rendersBeforeShutdown = h.requestRenderCalls.length;
  h.listeners.session_shutdown({}, h.fakeCtx);
  assert.equal(h.wheel.armed.length, 0, "shutdown stops the render clock");

  h.wheel.tick();
  assert.equal(
    h.requestRenderCalls.length,
    rendersBeforeShutdown,
    "no renders after shutdown",
  );

  // Repeated shutdown must not throw or resurrect anything.
  assert.doesNotThrow(() => h.listeners.session_shutdown({}, h.fakeCtx));
});

test("repeated session_start does not stack timers", () => {
  const h = extensionHarness();

  h.listeners.session_start({}, h.fakeCtx);
  h.listeners.message_start({ message: { role: "assistant" } }, h.fakeCtx);
  h.listeners.session_start({}, h.fakeCtx); // stale-state reset

  assert.equal(h.wheel.armed.length, 0, "session_start leaves the clock stopped while idle");
});
