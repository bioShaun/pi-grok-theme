/**
 * footer.ts — Single-line Grok-style metadata footer renderer for pi-grok-build
 *
 * Spec: Section 5.2 Custom Footer Specification
 * - Wide layout:  ~/my-project  main · claude-3.7-sonnet · 48k/200k (24%) · thinking:high · ● working (3.1s)
 * - Narrow layout: main · sonnet-3.7 · 24% · ● working
 * - Responsive item dropping hierarchy
 * - Multi-accent TokyoNight/GrokNight palette
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  visibleWidth as tuiVisibleWidth,
  truncateToWidth as tuiTruncateToWidth,
} from "@earendil-works/pi-tui";
import { ANSI_COLORS, formatDuration, type WorkingStateController } from "./status.ts";

export interface FooterConfig {
  separator: string; // default " · "
  showCwd: boolean;
  showGit: boolean;
  showModel: boolean;
  showContext: boolean;
  showThinking: boolean;
  showStatus: boolean;
  compactThreshold: number; // default 80
}

export const DEFAULT_FOOTER_CONFIG: FooterConfig = {
  separator: " · ",
  showCwd: true,
  showGit: true,
  showModel: true,
  showContext: true,
  showThinking: true,
  showStatus: true,
  compactThreshold: 80,
};

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
  if (cwd.startsWith(home)) {
    return `~${cwd.slice(home.length)}`;
  }
  return path.basename(cwd);
}

/** Fast, cached Git branch detection */
let cachedBranch: { branch: string; expiresAt: number; cwd: string } | null = null;

