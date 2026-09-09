/**
 * glyphs.ts — capability-aware glyph vocabulary for pi-grok-theme chrome
 *
 * One table owns every fixed-width symbol the chrome renders (v0.4 spec §4.7).
 * Renderers must never inline Unicode literals; they consume a GlyphSet so
 * legacy terminals get safe ASCII without touching layout math.
 *
 * Selection:
 * - `PI_GROK_LEGACY_GLYPHS=1` forces legacy;
 * - `PI_GROK_LEGACY_GLYPHS=0` forces modern (overrides win32 auto-detection);
 * - otherwise legacy is automatic on win32 when neither Windows Terminal nor a
 *   known modern terminal is detected.
 */

export type GlyphKey =
  | "workingDot"
  | "idleDot"
  | "thinkingMark"
  | "branchMark"
  | "tokenArrow"
  | "brandMark"
  | "disclosureArrow"
  | "folderMark"
  | "spinnerFrames";

export interface GlyphSet {
  /** Active-work dot (`●`). */
  workingDot: string;
  /** Idle circle (`○`). */
  idleDot: string;
  /** Thinking-level mark (`✻`). */
  thinkingMark: string;
  /** Git branch mark (`⎇`). */
  branchMark: string;
  /** Context token arrow (`⇣` modern, `↓` legacy fallback per spec §4.3). */
  tokenArrow: string;
  /** Lightning brand mark (`⚡`; the only glyph wider than one column). */
  brandMark: string;
  /** Disclosure arrow (`▸`). */
  disclosureArrow: string;
  /** Header workspace folder mark (`📁` modern, ASCII in legacy mode). */
  folderMark: string;
  /** Working-indicator frames, all exactly one visible column. */
  spinnerFrames: string[];
}

export type GlyphMode = "modern" | "legacy";

/** Braille spinner frames — the Grok Build working indicator (spec §4.2). */
export const MODERN_SPINNER_FRAMES: readonly string[] = [
  "⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧",
];

/** ASCII spinner frames for terminals without Braille coverage. */
export const LEGACY_SPINNER_FRAMES: readonly string[] = ["|", "/", "-", "\\"];

export const MODERN_GLYPHS: GlyphSet = {
  workingDot: "●",
  idleDot: "○",
  thinkingMark: "✻",
  branchMark: "⎇",
  tokenArrow: "⇣",
  brandMark: "⚡",
  disclosureArrow: "▸",
  folderMark: "📁",
  spinnerFrames: [...MODERN_SPINNER_FRAMES],
};

export const LEGACY_GLYPHS: GlyphSet = {
  workingDot: "*",
  idleDot: "o",
  thinkingMark: "*",
  branchMark: "#",
  tokenArrow: "↓",
  brandMark: "#",
  disclosureArrow: ">",
  folderMark: ">",
  spinnerFrames: [...LEGACY_SPINNER_FRAMES],
};

const GLYPH_SETS: Record<GlyphMode, GlyphSet> = {
  modern: MODERN_GLYPHS,
  legacy: LEGACY_GLYPHS,
};

/** Terminals on Windows that can be trusted with the modern glyph set. */
const MODERN_WINDOWS_TERM_PROGRAMS = new Set([
  "vscode",
  "ghostty",
  "wezterm",
  "hyper",
  "alacritty",
  "kitty",
]);

export function isModernWindowsTerminal(env: NodeJS.ProcessEnv): boolean {
  if (env.WT_SESSION || env.WT_PROFILE_ID) return true;
  const program = (env.TERM_PROGRAM ?? "").toLowerCase();
  if (MODERN_WINDOWS_TERM_PROGRAMS.has(program)) return true;
  // tmux inside a modern terminal still renders modern glyphs.
  if (env.TERM === "xterm-256color" || env.TERM?.startsWith("screen")) return true;
  return false;
}

/**
 * Pick the glyph mode from explicit overrides, then platform capability.
 * Pure in its inputs so tests can inject `env` and `platform`.
 */
export function detectGlyphMode(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): GlyphMode {
  const forced = env.PI_GROK_LEGACY_GLYPHS;
  if (forced === "1") return "legacy";
  if (forced === "0") return "modern";
  if (platform === "win32" && !isModernWindowsTerminal(env)) return "legacy";
  return "modern";
}

/** Resolve the glyph set for a mode (default: capability-aware detection). */
export function getGlyphs(mode: GlyphMode = detectGlyphMode()): GlyphSet {
  return GLYPH_SETS[mode];
}

// ---------------------------------------------------------------------------
// Glyph density (v0.5): unicode | nerd | ascii
// ---------------------------------------------------------------------------

export type GlyphDensity = "unicode" | "nerd" | "ascii";

export const GLYPH_DENSITIES: readonly GlyphDensity[] = ["unicode", "nerd", "ascii"];

/**
 * Nerd Font marks for branch/folder; other keys reuse the modern (unicode) set.
 * nf-pl-branch U+E0A0, nf-fa-folder U+F07B. Spinner keeps modern Braille.
 */
export const NERD_GLYPHS: GlyphSet = {
  ...MODERN_GLYPHS,
  branchMark: "\uE0A0", // nf-pl-branch
  folderMark: "\uF07B", // nf-fa-folder
};

/**
 * Resolve density from settings + capability.
 * - PI_GROK_LEGACY_GLYPHS=1 always forces ascii (wins over settings nerd).
 * - nerd only when settings explicitly request it.
 * - undefined settings → unicode (never auto-select nerd).
 */
export function resolveGlyphDensity(
  settingsDensity: GlyphDensity | undefined,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): GlyphDensity {
  if (env.PI_GROK_LEGACY_GLYPHS === "1") return "ascii";
  if (settingsDensity === "nerd") return "nerd";
  if (settingsDensity === "ascii") return "ascii";
  if (settingsDensity === "unicode") return "unicode";
  // No explicit settings: map legacy capability detection to ascii/unicode.
  const mode = detectGlyphMode(env, platform);
  return mode === "legacy" ? "ascii" : "unicode";
}

export function getGlyphsForDensity(density: GlyphDensity): GlyphSet {
  switch (density) {
    case "nerd":
      return NERD_GLYPHS;
    case "ascii":
      return LEGACY_GLYPHS;
    case "unicode":
    default:
      return MODERN_GLYPHS;
  }
}
