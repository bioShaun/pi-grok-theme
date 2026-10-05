# Changelog

## Unreleased

- Add automatic pi-open-tui companion ownership, with explicit integration modes applied on reload.
- Add `grok-open` / `grok-open-day` themes with readable effort labels, explicit body text and tinted tool errors.
- Add daily/diagnostic open-tui density presets with atomic, preserving configuration merges.
- Add optional real open-tui renderer previews and integration checks.

Reliability and visual-polish work for Pi chrome. No version bump is assigned yet.

- Cooperate with footer-owning extensions such as pi-open-tui: yield rendering and Git counts, retain theme chrome, and prevent `/grok header` from replacing the other extension's header. Theme chrome now synchronizes when Pi's active theme changes.
- Hardened Git spawn-error handling, limited OSC writes to TUI mode, passed working messages through, and sanitized status text.

### Git and layout

- Moved Git discovery and status reads out of the render path. A single-flight provider caches successful snapshots for about three seconds, aborts bounded reads, ignores stale workspace results, and refreshes the UI when data arrives.
- Refreshing retains the last good branch and counts. Failed reads show `git?`, retain a known branch, and hide unreliable counts; non-repositories remain quiet.
- At 80 columns and wider, Footer metadata and activity use two zones with a stable 24-column right activity area. Narrow layouts preserve a recognizable model and activity state before optional fields.
- Normal branches and untracked counts use neutral tones; staged and dirty counts keep distinct semantic and textual markers.

### Controls and persistence

- Footer presets are `default`, `minimal`, and `full`; legacy `auto` migrates to `default` and remains an accepted alias.
- Glyph preference now defaults to `auto`, with explicit `unicode`, `nerd`, and `ascii` choices. `PI_GROK_LEGACY_GLYPHS=1` forces ASCII; `=0` resolves auto to modern Unicode. Separator fallback follows the effective glyph mode without overwriting the selected separator.
- Header remains disabled by default. Its new `compact` style is one line; `boxed` preserves the previous banner. `/grok header [compact|boxed|on|off]` includes the existing bare toggle, and an old enabled Header migrates to boxed.
- Added `/grok motion normal|quiet`, defaulting to `normal`. Where the host supports custom working frames, quiet uses a static frame; plugin timers use integer seconds and avoid redundant redraws. Unsupported host animation control is reported honestly.
- Preferences are written atomically beneath the Pi agent directory, including `PI_CODING_AGENT_DIR` overrides. A failed save leaves the previous file intact, keeps the session change, and emits one failure notification.

### Visual system and previews

- Consolidated plugin-owned symbols into coherent Unicode, Nerd Font, and ASCII sets. Default icons are monochrome; day-theme readable secondary content uses a clearer accessible gray hierarchy.
- The Pi extension owns Footer, Header, commands, and motion. omp receives generated palette files only; this release does not port Pi chrome behavior to omp.
- Expanded the existing three deterministic Header/Footer SVGs with compact/boxed, wide/narrow, Git, context, and activity scenarios. Added three real-host `*-content.svg` showcases for Markdown, syntax, tools, errors, Diff, and filtered selection, rendered in isolated theme sessions.
- Automated rendering and contrast checks cover the documented states. Real-terminal and tmux visual QA remain separate acceptance work and are not claimed here.

## 0.5.0 — omp-style polish (2026-09-09)

Vars-first themes, omp-flavored footer chrome, OSC 8 path + git counts, and dual Pi/omp theme export.

### Themes
- Shared palette + overlays generate `themes/grok-build*.json` via `npm run build:themes`.
- Dual distribution: `themes/omp/*.json` adds `pythonMode` + 14 `statusLine*` tokens; **not** listed in `pi.themes`.

### Footer visual
- Preset rename: `auto` → `default` (legacy typed `auto` still accepted for one release).
- Glyph density: `unicode` | `nerd` | `ascii` (`nerd` opt-in only; `PI_GROK_LEGACY_GLYPHS=1` forces ascii).
- Named separators: `dot` | `powerline-thin` | `slash` | `ascii` (default `dot`).
- Settings migration write-back; `/grok footer`, `/grok footer glyphs`, `/grok footer sep` UX.

### Path + git
- OSC 8 `file://` hyperlink on the path segment (stripped for width math and SVG previews).
- Git staged / dirty / untracked counts via `git status --porcelain=v1` with a 3s cache, colored through existing Pi tones (success / warning / error).


## 0.4.1 — Cleanup (2026-09-09)

Focused cleanup on top of Adaptive Chrome. No new beauty/UI features.

### User-facing

- **Deterministic release previews** — SVG previews no longer bake the local
  checkout path; a fixed preview cwd (`~/pi/pi-grok-theme` via fixture home)
  makes `npm test` / `npm run previews` reproducible on any machine.
- **Semantic status only** — production status badges drop the ANSI
  `formattedText` / `rawText` / `dot` shims; chrome uses theme tones + glyphs.
