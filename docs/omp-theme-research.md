# Oh My Pi (omp) Theme System — Research for pi-grok-theme

- **Date:** 2026-09-02
- **Scope:** Investigate the theme system and built-in themes of Oh My Pi (`can1357/oh-my-pi`, "omp"), compare its theme engine with upstream Pi (`earendil-works/pi`, here loaded from `/home/tcuni-claw/pi/pi-grok-theme/node_modules/@earendil-works/pi-coding-agent`), and extract design lessons for the `pi-grok-theme` package. Primary sources only: the omp repo (docs, source, theme JSON, status-line source) and the locally installed upstream pi package.
- **Method:** Read omp `docs/theme.md`, the omp JSON schema (`theme-schema.json`), the default dark theme (`titanium.json`) and base `dark.json`, the omp status-line component source (`segments.ts`, `presets.ts`, `types.ts`), the omp repo tree, the GitHub repo/release metadata APIs, and a community porting gist. Cross-checked against upstream pi's `docs/themes.md` and the compiled `dist/modes/interactive/components/footer.js`.

---

## 1. omp theme system overview

### Format and location

- Theme files are JSON objects. Top-level fields: `name` (required), `colors` (required), `vars` (optional reusable variables), `export` (optional HTML-export colors), `symbols` (optional). Source: [`docs/theme.md`](https://github.com/can1357/oh-my-pi/blob/main/docs/theme.md).
- Runtime validation is an ArkType-compatible schema in code (`themeJsonSchema` in `src/modes/theme/schema.ts`); the JSON Schema file `theme-schema.json` is informational. Source: `docs/theme.md` "Real constraints and caveats"; schema at [`packages/coding-agent/src/modes/theme/theme-schema.json`](https://github.com/can1357/oh-my-pi/blob/main/packages/coding-agent/src/modes/theme/theme-schema.json).
- Built-in themes live in `packages/coding-agent/src/modes/theme/`: base `dark.json` + `light.json`, plus a large `defaults/` directory. Custom themes live in `~/.omp/agent/themes/<name>.json` (overridable via `PI_CODING_AGENT_DIR`). Source: repo tree (`packages/coding-agent/src/modes/theme/defaults/*.json`) and `docs/theme.md` "Built-in vs custom theme sources".
- Lookup order: built-in embedded themes first (built-ins win on name collision), then custom file. Source: `docs/theme.md` `loadThemeJson`.

### Color value model

- Four accepted value formats: hex `#RRGGBB`, 256-color index `0..255`, variable reference (resolved through `vars`, nested refs supported, throws on missing/circular), and empty string `""` = terminal default. Source: `docs/theme.md` "Color values"; schema `$defs/colorValue`.
- Terminal color mode detection (`detectColorMode`): `COLORTERM=truecolor|24bit` → truecolor; `WT_SESSION` → truecolor; `TERM` in `dumb`/`linux`/empty → 256color; else truecolor. Hex converts via `Bun.color(..., "ansi-16m" | "ansi-256")`. Source: `docs/theme.md` "Terminal color mode behavior".

### Switching UX

- **Auto light/dark slots:** omp persists a *pair* of themes — `theme.dark` (default `"titanium"`) and `theme.light` (default `"light"`) — and auto-selects per terminal appearance. Detection order: (1) OSC 11 background luminance, (2) `COLORFGBG` background index (`<8` ⇒ dark, `>=8` ⇒ light), (3) macOS appearance fallback for the known-broken macOS/Zellij OSC 11 path, (4) dark fallback. Auto mode re-evaluates on `SIGWINCH` and terminal-appearance changes. Source: `docs/theme.md` "Initial theme (`initTheme`)".
- **Explicit switch** (`setTheme`): loads theme, updates global singleton, optionally starts a file watcher, fires `onThemeChange`; on failure falls back to built-in `dark`. **Preview** (`previewTheme`): temporary apply for live settings UI, does not persist, does not fall back on error. Source: `docs/theme.md` "Explicit switching" / "Preview switching".
- **Live reload:** watcher on the active custom theme file only (built-ins not watched); debounced reload; reload errors keep the last good theme. Source: `docs/theme.md` "Watchers and live reload".
- Settings persisted to `~/.omp/agent/config.yml`: `theme.dark`, `theme.light`, `symbolPreset`, `colorBlindMode`; legacy flat `theme: "name"` is migrated to the nested dark/light slot by luminance. Source: `docs/theme.md` "Where theme settings are persisted".

### Capabilities beyond upstream pi

- **`symbols` section** (not in pi): `preset` (`unicode` | `nerd` | `ascii`), `overrides` (per-`SymbolKey`), and `spinnerFrames` (flat `string[]` for both spinners, or `{ status?: string[], activity?: string[] }` — `status` ~12.5fps for loaders/tool indicators, `activity` ~30fps for markdown progress). Precedence: settings override > theme `symbols.preset` > fallback `unicode`. Source: `docs/theme.md` "Optional tokens / `symbols` section"; schema `symbols`.
- **Box-drawing border theming** (not in pi): `boxRound.*` (topLeft/topRight/bottomLeft/bottomRight/horizontal/vertical) restyle every outlined chrome's rounded corners; `boxSharp.*` (cross/teeDown/teeUp/teeRight/teeLeft) restyle dividers/junctions; `boxSharp.{corners}` affect markdown-table corners only. Markdown tables are the sole sharp-corner exception. Source: `docs/theme.md` "Box-drawing borders".
- **`colorBlindMode`** (not in pi): HSV-adjusts only `toolDiffAdded` (green shifted toward blue) when the resolved value is hex. Source: `docs/theme.md` "Color-blind mode behavior".
- **`export` section** (also in pi): `pageBg` / `cardBg` / `infoBg`, defaults derived from theme colors if omitted. Source: schema `export`; `docs/theme.md` "Optional tokens".

### What the theme system drives

Per `docs/theme.md` "What the theme system controls": foreground/background color tokens, markdown adapters (`getMarkdownTheme()`), selector/editor/settings list adapters, symbol preset + overrides, native highlighter syntax colors, and **status line segment colors**.

---

## 2. Built-in themes — profile and notable design choices

omp ships an exceptionally large built-in set. From the repo tree (`packages/coding-agent/src/modes/theme/defaults/`):

- **~97 default theme files** plus base `dark.json` and `light.json` (~99 total). Counts from the tree listing:
  - 43 `dark-*` prefixed (abyss, arctic, aurora, catppuccin, cavern, copper, cosmos, cyberpunk, dracula, eclipse, ember, equinox, forest, github, gruvbox, lavender, lunar, midnight, monochrome, monokai, nebula, nord, ocean, one, poimandres, rainforest, reef, retro, rose-pine, sakura, slate, solarized, solstice, starfall, sunset, swamp, synthwave, taiga, terminal, tokyo-night, tundra, twilight, volcanic).
  - 15 neutral-named (likely dark/mineral): alabaster, amethyst, anthracite, basalt, birch, graphite, limestone, mahogany, marble, obsidian, onyx, pearl, porcelain, quartz, sandstone.
  - 39 `light-*` prefixed (arctic, aurora-day, canyon, catppuccin, cirrus, coral, cyberpunk, dawn, dunes, eucalyptus, forest, frost, github, glacier, gruvbox, haze, honeycomb, lagoon, lavender, meadow, mint, monochrome, ocean, one, opal, orchard, paper, poimandres, prism, retro, sand, savanna, solarized, soleil, sunset, synthwave, tokyo-night, wetland, zenith).
  - `index.ts` registers them. Source: repo tree paths under `packages/coding-agent/src/modes/theme/defaults/`.

### Notable design choices (read from source)

- **`titanium.json`** (the default dark theme) — [`defaults/titanium.json`](https://github.com/can1357/oh-my-pi/blob/main/packages/coding-agent/src/modes/theme/defaults/titanium.json):
  - Heavily variable-driven: 11 named `vars` (`brushedTitanium`, `electricBlue`, `deepBlue`, `titaniumGold`, `readoutGreen`, `alertRed`, …) referenced throughout `colors`. Demonstrates omp's intended idiom — define a palette in `vars`, alias in `colors`.
  - Distinct accent per surface: `accent`/`borderAccent`/`mdHeading`/`mdLink`/`syntaxKeyword`/`syntaxType`/`syntaxOperator` all = `electricBlue`; `syntaxFunction`/`mdCode`/`success`/`bashMode` = `readoutGreen`; `syntaxString` = `titaniumGold`. Strong, coherent "titanium instrument-panel" identity.
  - Full `statusLine*` block colored from the same vars; `pythonMode` set to `#f0c040` (distinct from `bashMode` `readoutGreen`).
  - Includes `export` block (`pageBg`/`cardBg`/`infoBg`).

- **`dark.json`** (base dark) — [`theme/dark.json`](https://github.com/can1357/oh-my-pi/blob/main/packages/coding-agent/src/modes/theme/dark.json):
  - VS Code Dark+ syntax palette (`syntaxComment #6A9955`, `syntaxKeyword #569CD6`, `syntaxFunction #DCDCAA`, `syntaxString #CE9178`, …).
  - Uses 256-color indices for some statusLine segments (`statusLineStaged: 70`, `statusLineDirty: 178`, `statusLineUntracked: 39`, `statusLineOutput: 205`, `statusLineCost: 205`, `statusLineSep: 244`) — proving omp themes freely mix hex + 256-index + var refs in one file.
  - Carries a legacy `"link": "#0088fa"` key inside `colors` (not in the schema's required list). This suggests built-in themes are not strictly gated by the JSON Schema's `additionalProperties: false` (the docs note the JSON Schema is informational; the real gate is the ArkType runtime schema). Flag: minor, but indicates built-ins can carry historical fields.

- **Coverage breadth:** omp provides paired dark/light variants for many popular palettes (catppuccin, gruvbox, github, nord [dark only], solarized, tokyo-night, cyberpunk, synthwave, poimandres, rose-pine [dark only], monokai [dark only], dracula [dark only]). This is far beyond upstream pi's two built-ins (`dark`, `light`).

---

## 3. Theme engine diff: omp vs upstream pi

Upstream pi reference: locally installed `@earendil-works/pi-coding-agent` `docs/themes.md` (authoritative token list) and `dist/modes/interactive/components/footer.js`. omp reference: `docs/theme.md` + `theme-schema.json`.

### Tokens omp ADDS (required) that pi does not have

| omp token | Purpose | pi? |
|---|---|---|
| `pythonMode` | Editor border in python (`>`) mode | pi has only `bashMode` |
| `statusLineBg` | Status line background | absent |
| `statusLineSep` | Status line separator | absent |
| `statusLineModel` | Model segment | absent |
| `statusLinePath` | Path segment | absent |
| `statusLineGitClean` / `statusLineGitDirty` | Git branch state | absent |
| `statusLineContext` | Context segment | absent |
| `statusLineSpend` | Spend/token segment | absent |
| `statusLineStaged` / `statusLineDirty` / `statusLineUntracked` | Git counts | absent |
| `statusLineOutput` | Output segment | absent |
| `statusLineCost` | Cost segment | absent |
| `statusLineSubagents` | Subagents segment | absent |

Net: omp requires **66 color tokens** (vs pi's **51**). The 15-token delta = `pythonMode` + 14 `statusLine*`. `thinkingMax` is optional in both. Source: omp `theme-schema.json` `required` array; pi `docs/themes.md` "colors must define all 51 required tokens".

### Tokens pi has that omp does NOT

| pi token | Purpose | omp? |
|---|---|---|
| `scrollbarThumb` (optional) | Fullscreen scrollbar thumb | absent from omp schema |
| `searchMatchBg` (optional) | Transcript search match bg | absent |
| `searchMatchText` (optional) | Transcript search match text | absent |

These three are pi additions (optional, falling back to `selectedBg`/`text`). omp's schema does not list them — omp either lacks transcript search/scrollbar theming or implements those surfaces without dedicated tokens. Source: pi `docs/themes.md` "Backgrounds & Content (11 required, 3 optional)"; omp `theme-schema.json` (no such properties, `additionalProperties: false`).

### Structural sections

| Section | upstream pi | omp |
|---|---|---|
| `vars` (with nested refs) | yes | yes (explicit nested-ref + circular-detection docs) |
| `colors` | yes (51 req) | yes (66 req) |
| `export` (pageBg/cardBg/infoBg) | yes | yes (identical) |
| `symbols` (preset/overrides/spinnerFrames/box-drawing) | **no** | **yes** |
| `colorBlindMode` setting | **no** | **yes** (HSV shift of `toolDiffAdded`) |
| Auto light/dark slots | single `theme` + `--use-theme light/dark` per-run; first-run detection | persisted `theme.dark`/`theme.light` pair, reactive auto-switch (OSC 11 / COLORFGBG / macOS fallback / SIGWINCH) |
| Color value formats | hex, 256-index, var, `""` | same |
| Terminal color mode | "falls back to nearest approximation" (24-bit primary) | explicit `detectColorMode` (COLORTERM / WT_SESSION / TERM) |

### Known upstream limitations (from pi-grok-theme's docs) — does omp fix them?

- **Editor border driven by `thinkingLevel`:** NOT fixed by omp themes. omp still uses `thinkingOff..thinkingMax` + `bashMode` + `pythonMode` as the editor border colors (schema descriptions: "Editor border color in bash/python mode"; "Thinking level border"). omp's status line *additionally* surfaces the thinking level as a compact icon, but the border itself remains thinking-level-driven. So pi-grok-theme's working-state controller approach (overriding the border) is not something omp offers via theme. Source: omp `theme-schema.json` token descriptions; release notes ("status line now displays the thinking level as a compact icon … set `statusLine.compactThinkingLevel` to `false`").
- **Prompt arrow not themeable:** omp theme docs list no prompt-arrow token. Likely still unthemeable in omp. *Unverified* — no prompt-arrow token found in schema or docs.
- **Cursor color needing OSC 12:** omp `accent` description says "logo, selected items, cursor", implying accent may drive a cursor, but the theme docs do not document OSC 12 emission. *Unverified* whether omp core emits OSC 12; the theme system itself has no dedicated cursor token.
- **Window title overwritten by core:** omp theme docs do not mention window-title theming. *Unverified* — not addressed by the theme system.

---

## 4. omp statusline / footer vs pi-grok-theme's extension

omp has a **full built-in, themeable, preset-driven status line** — this is the native equivalent of what pi-grok-theme builds as a UI extension.

### Implementation

- `packages/coding-agent/src/modes/components/status-line/`: `component.ts`, `segments.ts`, `presets.ts`, `separators.ts`, `types.ts`, `context-thresholds.ts`, `git-utils.ts`, `index.ts`. Plus `src/tui/status-line.ts` and an example hook `examples/hooks/status-line.ts`. Source: repo tree; [`segments.ts`](https://github.com/can1357/oh-my-pi/blob/main/packages/coding-agent/src/modes/components/status-line/segments.ts), [`presets.ts`](https://github.com/can1357/oh-my-pi/blob/main/packages/coding-agent/src/modes/components/status-line/presets.ts), [`types.ts`](https://github.com/can1357/oh-my-pi/blob/main/packages/coding-agent/src/modes/components/status-line/types.ts).

### Segments (24 total, from `SEGMENTS` registry in `segments.ts`)

`pi` (brand icon + working braille spinner + whole-unit turn timer, brand-fg tweened dim→accent across turn edges), `model` (name + thinking-level display + fast-mode icon + advisor badge), `mode` (plan/prewalk/goal/vibe/loop with paused/budget states), `path` (worktree-aware, scratch-dir detection, OSC 8 file hyperlinks, abbreviate + maxLength), `git` (branch + staged/unstaged/untracked counts, each independently colored), `pr` (PR `#num` as OSC 8 hyperlink), `subagents`, `token_in`, `token_out`, `token_total` (excludes cacheRead to avoid N×context inflation), `token_rate` (tok/s), `cost` ($ + subscription + premium requests ★ + advisor cost), `context_pct` (with async-compaction speculation pulse), `context_total`, `time_spent` (active processing time, not wall clock), `time` (12h/24h, seconds), `session`, `hostname`, `cache_read`, `cache_write`, `cache_hit` (%), `session_name`, `usage` (5h/1d/7d/monthly provider quotas with reset timers), `collab`.

### Presets (7, from `presets.ts`)

`default` (pi·model·mode·collab·path·git·pr·context_pct·cost | session_name; powerline-thin), `minimal` (path·git | session_name·mode·context_pct; slash), `compact` (model·mode·git·pr | session_name·cost·context_pct; thinking level as compact icon), `full` (pi·hostname·model·mode·path·git·pr·subagents | session_name·cache_hit·token_in·token_out·token_rate·cache_read·cost·context_pct·time_spent·time; powerline), `nerd` (full + Nerd Font icons + seconds), `ascii` (no Nerd Font deps), `custom` (user-overridable). Separator styles: `powerline`, `powerline-thin`, `slash`, `ascii`.

### Settings (`StatusLineSettings` in `types.ts`)

`preset`, `leftSegments`, `rightSegments`, `separator`, `segmentOptions` (per-segment: model.showThinkingLevel, path.{abbreviate,maxLength,stripWorkPrefix}, git.{showBranch,showStaged,showUnstaged,showUntracked}, time.{format,showSeconds}), `showHookStatus`, `sessionAccent` (hash-derived accent from session name), `transparent` (drop `statusLineBg` fill + powerline caps → inherit terminal bg), `compactThinkingLevel`, `contextLine` (embedded gauge mode).

### Themeability

Every segment routes its color through a `statusLine*` theme token (e.g. git dirty → `statusLineGitDirty`, cost → `statusLineCost`, subagents → `statusLineSubagents`). Icons come from `theme.icon.*` / symbol preset. The brand segment's working spinner uses `theme.getSpinnerFrames("activity")`.

### Comparison to upstream pi's built-in footer (`dist/.../footer.js`)

pi's `FooterComponent.render` produces 2–3 lines: (1) `pwd` with `~` substitution + `(branch)` + `• sessionName`; (2) a stats line `↑input ↓output RcacheRead WcacheWrite CH% cost$ context%/(window)(auto)` right-aligned with `model • thinkingLevel` (+ `(provider)` when multiple). Colors are **hardcoded** `theme.fg("dim", …)` for everything except context % (error/warning) and the experimental `xp` badge — **not per-segment themeable**. (3) An "extension statuses" line populated by `footerData.getExtensionStatuses()` — this is the hook pi-grok-theme's extension uses to inject its own footer.

**Key finding:** omp's status line is the native, themeable, preset-driven equivalent of pi-grok-theme's extension footer. pi-grok-theme's extension is effectively a back-port of omp's statusline concept to upstream pi, working around pi's non-themeable footer by injecting via the extension-status line and/or replacing the footer.

---

## 5. Community / adoption signals

- **Repo size & activity** (from `api.github.com/repos/can1357/oh-my-pi`, fetched 2026-09-02): **29,044 stars**, 2,914 forks, 2,079 open issues, 89 subscribers. Created 2025-12-31; `pushed_at` 2026-09-02 (same day). Homepage `omp.sh`. License MIT. Topics: ai-agent, bun, claude, cli, coding-assistant, llm, mcp, multi-provider, openai, rust, terminal, tui, typescript. Source: [repo API](https://api.github.com/repos/can1357/oh-my-pi).
- **Release cadence:** latest release **v18.1.3** published 2026-09-02 (today), automated via `github-actions[bot]`, with platform binaries (darwin-arm64/x64, linux-x64/arm64/musl-*, windows-x64). The release notes for v18.0.11 mention "Added gallery previews for composer and status-line components" and "The status line now displays the thinking level as a compact icon … set `statusLine.compactThinkingLevel` to `false`" — confirming the status line is an actively-evolved, first-class surface. Many external contributors per release. Source: [releases API](https://api.github.com/repos/can1357/oh-my-pi/releases).
- **Community porting back to pi:** the gist [`nicobailon/33076dde…`](https://gist.github.com/nicobailon/33076dde7a9784e6cd3bb2c769bde6d8) ("oh-my-pi theme for pi coding agent") is a near-verbatim copy of omp's `dark.json` with the omp-only tokens **stripped** (no `statusLine*`, no `pythonMode`) and pointed at the `badlogic/pi-mono` schema. It also sets `text` to `#e5e5e7` (omp's `dark.json` leaves `text` as `""`) and `mdCodeBlockBorder` to `darkGray`. This is direct evidence that users manually port omp themes to pi by deleting the omp-superset tokens — i.e. the community already treats omp's dark theme as a desirable pi target and does the compatibility surgery by hand. Source: [gist raw](https://gist.githubusercontent.com/nicobailon/33076dde7a9784e6cd3bb2c769bde6d8/raw).

---

## 6. Compatibility assessment: porting pi-grok-theme to/from omp

- **pi → omp (drop pi-grok-theme JSON onto omp):** would **fail** omp validation. omp requires 15 tokens pi themes lack: `pythonMode` + 14 `statusLine*`. To run on omp, each GrokNight/GrokDay JSON must add `pythonMode` and all 14 `statusLine*` color tokens (values can be derived from the existing palette via `vars`). The `export` block is already compatible. `symbols`/`spinnerFrames`/box-drawing are optional and can be omitted.
- **omp → pi (drop an omp theme onto pi):** would **fail** if pi's runtime rejects unknown color keys (the gist author stripped `statusLine*`/`pythonMode`, strongly implying pi/pi-mono rejects extras). Even if pi ignored extras, omp themes are missing pi's optional `scrollbarThumb`/`searchMatch*` (those fall back gracefully, so not fatal). The safe path is the same surgery the gist performed: strip `pythonMode` + `statusLine*`.
- **Net:** the two schemas are *near-compatible but not drop-in*. omp is a strict superset on required tokens (66 vs 51) and a subset on pi's optional scrollbar/search tokens. A small transform (add/remove 15 tokens) bridges them.
- **Recommendation for pi-grok-theme:** because the author already maintains paired light/dark JSON variants, shipping an **omp-compatible build** is low-cost: generate each theme twice — the pi variant (current) and an omp variant that adds `pythonMode` + 14 `statusLine*` colored from the same `vars`. This opens omp (29k-star, actively-growing) as a distribution channel with minimal divergence. A single source palette in `vars` makes the dual emission trivial.

---

## 7. Steal-able ideas for pi-grok-theme (prioritized)

1. **[feasible on upstream pi] Ship a `vars`-first palette and alias aggressively.** omp's `titanium.json` defines ~11 named palette colors and references them everywhere, so a recolor is a one-block edit. pi-grok-theme's GrokNight/GrokDay should centralize the palette in `vars` (accent, surface, syntax families) and alias — improves maintainability and makes the omp dual-emission trivial. Source: `defaults/titanium.json`.
2. **[feasible on upstream pi] Mix hex + 256-color index + var refs in one file.** omp's `dark.json` uses 256-indices (`70`, `178`, `39`, `205`, `244`) for minor statusLine segments and hex for primaries. pi-grok-theme can use 256-indices for low-salience tokens (separators, dim fills) to guarantee correct rendering on 256-color terminals without relying on approximation. Source: `theme/dark.json`.
3. **[would require omp/pi upstream change] Per-segment themeable status-line tokens (`statusLine*`).** omp's 14 dedicated status-line color tokens let each footer segment carry its own semantic color. pi's footer is hardcoded `theme.fg("dim", …)`, so pi-grok-theme's extension can only color via the limited tokens pi exposes (accent/error/warning/muted/dim). To match omp's per-segment theming on pi, pi-grok-theme must either reuse the 5 available pi tokens creatively or push upstream pi to add status-line tokens. Source: omp `theme-schema.json`; pi `footer.js`.
4. **[feasible on upstream pi] Status-line presets + left/right segment layout + separator styles.** omp's 7 presets (`default`/`minimal`/`compact`/`full`/`nerd`/`ascii`/`custom`) with `leftSegments`/`rightSegments`/`separator`/per-segment options is a clean, user-facing configuration model. pi-grok-theme's `/grok` command and footer extension could expose a similar preset switcher (e.g. grok-minimal / grok-full) and a separator choice, even while mapping to pi's fewer color tokens. Source: `presets.ts`, `types.ts`.
5. **[would require omp/pi upstream change] `symbols` section: `preset`, `overrides`, `spinnerFrames` (status/activity split), and box-drawing border theming.** omp themes can restyle the loading spinner (two cadences), pick a glyph preset, override individual symbols, and even restyle box-drawing corners/junctions. pi themes have no `symbols` section at all, so pi-grok-theme cannot theme spinners or box borders via JSON. This is a clear upstream gap to flag/request. Source: omp `theme-schema.json` `symbols`; pi `docs/themes.md` (no symbols section).
6. **[would require omp/pi upstream change] Persisted auto light/dark slot pair + reactive re-evaluation.** omp keeps `theme.dark` + `theme.light` and re-selects on terminal-appearance/SIGWINCH changes. pi has `--use-theme light/dark` for a single run and first-run detection but no persisted reactive pair. pi-grok-theme could approximate this by detecting background and switching its own variant, but a true reactive pair needs a pi settings change. Source: omp `docs/theme.md` "Initial theme"; pi `docs/themes.md` "Selecting a Theme".
7. **[feasible on upstream pi] `colorBlindMode`-style accessible adjustment.** omp HSV-shifts `toolDiffAdded` toward blue under a setting. pi-grok-theme can offer a colorblind-friendly variant of GrokNight/GrokDay (shift green diffs toward blue) as an alternate JSON, no engine change needed. Source: omp `docs/theme.md` "Color-blind mode behavior".
8. **[feasible on upstream pi] `pythonMode` token parity.** omp separates bash (`!`) and python (`>`) editor-border colors. pi only has `bashMode`. If pi-grok-theme wants python-mode parity it can't via JSON today (no `pythonMode` token in pi); flag as an upstream request alongside `statusLine*`. Source: omp schema; pi `docs/themes.md`.
9. **[feasible on upstream pi] Tok/s and active-time segments.** omp's `token_rate` (tok/s) and `time_spent` (active processing ms, excluding idle) are high-value, honest metrics. pi-grok-theme's footer extension already tracks working state; adding a tok/s and an active-time segment (not wall-clock) is feasible within the extension. Note: pi-grok-theme's own history (per repo commit `161612d` "revert: drop grok-tps turn-average metric (unreachable in real sessions)") shows tok/s was hard to source reliably on upstream pi — omp gets it from richer per-turn usage stats. Flag as feasible but watch the data-availability caveat. Source: `segments.ts` `tokenRateSegment`/`timeSpentSegment`; local repo `git log`.
10. **[feasible on upstream pi] OSC 8 file hyperlinks in the path segment.** omp's `path` segment wraps the project dir in an OSC 8 terminal hyperlink. pi-grok-theme's footer can do the same for the cwd. Source: `segments.ts` `pathSegment` (`fileHyperlink`).

### Top 5, ranked

1. **[feasible on upstream pi]** `vars`-first palette + aliasing (maintainability + enables omp dual-emission). (#1)
2. **[would require omp/pi upstream change]** Per-segment `statusLine*` theme tokens — the single biggest capability gap between omp's themeable footer and pi-grok-theme's extension. (#3)
3. **[feasible on upstream pi]** Status-line presets + left/right layout + separator styles for the `/grok` footer. (#4)
4. **[would require omp/pi upstream change]** `symbols` section (spinner frames, glyph presets, box-drawing theming). (#5)
5. **[feasible on upstream pi]** Ship an omp-compatible JSON variant set (add `pythonMode` + 14 `statusLine*`) to open omp as a distribution channel — low cost given existing light/dark pair. (compatibility section)

---

## 8. Sources

- omp theme docs: https://github.com/can1357/oh-my-pi/blob/main/docs/theme.md (raw: `https://raw.githubusercontent.com/can1357/oh-my-pi/main/docs/theme.md`)
- omp theme schema: `packages/coding-agent/src/modes/theme/theme-schema.json` (raw URL as above)
- omp default dark theme: `packages/coding-agent/src/modes/theme/defaults/titanium.json`
- omp base dark theme: `packages/coding-agent/src/modes/theme/dark.json`
- omp status-line: `packages/coding-agent/src/modes/components/status-line/{segments,presets,types,separators,component,context-thresholds,git-utils,index}.ts`
- omp repo tree: `https://api.github.com/repos/can1357/oh-my-pi/git/trees/main?recursive=1`
- omp repo metadata: `https://api.github.com/repos/can1357/oh-my-pi`
- omp releases: `https://api.github.com/repos/can1357/oh-my-pi/releases?per_page=5`
- Community gist: `https://gist.github.com/nicobailon/33076dde7a9784e6cd3bb2c769bde6d8` (raw fetched)
- Upstream pi docs: `/home/tcuni-claw/pi/pi-grok-theme/node_modules/@earendil-works/pi-coding-agent/docs/themes.md`
- Upstream pi footer: `/home/tcuni-claw/pi/pi-grok-theme/node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/components/footer.js`
- Local repo history: `git log` in `/home/tcuni-claw/pi/pi-grok-theme` (commit `161612d` re: grok-tps withdrawal)

## 9. Unverifiable / flagged

- Whether omp core emits **OSC 12** for cursor sync: no evidence in theme docs/schema; the `accent` description mentions "cursor" but no OSC 12 mechanism is documented. Not confirmed.
- Whether omp themes can recolor the **prompt arrow**: no prompt-arrow token found in schema or docs. Likely still unthemeable.
- Whether omp addresses **window-title overwrite by core**: not mentioned in theme docs. Not addressed by the theme system.
- Whether pi's runtime schema enforces `additionalProperties: false` (rejecting omp's extra tokens): inferred from the gist author stripping `statusLine*`/`pythonMode`, not directly confirmed against pi's runtime ArkType schema (the local dist does not expose `theme-schema.json` as a standalone file; the compiled `theme.js` would need inspection to be certain).
- Exact dark/light classification of omp's 15 neutral-named defaults (alabaster, birch, etc.): inferred from naming, not individually opened. `birch` has a contrast test (`test/modes/theme/birch-contrast.test.ts`) suggesting it is a designed, tested theme.
