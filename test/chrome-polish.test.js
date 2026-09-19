import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { syncBuiltinESMExports } from "node:module";
import { stripVTControlCharacters } from "node:util";
import register from "../index.ts";
import { renderGrokFooter, DEFAULT_FOOTER_CONFIG, visibleWidth, separatorForStyle } from "../footer.ts";
import { renderHeader } from "../header.ts";
import { WorkingStateController } from "../status.ts";
import { resolveGlyphDensity, resolveGlyphs } from "../glyphs.ts";
import { loadSettings, saveSettings, DEFAULT_GROK_SETTINGS } from "../settings.ts";
const plain = stripVTControlCharacters;
const ctx = { hasUI: true, cwd: "/project/example", model: { name: "vendor/unknown-model-with-a-very-long-name", contextWindow: 200000 }, getContextUsage: () => ({ tokens: 48000, percent: 24 }) };
function harness(t, initial = {}, extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-polish-"));
  const settingsPath = path.join(dir, "prefs.json");
  saveSettings({ ...DEFAULT_GROK_SETTINGS, ...initial }, settingsPath);
  const events = {}, notices = [], indicators = [], messages = [], timers = new Map();
  let command, footer, header, renders = 0;
  const tui = { requestRender: () => renders++ };
  const context = { ...ctx, ui: {
    setFooter: (factory) => { footer?.dispose?.(); footer = factory?.(tui, undefined, { getExtensionStatuses: () => new Map() }); },
    setHeader: (factory) => { header = factory?.(tui, undefined); },
    setWorkingMessage: (message) => messages.push(message),
    setWorkingIndicator: (indicator) => indicators.push(indicator),
    notify: (message, kind) => notices.push({ message: plain(message), kind }),
  } };
  const pi = { on: (name, fn) => { events[name] = fn; }, registerCommand: (_name, definition) => { command = definition; } };
  register(pi, { settingsPath, gitReader: async () => ({ state: "not-repo" }), renderClock: {
    requestRender: () => {},
    setTimer: (cb, ms) => { const id = {}; timers.set(id, { cb, ms }); return id; },
    clearTimer: (id) => timers.delete(id),
  }, ...extra });
  events.session_start({}, context);
  t.after(() => { events.session_shutdown({}, context); fs.rmSync(dir, { recursive: true, force: true }); });
  return { dir, settingsPath, context, events, notices, indicators, messages, timers,
    run: (args) => command.handler(args, context), complete: (prefix) => command.getArgumentCompletions(prefix),
    footer: (width = 120) => footer.render(width), header: (width = 100) => header?.render(width),
    renders: () => renders, tick: () => { const [id, timer] = timers.entries().next().value; timers.delete(id); timer.cb(); },
  };
}

test("all narrow widths keep activity and a model fragment for unknown long names", () => {
  for (const motion of ["normal", "quiet"]) for (const glyphDensity of ["unicode", "ascii", "nerd"]) {
    const state = new WorkingStateController(); state.startTurn(0); state.startTool("unfamiliar_tool_with_a_long_name", 0);
    for (const preset of ["minimal", "default", "full"]) for (let width = 20; width <= 160; width++) {
      const [line] = renderGrokFooter(ctx, state, width, new Map([["extra", "extension ".repeat(30)]]), { ...DEFAULT_FOOTER_CONFIG, preset, motion, glyphDensity });
      assert.ok(visibleWidth(line) <= width, `${preset}/${glyphDensity}/${width}`);
      assert.match(plain(line), /unknown|un…|unk|un~|u[~…]?/, `model at ${width}: ${plain(line)}`);
      assert.match(plain(line), /tool|running/, `activity at ${width}: ${plain(line)}`);
    }
  }
});

test("wide status region and left fields stay stable across timer digit boundaries", () => {
  const state = new WorkingStateController(); state.startTurn(0); state.startTool("bash", 0);
  const badge = state.getBadge.bind(state);
  let left;
  for (const now of [9900, 10000, 59000, 60000, 60100]) {
    state.getBadge = (_now, motion) => badge(now, motion);
    const line = plain(renderGrokFooter(ctx, state, 120)[0]);
    assert.equal(visibleWidth(line), 120);
    assert.equal(line.indexOf("●"), 96);
    assert.equal(line.slice(94, 96), "  ");
    if (left) assert.equal(line.slice(0, 96), left);
    left = line.slice(0, 96);
  }
});

