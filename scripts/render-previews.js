/**
 * render-previews.js — deterministic preview renderer for pi-grok-theme
 *
 * Produces the release preview assets (docs/previews/*.svg) from the REAL
 * render code path: bundled theme JSON is loaded into genuine Pi `Theme`
 * instances, the WorkingStateController is driven into an active state, and
 * `renderHeader` / `renderGrokFooter` render the chrome. A small ANSI→SVG
 * converter paints the captured truecolor output — nothing is hand-drawn.
 *
 * Usage: npm run previews   (regenerates docs/previews/*.svg)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { spawnSync } from "node:child_process";
import { Theme } from "@earendil-works/pi-coding-agent";
import { renderGrokFooter, DEFAULT_FOOTER_CONFIG, visibleWidth, stripOsc8 } from "../footer.ts";
import { renderHeader, DEFAULT_HEADER_OPTIONS } from "../header.ts";
import { WorkingStateController } from "../status.ts";
import { VERSION } from "../version.ts";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const THEMES = ["grok-build-coding", "grok-build", "grok-build-day"];
const OUT_DIR = path.join(ROOT, "docs", "previews");

const BG_TOKENS = new Set([
  "selectedBg",
  "scrollbarThumb",
  "searchMatchBg",
  "userMessageBg",
  "customMessageBg",
  "toolPendingBg",
  "toolSuccessBg",
  "toolErrorBg",
]);

/** Build a genuine Pi Theme instance from a bundled theme JSON file. */
export function loadBundledTheme(name) {
  const file = path.join(ROOT, "themes", `${name}.json`);
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  const resolve = (value) => {
    if (typeof value === "number") return value;
    if (value === "" || value === undefined) return "";
    if (value.startsWith("#")) return value;
    return json.vars[value] ?? "";
  };
  const fgColors = {};
  const bgColors = {};
  for (const [token, value] of Object.entries(json.colors)) {
    const resolved = resolve(value);
    if (BG_TOKENS.has(token)) bgColors[token] = resolved;
    else fgColors[token] = resolved;
  }
  return new Theme(fgColors, bgColors, "truecolor", { name: json.name });
}

/** Preview paths are labels only: no filesystem access or HOME mutation. */
export const PREVIEW_HOME = os.homedir();
export const PREVIEW_CWD = path.join(PREVIEW_HOME, "pi", "pi-grok-theme");
export function ensurePreviewFixture() {}
export function renderChromeLines(themeName) {
  const theme = loadBundledTheme(themeName);
  const now = Date.now();
  const ctx = {
    hasUI: true, mode: "tui", cwd: PREVIEW_CWD,
    model: { name: "claude-sonnet-4", id: "anthropic/claude-sonnet-4", contextWindow: 200000 },
    getContextUsage: () => ({ tokens: 48000, contextWindow: 200000, percent: 24 }),
    thinkingLevel: "high",
  };
  const gitSnapshot = { state: "ready", branch: "main", staged: 2, dirty: 1, untracked: 3 };
  const status = new WorkingStateController();
  status.startTurn(now); status.startTool("bash", now);
  // Fixed timestamps through the public badge seam keep all output deterministic.
  const liveBadge = status.getBadge.bind(status);
  status.getBadge = (_now, motion) => liveBadge(now + 3200, motion);
  const config = { ...DEFAULT_FOOTER_CONFIG, preset: "default", gitSnapshot, glyphDensity: "unicode" };
  const header = { ...DEFAULT_HEADER_OPTIONS, getGitSnapshot: () => gitSnapshot };
  const row = (width, overrides = {}, context = ctx) => renderGrokFooter(context, status, width, new Map(), { ...config, ...overrides }, theme);
  return {
    header: renderHeader(ctx, 100, header, theme),
    boxedHeader: renderHeader(ctx, 100, { ...header, style: "boxed" }, theme),
    wideFooter: row(120), narrowFooter: row(44), tinyFooter: row(20),
    quietFooter: row(120, { motion: "quiet" }),
    asciiFooter: row(80, { glyphDensity: "ascii", separator: " | " }),
    pressureFooter: row(80, {}, { ...ctx, getContextUsage: () => ({ percent: 90 }) }),
    unknownFooter: row(100, { gitSnapshot: { state: "error", branch: "main" } }),
    longFooter: row(40, {}, { ...ctx, model: { name: "vendor/very-long-unknown-model-name", contextWindow: 200000 } }),
    idleFooter: renderGrokFooter(ctx, new WorkingStateController(), 120, new Map(), config, theme),
  };
}
export function chromePreviewSections(name) {
  const c = renderChromeLines(name);
  return [
    { caption: `${name} — compact header (opt-in)`, lines: c.header },
    { caption: "boxed header — existing style remains available", lines: c.boxedHeader },
    { caption: "footer — 120 cols; left metadata / right activity", lines: c.wideFooter },
    { caption: "narrow footer — 44 / 20 cols; core fields retained", lines: [...c.narrowFooter, ...c.tinyFooter] },
    { caption: "quiet — integer seconds; static indicator in host", lines: c.quietFooter },
    { caption: "ASCII — 80 cols", lines: c.asciiFooter },
    { caption: "context pressure / unknown Git / long model / idle", lines: [...c.pressureFooter, ...c.unknownFooter, ...c.longFooter, ...c.idleFooter] },
  ];
}

