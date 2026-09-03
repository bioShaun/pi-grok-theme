/**
 * header.ts — Clean Grok-style workspace header for pi-grok-build
 *
 * Implements a high-contrast, minimalist workspace banner:
 * ╭─ GROK BUILD ────────────────────────────────────────────────────────────╮
 * │ 📁 my-project  ⎇ main  ·  model: claude-3.7-sonnet  ·  v0.2.0           │
 * ╰─────────────────────────────────────────────────────────────────────────╯
 *
 * v0.4: all foreground color comes from the active Pi theme through the
 * chrome adapter; the render path reads the live `ctx.ui.theme` so theme
 * switches recolor the header without reinstalling it.
 */

import * as path from "node:path";
import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { formatCwd, getGitBranch, truncateToWidth, visibleWidth } from "./footer.ts";
import { createChromeTheme } from "./chrome-theme.ts";
import { getGlyphs } from "./glyphs.ts";
import { VERSION } from "./version.ts";

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
  version: VERSION,
};

/**
 * Render a Grok Build styled workspace header box.
 */
export function renderHeader(
  ctx: ExtensionContext,
  width: number,
  options: HeaderOptions = DEFAULT_HEADER_OPTIONS,
  theme?: Theme | null,
): string[] {
  if (width < 20) return [""];

  const chrome = createChromeTheme(theme);
  const glyphs = getGlyphs();
  const innerWidth = Math.max(1, width - 4);
  void innerWidth;
  const cwdFormatted = formatCwd(ctx.cwd);
  const branch = options.showBranch ? getGitBranch(ctx.cwd) : undefined;
  const rawModel = ctx.model?.name || ctx.model?.id || "";

  // Title / Tag
  const brandTitle = " GROK BUILD ";
  const versionTag = options.version ? `v${options.version}` : "";

  // Metadata parts
  const parts: string[] = [];
  parts.push(`${chrome.fg("text", `${glyphs.folderMark} ${cwdFormatted}`)}`);
  if (branch) {
    parts.push(chrome.fg("accent", `${glyphs.branchMark} ${branch}`));
  }
  if (options.showModel && rawModel) {
    parts.push(`${chrome.fg("muted", "model: ")}${chrome.fg("text", rawModel)}`);
  }
  if (versionTag) {
    parts.push(chrome.fg("dim", versionTag));
  }

  const sep = chrome.fg("dim", " · ");
  const metaContent = parts.join(sep);

  // Borders
  const borderChar = "─";
  const titleFormatted = chrome.bold(chrome.fg("accent", brandTitle));
  const titleWidth = visibleWidth(brandTitle);
  const topBorderRightLength = Math.max(0, width - 3 - titleWidth);

  const topBorder = `${chrome.fg("dim", "╭─")}${titleFormatted}${chrome.fg("dim", `${borderChar.repeat(topBorderRightLength)}╮`)}`;
  const bottomBorder = chrome.fg("dim", `╰${borderChar.repeat(width - 2)}╯`);

  const paddedContent = `  ${metaContent}`;
  const truncatedContent = truncateToWidth(paddedContent, width - 2);
  const contentWidth = visibleWidth(truncatedContent);
  const rightPad = Math.max(0, width - 2 - contentWidth);

  const middleLine = `${chrome.fg("dim", "│")}${truncatedContent}${" ".repeat(rightPad)}${chrome.fg("dim", "│")}`;

  return [topBorder, middleLine, bottomBorder];
}

/**
 * Attempt to register or display the Grok Build header if the UI environment supports it.
 */
export function installHeader(
  ctx: ExtensionContext,
  options: HeaderOptions = DEFAULT_HEADER_OPTIONS,
): { dispose: () => void } | undefined {
  if (ctx.hasUI && typeof ctx.ui?.setHeader === "function") {
    try {
      ctx.ui.setHeader((_tui, theme) => {
        return {
          render: (width: number) => {
            let liveTheme: Theme | undefined;
            try {
              liveTheme = ctx.ui?.theme ?? undefined;
            } catch {
              liveTheme = undefined;
            }
            return renderHeader(ctx, width, options, liveTheme ?? theme);
          },
          invalidate: () => {},
        };
      });
      return {
        dispose: () => {
          try {
            ctx.ui?.setHeader(undefined);
          } catch {
            // Graceful fallback
          }
        },
      };
    } catch {
      // Graceful degradation
    }
  }
}
