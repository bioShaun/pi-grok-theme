/**
 * footer.ts — Single-line Grok-style metadata footer renderer for pi-grok-theme
 *
 * Spec: Section 5.2 Custom Footer Specification
 * - Wide layout:  ~/my-project  main · claude-3.7-sonnet · 48k/200k (24%) · ✻ high · ● working (3.1s)
 * - Narrow layout: main · sonnet-3.7 · 24% · ● working
 * - Responsive item dropping hierarchy
 * - Multi-accent TokyoNight/GrokNight palette
 */

import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import {
  visibleWidth as tuiVisibleWidth,
  truncateToWidth as tuiTruncateToWidth,
} from "@earendil-works/pi-tui";
import { createChromeTheme, type ChromeTheme, type ChromeTone } from "./chrome-theme.ts";
import {
  getGlyphs,
  getGlyphsForDensity,
  resolveGlyphDensity,
  type GlyphDensity,
  type GlyphSet,
} from "./glyphs.ts";
import { formatDuration, normalizeToolAction, type MotionMode, type WorkingStateController } from "./status.ts";

import type { GitSnapshot } from "./git-status.ts";

export interface FooterConfig {
  separator: string; // default " · "
  preset: FooterPreset; // default "default"
  showCwd: boolean;
  showGit: boolean;
  showModel: boolean;
  showContext: boolean;
  showThinking: boolean;
  showStatus: boolean;
  compactThreshold: number; // width under which compact variants are preferred (80)
  /** Resolved glyph density applied by the render path (default unicode via settings). */
  glyphDensity?: GlyphDensity;
  motion?: MotionMode;
  gitSnapshot?: GitSnapshot;
  onBranchChange?: () => void;
}

export type FooterPreset = "minimal" | "default" | "full";

export const FOOTER_PRESETS: readonly FooterPreset[] = ["minimal", "default", "full"];

export type SeparatorStyle = "dot" | "powerline-thin" | "slash" | "ascii";

export const SEPARATOR_STYLES: readonly SeparatorStyle[] = ["dot", "powerline-thin", "slash", "ascii"];

export const SEPARATOR_STYLE_LITERALS: Record<SeparatorStyle, string> = {
  dot: " · ",
  "powerline-thin": " \uE0B1 ",
  slash: " / ",
  ascii: " | ",
};

export function separatorForStyle(style: SeparatorStyle, density?: GlyphDensity): string {
  if (density && resolveGlyphDensity(density) === "ascii" && (style === "dot" || style === "powerline-thin")) return " | ";
  return SEPARATOR_STYLE_LITERALS[style];
}

export const DEFAULT_FOOTER_CONFIG: FooterConfig = {
  separator: " · ",
  preset: "default",
  showCwd: true,
  showGit: true,
  showModel: true,
  showContext: true,
  showThinking: true,
  showStatus: true,
  compactThreshold: 80,
  glyphDensity: "auto",
};

/**
 * One footer segment with fitting metadata (v0.4 spec §5.2). Fitting operates
 * on this metadata — never on formatted-string identity.
 *
 * `priority` follows spec §6 (1 = highest, dropped last). `position: "left"`
 * marks the cwd-style leading block that carries two trailing spaces instead
 * of a separator.
 */
export interface FooterSegment {
  id: string;
  priority: number;
  required: boolean;
  /** Fully styled wide variant. */
  wide: string;
  /** Styled compact variant, when the segment can shrink instead of dropping. */
  compact?: string;
  position?: "left" | "inline";
  detail?: string;
  timer?: string;
}

/**
 * Segment fitting per spec §5.2 and §6.
 *
 * 1. render the wide variants (or compact variants immediately on narrow
 *    terminals when `preferCompact` is set);
 * 2. while the row overflows, apply the cheapest operation next: drop
 *    optional segments lowest-priority-first (equal priority drops the later
 *    entry first, e.g. each third-party status individually), and compact an
 *    eligible segment before ever dropping it;
 * 3. required segments (status; model when its data exists) are never
 *    dropped — model may still shrink to its short name;
 * 4. truncate only as the final safety net.
 */