// ---------------------------------------------------------------------------
// ANSI → SVG (deterministic; supports the SGR subset the chrome emits)
// ---------------------------------------------------------------------------

const CHAR_WIDTH = 8.4;
const LINE_HEIGHT = 26;
const PAD = 16;
const CAPTION_GAP = 14;

const BASIC_SGR = {
  30: "rgb(0,0,0)", 31: "rgb(220,80,90)", 32: "rgb(120,200,90)", 33: "rgb(230,190,90)",
  34: "rgb(90,140,240)", 35: "rgb(200,120,240)", 36: "rgb(80,200,220)", 37: "rgb(200,200,200)",
  90: "rgb(130,135,145)", 91: "rgb(247,118,142)", 92: "rgb(158,206,106)", 93: "rgb(224,175,104)",
  94: "rgb(122,162,247)", 95: "rgb(187,154,247)", 96: "rgb(125,207,255)", 97: "rgb(235,235,235)",
};

/** Walk a styled line, grouping runs of identical SGR state. */
export function parseAnsiRuns(line) {
  const runs = [];
  let fg = null, bg = null, bold = false, italic = false, underline = false;
  const sgr = /\x1b\[([0-9;]*)m/g;
  let start = 0;
  for (const match of line.matchAll(sgr)) {
    if (match.index > start) runs.push({ text: line.slice(start, match.index), fg, bg, bold, italic, underline });
    const codes = (match[1] || "0").split(";").map(Number);
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      if (code === 0) { fg = bg = null; bold = italic = underline = false; }
      else if (code === 1) bold = true;
      else if (code === 22) bold = false;
      else if (code === 3) italic = true;
      else if (code === 23) italic = false;
      else if (code === 4) underline = true;
      else if (code === 24) underline = false;
      else if (code === 39) fg = null;
      else if (code === 49) bg = null;
      else if ((code === 38 || code === 48) && codes[i + 1] === 2) {
        const color = `rgb(${codes.slice(i + 2, i + 5).join(",")})`;
        if (code === 38) fg = color; else bg = color;
        i += 4;
      } else if (BASIC_SGR[code]) fg = BASIC_SGR[code];
      else if (code >= 40 && code <= 47) bg = BASIC_SGR[code - 10];
    }
    start = match.index + match[0].length;
  }
  if (start < line.length) runs.push({ text: line.slice(start), fg, bg, bold, italic, underline });
  return runs;
}

/** Escape XML entities. */
const xmlEscape = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/**
 * Paint captured chrome sections as an SVG terminal snapshot.
 * `sections` is an ordered list of { caption, lines } — lines are positioned
 * by visible column so runs stay aligned regardless of glyph width.
 */