test("Git unknown is visible and does not display stale counts", () => {
  const [row] = renderGrokFooter({ ...ctx, model: { name: "model" } }, new WorkingStateController(), 120, undefined, { ...DEFAULT_FOOTER_CONFIG, gitSnapshot: { state: "error", branch: "main", staged: 9, dirty: 8, untracked: 7 } });
  assert.match(plain(row), /main git\?/);
  assert.doesNotMatch(plain(row), /\+9|~8|\?7/);
});

test("glyph auto and explicit preferences have predictable precedence", () => {
  assert.equal(resolveGlyphDensity("auto", { TERM: "dumb" }, "win32"), "ascii");
  assert.equal(resolveGlyphDensity(undefined, { WT_SESSION: "modern" }, "win32"), "unicode");
  assert.equal(resolveGlyphDensity("auto", { PI_GROK_LEGACY_GLYPHS: "0" }, "win32"), "unicode");
  assert.equal(resolveGlyphDensity("ascii", { PI_GROK_LEGACY_GLYPHS: "0" }, "win32"), "ascii");
  assert.equal(resolveGlyphDensity("nerd", { PI_GROK_LEGACY_GLYPHS: "1" }, "linux"), "ascii");
  assert.equal(resolveGlyphDensity("unicode", {}, "win32"), "unicode");
  for (const value of Object.values(resolveGlyphs("ascii")).flat()) assert.match(value, /^[\x20-\x7e]+$/);
  assert.equal(separatorForStyle("powerline-thin", "ascii"), " | ");
});

test("ASCII chrome preserves user Unicode while all generated decoration is ASCII", () => {
  const state = new WorkingStateController(); state.startTurn(0);
  const asciiCtx = { ...ctx, model: { name: "long-model" } };
  for (const width of [1, 20, 44, 80, 120]) {
    const rows = [...renderGrokFooter(asciiCtx, state, width, undefined, { ...DEFAULT_FOOTER_CONFIG, glyphDensity: "ascii" }), ...renderHeader(asciiCtx, width, { style: "boxed", glyphDensity: "ascii" })];
    for (const row of rows) assert.match(plain(row), /^[\x20-\x7e]*$/);
  }
  const row = renderGrokFooter({ ...asciiCtx, model: { name: "中文模型" } }, state, 120, undefined, { ...DEFAULT_FOOTER_CONFIG, glyphDensity: "ascii" })[0];
  assert.match(plain(row), /中文模型/);
});

test("header commands preserve selected style, apply immediately, and persist", async (t) => {
  const h = harness(t);
  assert.equal(h.header(), undefined);
  await h.run("header"); assert.equal(h.header().length, 1);
  assert.doesNotMatch(plain(h.header().join("")), /GROK BUILD|model:|v0\./);
  await h.run("header boxed"); assert.equal(h.header().length, 3);
  await h.run("header off"); assert.equal(h.header(), undefined);
  await h.run("header on"); assert.equal(h.header().length, 3);
  assert.equal(loadSettings(h.settingsPath).headerStyle, "boxed");
  assert.ok(h.complete("header c").some((item) => item.value === "header compact"));
  await h.run("header invalid"); assert.equal(h.notices.at(-1).kind, "warning");
});

test("ASCII notifications preserve Unicode workspace, model, and theme names", async (t) => {
  const h = harness(t, { glyphDensity: "ascii" });
  h.context.cwd = "/project/Acme·π●•";
  h.context.model = { name: "Model·π●•" };
  await h.run("info");
  const info = h.notices.at(-1).message;
  assert.ok(info.includes(h.context.cwd));
  assert.ok(info.includes(h.context.model.name));
  assert.match(info.split("\n")[0], /^[\x20-\x7e]+$/);
  await h.run("theme Acme·π●•");
  assert.match(h.notices.at(-1).message, /Acme·π●•/);
  await h.run("themes");
  assert.match(h.notices.at(-1).message, /^[\x09\x0a\x0d\x20-\x7e]+$/);
});

