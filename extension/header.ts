/**
 * header.ts — Clean Grok-style workspace header for pi-grok-build
 *
 * Implements a high-contrast, minimalist workspace banner:
 * ╭─ GROK BUILD ────────────────────────────────────────────────────────────╮
 * │ 📁 my-project  ⎇ main  ·  model: claude-3.7-sonnet  ·  v0.2.0           │
 * ╰─────────────────────────────────────────────────────────────────────────╯
 */

import * as path from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { formatCwd, getGitBranch, truncateToWidth, visibleWidth } from "./footer.ts";
import { ANSI_COLORS } from "./status.ts";

export interface HeaderOptions {
  showTitle?: boolean;
  showBranch?: boolean;
  showModel?: boolean;
  version?: string;
}

export const DEFAULT_HEADER_OPTIONS: HeaderOptions = {
  showTitle: true,
  showBranch: true,
  showModel: true,
  version: "0.2.0",
};

/**
 * Render a Grok Build styled workspace header box.
 */
export function renderHeader(
  ctx: ExtensionContext,
  width: number,
  options: HeaderOptions = DEFAULT_HEADER_OPTIONS,
): string[] {
  if (width < 20) return [""];

  const innerWidth = Math.max(1, width - 4);
  const cwdFormatted = formatCwd(ctx.cwd);
  const branch = options.showBranch ? getGitBranch(ctx.cwd) : undefined;
  const rawModel = ctx.model?.name || ctx.model?.id || "";

  // Title / Tag
  const brandTitle = " GROK BUILD ";
  const versionTag = options.version ? `v${options.version}` : "";

  // Metadata parts
  const parts: string[] = [];
  parts.push(`${ANSI_COLORS.fg}📁 ${cwdFormatted}${ANSI_COLORS.reset}`);
  if (branch) {
    parts.push(`${ANSI_COLORS.cyan}⎇ ${branch}${ANSI_COLORS.reset}`);
  }
  if (options.showModel && rawModel) {
    parts.push(`${ANSI_COLORS.muted}model: ${ANSI_COLORS.fg}${rawModel}${ANSI_COLORS.reset}`);
  }
  if (versionTag) {
    parts.push(`${ANSI_COLORS.dim}${versionTag}${ANSI_COLORS.reset}`);
  }

  const sep = `${ANSI_COLORS.dim} · ${ANSI_COLORS.reset}`;
  const metaContent = parts.join(sep);

  // Borders
  const borderChar = "─";
  const titleFormatted = `${ANSI_COLORS.bold}${ANSI_COLORS.blue}${brandTitle}${ANSI_COLORS.reset}`;
  const titleWidth = visibleWidth(brandTitle);
  const topBorderRightLength = Math.max(0, width - 2 - titleWidth - 2);

  const topBorder = `${ANSI_COLORS.dim}╭─${ANSI_COLORS.reset}${titleFormatted}${ANSI_COLORS.dim}${borderChar.repeat(topBorderRightLength)}╮${ANSI_COLORS.reset}`;
  const bottomBorder = `${ANSI_COLORS.dim}╰${borderChar.repeat(width - 2)}╯${ANSI_COLORS.reset}`;

  const paddedContent = `  ${metaContent}`;
  const truncatedContent = truncateToWidth(paddedContent, width - 2);
  const contentWidth = visibleWidth(truncatedContent);
  const rightPad = Math.max(0, width - 2 - contentWidth);

  const middleLine = `${ANSI_COLORS.dim}│${ANSI_COLORS.reset}${truncatedContent}${" ".repeat(rightPad)}${ANSI_COLORS.dim}│${ANSI_COLORS.reset}`;

  return [topBorder, middleLine, bottomBorder];
}

/**
 * Attempt to register or display the Grok Build header if the UI environment supports it.
 */
export function installHeader(
  ctx: ExtensionContext,
  options: HeaderOptions = DEFAULT_HEADER_OPTIONS,
): void {
  // Check if ctx.ui has custom setHeader API
  const ui = ctx.ui as unknown as { setHeader?: (renderer: (width: number) => string[]) => void };
  if (ctx.hasUI && typeof ui.setHeader === "function") {
    try {
      ui.setHeader((width: number) => renderHeader(ctx, width, options));
    } catch {
      // Graceful degradation
    }
  }
}
