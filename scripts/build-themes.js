#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { paletteDark } from "./theme-src/palette-dark.js";
import { paletteDay } from "./theme-src/palette-day.js";
import { overlayBase } from "./theme-src/overlay-base.js";
import { overlayCoding } from "./theme-src/overlay-coding.js";
import { overlayDay } from "./theme-src/overlay-day.js";

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

function writeTheme(relPath, theme) {
  const abs = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(theme, null, 2)}\n`, "utf8");
}

const themes = [
  ["themes/grok-build.json", buildPiTheme(paletteDark, overlayBase)],
  ["themes/grok-build-coding.json", buildPiTheme(paletteDark, overlayCoding)],
  ["themes/grok-build-day.json", buildPiTheme(paletteDay, overlayDay)],
];

for (const [rel, theme] of themes) writeTheme(rel, theme);
console.log(`Wrote ${themes.length} Pi themes`);
