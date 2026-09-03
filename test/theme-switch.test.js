/**
 * theme-switch.test.js — v0.4 direct theme switching (spec §4.6)
 */

import test from "node:test";
import assert from "node:assert/strict";

import registerGrokBuildExtension from "../index.ts";

const INSTALLED = ["grok-build-coding", "grok-build", "grok-build-day", "vendor-light", "boom-theme"];

function harness({ themeName = "grok-build-coding", withSwitchingApis = true } = {}) {
  const notifications = [];
  const listeners = {};
  let registered_grok;
  const setThemeCalls = [];
  const oscWrites = [];
  const indicatorCalls = [];
  let footerFactory = null;
  const renderRequests = [];

  const themeObj = { name: themeName };
  const ui = {
    ...(withSwitchingApis
      ? {
          getAllThemes: () => INSTALLED.map((name) => ({ name, path: undefined })),
          setTheme: (name) => {
            setThemeCalls.push(name);
            if (name === "boom-theme") return { success: false, error: "boom exploded" };
            themeObj.name = name;
            return { success: true };
          },
        }
      : {}),
    theme: themeObj,
    setFooter: (factory) => {
      footerFactory = factory;
    },
    setHeader: () => {},
    setWorkingMessage: () => {},
    setWorkingIndicator: (...args) => indicatorCalls.push(args),
    notify: (msg, type) => notifications.push({ msg, type }),
  };

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
    model: { name: "claude-3.7-sonnet", id: "x", contextWindow: 200000 },
    getContextUsage: () => undefined,
    ui,
  };

  const originalWrite = process.stdout.write;
  process.stdout.write = (chunk) => {
    oscWrites.push(chunk.toString());
    return true;
  };

  registerGrokBuildExtension(fakePi);
  listeners.session_start({}, fakeCtx);

  return {
    listeners,
    command: registered_grok,
    notifications,
    setThemeCalls,
    oscWrites,
    indicatorCalls,
    render: () => {
      const handle = footerFactory({ requestRender: () => renderRequests.push(1) }, undefined, {
        onBranchChange: () => {},
        getExtensionStatuses: () => new Map(),
      });
      return handle;
    },
    renderRequests,
    fakeCtx,
    themeObj,
    restoreStdout() {
      process.stdout.write = originalWrite;
    },
  };
}

test("/grok theme lists installed themes and marks the active one", () => {
  const h = harness();
  try {
    h.command.handler("theme", h.fakeCtx);
    const msg = h.notifications.at(-1).msg;
    for (const name of INSTALLED) {
      assert.ok(msg.includes(name), `listing must include ${name}`);
    }
    assert.ok(msg.includes("(active)") && msg.includes("●"), "active theme is marked");
    assert.ok(msg.includes("coding, minimal, day"), "aliases are advertised");
    assert.equal(h.setThemeCalls.length, 0, "listing never switches themes");
  } finally {
    h.restoreStdout();
  }
});

test("aliases activate their bundled themes directly and refresh all chrome", () => {
  for (const [alias, expected] of [
    ["day", "grok-build-day"],
    ["coding", "grok-build-coding"],
    ["minimal", "grok-build"],
  ]) {
    const h = harness();
    try {
      const footer = h.render();
      const rendersBefore = h.renderRequests.length;
      h.oscWrites.length = 0;
      h.indicatorCalls.length = 0;

      h.command.handler(`theme ${alias}`, h.fakeCtx);

      assert.deepEqual(h.setThemeCalls, [expected], `${alias} maps to ${expected}`);

      // Cursor policy reapplied for the new theme.
      const osc = h.oscWrites.join("");
      const expectedCursor = expected === "grok-build-day" ? "rgb:B4/53/09" : "rgb:E0/AF/68";
      assert.ok(osc.includes(expectedCursor), `cursor must be reapplied (${expectedCursor}), got: ${osc}`);

      // Working indicator re-applied with themed frames.
      assert.equal(h.indicatorCalls.length, 1, "working indicator reapplied after switch");
      assert.equal(h.indicatorCalls[0][0].intervalMs, 120);

      // Footer/header re-render requested.
      assert.ok(h.renderRequests.length > rendersBefore, "render requested after switch");

      // Success notification.
      assert.ok(
        h.notifications.some((n) => n.msg.includes(`Theme switched to ${expected}`)),
        "success notification",
      );
      void footer;
    } finally {
      h.restoreStdout();
    }
  }
});