export function getGitBranch(cwd: string): string | undefined {
  const now = Date.now();
  if (cachedBranch && cachedBranch.cwd === cwd && cachedBranch.expiresAt > now) {
    return cachedBranch.branch || undefined;
  }

  let current = path.resolve(cwd);
  let branch: string | undefined;

  try {
    while (true) {
      const gitHeadPath = path.join(current, ".git", "HEAD");
      if (fs.existsSync(gitHeadPath)) {
        const content = fs.readFileSync(gitHeadPath, "utf8").trim();
        if (content.startsWith("ref: refs/heads/")) {
          branch = content.replace("ref: refs/heads/", "");
        } else if (content.length >= 7) {
          // Detached HEAD
          branch = content.slice(0, 7);
        }
        break;
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  } catch {
    // Fallback quietly on permission or filesystem errors
  }

  cachedBranch = {
    cwd,
    branch: branch ?? "",
    expiresAt: now + 3000, // 3-second cache TTL
  };

  return branch;
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
  if (name.includes("k3-256k") || name.includes("kimi")) return "kimi-k3";

  // Remove common vendor prefixes if present
  const parts = modelId.split("/");
  return parts[parts.length - 1];
}

/** Render context usage percentage and token counts with color tiers */
export function renderContextMetric(
  usedTokens: number | undefined,
  totalTokens: number | undefined,
  percent: number | undefined,
  compact: boolean,
): string {
  if (percent === undefined && usedTokens === undefined) return "";

  const pct = percent ?? (usedTokens && totalTokens ? (usedTokens / totalTokens) * 100 : 0);
  const pctRounded = Math.round(pct);

  let color = ANSI_COLORS.muted;
  if (pctRounded >= 90) color = ANSI_COLORS.red;
  else if (pctRounded >= 75) color = ANSI_COLORS.amber;

  if (compact || !usedTokens || !totalTokens) {
    return `${color}${pctRounded}%${ANSI_COLORS.reset}`;
  }

  const usedStr = formatTokenCount(usedTokens);
  const totalStr = formatTokenCount(totalTokens);
  return `${color}${usedStr}/${totalStr} (${pctRounded}%)${ANSI_COLORS.reset}`;
}

/**
 * Main Grok Build footer renderer.
 */
export function renderGrokFooter(
  ctx: ExtensionContext,
  statusController: WorkingStateController,
  width: number,
  extensionStatuses?: ReadonlyMap<string, string>,
  config: FooterConfig = DEFAULT_FOOTER_CONFIG,
): string[] {
  if (width <= 0) return [""];

  const sep = `${ANSI_COLORS.dim}${config.separator}${ANSI_COLORS.reset}`;
  const isNarrow = width < config.compactThreshold;

  // 1. Working Badge (Always visible, highest priority)
  const badge = statusController.getBadge();
  const statusSegment = badge.formattedText;

  // 2. Active Model Name
  const rawModel = ctx.model?.name || ctx.model?.id || "";
  const modelName = isNarrow ? shortenModelName(rawModel) : rawModel;
  const modelSegment = modelName ? `${ANSI_COLORS.muted}${modelName}${ANSI_COLORS.reset}` : "";

  // 3. Git Branch
  const branch = config.showGit ? getGitBranch(ctx.cwd) : undefined;
  const branchSegment = branch ? `${ANSI_COLORS.cyan}⎇ ${branch}${ANSI_COLORS.reset}` : "";

  // 4. Context Usage
  const contextUsage = ctx.getContextUsage?.();
  const usedTokens = (contextUsage as { usedTokens?: number; tokens?: number })?.usedTokens ?? contextUsage?.tokens;
  const totalTokens = ctx.model?.contextWindow ?? contextUsage?.contextWindow;
  const percent = contextUsage?.percent;
  const contextSegment = config.showContext
    ? renderContextMetric(usedTokens, totalTokens, percent, isNarrow)
    : "";

  // 5. Thinking Level
  let thinkingLevel: string | undefined;
  try {
    const extApi = (ctx as unknown as { api?: { getThinkingLevel?: () => string } }).api;
    thinkingLevel = extApi?.getThinkingLevel?.();
  } catch {
    // Optional
  }
  const showThinkingSegment =
    config.showThinking && thinkingLevel && thinkingLevel !== "off" && !isNarrow;
  const thinkingSegment = showThinkingSegment
    ? `${ANSI_COLORS.muted}thinking:${thinkingLevel}${ANSI_COLORS.reset}`
    : "";

  // 6. Project Directory / CWD (First to hide on narrow screens)
  const cwdFormatted = formatCwd(ctx.cwd);
  const cwdSegment =
    config.showCwd && !isNarrow ? `${ANSI_COLORS.muted}${cwdFormatted}${ANSI_COLORS.reset}` : "";

  // 7. Extra extension statuses (e.g. TPS from pi-velocity)
  const extraStatuses: string[] = [];
  if (extensionStatuses) {
    for (const [key, val] of extensionStatuses.entries()) {
      if (val && key !== "status") {
        extraStatuses.push(`${ANSI_COLORS.muted}${val}${ANSI_COLORS.reset}`);
      }
    }
  }

  // Construct Responsive Row
  // Wide order: CWD  Branch · Model · Context · Thinking · ExtraStatuses · Status
  // Narrow order: Branch · ShortModel · Context% · Status

  if (isNarrow) {
    const segments = [branchSegment, modelSegment, contextSegment, ...extraStatuses, statusSegment].filter(
      Boolean,
    );
    let row = segments.join(sep);
    if (visibleWidth(row) > width) {
      // Drop context first, then branch if still too wide
      const slim = [branchSegment, modelSegment, statusSegment].filter(Boolean);
      row = slim.join(sep);
    }
    return [truncateToWidth(row, width)];
  }

  // Standard / Wide layout
  let items = [
    branchSegment,
    modelSegment,
    contextSegment,
    thinkingSegment,
    ...extraStatuses,
    statusSegment,
  ].filter(Boolean);

  let leftSide = cwdSegment ? `${cwdSegment}  ` : "";
  let rightSide = items.join(sep);
  let fullRow = `${leftSide}${rightSide}`;

  // If overflowing, progressively drop items according to priority hierarchy:
  if (visibleWidth(fullRow) > width && cwdSegment) {
    // Priority 6: Drop CWD
    leftSide = "";
    fullRow = items.join(sep);
  }

  if (visibleWidth(fullRow) > width && thinkingSegment) {
    // Priority 5: Drop Thinking Level
    items = items.filter((i) => i !== thinkingSegment);
    fullRow = items.join(sep);
  }

  if (visibleWidth(fullRow) > width && contextSegment) {
    // Priority 4: Compact Context
    const compactContext = renderContextMetric(usedTokens, totalTokens, percent, true);
    items = items.map((i) => (i === contextSegment ? compactContext : i));
    fullRow = items.join(sep);
  }

  if (visibleWidth(fullRow) > width && modelSegment) {
    // Priority 2: Shorten Model
    const shortModel = `${ANSI_COLORS.muted}${shortenModelName(rawModel)}${ANSI_COLORS.reset}`;
    items = items.map((i) => (i === modelSegment ? shortModel : i));
    fullRow = items.join(sep);
  }

  return [truncateToWidth(fullRow, width)];
}

/**
 * Install the Grok Build single-line footer into the Pi Extension Context.
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

  ctx.ui.setFooter((tui, _theme, footerData) => {
    activeTui = tui;

    const unsubscribeBranch = footerData?.onBranchChange?.(() => {
      cachedBranch = null;
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
        return renderGrokFooter(ctx, statusController, width, statuses, config);
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
