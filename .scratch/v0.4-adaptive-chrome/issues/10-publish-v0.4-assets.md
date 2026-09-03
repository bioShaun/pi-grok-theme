# 10: Publish the v0.4 release assets

**What to build:** Make v0.4 understandable and evaluable before installation by shipping trustworthy visual previews, synchronized bilingual documentation, and complete release metadata.

**Blocked by:** 01: Establish the v0.4 quality baseline; 09: Verify the Adaptive Chrome regression matrix.

**Status:** resolved

- [x] Real-session or deterministic screenshots cover all three bundled themes.
- [x] Preview assets demonstrate both narrow and wide footer layouts without hand-drawn substitutes.
- [x] English and Chinese READMEs explain the new working indicator, context metric, footer presets, theme switching, glyph fallback, and compatibility behavior.
- [x] The main specification and release notes accurately distinguish delivered features from deferred v0.5 or upstream work.
- [x] Package metadata and displayed version values are synchronized at 0.4.0.
- [x] Installation contents include every required runtime and preview/documentation artifact.
- [x] All CI and release-gate checks pass against the final release state.

## Comments

Implemented 2026-09-03.

- **Deterministic previews:** `scripts/render-previews.js` (`npm run previews`) loads each bundled theme JSON into a genuine Pi `Theme` instance (truecolor), drives `WorkingStateController` into a running-tool turn, and renders the header plus **wide (120 cols) and narrow (44 cols)** footers through the real `renderHeader`/`renderGrokFooter`; a small ANSI→SVG converter paints the captured truecolor output on the theme's terminal background. Assets committed at `docs/previews/{grok-build-coding,grok-build,grok-build-day}.svg`. No hand-drawn art anywhere — and a release test byte-compares the committed SVGs against a fresh render, so previews can never go stale.
- **Bilingual docs:** both READMEs gained a "What's New in v0.4 / v0.4 新特性" section (working indicator, context metric, footer presets, theme switching, glyph fallback, compatibility), a Visual Previews section linking the three SVGs, updated layout examples with the `⇣` notation, the preset commands, the metadata-driven dropping hierarchy, the new extension commands (`/grok footer`, `/grok theme <name>`), and the refreshed project-structure tree.
- **Release notes:** `CHANGELOG.md` (new) records the authoritative delivered-in-0.4.0 list versus deferred work (v0.5 appearance-aware switching, Oh My Pi variant distribution, upstream schema proposals, no-data segments), plus the documented limitation that theme switches made outside `/grok theme` recolor cursor/spinner on the next session or command (Pi exposes no theme-change event). The canonical spec header moved to **Status: Delivered in 0.4.0** with a delivery note referencing the same split.
- **Version sync:** new `version.ts` is the single source (`VERSION = "0.4.0"`); `package.json`, the `/grok info` and `/grok theme` display strings, and the header version tag all consume it; `test/release.test.js` asserts package.json === version.ts === header default.
- **Package contents:** `package.json` files now include all ten runtime modules, `SPEC.md`, `CHANGELOG.md`, and `docs/previews`; `npm pack --dry-run` verified 24 files / 42.2 kB with every runtime and preview/doc artifact present; `test/release.test.js` also cross-checks that each runtime module and doc artifact is listed and exists.
- **Final gate:** `npm run typecheck` clean + 92 tests green (theme schema/token/contrast gates, foundation, chrome-native, context metric, render clock, working indicator, presets, theme switching, full regression matrix, release assets).
