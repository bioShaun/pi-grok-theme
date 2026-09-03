# 03: Make extension chrome theme-native

**What to build:** Make the footer, optional header, status badge, and supported notifications immediately reflect the active Pi theme, including an appropriate cursor policy for each bundled light or dark theme.

**Blocked by:** 02: Introduce the Adaptive Chrome foundation.

**Status:** resolved

- [x] Footer, header, and status foreground colors are derived from semantic Pi theme tokens rather than fixed GrokNight RGB values.
- [x] Switching between bundled dark and day themes recolors installed chrome without restarting Pi.
- [x] Third-party themes remain legible because extension chrome uses their active semantic tokens.
- [x] Bundled dark themes use the Grok amber cursor and the day theme uses its darker amber cursor.
- [x] Unknown third-party themes are not forced to use a bundled-theme cursor color.
- [x] The migration removes the obsolete hard-coded chrome-color path without breaking working-message filtering or command output.

## Comments

Implemented 2026-09-03.

- **Cursor policy (`cursor.ts`):** `CURSOR_COLORS_BY_THEME` named-theme map (`grok-build-coding`/`grok-build` → `#E0AF68`, `grok-build-day` → `#B45309`); `resolveCursorPolicy()` returns "restore terminal default" for unknown or missing themes; `applyCursorPolicy()` emits OSC 12 for bundled matches and OSC 112 otherwise. `session_start` now applies the policy for the active theme name (`ctx.ui.theme?.name`) instead of unconditionally forcing amber.
- **Footer migration (`footer.ts`):** `renderGrokFooter` gained an optional `Theme` param and renders every segment through the chrome adapter (separator dim, branch accent per spec §4.1, model/cwd/extension statuses muted, context tiers through the adapter, badge rebuilt from the semantic badge: icon in the state's tone + label muted, idle dot muted). `installFooter` reads the live `ctx.ui.theme` on every render, so a dark↔day switch recolors on the next frame without reinstalling the footer or restarting Pi.
- **Header migration (`header.ts`):** same treatment — brand title accent+bold, cwd/model values text, labels muted, borders/separators dim, branch accent; live theme read per render. The folder mark moved into the glyph vocabulary (`folderMark`: modern `📁`, legacy `>`) so legacy terminals no longer depend on emoji.
- **Notifications (`index.ts`):** `/grok` info/theme/header/toggle messages are styled via the chrome adapter with the live theme; content unchanged. `badge.formattedText` is no longer consumed by chrome — footer builds the status segment from semantic fields.
- **Hard-coded path removal:** `footer.ts`, `header.ts`, and `index.ts` no longer import `ANSI_COLORS`. The constants remain only inside `status.ts` (shim badge fields + working-message filter, untouched behavior) and the chrome adapter's no-theme fallback, as the spec's migration clause allows. Working-message filtering and all command outputs keep passing their original tests.
- **Tests (`test/chrome-native.test.js`, 9 new):** token-derived coloring with valid-SGR theme doubles (a first draft used invalid escape sequences that pi-tui could not strip, which corrupted width math — fixed by emitting numeric SGR codes), dark↔day recolor with identical stripped content, third-party theme token use, shim fallback, cursor policy table + captured OSC writes. Suite: 34 tests green, `tsc --noEmit` clean.
