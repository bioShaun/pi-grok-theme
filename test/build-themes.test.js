import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(".");
const THEME_FILES = [
  "themes/grok-build.json",
  "themes/grok-build-coding.json",
  "themes/grok-build-day.json",
  "themes/grok-open.json",
  "themes/grok-open-day.json",
];

test("build:themes script exists and regenerates Pi themes without raw hex in colors", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.scripts["build:themes"], "node scripts/build-themes.js");

  const run = spawnSync("node", ["scripts/build-themes.js"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);

  for (const rel of THEME_FILES) {
    const theme = JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
    assert.ok(theme.vars && typeof theme.vars === "object");
    assert.ok(theme.colors && typeof theme.colors === "object");
    for (const [key, value] of Object.entries(theme.colors)) {
      assert.equal(typeof value, "string", `${rel} colors.${key}`);
      if (value !== "") {
        assert.ok(!value.startsWith("#"), `${rel} colors.${key} must be a var ref, got ${value}`);
        assert.ok(value in theme.vars, `${rel} colors.${key}=${value} missing from vars`);
      }
    }
    assert.equal(theme.colors.text, rel.includes("grok-open") ? "fg" : "");
    assert.ok(!("pythonMode" in theme.colors));
    assert.ok(!Object.keys(theme.colors).some((k) => k.startsWith("statusLine")));
  }
});

const OMP_KEYS = [
  "pythonMode",
  "statusLineBg", "statusLineSep", "statusLineModel", "statusLinePath",
  "statusLineGitClean", "statusLineGitDirty", "statusLineContext", "statusLineSpend",
  "statusLineStaged", "statusLineDirty", "statusLineUntracked",
  "statusLineOutput", "statusLineCost", "statusLineSubagents",
];

test("omp themes include 15 extra keys; Pi themes do not", () => {
  spawnSync("node", ["scripts/build-themes.js"], { cwd: ROOT });
  for (const name of ["grok-build", "grok-build-coding", "grok-build-day"]) {
    const pi = JSON.parse(fs.readFileSync(`themes/${name}.json`, "utf8"));
    const omp = JSON.parse(fs.readFileSync(`themes/omp/${name}.json`, "utf8"));
    for (const key of OMP_KEYS) {
      assert.ok(!(key in pi.colors), `Pi must not contain ${key}`);
      assert.ok(key in omp.colors, `omp must contain ${key}`);
      assert.ok(omp.colors[key] in omp.vars, `omp ${key} must alias a var`);
    }
  }
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.ok(!pkg.pi.themes.some((p) => p.includes("/omp/")));
});