export function toTerminalSvg({ background, foreground = "#E1E1E1", sections }) {
  const allLines = sections.flatMap((section) => section.lines);
  const maxCols = Math.max(...allLines.map((l) => visibleWidth(stripOsc8(l))), 40);
  const width = Math.ceil(maxCols * CHAR_WIDTH + PAD * 2);
  const height = Math.ceil(
    PAD * 2 +
      sections.reduce((acc, s) => acc + LINE_HEIGHT * (1 + s.lines.length) + CAPTION_GAP, 0),
  );

  const parts = [];
  let y = PAD + 14;

  const MONO = "'DejaVu Sans Mono','Noto Sans Mono',monospace";

  for (const section of sections) {
    parts.push(
      `<text x="${PAD}" y="${y}" xml:space="preserve" font-family=${JSON.stringify(MONO)} font-size="11" letter-spacing="0.5" fill="rgba(128,128,128,0.9)">${xmlEscape(section.caption)}</text>`,
    );
    y += LINE_HEIGHT;
    for (const rawLine of section.lines) {
      const line = stripOsc8(rawLine);
      let col = 0;
      for (const run of parseAnsiRuns(line)) {
        const attrs = [`fill="${run.fg ?? foreground}"`];
        if (run.bold) attrs.push('font-weight="600"');
        if (run.italic) attrs.push('font-style="italic"');
        if (run.underline) attrs.push('text-decoration="underline"');
        const x = (PAD + col * CHAR_WIDTH).toFixed(1);
        if (run.bg) parts.push(`<rect x="${x}" y="${y - 19}" width="${visibleWidth(run.text) * CHAR_WIDTH}" height="${LINE_HEIGHT}" fill="${run.bg}"/>`);
        parts.push(
          `<text x="${x}" y="${y}" xml:space="preserve" font-family=${JSON.stringify(MONO)} font-size="14" ${attrs.join(" ")}>${xmlEscape(run.text)}</text>`,
        );
        col += visibleWidth(run.text);
      }
      y += LINE_HEIGHT;
    }
    y += CAPTION_GAP;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="100%" height="100%" fill="${background}"/>
${parts.join("\n")}
</svg>
`;
}

/** A separate public-host theme session prevents global theme state leaking. */
export function contentPreviewSections(name) {
  const runtime = fs.mkdtempSync(path.join(ROOT, ".preview-runtime-"));
  try {
    fs.symlinkSync(path.join(ROOT, "themes"), path.join(runtime, "themes"), "dir");
    const result = spawnSync(process.execPath, [path.join(ROOT, "scripts", "render-content-preview.js"), name, path.join(runtime, "content.json")], {
      cwd: ROOT, encoding: "utf8", timeout: 10000,
      env: { ...process.env, PI_CODING_AGENT_DIR: runtime, COLORTERM: "truecolor", TERM: "xterm-256color" },
    });
    if (result.status !== 0) throw new Error(result.stderr || result.error?.message || "Content preview failed");
    return JSON.parse(fs.readFileSync(path.join(runtime, "content.json"), "utf8"));
  } finally { fs.rmSync(runtime, { recursive: true, force: true }); }
}

/** Generate one preview SVG per bundled theme and write them to docs/previews. */
export function renderAllPreviews() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const written = [];
  for (const name of THEMES) {
    const chrome = renderChromeLines(name);
    const json = JSON.parse(fs.readFileSync(path.join(ROOT, "themes", `${name}.json`), "utf8"));
    const svg = toTerminalSvg({
      background: json.vars.terminalBg,
      foreground: json.vars.fg,
      sections: chromePreviewSections(name),
    });
    const out = path.join(OUT_DIR, `${name}.svg`);
    fs.writeFileSync(out, svg);
    written.push(path.relative(ROOT, out));
    const contentOut = path.join(OUT_DIR, `${name}-content.svg`);
    fs.writeFileSync(contentOut, toTerminalSvg({ background: json.vars.terminalBg, foreground: json.vars.fg, sections: contentPreviewSections(name) }));
    written.push(path.relative(ROOT, contentOut));
  }
  return written;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const written = renderAllPreviews();
  console.log(`wrote ${written.length} previews:\n  ${written.join("\n  ")}`);
}