export function fitFooterSegments(
  segments: FooterSegment[],
  width: number,
  separator: string,
  preferCompact = false,
  ellipsis = "…",
): string {
  if (width <= 0) return "";
  const live = segments.map((seg) => ({ ...seg, text: preferCompact ? seg.compact ?? seg.wide : seg.wide, dropped: false }));
  const row = () => live.filter((s) => !s.dropped && s.text).map((s) => s.text).join(separator);
  const ordered = [...live].sort((a, b) => b.priority - a.priority || live.indexOf(b) - live.indexOf(a));
  const operations = [
    ...ordered.filter((s) => !s.required && s.compact === undefined).map((s) => () => { s.dropped = true; }),
    ...ordered.filter((s) => s.compact !== undefined).map((s) => () => { s.text = s.compact!; }),
    ...ordered.filter((s) => !s.required && s.compact !== undefined).map((s) => () => { s.dropped = true; }),
  ];
  for (const operation of operations) {
    if (visibleWidth(row()) <= width) break;
    operation();
  }
  if (visibleWidth(row()) <= width) return row();
  // Allocate the remaining required fields in priority order, reserving a
  // visible character for each lower-priority field whenever space allows.
  const required = live.filter((s) => !s.dropped).sort((a, b) => a.priority - b.priority);
  const gap = visibleWidth(separator);
  let remaining = width;
  for (let i = 0; i < required.length; i++) {
    const segment = required[i]!;
    const later = required.length - i - 1;
    const reserve = remaining >= 1 + later * (gap + 1) ? later * (gap + 1) : 0;
    const budget = Math.max(0, remaining - reserve);
    segment.text = truncateToWidth(segment.text, budget, budget > 1 ? ellipsis : "");
    if (!segment.text) segment.dropped = true;
    remaining = Math.max(0, remaining - visibleWidth(segment.text) - gap);
  }
  return truncateToWidth(row(), width, ellipsis);
}

/**
 * Calculate visible terminal width of a string excluding ANSI escape sequences.
 *
 * Delegates to pi-tui: the TUI validates every rendered line with its own
 * visibleWidth() and hard-crashes on overflow, so any divergence between our
 * measurement and theirs is fatal. A previous local implementation counted
 * RGI emoji such as ⚡ (U+26A1, width 2 in pi-tui) as width 1, which produced
 * over-wide footer lines and crashed pi.
 */
export function visibleWidth(str: string): number {
  return tuiVisibleWidth(str ?? "");
}

/** Truncate text to a maximum visible width, appending ellipsis if needed. */
export function truncateToWidth(str: string, maxWidth: number, ellipsis = "…"): string {
  return tuiTruncateToWidth(str, maxWidth, ellipsis);
}

/** Format token counts into human-readable strings (e.g., 48k, 1.2M) */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(tokens < 10_000 ? 1 : 0)}k`;
  return `${(tokens / 1_000_000).toFixed(1)}M`;
}

/** Shorten file path relative to HOME or CWD */
export function formatCwd(cwd: string): string {
  const home = os.homedir();
  if (cwd === home) return "~";
  if (cwd.startsWith(`${home}${path.sep}`)) {
    return `~${cwd.slice(home.length)}`;
  }
  return path.basename(cwd);
}


/** Build a file:// URL for an absolute path; soft-fail → undefined. */
export function toFileUrl(absPath: string): string | undefined {
  try {
    if (!absPath || !path.isAbsolute(absPath)) return undefined;
    const normalized = absPath.replaceAll("\\", "/");
    const parts = normalized.split("/");
    const encoded = parts
      .map((p, i) => (i === 0 && p === "" ? "" : encodeURIComponent(p)))
      .join("/");
    return `file://${encoded.startsWith("/") ? encoded : `/${encoded}`}`;
  } catch {
    return undefined;
  }
}

