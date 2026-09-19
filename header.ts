/** Compact workspace heading or optional boxed banner, with live semantic colors. */

import * as path from "node:path";
import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { formatCwd, shortenBranch, truncateToWidth, visibleWidth } from "./footer.ts";
import { createChromeTheme } from "./chrome-theme.ts";
import { resolveGlyphs, resolveGlyphDensity, type GlyphDensity } from "./glyphs.ts";
import type { GitSnapshot } from "./git-status.ts";
import type { HeaderStyle } from "./settings.ts";
import { VERSION } from "./version.ts";

export interface HeaderOptions {
  style?: HeaderStyle;
  glyphDensity?: GlyphDensity;
  getGitSnapshot?: () => GitSnapshot;
  showTitle?: boolean;
  showBranch?: boolean;
  showModel?: boolean;
  version?: string;
}

export const DEFAULT_HEADER_OPTIONS: HeaderOptions = {
  style: "compact",
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
  if (width <= 0) return [""];
  const chrome = createChromeTheme(theme);
  const glyphs = resolveGlyphs(options.glyphDensity);
  const ascii = resolveGlyphDensity(options.glyphDensity) === "ascii";
  const ellipsis = ascii ? "~" : "…";
  const cut = (text: string, size: number) => truncateToWidth(text, Math.max(0, size), size > 1 ? ellipsis : "");
  const cwdFormatted = formatCwd(ctx.cwd);
  const branch = options.showBranch !== false ? options.getGitSnapshot?.().branch : undefined;
  const sep = chrome.fg("dim", ascii ? " | " : " · ");
  if ((options.style ?? "compact") === "compact") {
    const project = chrome.fg("text", `${glyphs.folderMark} ${path.basename(ctx.cwd) || cwdFormatted}`);
    const remaining = width - visibleWidth(project) - visibleWidth(sep);
    const branchLabel = branch && remaining >= 4
      ? chrome.fg("muted", `${glyphs.branchMark} ${shortenBranch(branch, remaining - 2, ellipsis)}`) : "";
    return [cut(project + (branchLabel ? sep + branchLabel : ""), width)];
  }
  if (width < 4) return ["", cut(cwdFormatted, width), ""];
  const parts = [chrome.fg("text", `${glyphs.folderMark} ${cwdFormatted}`)];
  if (branch) parts.push(chrome.fg("muted", `${glyphs.branchMark} ${branch}`));
  const model = ctx.model?.name || ctx.model?.id;
  if (options.showModel !== false && model) parts.push(chrome.fg("muted", "model: ") + chrome.fg("text", model));
  if (options.version) parts.push(chrome.fg("muted", `v${options.version}`));
  const h = ascii ? "-" : "─";
  const v = ascii ? "|" : "│";
  const corners = ascii ? ["+", "+", "+", "+"] : ["╭", "╮", "╰", "╯"];
  const title = options.showTitle === false ? "" : cut(chrome.bold(chrome.fg("text", " GROK BUILD ")), width - 3);
  const top = chrome.fg("dim", corners[0]! + h) + title + chrome.fg("dim", h.repeat(Math.max(0, width - 3 - visibleWidth(title))) + corners[1]);
  const content = cut(" " + parts.join(sep), width - 2);
  return [top, chrome.fg("dim", v) + content + " ".repeat(width - 2 - visibleWidth(content)) + chrome.fg("dim", v), chrome.fg("dim", corners[2]! + h.repeat(width - 2) + corners[3])];
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
