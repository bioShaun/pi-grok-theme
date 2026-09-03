# 04: Upgrade the context pressure metric

**What to build:** Give users a compact Grok-style context indicator that shows real token pressure, adapts between wide and narrow terminals, and escalates through the active theme's semantic colors.

**Blocked by:** 03: Make extension chrome theme-native.

**Status:** resolved

- [x] Wide layouts show used tokens, total tokens, and percentage with the Grok token-arrow vocabulary.
- [x] Compact layouts show percentage only.
- [x] Context color changes at the specified 65%, 80%, and 90% thresholds using muted, accent, warning, and error tones.
- [x] Host-provided percentages take precedence; otherwise the percentage is computed and clamped to 0–100%.
- [x] Missing usage data produces no fabricated context segment.
- [x] Legacy glyph mode substitutes the token arrow without changing layout width.
- [x] Boundary and width tests cover unavailable data and every threshold transition.

## Comments

Implemented 2026-09-03.

- `renderContextMetric` rewritten to the spec §4.3 contract: wide form `⇣48k/200k (24%)` with the token arrow taken from the glyph vocabulary (modern `⇣`, legacy `↓`, both pinned width 1 so layout width is unchanged), compact form `24%`, threshold tones muted `<65`, accent `65–79`, warning `80–89`, error `>=90` evaluated on the displayed (rounded) percentage so color always matches the shown number.
- Percentage resolution: host-provided `ContextUsage.percent` wins when present; otherwise computed from `usedTokens/totalTokens`; display clamped to 0–100%. The old path fabricated `0%` when tokens existed without a total — removed: no percent and no total → empty segment. (This also fixed a latent v0.3 defect where `percent===0 && tokens===0`-style inputs rendered a bogus `0%`.)
- `renderGrokFooter` passes the resolved glyph set into both wide and compact render calls; compaction to the percentage-only form still happens inside the existing overflow-fitting chain.
- Tests (`test/context-metric.test.js`, 10 new): exact wide/compact strings (ANSI-stripped), tone tables at 0/24/64/65/70/79/80/85/89/90/95/100, computed-value boundaries, host precedence, clamping (over-window, host >100, host <0), missing-data matrix (`undefined`/half-provided/null), legacy substitution with equal visible width, and a wide-footer integration check at 90% pressure. Suite: 44 tests green, `tsc --noEmit` clean.

