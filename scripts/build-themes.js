#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { paletteDark } from "./theme-src/palette-dark.js";
import { paletteDay } from "./theme-src/palette-day.js";
import { overlayBase } from "./theme-src/overlay-base.js";
import { overlayCoding } from "./theme-src/overlay-coding.js";
import { overlayDay } from "./theme-src/overlay-day.js";

import { overlayOpen, overlayOpenDay } from "./theme-src/overlay-open.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA =
  "https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json";

function buildPiTheme(palette, overlay) {
  const vars = { ...palette, ...(overlay.varsExtra ?? {}) };
  return {
    $schema: SCHEMA,
    name: overlay.name,
    vars,
    colors: { ...overlay.colors },
    export: { ...overlay.export },
  };
}


const OMP_STATUS_LINE = {
  pythonMode: "amber",
  statusLineBg: "surface1",
  statusLineSep: "dim",
  statusLineModel: "blue",
  statusLinePath: "fgSecondary",
  statusLineGitClean: "green",
  statusLineGitDirty: "amber",
  statusLineContext: "cyan",
  statusLineSpend: "purple",
  statusLineStaged: "green",
  statusLineDirty: "amber",
  statusLineUntracked: "red",
  statusLineOutput: "fgSecondary",
  statusLineCost: "purple",
  statusLineSubagents: "cyan",
};

function buildOmpTheme(palette, overlay) {
  const pi = buildPiTheme(palette, overlay);
  return {
    ...pi,
    colors: { ...pi.colors, ...OMP_STATUS_LINE },
  };
}

function writeTheme(relPath, theme) {
  const abs = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(theme, null, 2)}\n`, "utf8");
}

const piThemes = [
  ["themes/grok-open.json", buildPiTheme(paletteDark, overlayOpen)],
  ["themes/grok-open-day.json", buildPiTheme(paletteDay, overlayOpenDay)],
  ["themes/grok-build.json", buildPiTheme(paletteDark, overlayBase)],
  ["themes/grok-build-coding.json", buildPiTheme(paletteDark, overlayCoding)],
  ["themes/grok-build-day.json", buildPiTheme(paletteDay, overlayDay)],
];

const ompThemes = [
  ["themes/omp/grok-build.json", buildOmpTheme(paletteDark, overlayBase)],
  ["themes/omp/grok-build-coding.json", buildOmpTheme(paletteDark, overlayCoding)],
  ["themes/omp/grok-build-day.json", buildOmpTheme(paletteDay, overlayDay)],
];

for (const [rel, theme] of [...piThemes, ...ompThemes]) writeTheme(rel, theme);
console.log(`Wrote ${piThemes.length} Pi themes + ${ompThemes.length} omp themes`);
