# 06: Add the Grok working animation

**What to build:** Show active work with a stable, theme-colored, one-column Braille spinner on capable Pi versions and a safe ASCII animation on legacy terminals, restoring host behavior on shutdown.

**Blocked by:** 03: Make extension chrome theme-native.

**Status:** resolved

- [x] Supported Pi versions receive the specified Braille working frames at the specified cadence.
- [x] Every modern and legacy frame occupies exactly one visible terminal column.
- [x] Spinner frames use the active theme accent and are reapplied after a theme change.
- [x] Forced and automatically detected legacy mode uses the ASCII fallback frames.
- [x] Older Pi versions without the working-indicator API retain functional v0.3 behavior without errors.
- [x] Session shutdown restores Pi's default working indicator.
- [x] The footer does not display a second animated spinner.

## Comments

Implemented 2026-09-03.

- **`working-indicator.ts` (new):** `applyWorkingIndicator(ctx)` feature-detects `ctx.ui.setWorkingIndicator` and installs the spec Braille frame set (`⠋⠙⠹⠸⠼⠴⠦⠧` from the glyph vocabulary) at `WORKING_INDICATOR_INTERVAL_MS = 120`, each frame colored with the active theme's `accent` via the chrome adapter (frames are baked strings, so re-application after a theme change re-runs `applyWorkingIndicator` — the `/grok theme` switch in ticket 08 wires this; the reapply function is built and tested here). `restoreWorkingIndicator(ctx)` calls `setWorkingIndicator()` with no arguments to restore Pi's default. Both are feature-detected and never throw — Pi versions without the API (or a failing host) silently keep v0.3 behavior.
- **Legacy mode:** forced (`PI_GROK_LEGACY_GLYPHS=1`) and automatic detection resolve the glyph set to the ASCII `| / - \` frames, still accent-colored.
- **Lifecycle:** `session_start` applies the indicator; `session_shutdown` restores Pi's default before disposing chrome.
- **No double spinner:** the footer keeps its compact static state marker (semantic badge dot + label); a test proves no spinner frame ever appears in a rendered footer and that renders are deterministic.
- **Tests (`test/working-indicator.test.js`, 8 new):** cadence constant, frame set + coloring for modern and legacy, colored-frame width pinned at exactly one column across themes, reapplication with a second theme's accent, API-absent and host-error paths, restore-with-no-args semantics, and the footer static-marker/no-animation guarantee. Suite: 62 tests green, `tsc --noEmit` clean.

