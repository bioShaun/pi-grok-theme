/**
 * chrome-theme.ts — the single styling adapter for pi-grok-theme chrome
 *
 * All extension chrome (footer, header, status badge, notifications) takes
 * foreground color and text modifiers from here and nowhere else (v0.4 spec
 * §3.1, §4.1). Two backends:
 *
 * - **Theme-backed:** wraps the active Pi `Theme` so every tone resolves to a
 *   semantic theme token (`Theme.fg`/`Theme.bold`/`Theme.getFgAnsi`). ANSI
 *   reset handling lives only inside this adapter.
 * - **Shim-backed (no theme):** a private fallback palette used only when a
 *   `Theme` instance is genuinely unavailable (tests / headless).
 */

import type { Theme } from "@earendil-works/pi-coding-agent";

/**
 * Fallback palette for the shim backend only — never imported by status or
 * other production renderers. Kept here so chrome still paints when Pi does
 * not expose a Theme.
 */
export const ANSI_COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[38;2;104;110;120m", // #686E78
  muted: "\x1b[38;2;136;144;159m", // #88909F
  fg: "\x1b[38;2;225;225;225m", // #E1E1E1
  fgSecondary: "\x1b[38;2;200;200;200m", // #C8C8C8
  blue: "\x1b[38;2;122;162;247m", // #7AA2F7
  cyan: "\x1b[38;2;125;207;255m", // #7DCFFF
  amber: "\x1b[38;2;224;175;104m", // #E0AF68
  green: "\x1b[38;2;158;206;106m", // #9ECE6A
  purple: "\x1b[38;2;187;154;247m", // #BB9AF7
  red: "\x1b[38;2;247;118;142m", // #F7768E
};

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
