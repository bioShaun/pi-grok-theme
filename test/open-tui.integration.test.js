import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import register from "../index.ts";

function harness({ present = true, settings = {}, openConfig, externalFirst = true } = {}) {
  const base = path.resolve(".scratch/test-tmp"); fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, "open-integration-"));
  const settingsPath = path.join(dir, "pi-grok-theme.json");
  const openPath = path.join(dir, "open-tui.json");
  fs.writeFileSync(settingsPath, JSON.stringify(settings));
  if (openConfig !== undefined) fs.writeFileSync(openPath, typeof openConfig === "string" ? openConfig : JSON.stringify(openConfig));
  const calls = [], notices = [], events = {}, gitCounts = [];
  let command;
  const external = () => "external";
  const ui = {
    theme: { name: "grok-build-coding" },
    setFooter: (...args) => calls.push(["footer", ...args]),
    setHeader: (...args) => calls.push(["header", ...args]),
    setWorkingIndicator: (...args) => calls.push(["indicator", ...args]),
    setHiddenThinkingLabel: (...args) => calls.push(["thinking", ...args]),
    setWorkingMessage: external,
    setTitle() {},
    notify: (msg, type) => notices.push({ msg, type }),
    getAllThemes: () => [{ name: "grok-open" }, { name: "grok-open-day" }],
    setTheme: name => { ui.theme.name = name; return { success: true }; },
  };
  const ctx = { hasUI: true, mode: "rpc", cwd: process.cwd(), ui };
  register({
    on: (e, fn) => events[e] = fn,
    registerCommand: (_name, def) => command = def,
    getCommands: () => present ? [{ name: "open-tui", source: "extension" }] : [],
  }, {
    settingsPath,
    gitReader: async (_cwd, opts) => { gitCounts.push(opts.counts); return { state: "not-repo" }; },
    renderClock: { setTimer: () => { calls.push(["timer"]); return { unref() {} }; }, clearTimer() {} },
  });
  const installExternal = () => { ui.setFooter(external); ui.setHeader(external); };
  if (externalFirst) installExternal();
  calls.length = 0;
  events.session_start({}, ctx);
  const startupCalls = [...calls];
  if (!externalFirst) installExternal();
  return { ctx, ui, events, calls, startupCalls, notices, gitCounts, external, settingsPath, openPath,
    run: args => command.handler(args, ctx),
    close() { events.session_shutdown({}, ctx); fs.rmSync(dir, { recursive: true, force: true }); },
  };
}

for (const externalFirst of [true, false]) test(`auto companion keeps open-tui ownership, externalFirst=${externalFirst}`, async () => {
  const h = harness({ externalFirst, settings: { showHeader: true } });
  try {
    assert.deepEqual(h.startupCalls, [], "companion must not install footer/header/indicator/thinking label");
    assert.equal(h.ui.setWorkingMessage, h.external);
    h.calls.length = 0;
    h.events.agent_start({}, h.ctx);
    h.events.message_start({ message: { role: "assistant" } }, h.ctx);
    h.events.tool_execution_start({ toolName: "bash" }, h.ctx);
    await h.run("theme grok-open");
    await h.run("footer glyphs ascii");
    await h.run("motion quiet");
    await h.run("header off");
    assert.deepEqual(h.calls, [], "commands must not reclaim open-tui surfaces");
    assert.ok(!h.gitCounts.includes(true), "companion must not read Git counts");
    await h.run("info"); assert.match(h.notices.at(-1).msg, /companion/);
    h.events.session_shutdown({}, h.ctx);
    assert.deepEqual(h.calls, [], "shutdown must not clear external indicator or surfaces");
  } finally { h.close(); }
});

test("absent or disabled open-tui retains standalone UI", () => {
  for (const options of [{ present: false }, { openConfig: { enabled: false } }, { settings: { integration: "standalone" } }]) {
    const h = harness(options);
    try { assert.ok(h.startupCalls.some(([name]) => name === "footer")); }
    finally { h.close(); }
  }
});

test("explicit companion works without command discovery and survives reload", async () => {
  const h = harness({ present: false, settings: { integration: "companion" } });
  try {
    assert.deepEqual(h.startupCalls, []);
    await h.run("integration standalone");
    assert.equal(JSON.parse(fs.readFileSync(h.settingsPath)).integration, "standalone");
    assert.match(h.notices.at(-1).msg, /reload/);
    assert.deepEqual(h.calls, [], "mode switch is applied on reload, never mid-turn");
    h.events.session_shutdown({}, h.ctx);
    h.events.session_start({}, h.ctx);
    assert.ok(h.calls.some(([name]) => name === "footer"));
  } finally { h.close(); }
});

test("daily and diagnostic profiles preserve unrelated personal settings", async () => {
  const original = { settingsLanguage: "zh", cursorStyle: "underline", icons: { mode: "nerd" },
    future: { keep: true }, footerSegments: { hostname: true, extensionStatuses: false }, telemetry: { futureMetric: true } };
  const h = harness({ openConfig: original });
  try {
    await h.run("open-tui daily");
    let config = JSON.parse(fs.readFileSync(h.openPath));
    assert.equal(config.inlineFooter, true);
    assert.equal(config.footerSegments.tokens, false);
    assert.equal(config.footerSegments.runtime, false);
    assert.equal(config.telemetry.tps, false);
    assert.equal(config.telemetry.duration, true);
    assert.equal(config.telemetry.stalls, true);
    for (const key of ["settingsLanguage", "cursorStyle", "icons", "future"]) assert.deepEqual(config[key], original[key]);
    assert.equal(config.footerSegments.hostname, true);
    assert.equal(config.footerSegments.extensionStatuses, false);
    assert.equal(config.telemetry.futureMetric, true);
    assert.match(h.notices.at(-1).msg, /reload/);
    await h.run("open-tui diagnostic");
    config = JSON.parse(fs.readFileSync(h.openPath));
    assert.equal(config.inlineFooter, false);
    assert.equal(config.telemetry.tps, true);
    assert.equal(config.footerSegments.tokens, true);
    assert.equal(config.icons.mode, "nerd");
  } finally { h.close(); }
});

for (const malformed of ["{broken", "[]", "null", '{"telemetry":false}']) test(`profile refuses malformed settings: ${malformed}`, async () => {
  const h = harness({ openConfig: malformed });
  try {
    await h.run("open-tui daily");
    assert.equal(fs.readFileSync(h.openPath, "utf8"), malformed);
    assert.equal(h.notices.at(-1).type, "error");
  } finally { h.close(); }
});

test("companion themes are registered and use explicit readable text", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json"));
  for (const name of ["grok-open", "grok-open-day"]) {
    assert.ok(pkg.pi.themes.includes(`./themes/${name}.json`), `${name} must be installable`);
    const theme = JSON.parse(fs.readFileSync(`themes/${name}.json`));
    assert.equal(theme.colors.text, "fg");
    assert.notEqual(theme.colors.toolErrorBg, theme.colors.toolSuccessBg);
  }
});