const OSC8_RE = /\x1b\]8;;.*?\x07/g;

/** Wrap visible label in an OSC 8 hyperlink (BEL-terminated). */
export function wrapOsc8Hyperlink(uri: string, label: string): string {
  return `\x1b]8;;${uri}\x07${label}\x1b]8;;\x07`;
}

/** Strip OSC 8 sequences for width math / preview snapshots. */
export function stripOsc8(str: string): string {
  return (str ?? "").replace(OSC8_RE, "");
}

/** Simplify model identifier for compact display */
export function shortenModelName(modelId: string): string {
  if (!modelId) return "";
  const name = modelId.toLowerCase();
  if (name.includes("claude-3-7-sonnet") || name.includes("claude-3.7-sonnet")) return "sonnet-3.7";
  if (name.includes("claude-3-5-sonnet") || name.includes("claude-3.5-sonnet")) return "sonnet-3.5";
  if (name.includes("gpt-5.6") || name.includes("gpt-5-6")) return "gpt-5.6";
  if (name.includes("gpt-4o")) return "gpt-4o";
  if (name.includes("qwen3.8-27b") || name.includes("qwen3.8")) return "qwen-3.8";
  if (name.includes("qwen") && name.includes("27b")) return "qwen-27b";
  if (name.includes("glm-5")) return "glm-5";
  // NOTE: narrowed from `name.includes("kimi")` so kimi-k2 can map separately below.
  if (name.includes("k3-256k") || name.includes("kimi-k3")) return "kimi-k3";

  // Extended mappings (R1): more specific patterns must precede their prefixes.
  if (name.includes("gpt-4.1-mini")) return "gpt-4.1-mini";
  if (name.includes("gpt-4.1-nano")) return "gpt-4.1-nano";
  if (name.includes("gpt-4.1")) return "gpt-4.1";
  if (name.includes("gpt-5-mini")) return "gpt-5-mini";
  if (name.includes("gpt-5-nano")) return "gpt-5-nano";
  if (name.includes("gpt-5")) return "gpt-5";
  if (name.includes("claude-opus-4")) return "opus-4";
  if (name.includes("claude-sonnet-4")) return "sonnet-4";
  if (name.includes("claude-haiku-4")) return "haiku-4";
  if (name.includes("o1-mini")) return "o1-mini";
  if (name.includes("o1-pro")) return "o1-pro";
  if (name.includes("o1")) return "o1";
  if (name.includes("o3-mini")) return "o3-mini";
  if (name.includes("o3")) return "o3";
  if (name.includes("o4-mini")) return "o4-mini";
  if (name.includes("gemini-2.0-flash")) return "gem-2-flash";
  if (name.includes("gemini-2.5-pro")) return "gem-2.5-pro";
  if (name.includes("deepseek-v3")) return "deepseek-v3";
  if (name.includes("deepseek-r1")) return "deepseek-r1";
  if (name.includes("qwen3-coder")) return "qwen3-coder";
  if (name.includes("qwen3-max")) return "qwen3-max";
  if (name.includes("kimi-k2")) return "kimi-k2";
  if (name.includes("minimax")) return "minimax";

  // Remove common vendor prefixes if present
  const parts = modelId.split("/");
  return parts[parts.length - 1] ?? "";
}

/**
 * Render the Grok-style context pressure metric (v0.4 spec §4.3).
 *
 * - wide form:   `⇣48k/200k (24%)` (token arrow from the glyph vocabulary)
 * - compact form: `24%`
 * - thresholds: <65 muted, 65–79 accent, 80–89 warning, >=90 error
 * - host-provided percentages take precedence; computed values are clamped
 *   to 0–100%;
 * - no fabricated segment without real usage data.
 */
