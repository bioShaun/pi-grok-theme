/**
 * render-previews.js — deterministic preview renderer for pi-grok-build
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
import { Theme } from "@earendil-works/pi-coding-agent";
import { renderGrokFooter, DEFAULT_FOOTER_CONFIG, visibleWidth } from "../footer.ts";
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

/** A representative in-turn chrome snapshot: header + wide + narrow footer. */
export function renderChromeLines(themeName) {
  const theme = loadBundledTheme(themeName);
  const now = Date.now();

  const ctx = {
    hasUI: true,
    mode: "tui",
    // A real git repository so branch detection participates in the preview.
    cwd: process.cwd(),
    model: {
      name: "claude-3.7-sonnet",
      id: "anthropic/claude-3.7-sonnet",
      contextWindow: 200000,
    },
    getContextUsage: () => ({ usedTokens: 48000, contextWindow: 200000, percent: 24 }),
    thinkingLevel: "high",
  };
  const statuses = new Map([["velocity", "19.6 / 23.2 tps"]]);

  const status = new WorkingStateController();
  status.startTurn(now);
  status.startTool("bash", now);

  const config = { ...DEFAULT_FOOTER_CONFIG, preset: "auto" };
  return {
    header: renderHeader(ctx, 100, { ...DEFAULT_HEADER_OPTIONS, version: VERSION }, theme),
    wideFooter: renderGrokFooter(ctx, status, 120, statuses, config, theme),
    narrowFooter: renderGrokFooter(ctx, status, 44, statuses, config, theme),
  };
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
  let fg = null;
  let bold = false;
  let text = "";
  let i = 0;
  const flush = () => {
    if (text) runs.push({ text, fg, bold });
    text = "";
  };
  while (i < line.length) {
    const char = line[i];
    if (char === "\x1b" && line[i + 1] === "[") {
      const end = line.indexOf("m", i + 2);
      if (end === -1) break; // dangling escape — cannot happen in chrome output
      const code = line.slice(i + 2, end);
      flush();
      if (code === "0" || code === "") {
        fg = null;
        bold = false;
      } else if (code === "1") bold = true;
      else if (code === "22") bold = false;
      else if (code === "39") fg = null;
      else if (code.startsWith("38;2;")) {
        const [r, g, b] = code.slice(5).split(";");
        fg = `rgb(${r},${g},${b})`;
      } else if (/^\d+$/.test(code)) {
        fg = BASIC_SGR[code] ?? null;
      }
      i = end + 1;
    } else {
      text += char;
      i += 1;
    }
  }
  flush();
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
export function toTerminalSvg({ background, sections }) {
  const allLines = sections.flatMap((section) => section.lines);
  const maxCols = Math.max(...allLines.map((l) => visibleWidth(l)), 40);
  const width = Math.ceil(maxCols * CHAR_WIDTH + PAD * 2);
  const height = Math.ceil(
    PAD * 2 +
      sections.reduce((acc, s) => acc + LINE_HEIGHT * (1 + s.lines.length) + CAPTION_GAP, 0),
  );

  const parts = [];
  let y = PAD + 14;

  const MONO = "'JetBrains Mono','SF Mono',Menlo,Consolas,monospace";

  for (const section of sections) {
    parts.push(
      `<text x="${PAD}" y="${y}" xml:space="preserve" font-family=${JSON.stringify(MONO)} font-size="11" letter-spacing="0.5" fill="rgba(128,128,128,0.9)">${xmlEscape(section.caption)}</text>`,
    );
    y += LINE_HEIGHT;
    for (const line of section.lines) {
      let col = 0;
      for (const run of parseAnsiRuns(line)) {
        const attrs = [`fill="${run.fg ?? "rgb(210,210,210)"}"`];
        if (run.bold) attrs.push('font-weight="600"');
        const x = (PAD + col * CHAR_WIDTH).toFixed(1);
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

/** Generate one preview SVG per bundled theme and write them to docs/previews. */
export function renderAllPreviews() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const written = [];
  for (const name of THEMES) {
    const chrome = renderChromeLines(name);
    const json = JSON.parse(fs.readFileSync(path.join(ROOT, "themes", `${name}.json`), "utf8"));
    const svg = toTerminalSvg({
      background: json.vars.terminalBg,
      sections: [
        { caption: `${name} — header (opt-in via /grok header)`, lines: chrome.header },
        { caption: "footer — wide layout (auto preset, 120 cols)", lines: chrome.wideFooter },
        { caption: "footer — narrow layout (44 cols): compact model + context %", lines: chrome.narrowFooter },
      ],
    });
    const out = path.join(OUT_DIR, `${name}.svg`);
    fs.writeFileSync(out, svg);
    written.push(path.relative(ROOT, out));
  }
  return written;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const written = renderAllPreviews();
  console.log(`wrote ${written.length} previews:\n  ${written.join("\n  ")}`);
}