test("installed third-party theme names activate directly", () => {
  const h = harness();
  try {
    h.oscWrites.length = 0;
    h.command.handler("theme vendor-light", h.fakeCtx);
    assert.deepEqual(h.setThemeCalls, ["vendor-light"]);
    // Unknown themes restore the terminal default cursor instead of a bundled one.
    assert.ok(h.oscWrites.join("").includes("\x1b]112\x07"), "third-party switch restores default cursor");
  } finally {
    h.restoreStdout();
  }
});

test("a failing setTheme reports the host error and changes nothing else", () => {
  const h = harness();
  try {
    h.oscWrites.length = 0;
    h.indicatorCalls.length = 0;
    h.command.handler("theme boom-theme", h.fakeCtx);

    assert.deepEqual(h.setThemeCalls, ["boom-theme"], "host was asked");
    assert.ok(
      h.notifications.some((n) => n.type === "error" && n.msg.includes("boom exploded")),
      "host error is surfaced",
    );
    assert.ok(h.notifications.at(-1).msg.includes("Active theme unchanged"));
    assert.equal(h.oscWrites.length, 0, "no cursor churn on failure");
    assert.equal(h.indicatorCalls.length, 0, "no indicator churn on failure");
  } finally {
    h.restoreStdout();
  }
});

test("an unknown theme warns and never calls setTheme", () => {
  const h = harness();
  try {
    h.command.handler("theme does-not-exist", h.fakeCtx);
    assert.equal(h.setThemeCalls.length, 0, "setTheme must not be called");
    const warning = h.notifications.find((n) => n.type === "warning");
    assert.ok(warning, "warning emitted");
    assert.ok(warning.msg.includes("does-not-exist"), "warning names the unknown theme");
    assert.ok(warning.msg.includes("Active theme unchanged"));
  } finally {
    h.restoreStdout();
  }
});

test("older Pi versions without switching APIs receive the manual guidance", () => {
  const h = harness({ withSwitchingApis: false });
  try {
    // No-arg listing falls back to the v0.3 instructions.
    h.command.handler("theme", h.fakeCtx);
    assert.ok(h.notifications.at(-1).msg.includes("Switch theme via:"));

    // Alias asks still show the activation guide.
    h.command.handler("theme day", h.fakeCtx);
    assert.ok(h.notifications.at(-1).msg.includes("To activate grok-build-day"));
  } finally {
    h.restoreStdout();
  }
});

test("argument completion offers aliases and installed names without switching themes", () => {
  const h = harness();
  try {
    assert.ok(typeof h.command.getArgumentCompletions === "function", "completions registered");

    const all = h.command.getArgumentCompletions("") ?? [];
    const values = all.map((i) => i.value);
    for (const expected of ["coding", "minimal", "day", "grok-build-coding", "vendor-light", "footer", "info"]) {
      assert.ok(values.includes(expected), `completions must include ${expected}`);
    }

    // Prefix filtering.
    const day = h.command.getArgumentCompletions("da") ?? [];
    assert.deepEqual(day.map((i) => i.value), ["day"]);
    const grok = h.command.getArgumentCompletions("grok-build") ?? [];
    assert.ok(grok.length >= 3, "installed grok-build themes complete by prefix");

    const none = h.command.getArgumentCompletions("zzz");
    assert.equal(none, null, "no matches → null");

    // Completion must be side-effect free.
    assert.equal(h.setThemeCalls.length, 0, "autocomplete never switches themes");
  } finally {
    h.restoreStdout();
  }
});