test("assistant thinking deltas retain phase time until text starts generating", async (t) => {
  let now = 1000; t.mock.method(Date, "now", () => now);
  const h = harness(t, { motion: "quiet" });
  await Promise.resolve(); await Promise.resolve();
  const message = { role: "assistant" };
  const update = (type) => h.events.message_update({ message, assistantMessageEvent: { type } }, h.context);
  h.events.agent_start({}, h.context);
  h.events.message_start({ message }, h.context);
  update("start"); update("thinking_start");
  const before = h.renders();
  now = 2400; update("thinking_delta");
  assert.match(plain(h.footer()[0]), /thinking\s+1s/);
  assert.equal(h.renders(), before);
  now = 3600; update("thinking_delta"); update("thinking_end");
  assert.match(plain(h.footer()[0]), /thinking\s+2s/);
  update("text_start");
  assert.ok(h.renders() > before);
  assert.match(plain(h.footer()[0]), /generating\s+0s/);
  now = 4900; update("text_delta");
  assert.match(plain(h.footer()[0]), /generating\s+1s/);
  h.events.agent_end({}, h.context);
  assert.match(plain(h.footer()[0]), /idle/);
  assert.equal(h.timers.size, 0);
});

test("old enabled Header migrates to boxed while missing glyph preference becomes auto", (t) => {
  const h = harness(t);
  fs.writeFileSync(h.settingsPath, JSON.stringify({ showHeader: true, footerPreset: "auto" }));
  const loaded = loadSettings(h.settingsPath);
  assert.equal(loaded.headerStyle, "boxed"); assert.equal(loaded.glyphDensity, "auto");
  assert.equal(loaded.footerPreset, "default");
  assert.equal(JSON.parse(fs.readFileSync(h.settingsPath)).headerStyle, "boxed");
});

test("quiet mode installs one static frame and does not defer state changes", async (t) => {
  const h = harness(t);
  await h.run("motion quiet");
  assert.equal(h.indicators.at(-1).frames.length, 1);
  const assistant = { message: { role: "assistant" } };
  h.events.message_start(assistant, h.context);
  const before = h.renders();
  h.events.tool_execution_start({ toolName: "bash" }, h.context);
  assert.ok(h.renders() > before);
  assert.match(plain(h.footer()[0]), /running bash/);
  assert.doesNotMatch(plain(h.footer()[0]), /\d\.\ds/);
  h.context.ui.setWorkingMessage("thinking");
  assert.doesNotMatch(h.messages.at(-1), /[●⠋]|\d\.\ds/);
  await h.run("motion normal"); assert.ok(h.indicators.at(-1).frames.length > 1);
  assert.equal(loadSettings(h.settingsPath).motion, "normal");
});

test("quiet timer-only ticks coalesce within a second without slowing the shared clock", async (t) => {
  let now = 1000; t.mock.method(Date, "now", () => now);
  const h = harness(t, { motion: "quiet" });
  await Promise.resolve(); await Promise.resolve();
  h.events.message_start({ message: { role: "assistant" } }, h.context);
  const before = h.renders();
  for (const time of [1250, 1500, 1750]) { now = time; h.tick(); }
  assert.equal(h.renders(), before);
  now = 2000; h.tick(); assert.equal(h.renders(), before + 1);
  assert.equal(h.timers.values().next().value.ms, 250);
});

test("quiet reports unsupported host animation without failing", async (t) => {
  const h = harness(t);
  h.context.ui.setWorkingIndicator = undefined;
  await h.run("motion quiet");
  assert.match(h.notices.at(-1).message, /host animation cannot be customized/);
  assert.equal(loadSettings(h.settingsPath).motion, "quiet");
});

test("failed save keeps session preferences and produces one honest notification", async (t) => {
  const h = harness(t);
  fs.unlinkSync(h.settingsPath); fs.mkdirSync(h.settingsPath);
  const before = h.notices.length;
  await h.run("footer minimal");
  assert.equal(h.notices.length, before + 1);
  assert.match(h.notices.at(-1).message, /session only.*could not be saved/);
  assert.equal(h.notices.at(-1).kind, "warning");
  assert.equal(fs.readdirSync(h.dir).filter((name) => name.endsWith(".pending")).length, 0);
  await h.run("footer"); assert.match(h.notices.at(-1).message, /preset=minimal/);
});