export function renderContextMetric(
  usedTokens: number | undefined,
  totalTokens: number | undefined,
  percent: number | undefined,
  compact: boolean,
  chrome: ChromeTheme = createChromeTheme(null),
  glyphs: GlyphSet = getGlyphs(),
): string {
  let pct = percent;
  if (pct === undefined && usedTokens !== undefined && totalTokens) {
    pct = (usedTokens / totalTokens) * 100;
  }
  if (pct === undefined || !Number.isFinite(pct)) return "";

  const pctRounded = Math.round(Math.min(100, Math.max(0, pct)));

  let tone: ChromeTone;
  if (pctRounded >= 90) tone = "error";
  else if (pctRounded >= 80) tone = "warning";
  else if (pctRounded >= 65) tone = "accent";
  else tone = "muted";

  if (compact || usedTokens === undefined || !totalTokens) {
    return chrome.fg(tone, `${pctRounded}%`);
  }

  const usedStr = formatTokenCount(usedTokens);
  const totalStr = formatTokenCount(totalTokens);
  return chrome.fg(tone, `${glyphs.tokenArrow}${usedStr}/${totalStr} (${pctRounded}%)`);
}

/**
 * Build the metadata-driven footer segments for the configured preset
 * (spec §4.5, §5.2, §6). Segments without data are omitted entirely.
 */
