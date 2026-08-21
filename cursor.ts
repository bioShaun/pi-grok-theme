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
