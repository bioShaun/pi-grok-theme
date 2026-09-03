/**
 * release.test.js — v0.4 release asset gates
 *
 * 1. version sync: package.json === version.ts === header default;
 * 2. preview determinism: the committed SVGs byte-match a fresh render from
 *    the real chrome code (they are never hand-drawn or stale);
 * 3. package completeness: every runtime module, theme, and documentation
 *    artifact referenced by the extension is listed in package.json `files`.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { VERSION } from "../version.ts";
import { DEFAULT_HEADER_OPTIONS } from "../header.ts";
import { toTerminalSvg, renderChromeLines } from "../scripts/render-previews.js";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

test("package metadata and displayed versions are synchronized", () => {
  assert.equal(pkg.version, VERSION, "package.json version must match version.ts");
  assert.equal(DEFAULT_HEADER_OPTIONS.version, VERSION, "header default version must match version.ts");
  assert.match(VERSION, /^\d+\.\d+\.\d+$/, "VERSION must be a semver string");
});

test("committed preview SVGs byte-match a fresh deterministic render", () => {
  for (const name of ["grok-build-coding", "grok-build", "grok-build-day"]) {
    const committed = fs.readFileSync(path.join(ROOT, "docs", "previews", `${name}.svg`), "utf8");
    assert.ok(committed.startsWith("<svg"), `${name} preview exists`);
    assert.ok(committed.includes(name), `${name} preview carries the theme caption`);

    const chrome = renderChromeLines(name);
    const themeJson = JSON.parse(fs.readFileSync(path.join(ROOT, "themes", `${name}.json`), "utf8"));
    const fresh = toTerminalSvg({
      background: themeJson.vars.terminalBg,
      sections: [
        { caption: `${name} — header (opt-in via /grok header)`, lines: chrome.header },
        { caption: "footer — wide layout (auto preset, 120 cols)", lines: chrome.wideFooter },
        { caption: "footer — narrow layout (44 cols): compact model + context %", lines: chrome.narrowFooter },
      ],
    });
    assert.equal(fresh, committed, `${name} preview is stale — run \`npm run previews\``);
  }
});

test("previews demonstrate narrow and wide footer layouts", () => {
  const chrome = renderChromeLines("grok-build-coding");
  assert.ok(chrome.wideFooter.length === 1, "wide footer is one line");
  assert.ok(chrome.narrowFooter.length === 1, "narrow footer is one line");
  assert.notEqual(chrome.wideFooter[0], chrome.narrowFooter[0], "layouts must differ");
});

test("package installation contents include every runtime and doc artifact", () => {
  const files = new Set(pkg.files);

  // Every local .ts module the extension imports must ship.
  const runtimeModules = [
    "index.ts",
    "chrome-theme.ts",
    "cursor.ts",
    "footer.ts",
    "glyphs.ts",
    "header.ts",
    "render-clock.ts",
    "status.ts",
    "version.ts",
    "working-indicator.ts",
  ];
  for (const module of runtimeModules) {
    assert.ok(files.has(module), `runtime module ${module} missing from package.files`);
    assert.ok(fs.existsSync(path.join(ROOT, module)), `${module} exists`);
  }

  // Themes, docs, previews.
  for (const artifact of ["themes", "README.md", "README.zh-CN.md", "CHANGELOG.md", "guidelines.md", "LICENSE", "docs/previews"]) {
    assert.ok(files.has(artifact), `${artifact} missing from package.files`);
  }
  assert.equal(pkg.pi.themes.length, 3, "all three themes are registered in the pi manifest");
  assert.equal(pkg.pi.extensions.length, 1, "extension entrypoint registered");

  // Committed preview assets exist on disk.
  for (const name of ["grok-build-coding", "grok-build", "grok-build-day"]) {
    assert.ok(
      fs.existsSync(path.join(ROOT, "docs", "previews", `${name}.svg`)),
      `${name} preview asset committed`,
    );
  }
});