- **Phase-aligned working messages** — filtered working labels use the same
  phase clock as the footer badge (not whole-turn elapsed).
- **Glyph-routed shell chrome** — window title and hidden-thinking label use
  `brandMark` / `disclosureArrow` so legacy glyph mode stays consistent.
- **Persisted footer/header prefs** — `/grok footer` preset and `/grok header`
  toggle survive across sessions in `~/.pi/agent/pi-grok-theme.json`.
- **Honest `/grok info`** — reports the active theme and
  `resolveCursorPolicy` result instead of hard-coded Amber Gold / GrokNight.
- **Help copy** — unknown-subcommand usage lists `footer`; user-visible
  strings say `pi-grok-theme` (package name unchanged).
- **Docs** — root `SPEC.md` is a short stub pointing at the authoritative
  docs; `docs/grok-build-ui-gaps.md` marked as a pre-0.4 archive.

### Notes

- Do not restore grok-tps. Segment fitting, RenderClock ownership, and the
  theme-native chrome adapter are unchanged.

## 0.4.0 — Adaptive Chrome (2026-09-03)

Theme-native adaptive chrome for the footer, header, status badge, and
notifications, with Grok Build-style motion and metrics. Target runtime:
Pi `>= 0.80.0` with progressive enhancement on newer UI APIs.

### Delivered in 0.4.0

- **Theme-native chrome** — every chrome color comes from the active Pi
  theme's semantic tokens through a single styling adapter
  (`chrome-theme.ts`); the hard-coded GrokNight ANSI path is removed.
  Switching themes recolors installed chrome without restarting Pi.
- **Named-theme cursor policy** — bundled dark themes set the Grok amber
  cursor (`#E0AF68`), `grok-build-day` sets a darker amber (`#B45309`),
  unknown/third-party themes restore the terminal default (OSC 12/112).
- **Grok working indicator** — one-column Braille spinner
  (`⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧`) at a 120 ms cadence in the theme accent via
  `ctx.ui.setWorkingIndicator`, with ASCII fallback (`| / - \`) in legacy
  glyph mode and full restore on shutdown. Feature-detected on older Pi.
- **Context pressure metric** — Grok token notation `⇣48k/200k (24%)`
  (compact `24%`) with threshold tones at 65/80/90% (accent/warning/error),
  host-percent precedence, 0–100% clamping, and no fabricated segment when
  usage data is missing. The context marker follows the active glyph set.
- **Coalesced render clock + dual timing** — at most one render per 250 ms
  while a turn is active (`render-clock.ts`), token bursts coalesced,
  `unref()`'d timer, phase time in the status label (resets per
  thinking/streaming/tool transition) and whole-turn time in the `full`
  preset. Timer ownership lives exclusively in `index.ts`.
- **Footer presets** — the original responsive/minimal/full controls, since
  superseded by the `default|minimal|full` names documented in Unreleased, with
  metadata-driven segments (`FooterSegment` priority/required/wide/compact),
  guaranteed single-line fitting at every width, and third-party extension
  statuses that can never push core fields off-screen.
- **Direct theme switching** — `/grok theme` lists installed themes with the
  active one marked; `/grok theme <name|coding|minimal|day>` switches
  immediately, refreshes cursor/indicator/footer/header, surfaces host
  errors without changing the active theme, and offers argument completion
  with no preview side effects.
- **Legacy glyph mode** — central glyph vocabulary (`glyphs.ts`) with
  explicit visible-width tests; `PI_GROK_LEGACY_GLYPHS=1/0` override and
  win32 auto-detection.
- **Quality baseline** — CI (Node 22/24) running strict `tsc --noEmit`, the
  unit/regression suite, Pi theme-schema validation, token-completeness
  checks, and WCAG-derived contrast gates.
- **Regression matrix** — every width 20–160 × every preset × every activity
  state × both glyph modes rendered width-safe; lifecycle stacking,
  long-value, and ANSI-balance guarantees tested.
- **Release assets** — deterministic SVG previews for all three themes
  (`docs/previews/`, generated by `scripts/render-previews.js` from the real
  render path), bilingual documentation, and version values synchronized at
  `0.4.0`.

### Deferred (not in 0.4.0)

Per the v0.4 specification's non-goals; these remain candidates for later
releases:

- **v0.5:** appearance-aware dark/light switching (needs a safe terminal
  background detection design that avoids raw stdin probing).
- **Separate distribution:** generated Oh My Pi-compatible theme variants.
- **Upstream proposals to Pi:** per-heading (h1–h6) theme colors (requires a
  theme-schema change), symbol presets, and themeable status-line tokens.
- **Not planned without new Pi APIs:** tok/s or cost segments (no
  trustworthy data path), editor/prompt-arrow replacement, raw OSC 11
  probing, animated idle indicators, cross-platform appearance polling.

Note: cursor recolor and spinner recolor for theme switches made *outside*
`/grok theme` (e.g. via `/settings`) apply on the next session or the next
`/grok theme` invocation — Pi exposes no theme-change event to extensions.
