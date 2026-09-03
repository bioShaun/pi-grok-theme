/**
 * cursor.ts — OSC 12 terminal cursor color synchronization for pi-grok-build
 *
 * Grok Build's signature visual: the warm amber cursor.
 * Unlike theme JSON colors, cursor color is set at runtime via OSC 12
 * terminal escape sequences directly to stdout.
 *
 * Reference: grok-build theme/mod.rs apply_cursor_color()
 *   - OSC 12 to set:    \x1b]12;rgb:RR/GG/BB\x07
 *   - OSC 112 to reset:  \x1b]112\x07
 *
 * Supported terminals: Ghostty, WezTerm, iTerm2, Kitty, foot, xterm, VS Code
 */

/** Default Grok Build cursor color — Amber Gold from TokyoNight palette */
const GROK_CURSOR_COLOR = "E0/AF/68"; // #E0AF68

/**
 * Named-theme cursor policy (v0.4 spec §4.1).
 *
 * OSC 12 is outside the Pi theme API, so cursor color comes from this map
 * instead of the theme object. Bundled dark themes use Grok amber; the day
 * theme uses a darker amber that survives a light canvas. Unknown or
 * third-party themes must NOT be forced onto a bundled color — the terminal
 * default is restored instead.
 */
export const CURSOR_COLORS_BY_THEME: Readonly<Record<string, string>> = {
  "grok-build-coding": "#E0AF68",
  "grok-build": "#E0AF68",
  "grok-build-day": "#B45309",
};

export interface CursorPolicy {
  /** Hex color to apply via OSC 12, when the theme is a bundled match. */
  color?: string;
  /** True when the terminal default should be restored (OSC 112). */
  restoreDefault: boolean;
}

/** Resolve the cursor policy for an active theme name (null/unknown → restore default). */
export function resolveCursorPolicy(themeName?: string | null): CursorPolicy {
  const color = themeName ? CURSOR_COLORS_BY_THEME[themeName] : undefined;
  if (color) return { color, restoreDefault: false };
  return { restoreDefault: true };
}

/**
 * Apply the cursor policy for an active theme name: OSC 12 for bundled
 * matches, OSC 112 restore for unknown/missing themes.
 */
export function applyCursorPolicy(themeName?: string | null): void {
  const policy = resolveCursorPolicy(themeName);
  if (policy.color) {
    setCursorColor(hexToOsc12(policy.color));
  } else {
    resetCursorColor();
  }
}

/**
 * Emit an OSC 12 escape sequence to set the terminal cursor color.
 * This writes directly to stdout, bypassing Pi's rendering pipeline.
 */
export function setCursorColor(hexRgb?: string): void {
  const rgb = hexRgb ?? GROK_CURSOR_COLOR;
  try {
    // OSC 12 ; rgb:RR/GG/BB BEL
    process.stdout.write(`\x1b]12;rgb:${rgb}\x07`);
  } catch {
    // Silently fail if stdout is not a terminal (e.g., piped output)
  }
}

/**
 * Emit an OSC 112 escape sequence to restore the terminal's default cursor color.
 * Should be called on session_shutdown to leave the terminal clean.
 */
export function resetCursorColor(): void {
  try {
    // OSC 112 BEL — reset cursor color to terminal default
    process.stdout.write(`\x1b]112\x07`);
  } catch {
    // Silently fail
  }
}

/**
 * Convert a hex color string like "#E0AF68" or "E0AF68" to OSC 12 format "E0/AF/68".
 */
export function hexToOsc12(hex: string): string {
  const clean = hex.replace(/^#/, "");
  if (clean.length !== 6) return GROK_CURSOR_COLOR;
  return `${clean.slice(0, 2)}/${clean.slice(2, 4)}/${clean.slice(4, 6)}`;
}
