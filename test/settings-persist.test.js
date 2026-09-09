/**
 * settings-persist.test.js — footer/header prefs survive across sessions
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import registerGrokBuildExtension from "../index.ts";
import { loadSettings, saveSettings, DEFAULT_GROK_SETTINGS } from "../settings.ts";

function tempSettingsPath() {
  return path.join(os.tmpdir(), `pi-grok-theme-settings-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
}

test("loadSettings returns defaults for missing/invalid files", () => {
  const missing = tempSettingsPath();
  assert.deepEqual(loadSettings(missing), DEFAULT_GROK_SETTINGS);

  const bad = tempSettingsPath();
  fs.writeFileSync(bad, "{not-json", "utf8");
  assert.deepEqual(loadSettings(bad), DEFAULT_GROK_SETTINGS);
  fs.unlinkSync(bad);
});

test("saveSettings + loadSettings round-trip all four fields", () => {
  const file = tempSettingsPath();
  saveSettings({
    footerPreset: "minimal",
    showHeader: true,
    glyphDensity: "nerd",
    separatorStyle: "slash",
  }, file);
  assert.deepEqual(loadSettings(file), {
    footerPreset: "minimal",
    showHeader: true,
    glyphDensity: "nerd",
    separatorStyle: "slash",
  });
  fs.unlinkSync(file);
});

test("loadSettings migrates footerPreset auto → default and write-backs", () => {
  const file = tempSettingsPath();
  fs.writeFileSync(file, JSON.stringify({ footerPreset: "auto", showHeader: true }), "utf8");
  const loaded = loadSettings(file);
  assert.equal(loaded.footerPreset, "default");
  assert.equal(loaded.glyphDensity, "unicode");
  assert.equal(loaded.separatorStyle, "dot");
  assert.equal(loaded.showHeader, true);
  const disk = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(disk.footerPreset, "default");
  assert.ok(disk.footerPreset !== "auto");
  fs.unlinkSync(file);
});

test("saveSettings never writes auto and includes new keys", () => {
  const file = tempSettingsPath();
  saveSettings({
    footerPreset: "default",
    showHeader: false,
    glyphDensity: "nerd",
    separatorStyle: "slash",
  }, file);
  const disk = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.deepEqual(disk, {
    footerPreset: "default",
    showHeader: false,
    glyphDensity: "nerd",
    separatorStyle: "slash",
  });
  fs.unlinkSync(file);
});

test("session_start loads persisted prefs; /grok footer|header saves them", async () => {
  const settingsPath = tempSettingsPath();
  saveSettings({ footerPreset: "full", showHeader: true, glyphDensity: "unicode", separatorStyle: "dot" }, settingsPath);

  const notifications = [];
  let headerFactory = null;
  let footerFactory = null;
  const listeners = {};
  let registered;

  const fakePi = {
    on: (evt, handler) => {
      listeners[evt] = handler;
    },
    registerCommand: (_n, def) => {
      registered = def;
    },
  };

  const fakeCtx = {
    hasUI: true,
    mode: "tui",
    cwd: process.cwd(),
    model: { name: "claude-3.7-sonnet", id: "anthropic/claude-3.7-sonnet", contextWindow: 200000 },
    getContextUsage: () => ({ usedTokens: 1000, contextWindow: 200000, percent: 1 }),
    ui: {
      setFooter: (factory) => {
        footerFactory = factory;
      },
      setHeader: (factory) => {
        headerFactory = factory;
      },
      setWorkingMessage: () => {},
      notify: (msg, type) => notifications.push({ msg, type }),
    },
  };

  registerGrokBuildExtension(fakePi, { settingsPath });
  listeners.session_start({}, fakeCtx);

  assert.equal(typeof headerFactory, "function", "persisted showHeader=true installs header on session_start");
  assert.equal(typeof footerFactory, "function");

  notifications.length = 0;
  await registered.handler("footer", fakeCtx);
  assert.ok(notifications.some((n) => n.msg.includes("Current:") && n.msg.includes("full")));

  // Toggle header off and switch footer → persisted for next session.
  await registered.handler("header", fakeCtx);
  await registered.handler("footer minimal", fakeCtx);
  assert.deepEqual(loadSettings(settingsPath), { footerPreset: "minimal", showHeader: false, glyphDensity: "unicode", separatorStyle: "dot" });

  // Fresh registration simulates a new session.
  const listeners2 = {};
  let header2 = null;
  let registered2;
  const fakePi2 = {
    on: (evt, handler) => {
      listeners2[evt] = handler;
    },
    registerCommand: (_n, def) => {
      registered2 = def;
    },
  };
  const fakeCtx2 = {
    ...fakeCtx,
    ui: {
      ...fakeCtx.ui,
      setHeader: (factory) => {
        header2 = factory ?? null;
      },
      setFooter: () => {},
      notify: (msg, type) => notifications.push({ msg, type }),
    },
  };
  registerGrokBuildExtension(fakePi2, { settingsPath });
  listeners2.session_start({}, fakeCtx2);
  assert.equal(header2, null, "persisted showHeader=false keeps header off");

  notifications.length = 0;
  await registered2.handler("footer", fakeCtx2);
  assert.ok(notifications.some((n) => n.msg.includes("Current:") && n.msg.includes("minimal")));

  fs.unlinkSync(settingsPath);
});
