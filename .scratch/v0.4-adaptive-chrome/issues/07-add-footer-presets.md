# 07: Add responsive footer presets

**What to build:** Let users switch among auto, minimal, and full single-line footer presentations while preserving core status information, third-party extension statuses, and strict width safety.

**Blocked by:** 04: Upgrade the context pressure metric; 05: Add coalesced rendering and dual timing.

**Status:** resolved

- [x] The footer command reports and switches among auto, minimal, and full presets immediately.
- [x] Each preset includes the segment set defined by the v0.4 specification.
- [x] Model and active status remain the highest-priority core fields whenever their data exists.
- [x] Whole-turn timing appears only where the preset and available width permit it.
- [x] Third-party extension statuses remain supported but cannot force higher-priority core fields off-screen.
- [x] Optional segments are compacted or removed by metadata-driven priority rather than formatted-string identity.
- [x] Every preset remains a single line and fits all tested terminal widths.

## Comments

Implemented 2026-09-03.

- **Metadata-driven segments (spec §5.2):** `FooterSegment { id, priority, required, wide, compact, position }`; new `buildFooterSegments()` constructs only segments with real data; new `fitFooterSegments()` fits the row operating purely on that metadata (the old formatted-string identity comparisons are gone). Fitting runs in three tiers: drop non-compactable optional segments lowest-priority-first → compact compactable segments (context → percentage-only, model → short name) → drop compactable segments only if still overflowing → `truncateToWidth` as the final safety net. Required segments (status; model when data exists) never receive a drop op.
- **Presets (spec §4.5):** `auto` = full responsive hierarchy (no turn time); `minimal` = model · context · status; `full` = everything plus whole-turn duration (`formatDuration(turnElapsedMs) turn`, dim tone) rendered only when the badge actually has `turnElapsedMs`. cwd stays the leading block (two-space glue) and is the first standard segment removed (priority 8 per spec §6); extension statuses are one segment per key at priority 5, dropped individually (later entries first), so they can never push status/model off-screen.
- **Command:** `/grok footer` reports the current preset with descriptions and the available values; `/grok footer auto|minimal|full` validates, applies immediately (`requestRender`), and notifies; unknown presets warn without changing anything. Preset is session-local (spec §4.5). `/grok` description updated.
- **Compat:** the v0.3 `compactThreshold` survives as "prefer compact variants below this width", which also keeps `/grok toggle` meaningful.
- **Tests (`test/footer-presets.test.js`, 10 new):** preset segment membership, turn-time gating (full-only + data-only), tiered fitting (priority drop order, compact-before-drop, required survival, individually droppable extension statuses), single-line width safety for all presets at 20–160 sampled widths, core-field survival at extreme narrowness, and the `/grok footer` report/switch/immediate-apply/unknown-preset flows. Suite: 72 tests green, `tsc --noEmit` clean.

