# 09: Verify the Adaptive Chrome regression matrix

**What to build:** Prove the complete v0.4 presentation layer remains width-safe, lifecycle-safe, and compatible across presets, activity states, themes, glyph modes, and cooperating extensions.

**Blocked by:** 04: Upgrade the context pressure metric; 05: Add coalesced rendering and dual timing; 06: Add the Grok working animation; 07: Add responsive footer presets; 08: Enable direct theme switching.

**Status:** resolved

- [x] Automated tests exercise every terminal width from 20 through 160 for every footer preset.
- [x] Tests cover idle, thinking, streaming, running-tool, and post-tool states in modern and legacy glyph modes.
- [x] Long model, branch, path, and third-party extension-status values never overflow Pi's visible-width limit.
- [x] ANSI styling remains balanced after compaction and final truncation.
- [x] Repeated setup, turn, theme-switch, and shutdown sequences do not stack wrappers, timers, indicators, or subscriptions.
- [x] Dark, day, and representative third-party themes pass integration-style rendering checks.
- [x] The full test and quality baseline passes as one release candidate.

## Comments

Implemented 2026-09-03.

- **Width matrix (`test/regression-matrix.test.js`):** every width 20 through 160 (inclusive, step 1) × every preset (auto/minimal/full) × every activity state (idle/thinking/streaming/running_tool/working) renders exactly one non-empty line with `visibleWidth ≤ width`, both with extension statuses present and with a bare context (no model/usage/thinking data). Plus a shim-palette sweep across all 141 widths (longest ANSI payloads).
- **Glyph modes:** all five states render safely in modern and legacy modes with the correct markers (`○`/`●` vs `o`/`*`, `⎇` vs `#`); legacy substitution provably keeps identical line width.
- **Long values:** 6×-repeated directory paths, an 80-char model id, and 40–60-char extension statuses from three cooperating extensions stay inside budget at widths 20–160 across all presets.
- **ANSI balance:** every matrix row is checked by comparing pi-tui's measurement against a regex-stripped measurement (a dangling or partial escape would diverge) plus an explicit dangling-escape regex — compaction and final truncation included.
- **Lifecycle stacking:** a counting harness proves two `session_start`s wrap `setWorkingMessage` exactly once, footer installs/disposes follow the exact install-reinstall-dispose pattern with no stacking, double shutdown is a clean no-op that leaves the footer handle cleared, working-indicator configuration is an idempotent set/restore count (2 installs + 2 theme-switch reapplies + 1 restore), and header enable/disable cycles dispose exactly once per real install.
- **Theme integration:** dark, day, and third-party palette doubles render footer (single line, fits, themed) and header (three balanced lines, fits) at 40/80/120 with zero hard-coded GrokNight truecolor output.
- **Release candidate:** the entire suite (88 tests) plus `tsc --noEmit` passes as one gate.