test("atomic replace failure preserves prior file and cleans pending files", (t) => {
  const h = harness(t);
  const before = fs.readFileSync(h.settingsPath, "utf8");
  t.mock.method(fs, "renameSync", () => { throw new Error("injected replace failure"); });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const result = saveSettings({ ...DEFAULT_GROK_SETTINGS, motion: "quiet" }, h.settingsPath);
  assert.equal(result.success, false);
  assert.equal(fs.readFileSync(h.settingsPath, "utf8"), before);
  assert.equal(fs.readdirSync(h.dir).filter((name) => name.endsWith(".pending")).length, 0);
});

test("pending Git does not block footer or commands and completion refreshes", async (t) => {
  let complete;
  const h = harness(t, {}, { gitReader: () => new Promise((resolve) => { complete = resolve; }) });
  assert.ok(h.footer()[0]);
  await h.run("header compact"); assert.equal(h.header().length, 1);
  const before = h.renders();
  complete({ state: "ready", branch: "feature", staged: 2, dirty: 0, untracked: 0 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(h.renders() > before);
  assert.match(plain(h.footer()[0]), /feature.*\+2/);
  assert.match(plain(h.header()[0]), /feature/);
});

test("host agent completion stops tool timers even without a final assistant message", (t) => {
  let now = 1000; t.mock.method(Date, "now", () => now);
  const h = harness(t, { footerPreset: "full", motion: "quiet" });
  h.events.agent_start({}, h.context);
  now = 3000;
  h.events.message_start({ message: { role: "assistant" } }, h.context);
  h.events.message_end({ message: { role: "assistant" } }, h.context);
  h.events.tool_execution_start({ toolName: "bash" }, h.context);
  now = 5000;
  assert.match(plain(h.footer(160)[0]), /4s turn/);
  h.events.agent_end({}, h.context);
  assert.equal(h.timers.size, 0);
  assert.match(plain(h.footer()[0]), /idle/);
  assert.doesNotMatch(plain(h.footer()[0]), /turn/);
});

test("minimal with no visible branch consumer never queries Git", async (t) => {
  let calls = 0;
  const h = harness(t, { footerPreset: "minimal" }, { gitReader: async () => { calls++; return { state: "ready", branch: "main" }; } });
  assert.equal(calls, 0);
  h.events.agent_start({}, h.context); h.tick();
  assert.equal(calls, 0);
  await h.run("header compact");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  assert.match(plain(h.header()[0]), /main/);
});

test("concurrent saves always leave one complete settings snapshot", async (t) => {
  const h = harness(t);
  const choices = [
    { ...DEFAULT_GROK_SETTINGS, footerPreset: "minimal", motion: "quiet" },
    { ...DEFAULT_GROK_SETTINGS, footerPreset: "full", headerStyle: "boxed", showHeader: true },
  ];
  const moduleUrl = pathToFileURL(path.resolve("settings.ts")).href;
  let finished = false;
  const writers = choices.map((choice) => new Promise((resolve, reject) => {
    const code = `import {saveSettings} from ${JSON.stringify(moduleUrl)}; const r=saveSettings(${JSON.stringify(choice)},${JSON.stringify(h.settingsPath)}); process.exitCode=r.success?0:1;`;
    const child = spawn(process.execPath, ["--input-type=module", "-e", code], { stdio: "ignore" });
    child.on("error", reject); child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`save child exited ${code}`)));
  }));
  const complete = Promise.all(writers).finally(() => { finished = true; });
  while (!finished) {
    const observed = JSON.parse(fs.readFileSync(h.settingsPath, "utf8"));
    assert.ok([DEFAULT_GROK_SETTINGS, ...choices].some((choice) => JSON.stringify(choice) === JSON.stringify(observed)));
    await new Promise((resolve) => setImmediate(resolve));
  }
  await complete;
  assert.ok(choices.some((choice) => JSON.stringify(choice) === JSON.stringify(loadSettings(h.settingsPath))));
});
