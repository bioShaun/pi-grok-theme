/**
 * working-indicator.ts — Grok Build working animation (v0.4 spec §4.2)
 *
 * Installs the one-column Braille spinner (or ASCII fallback in legacy glyph
 * mode) via Pi's `setWorkingIndicator`, colored with the active theme's
 * accent. Pi core animates the frames; this module only supplies them.
 *
 * Everything is feature-detected: Pi versions without `setWorkingIndicator`
 * keep the v0.3 behavior silently. Frames are baked strings, so a theme
 * switch re-applies them via `applyWorkingIndicator` (wired by the theme
 * switching ticket); shutdown restores Pi's default indicator.
 */

import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { getGlyphs } from "./glyphs.ts";
import { createChromeTheme } from "./chrome-theme.ts";

/** Frame cadence for the working indicator (spec §4.2). */
export const WORKING_INDICATOR_INTERVAL_MS = 120;

/** Spinner frames colored with the active theme accent. */
export function coloredSpinnerFrames(theme?: Theme | null): string[] {
  const chrome = createChromeTheme(theme);
  return getGlyphs().spinnerFrames.map((frame) => chrome.fg("accent", frame));
}

/**
 * Configure the custom working indicator on Pi versions that support it.
 * Returns true when the indicator was installed, false when the API is
 * unavailable (never throws).
 */
export function applyWorkingIndicator(ctx: ExtensionContext): boolean {
  if (!ctx.hasUI || typeof ctx.ui?.setWorkingIndicator !== "function") {
    return false;
  }
  try {
    let theme: Theme | undefined;
    try {
      theme = ctx.ui?.theme ?? undefined;
    } catch {
      theme = undefined;
    }
    ctx.ui.setWorkingIndicator({
      frames: coloredSpinnerFrames(theme),
      intervalMs: WORKING_INDICATOR_INTERVAL_MS,
    });
    return true;
  } catch {
    return false;
  }
}

/** Restore Pi's default working indicator (feature-detected, idempotent). */
export function restoreWorkingIndicator(ctx: ExtensionContext): void {
  if (!ctx.hasUI || typeof ctx.ui?.setWorkingIndicator !== "function") {
    return;
  }
  try {
    ctx.ui.setWorkingIndicator();
  } catch {
    // Restoring must never crash shutdown.
  }
}
