# 02: Introduce the Adaptive Chrome foundation

**What to build:** Add a backward-compatible presentation foundation in which activity state is semantic, theme styling is applied at render time, and all fixed-width glyphs come from one capability-aware vocabulary, while preserving the existing v0.3 appearance and behavior.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Activity status can be consumed as semantic state, tone, label, phase time, and turn time without requiring embedded ANSI codes.
- [x] A single theme adapter owns foreground styling and text modifiers used by extension chrome.
- [x] A single glyph vocabulary supplies modern and legacy variants for every fixed-width chrome symbol required by the v0.4 spec.
- [x] Modern and legacy fixed-width glyphs have explicit visible-width tests.
- [x] Existing footer, header, commands, working-message filtering, and teardown tests continue to pass.
- [x] Compatibility shims keep existing public behavior intact until the migration ticket removes the old rendering path.

## Comments

Implemented 2026-09-02.

- **`glyphs.ts` (new):** one `GlyphSet` vocabulary with modern/legacy variants for all spec §4.7 keys (working dot, idle circle, thinking mark, branch mark, token arrow, brand mark, disclosure arrow, spinner frames). `detectGlyphMode()` implements `PI_GROK_LEGACY_GLYPHS=1`/`=0` overrides plus automatic legacy mode on win32 without Windows Terminal / a known modern terminal; `getGlyphs()` resolves the set. Token arrow follows spec §4.3: modern `⇣`, legacy `↓`. Spinner frames: Braille `⠋⠙⠹⠸⠼⠴⠦⠧` vs ASCII `|/-\`.
- **`chrome-theme.ts` (new):** the single styling adapter. Tone vocabulary (`text muted dim accent warning success error thinking`) maps to semantic Pi theme tokens (`Theme.fg`/`Theme.bold`/`Theme.getFgAnsi`); ANSI reset handling lives only here. Without a `Theme` it falls back to the v0.3 `ANSI_COLORS` shim, and a broken theme degrades to unstyled text instead of crashing.
- **`status.ts`:** `StatusBadge` now carries semantic fields (`state`, `icon: GlyphKey`, `tone`, `label`, `phaseElapsedMs`, `turnElapsedMs`) with zero embedded ANSI. `phaseStartAt` resets on every thinking/streaming/tool transition; repeated `startStreaming` updates (per-token `message_update`) no longer reset the phase clock; turn clock stays continuous. v0.3 shims (`dot`, `duration`, `rawText`, `formattedText`, `ANSI_COLORS` export) kept byte-identical — the per-state shim dot colors are preserved exactly.
- **Width tests:** all fixed-width glyphs pinned at exactly 1 visible column via pi-tui `visibleWidth`, except the modern brand mark `⚡` (measured width 2); spinner frames 1 column each. Tested via explicit expected-width tables.
- **Backward compatibility:** footer/header/index rendering untouched in this ticket; all 10 pre-existing tests pass unchanged (25 tests total green, `tsc --noEmit` clean).