export function buildFooterSegments(
  ctx: ExtensionContext,
  statusController: WorkingStateController,
  extensionStatuses: ReadonlyMap<string, string> | undefined,
  config: FooterConfig,
  chrome: ChromeTheme,
  glyphs: ReturnType<typeof getGlyphs>,
): FooterSegment[] {
  const preset = config.preset ?? "default";
  const badge = statusController.getBadge(Date.now(), config.motion);
  const want = (id: string): boolean => {
    if (preset === "minimal") return id === "model" || id === "context" || id === "status";
    return true; // default and full include every eligible segment
  };
  const push = (segment: FooterSegment): void => {
    if (want(segment.id) && segment.wide) segments.push(segment);
  };

  const segments: FooterSegment[] = [];

  // CWD — leading block with OSC 8 hyperlink when possible (priority 8).
  if (config.showCwd && preset !== "minimal") {
    const cwdFormatted = formatCwd(ctx.cwd);
    const abs = path.resolve(ctx.cwd);
    const fileUrl = toFileUrl(abs);
    const label = chrome.fg("muted", cwdFormatted);
    const wide = fileUrl ? wrapOsc8Hyperlink(fileUrl, label) : label;
    push({
      id: "cwd",
      priority: 8,
      required: false,
      wide,
    });
  }

  // Snapshot only: renderers never discover repositories or run Git.
  if (config.showGit && preset !== "minimal") {
    const info = config.gitSnapshot;
    if (info && (info.branch || info.state === "error")) {
      let text = info.branch ? chrome.fg("muted", `${glyphs.branchMark} ${info.branch}`) : "";
      if (info.state === "error") text += chrome.fg("warning", `${text ? " " : ""}git?`);
      if (info.state !== "error" && (info.staged ?? 0) > 0) text += chrome.fg("success", ` +${info.staged}`);
      if (info.state !== "error" && (info.dirty ?? 0) > 0) text += chrome.fg("warning", ` ~${info.dirty}`);
      if (info.state !== "error" && (info.untracked ?? 0) > 0) text += chrome.fg("muted", ` ?${info.untracked}`);
      push({
        id: "branch",
        priority: 3,
        required: false,
        wide: text,
        compact: `${chrome.fg("muted", `${glyphs.branchMark} ${shortenBranch(info.branch ?? "", 14, glyphs === getGlyphsForDensity("ascii") ? "~" : "…")}`)}${info.state === "error" ? chrome.fg("warning", " git?") : ""}`,
      });
    }
  }

  // Model — required whenever its data exists (priority 2).
  if (config.showModel) {
    const rawModel = ctx.model?.name || ctx.model?.id || "";
    if (rawModel) {
      push({
        id: "model",
        priority: 2,
        required: true,
        wide: chrome.fg("text", rawModel),
        compact: chrome.fg("text", shortenModelName(rawModel)),
      });
    }
  }

  // Context usage (priority 4): wide ⇣48k/200k (24%), compact 24%.
  if (config.showContext) {
    const contextUsage = ctx.getContextUsage?.();
    const usedTokens = (contextUsage as { usedTokens?: number; tokens?: number | null })?.usedTokens
      ?? contextUsage?.tokens ?? undefined;
    const totalTokens = ctx.model?.contextWindow ?? contextUsage?.contextWindow ?? undefined;
    const percent = contextUsage?.percent ?? undefined;
    const wide = renderContextMetric(usedTokens, totalTokens, percent, false, chrome, glyphs);
    const compact = renderContextMetric(usedTokens, totalTokens, percent, true, chrome, glyphs);
    if (wide) {
      push({
        id: "context",
        priority: 4,
        required: false,
        wide,
        compact,
      });
    }
  }

  // Third-party extension statuses — individually droppable (priority 5).
  if (extensionStatuses) {
    for (const [key, val] of extensionStatuses.entries()) {
      const sanitized = val.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim();
      if (sanitized && key !== "status") {
        push({
          id: `extension:${key}`,
          priority: 5,
          required: false,
          wide: chrome.fg("muted", sanitized),
        });
      }
    }
  }

  // Thinking level (priority 6).
  if (config.showThinking) {
    let thinkingLevel: string | undefined;
    try {
      const direct = ctx as unknown as {
        getThinkingLevel?: () => string;
        thinkingLevel?: string;
      };
      thinkingLevel = direct.getThinkingLevel?.() ?? direct.thinkingLevel ?? undefined;
    } catch {
      // Optional
    }
    if (thinkingLevel && thinkingLevel !== "off") {
      push({
        id: "thinking",
        priority: 6,
        required: false,
        wide: chrome.fg("muted", `${glyphs.thinkingMark} ${thinkingLevel}`),
      });
    }
  }

  // Whole-turn duration — full preset only, when the data exists (priority 7).
  if (preset === "full" && badge.turnElapsedMs !== undefined) {
    push({
      id: "turn",
      priority: 7,
      required: false,
      wide: chrome.fg("muted", `${formatDuration(badge.turnElapsedMs, config.motion)} turn`),
    });
  }

  // Active status — never deliberately dropped (priority 1).
  if (config.showStatus) {
    const iconGlyph = badge.icon === "spinnerFrames"
      ? undefined
      : glyphs[badge.icon];
    const icon = (typeof iconGlyph === "string" ? iconGlyph : undefined)
      ?? (badge.state === "idle" ? glyphs.idleDot : glyphs.workingDot);
    push({
      id: "status",
      priority: 1,
      required: true,
      wide: `${chrome.fg(badge.tone, icon)} ${chrome.fg("muted", badge.label)}`,
      compact: `${chrome.fg(badge.tone, icon)} ${chrome.fg("muted", badge.state === "running_tool" ? "tool" : badge.state === "streaming" ? "generating" : badge.state)}`,
      detail: `${chrome.fg(badge.tone, icon)} ${chrome.fg("muted", badge.state === "running_tool" ? normalizeToolAction(statusController.getCurrentTool()) : badge.state === "streaming" ? "generating" : badge.state)}`,
      timer: badge.phaseElapsedMs === undefined ? undefined : chrome.fg("muted", formatDuration(badge.phaseElapsedMs, config.motion)),
    });
  }

  const order = (id: string) => id.startsWith("extension:") ? 3 : ({ model: 0, branch: 1, context: 2, thinking: 4, cwd: 5, turn: 6, status: 7 }[id] ?? 3);
  return segments.sort((a, b) => order(a.id) - order(b.id));
}

/**
 * Main Grok Build footer renderer.
 *
 * All foreground color comes from the active Pi theme via the chrome adapter;
 * `theme` is optional so tests and headless contexts fall back to the v0.3
 * shim palette. The row is assembled from metadata-driven segments and fitted
 * to the terminal width per spec §5.2/§6.
 */
