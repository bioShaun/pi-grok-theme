/**
 * chrome-theme.ts — the single styling adapter for pi-grok-build chrome
 *
 * All extension chrome (footer, header, status badge, notifications) takes
 * foreground color and text modifiers from here and nowhere else (v0.4 spec
 * §3.1, §4.1). Two backends:
 *
 * - **Theme-backed:** wraps the active Pi `Theme` so every tone resolves to a
 *   semantic theme token (`Theme.fg`/`Theme.bold`/`Theme.getFgAnsi`). ANSI
 *   reset handling lives only inside this adapter.
 * - **Shim-backed (no theme):** the v0.3 `ANSI_COLORS` constants, used until
 *   the migration ticket removes the old hard-coded path and anywhere a
 *   `Theme` instance is genuinely unavailable.
 */

import type { Theme } from "@earendil-works/pi-coding-agent";
import { ANSI_COLORS } from "./status.ts";

/** Semantic chrome tones — the vocabulary renderers are allowed to name. */
export type ChromeTone =
  | "text"
  | "muted"
  | "dim"
  | "accent"
  | "warning"
  | "success"
  | "error"
  | "thinking";

type ThemeColorName =
  | "text"
  | "muted"
  | "dim"
  | "accent"
  | "warning"
  | "success"
  | "error"
  | "thinkingText";

const TONE_TO_THEME_COLOR: Record<ChromeTone, ThemeColorName> = {
  text: "text",
  muted: "muted",
  dim: "dim",
  accent: "accent",
  warning: "warning",
  success: "success",
  error: "error",
  thinking: "thinkingText",
};

const TONE_TO_SHIM_ANSI: Record<ChromeTone, string> = {
  text: ANSI_COLORS.fg,
  muted: ANSI_COLORS.muted,
  dim: ANSI_COLORS.dim,
  accent: ANSI_COLORS.blue,
  warning: ANSI_COLORS.amber,
  success: ANSI_COLORS.green,
  error: ANSI_COLORS.red,
  thinking: ANSI_COLORS.purple,
};

export interface ChromeTheme {
  /** The wrapped Pi theme, or null when running on the shim backend. */
  readonly theme: Theme | null;
  /** Wrap `text` in the tone's foreground color (reset included). */
  fg(tone: ChromeTone, text: string): string;
  /** Open prefix for hand-assembled segments; pair with `fgClose()`. */
  fgOpen(tone: ChromeTone): string;
  /** Close suffix matching `fgOpen()` — the only reset the adapter emits. */
  fgClose(): string;
  /** Bold modifier (reset included). */
  bold(text: string): string;
}

/**
 * Build the chrome styling adapter around a Pi `Theme`.
 * Passing null/undefined selects the shim backend.
 */
export function createChromeTheme(theme?: Theme | null): ChromeTheme {
  if (!theme) {
    return {
      theme: null,
      fg: (tone, text) => `${TONE_TO_SHIM_ANSI[tone]}${text}${ANSI_COLORS.reset}`,
      fgOpen: (tone) => TONE_TO_SHIM_ANSI[tone],
      fgClose: () => ANSI_COLORS.reset,
      bold: (text) => `${ANSI_COLORS.bold}${text}${ANSI_COLORS.reset}`,
    };
  }

  const safeFg = (tone: ChromeTone, text: string): string => {
    try {
      return theme.fg(TONE_TO_THEME_COLOR[tone], text);
    } catch {
      // Unknown/misshapen theme color: degrade to unstyled, never crash chrome.
      return text;
    }
  };
  const safeFgOpen = (tone: ChromeTone): string => {
    try {
      return theme.getFgAnsi(TONE_TO_THEME_COLOR[tone]);
    } catch {
      return "";
    }
  };

  return {
    theme,
    fg: (tone, text) => safeFg(tone, text),
    fgOpen: (tone) => safeFgOpen(tone),
    // Theme.fg resets only the foreground (\x1b[39m); mirror that here.
    fgClose: () => "\x1b[39m",
    bold: (text) => {
      try {
        return theme.bold(text);
      } catch {
        return text;
      }
    },
  };
}