export function renderGrokFooter(
  ctx: ExtensionContext,
  statusController: WorkingStateController,
  width: number,
  extensionStatuses?: ReadonlyMap<string, string>,
  config: FooterConfig = DEFAULT_FOOTER_CONFIG,
  theme?: Theme | null,
): string[] {
  if (width <= 0) return [""];

  const chrome = createChromeTheme(theme);
  const density = resolveGlyphDensity(config.glyphDensity ?? "auto");
  const glyphs = getGlyphsForDensity(density);
  const separator = density === "ascii" ? config.separator.replace(/[·\uE0B1]/g, "|") : config.separator;
  const sep = chrome.fg("dim", separator);

  const segments = buildFooterSegments(ctx, statusController, extensionStatuses, config, chrome, glyphs);
  const preferCompact = width < config.compactThreshold;
  const ellipsis = density === "ascii" ? "~" : "…";
  const activity = segments.find((segment) => segment.id === "status");
  if (!preferCompact && width >= 80 && activity) {
    const region = 24;
    const timer = activity.timer ?? "";
    const labelBudget = region - (timer ? visibleWidth(timer) + 1 : 0);
    const detail = visibleWidth(activity.detail ?? "") <= labelBudget ? activity.detail! : activity.compact!;
    const label = truncateToWidth(detail, Math.max(1, labelBudget), ellipsis);
    const right = label + " ".repeat(Math.max(0, region - visibleWidth(label) - visibleWidth(timer))) + timer;
    const left = fitFooterSegments(segments.filter((s) => s !== activity), width - region - 2, sep, false, ellipsis);
    return [left + " ".repeat(width - region - visibleWidth(left)) + right];
  }
  return [fitFooterSegments(segments, width, sep, preferCompact, ellipsis)];
}

/**
 * Install the Grok Build single-line footer into the Pi Extension Context.
 *
 * The render path reads the live `ctx.ui.theme` on every render so a theme
 * switch recolors chrome immediately without re-installing the footer.
 */
export function installFooter(
  ctx: ExtensionContext,
  statusController: WorkingStateController,
  config: FooterConfig = DEFAULT_FOOTER_CONFIG,
): { dispose: () => void; requestRender: () => void } {
  let activeTui: { requestRender: () => void } | undefined;

  if (!ctx.hasUI || typeof ctx.ui?.setFooter !== "function") {
    return {
      dispose: () => {},
      requestRender: () => {},
    };
  }

  /** Live active theme; undefined on Pi versions without the getter. */
  const currentTheme = (): Theme | undefined => {
    try {
      return ctx.ui?.theme ?? undefined;
    } catch {
      return undefined;
    }
  };

  ctx.ui.setFooter((tui, theme, footerData) => {
    activeTui = tui;

    const unsubscribeBranch = footerData?.onBranchChange?.(() => {
      config.onBranchChange?.();
      tui.requestRender();
    });

    return {
      dispose: () => {
        unsubscribeBranch?.();
        activeTui = undefined;
      },
      invalidate: () => {},
      render: (width: number) => {
        const statuses = footerData?.getExtensionStatuses?.();
        return renderGrokFooter(ctx, statusController, width, statuses, config, currentTheme() ?? theme);
      },
    };
  });

  return {
    dispose: () => {
      try {
        ctx.ui?.setFooter(undefined as unknown as never);
      } catch {
        // Fallback safely
      }
    },
    requestRender: () => {
      activeTui?.requestRender();
    },
  };
}

/** Keep the distinguishing tail without splitting display units. */
export function shortenBranch(branch: string, width: number, ellipsis = "…"): string {
  if (visibleWidth(branch) <= width) return branch;
  const units = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(branch)].map((s) => s.segment);
  let tail = "";
  for (const unit of units.reverse()) {
    if (visibleWidth(ellipsis + unit + tail) > width) break;
    tail = unit + tail;
  }
  return ellipsis + tail;
}
