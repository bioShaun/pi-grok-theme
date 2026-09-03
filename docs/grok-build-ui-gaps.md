# Grok Build UI Trait Gap Analysis for pi-grok-theme

**Date:** 2026-09-02
**Scope:** Mine the local Grok Build source tree
(`/home/tcuni-claw/pi/grok-build`, Rust, the official `xai-org/grok-build`
codebase) for UI/UX traits, and identify which excellent ones have NOT yet
been ported to **Pi Coding Agent** via the `pi-grok-theme` package.

**Grok Build revision:**
- git: `19d42e35c07a9c9244f03f6df0c4c353f970d4f9` (2026-08-19, "Synced from monorepo")
- `SOURCE_REV`: `7d67deacbeb1c1093fdb4f9bcbfab2630e18a6aa`

**Pi extension API verified against:**
`node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`
(pi v0.84.2 era). The `ExtensionUIContext` surface confirmed to expose:
`setWorkingIndicator({frames, intervalMs})`, `setWidget(key, content, {placement})`,
`setStatus(key, text)`, `setToolsExpanded`, `setEditorComponent`, `setTitle`,
`setHiddenThinkingLabel`, `setWorkingMessage`, `notify`, `select/confirm/input`,
`custom()`, `pasteToEditor/setEditorText/getEditorText`, `editor()`,
`getAllThemes/getTheme/setTheme`, `addAutocompleteProvider`,
`registerMarkdownTransformer`, `onTerminalInput`, `registerShortcut`.
Event API includes `tool_execution_start/end`, `turn_start/end`,
`message_start/update/end`, `thinking_level_select`, `session_*`.

---

## 1. What pi-grok-theme already does (not re-reported as gaps)

For reference, these are already shipped and are excluded from the gap
table below:

- Theme JSONs: 3 variants (`grok-build-coding`, `grok-build`, `grok-build-day`)
  with full ~55-token coverage; `mdHeading` cyan; `thinkingOff..Max` editor
  border colors; `bashMode` amber; GrokNight `#0A0A0A/#141414/#242424` +
  TokyoNight accents; GrokDay light variant.
- OSC 12 cursor color sync (amber `#E0AF68`, OSC 112 restore on shutdown).
- Single-line responsive footer with segment-dropping priority
  (cwd, git branch, model, context %, thinking level, working badge + duration).
- Opt-in header banner.
- Working-state controller: `● thinking/running bash/generating` + duration,
  `filterWorkingMessage` compaction.
- `/grok` slash command (info/theme/toggle/header).
- Window title `⚡ grok · dir · branch`; hidden thinking label `▸ thought`.

---

## 2. Trait Catalog (mined from grok-build, with source citations)

### 2.1 Theme module (`xai-grok-pager-render/src/theme/`)

#### T1. OSC 11 terminal background detection
**Source:** `theme/osc11.rs:1-200` (`detect_via_osc11`, `parse_osc11_rgb`,
`classify_luminance`).
**What it does:** At startup (before crossterm owns stdin), emits
`\x1b]11;?\x07` to query the terminal's actual background RGB, parses the
`rgb:RRRR/GGGG/BBBB` reply (2- or 4-digit per channel), and classifies it as
dark/light via ITU-R BT.709 luminance (threshold 0.5). Includes a tmux
DCS-passthrough wrap retry (`\x1bPtmux;\x1b\x1b]11;?\x07\x1b\\`) with a short
80ms timeout. Uses a `TermiosGuard` that restores termios on drop *without*
touching crossterm's process-wide raw-mode flag.
**Why it's good:** Auto-selects dark/light theme from the *real* terminal
canvas, not a guess — works inside SSH/tmux where desktop APIs are absent.

#### T2. System appearance auto-switching (`auto` theme variant)
**Source:** `theme/system_appearance.rs:1-120` (`detect`,
`detect_with_osc11_fallback`, `SystemAppearanceWatcher`, `to_theme_kind`);
`theme/env_appearance.rs:1-80` (`GROK_APPEARANCE`/`LC_GROK_APPEARANCE`/
`COLORFGBG` parsing); `theme/cache.rs:1-80` (`AutoThemeConfig`,
`is_auto_mode`, `resolve_auto`).
**What it does:** A meta `auto` theme variant resolves to a concrete theme
via a 4-step chain: desktop APIs (`dark-light` crate: macOS
`AppleInterfaceStyle`, Linux XDG portal, Windows registry) → explicit
SSH-surviving env stamps (`GROK_APPEARANCE`/`LC_GROK_APPEARANCE`) → cached
startup OSC 11 → inherited `COLORFGBG`. A `SystemAppearanceWatcher` polls
every 5s and re-resolves on change. Users can configure which dark/light
theme `auto` maps to (`auto_dark_theme`/`auto_light_theme`).
**Why it's good:** True follow-the-sun theming that survives SSH and tmux.

#### T3. Color support quantization (truecolor/256/16 fallback)
**Source:** `theme/color_support.rs:1-120` (`ColorLevel`, `detect`,
`quantize_color`); `theme/mod.rs:228-300` (`Theme::quantized`).
**What it does:** Detects the terminal's color level
(`None`/`Basic`/`Ansi256`/`TrueColor`) via `supports-color` + `NO_COLOR`, then
quantizes every theme RGB to the highest supported level (nearest 6×6×6
cube or 24-step grayscale). `Theme::current()` runs this on every frame.
**Why it's good:** Themes survive on macOS Terminal.app (256-color) and
`TERM=ansi` (16-color) boxes without washing out.

#### T4. ANSI16 chrome polarity overrides
**Source:** `theme/mod.rs:549-700` (`ansi16_chrome_overrides`).
**What it does:** On 16-color terminals, pins chrome (bg/borders/scrollbar)
to ANSI-named entries by polarity (Black/White canvas, DarkGray/Gray step)
and semantic accents to bright variants on dark / normal on light, because
naive nearest-RGB quantization collapses pastel theme hues onto the gray
ramp. Surfaces that should blend with the canvas are pinned to the theme's
polarity (not `Color::Reset`) so a dark theme on a white terminal doesn't
show white "holes".
**Why it's good:** Guarantees error=red, success=green, focus=high-contrast
even on museum-grade 16-color terminals.

#### T5. Windows display-gamma contrast boost
**Source:** `theme/mod.rs:380-440` (`windows_contrast_boost`).
**What it does:** On Windows, pushes structural colors (bg_light, borders,
scrollbar, prompt_border) further from `bg_base` by tuned per-field amounts
(16-60 levels) so the ~12-unit RGB steps survive ConHost display gamma.
**Why it's good:** GrokNight's subtle gray hierarchy is legible on
uncalibrated Windows panels.

#### T6. Per-heading-level markdown colors + modifiers
**Source:** `theme/tokyonight.rs:120-180` (`md_heading_h1..h6`,
`md_heading_h1_mod..h6_mod`); `theme/md_style.rs:90-160`
(`heading_inner_styles`, `heading_outer_styles`).
**What it does:** Six distinct heading colors (GrokNight: h1=teal, h2=blue,
h3=purple, h4=bright-gray, h5=medium-gray, h6=medium-gray) each with a
per-level `Modifier` (BOLD for h1-h5, empty for h6). The markdown renderer
emits a dimmed+hidden "outer" syntax marker (`#`) plus a styled "inner"
heading text.
**Why it's good:** Document structure reads at a glance; h1/h2/h3 carry
semantic hue, h4-h6 recede by gray tier.

#### T7. Theme caching + live preview
**Source:** `theme/cache.rs:1-80` (`current_kind`, `set`, `AUTO_MODE`);
`slash/commands/theme.rs:60-110` (`preview_arg`, `cancel_preview`,
`preview_state`, `supports_preview`).
**What it does:** `/theme` slash command shows the current theme as the
preview state, and as the user types/arrow-keys through arg completions,
calls `Theme::apply_kind(kind)` directly for a non-persisting visual
preview (no toast/disk write per keystroke); `cancel_preview` restores the
previous theme on Esc. `auto` previews the resolved concrete theme.
**Why it's good:** Try-before-you-commit theme switching with zero
surprises.

### 2.2 Glyphs/symbols (`xai-grok-pager-render/src/glyphs.rs`)

#### T8. Legacy-console glyph fallback system
**Source:** `glyphs.rs:1-120` (`is_legacy_windows_console`,
`prompt_arrow`, `record_dot`, `ballot_x`, `check_mark`, `enlarge`,
`copy_icon`, `token_arrow`, `diamond_*`, `filled_dot`, `selection_bar`,
`chevron*`, `disclosure_*`, `accent_bar`, `heavy/light_horizontal`,
`timeline_tick_*`).
**What it does:** Every chrome glyph has a tested 1-column ASCII or CP437
fallback for legacy Windows ConHost (Consolas/Lucida Console, which do no
font fallback and render missing Dingbats as tofu): `❯`→`>`, `✗`→`x`,
`✓`→`√` (U+221A), `◆`→`♦` (U+2666), `⇣`→`↓`, `┃`→`│`, etc. Detection is
host+brand based (default-deny on Windows: unknown brand = legacy), with a
`GROK_FORCE_LEGACY_CONSOLE` env escape hatch for QA on any platform. A
`legacy_glyph_fallback`/`sanitize_toast_message` funnel substitutes glyphs
in free-flowing toast text.
**Why it's good:** Pixel-stable chrome on every terminal, including
`cmd.exe`; the `GROK_FORCE_LEGACY_CONSOLE` knob lets you eyeball fallbacks
on macOS/Linux.

#### T9. Braille progress spinner frames
**Source:** `glyphs.rs:200-215` (`braille_spinner_frames`).
**What it does:** Rotating braille dots `⠋⠙⠹⠸⠼⠴⠦⠧` (U+2800 block); ASCII
`|/-\` fallback on legacy ConHost. Every frame is exactly 1 column so the
trailing label never shifts.
**Why it's good:** The canonical "agent is working" animation; far more
alive than a static dot.

#### T10. Dot spinner frames (quiet)
**Source:** `glyphs.rs:225-240` (`dot_spinner_frames`).
**What it does:** Quieter pulse `⋅ : ⸬ ⁙` (U+22C5/U+003A/U+2E2C/U+2059);
ASCII `.`/`:`/`·` fallback. 1-column invariant.
**Why it's good:** A calmer alternative for subagent/task rows where the
braille spinner would feel frantic.

#### T11. Monitor pulse frames (breathing circle)
**Source:** `glyphs.rs:140-160` (`monitor_icon_frames`).
**What it does:** `○ ◎ ◉ ◎` (U+25CB/U+25CE/U+25C9) — a concentric circle
that breathes open→shut like a scanning scope; ASCII `·`/`○`/`•`/`○`
fallback. Runs at half the speed of the active spinner
(`MONITOR_PULSE_DIVISOR = 8` vs `SPINNER_DIVISOR = 4`).
**Why it's good:** A calm "still running / watching" cue that doesn't
compete with the active-turn spinner.

#### T12. Prompt arrow `❯`
**Source:** `glyphs.rs:30-40` (`prompt_arrow`, `PROMPT_ARROW_WIDTH=2`).
**What it does:** `❯ ` (U+276F, 2 columns) as the user-prompt affordance;
`> ` on legacy ConHost.
**Why it's good:** The signature Grok prompt glyph; lighter than `❯❯` or
`$`.

#### T13. Diamond glyphs + token arrow
**Source:** `glyphs.rs:170-215` (`diamond_filled/hollow/dotted`,
`token_arrow` `⇣`).
**What it does:** `◆◇◈` for usage-bar cells, scrollback bullets, picker
folds, dashboard markers; `⇣` (U+21E3 dashed down arrow) for the
context-token count.
**Why it's good:** A consistent geometric vocabulary for status/usage
indicators.

### 2.3 TUI layout (`xai-grok-pager/src/views/`)

#### T14. Turn status line (dedicated row above prompt)
**Source:** `views/turn_status.rs:1-150` (`render_turn_status`,
`TurnStatusArgs`, `SPINNER_DIVISOR`, `Watchers`); full file 1746 lines.
**What it does:** A single 1-row widget between scrollback and prompt:
`⠧ Run command 0.2s        1m20s ⇣12k [stop]`. Layout = spinner (slowed to
~7.5fps) + activity label (colored per activity, truncates) + phase timer
`Xs` (gray, never truncates) + queued-send hint + fill + turn timer
`Xm Ys` + token count `⇣Nk` (right-aligned, gray) + cancel `[stop]` button
(red on hover). Hidden (0 height) when idle.
**Why it's good:** Separates "what's happening now" (turn status) from
"ambient metadata" (footer); the dual timer (phase + total turn) and
token arrow give at-a-glance turn economics.

#### T15. Pending diamond pulse ("waiting on you")
**Source:** `views/turn_status.rs:50-70` (`pending_diamond_color`,
`USER_WAITING_PULSE_SPEED=0.08`); `theme/tokyonight.rs`
(`pulse_brightness`).
**What it does:** For permission prompts, `ask_user_question`, and the
drain-blocked idle status, a filled diamond `◆` pulses via
`sin²(tick*0.08)` brightness blended toward `bg_base`, with brightness
range **0.3–1.0** so the diamond never disappears at the trough. Three
call sites share one helper so they never drift apart.
**Why it's good:** A polite but insistent "your move" cue that breathes
rather than blinks.

#### T16. Still-running watcher cue (idle)
**Source:** `views/turn_status.rs:120-150` (`format_still_running`,
`still_running_label`, `Watchers`); `views/turn_status.rs:300-330`
(monitor pulse render).
**What it does:** When idle but background work (commands, monitors,
`/loop` tasks, subagents, workflows) is still running, shows a counts-first
label `"1 command · 2 monitors · 1 loop still running"` led by the
breathing monitor pulse `○ ◎ ◉ ◎` (T11). Clickable to open the tasks pane.
**Why it's good:** Idle ≠ done; the cue persists above the prompt so it
never scrolls away.

#### T17. BtwBlock / `/btw` side-question panel
**Source:** `views/btw_overlay.rs:1-120` (`BtwOverlayState`,
`BtwOverlayState::done`).
**What it does:** A compact bordered panel above the prompt input, below
scrollback. Shows a side question + loading indicator while in-flight;
once the response arrives, stays on screen until Esc, then persists to
scrollback as a collapsed `BtwBlock`. Renders response with the same
`MarkdownContent` renderer as agent messages (tables, headings, lists).
Supports scrolling and text selection.
**Why it's good:** Ask a side question without losing your place in the
main transcript.

#### T18. Todo pane with per-status styling
**Source:** `views/todo_pane.rs:1-100` (`TodoPaneStyle`, `TodoStatusStyle`,
`TodoListEntry`).
**What it does:** Todo items render with status-icon prefixes and styled
content: pending (text_primary icon, normal text), in_progress (warning
icon, **bold** text), completed (accent_success icon, gray_bright text),
cancelled (accent_error icon, gray_bright + **strikethrough** text).
**Why it's good:** Todo state reads instantly from icon hue + weight.

#### T19. Context bar with color-blending breakpoints
**Source:** `views/context_bar.rs:1-120` (`default_breakpoints`,
`blend_color`, `fmt_pct5`, `fmt_tokens`); `views/progress_bar.rs`.
**What it does:** Default renders `8.5K / 1.0M` (tokens, colored by usage
%). On hover, swaps to a progress bar `█████ 42.0%` of the same total
width (no layout shift). Bar color blends across breakpoints:
`text_primary` (0%) → `accent_user` (50-65%) → `warning` (75-85%) →
`accent_error` (95%+). `fmt_pct5` is a fixed-width 5-char percent
(`<10` → `X.XX%`, `10-99` → `XX.X%`, `≥100` → `MAX %`); `fmt_tokens` is
≤4 chars (`1.2K`, `12K`, `1.2M`).
**Why it's good:** Context pressure escalates visually as you approach
the limit.

#### T20. Permission/approval prompt styling
**Source:** `views/permission_view.rs:1-80` (`PermissionViewState`,
`PermissionFocus`, `PatternEditState`); full file 3796 lines.
**What it does:** Structured permission overlay with option rows
(AllowOnce/AllowAlways/RejectOnce/RejectAlways), a followup-input mode
(Enter on RejectOnce), and a free-form "Always allow" glob pattern editor
(`e` on a bash prompt). Bash command highlighting with heredoc payload
byte ranges and soft-break offsets after operators. Only the front
request in a `VecDeque` is interactive.
**Why it's good:** Permission decisions are scannable and reversible;
the glob editor turns "always allow" into a real pattern, not a literal.

### 2.4 Interaction/UX

#### T21. `/theme` switcher with live preview
**Source:** `slash/commands/theme.rs:1-200` (see T7).
**What it does:** `/theme` (alias `/t`); no-arg toggles through available
themes; named-arg switches; `auto` enables system-appearance mode. Arg
completions show `(active)` markers; `auto` is prepended. Live preview on
every keystroke via `preview_arg`; `cancel_preview` restores on Esc.
Truecolor-only themes are clamped to GrokNight on 256-color terminals.
**Why it's good:** Frictionless theme exploration.

#### T22. Vim / emacs editor modes
**Source:** `slash/commands/vim_mode.rs`; `slash/mode_support.rs`;
`slash/mode_support_tests.rs`.
**What it does:** `/vim` toggles a vim-mode editor (the pi extension API
documents exactly this `VimEditor` + `setEditorComponent` pattern).
**Why it's good:** Modal editing for power users.

#### T23. Mouse support, scrollback selection, copy
**Source:** `views/block_viewer.rs`; `render/scrollbar.rs`;
`render/osc8.rs` (hyperlinks); `slash/commands/toggle_mouse_reporting.rs`;
`slash/commands/copy.rs`.
**What it does:** Mouse hover/click/scroll, text selection with
`ResolvedSelectionModel`, OSC 8 hyperlinks, a `/copy` command, and a
`/toggle-mouse` switch.
**Why it's good:** Terminal-native pointer interactions.

#### T24. Session picker / resume / fork
**Source:** `views/session_picker.rs`; `slash/commands/fork.rs`;
`sessions_cmd.rs`.
**What it does:** Rich session tree picker, fork-from-entry, rewind.
**Why it's good:** Non-linear session history.

### 2.5 Other visually distinctive

#### T25. Pulse / wave brightness helpers
**Source:** `theme/tokyonight.rs` (`pulse_brightness`, `wave_brightness`);
`views/turn_status.rs:50-70`.
**What it does:** `pulse_brightness(tick, speed)` = `sin²(tick*speed)`
(period π); `wave_brightness` is a sine wave. Used for the pending diamond
(T15) and other breathing indicators.
**Why it's good:** Reusable breathing math for any indicator.

#### T26. Color blending toward base (fade transitions)
**Source:** `render/color.rs:1-120` (`indexed_to_rgb`, `nearest_indexed`,
`blend_color`, `lerp_color`).
**What it does:** Linear interpolation between two colors (RGB or
indexed), used for sticky-header fade-out and the context bar blend.
**Why it's good:** Smooth color transitions instead of hard cuts.

#### T27. Timeline sidebar
**Source:** `views/timeline.rs`; `glyphs.rs`
(`timeline_chevron_up/down`, `timeline_tick_active/hover`,
`heavy/light_horizontal`).
**What it does:** A turn-navigation rail with active `━━` / hover `──` /
idle `─` ticks and `▴`/`▾` chevrons to jump between turns.
**Why it's good:** Spatial turn navigation.

---

## 3. Gap Table

Legend: **Ported?** = already in pi-grok-theme. **Class** =
`[theme-json]` (theme JSON alone) / `[extension]` (pi extension API) /
`[upstream-blocked]` (needs a pi core change).

| # | Trait | Ported? | Class | Concrete port sketch for pi-grok-theme |
|---|------|---------|------|----------------------------------------|
| T1 | OSC 11 bg detection | No | `[upstream-blocked]` (mostly) / `[extension]` (partial) | OSC 11 needs raw-mode stdin owned by pi core; an extension can't safely query it mid-session. The *desktop* half (T2) is `[extension]`. Skip OSC 11. |
| T2 | System appearance `auto` theme | **No** | `[extension]` | Poll OS appearance every 5s in a `setInterval` from `session_start`: macOS `defaults read -g AppleInterfaceStyle`, Linux `dbus-send ... org.freedesktop.appearance.color-scheme`, Windows `reg query`. On change call `ctx.ui.setTheme("grok-build")`/`"grok-build-day"`. Add a `/grok auto` toggle persisting to `~/.pi/agent/settings.json`. Re-uses existing themes. |
| T3 | Color quantization | No | `[upstream-blocked]` | pi core owns theme rendering & quantization. A 256-color theme JSON variant (int color values 0-255) is `[theme-json]`-possible but the auto-detect+quantize loop is core. Low value (pi targets truecolor). |
| T4 | ANSI16 chrome overrides | No | `[upstream-blocked]` | pi core quantizes; no extension hook into the render pipeline. Skip. |
| T5 | Windows contrast boost | No | `[upstream-blocked]` | pi core renders. Skip. |
| T6 | Per-heading-level colors (h1-h6) | **No** (only `mdHeading`) | `[upstream-blocked]` | pi theme schema has a single `mdHeading` token, no `mdHeadingH1..H6`. A `registerMarkdownTransformer` could inject ANSI color codes per heading level as a hack, but it would fight pi's own markdown renderer. File a pi schema request instead. |
| T7 | Theme caching + live preview | Partial (`/grok theme` shows instructions only) | `[extension]` | Implement `/grok theme <name>` to call `ctx.ui.setTheme(name)` immediately (live), with a 2nd `/grok theme` (no arg) listing `getAllThemes()` with `(active)` markers. Add `getArgumentCompletions` returning theme names so the slash completer previews. |
| T8 | Legacy console glyph fallback | **No** | `[extension]` | Detect legacy console via `process.env` (`TERM_PROGRAM`, `WT_SESSION`, OS = win32 with no modern terminal env). In `footer.ts`/`header.ts`/`status.ts`, substitute ASCII for `●`→`*`, `⚡`→`#`, `✻`→`*`, `▸`→`>`. Cheap insurance; gate behind a `PI_GROK_LEGACY_GLYPHS` env for QA. |
| T9 | Braille spinner frames | **No** (static `●`) | `[extension]` | One call in `session_start`/`message_start`: `ctx.ui.setWorkingIndicator({ frames: ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧"], intervalMs: 120 })`. Restore default on `session_shutdown`. Huge visual win, trivial cost. |
| T10 | Dot spinner frames (quiet) | No | `[extension]` | Alternative to T9 for a calmer aesthetic: `setWorkingIndicator({ frames: ["⋅",":","⸬","⁙"], intervalMs: 200 })`. Could be a `/grok spinner dot` option. |
| T11 | Monitor pulse (idle) | No | `[extension]` | When `statusController.state === "idle"` but a turn just ended, render the footer working badge as a breathing `○ ◎ ◉ ◎` instead of `○ idle`. Needs a render tick; reuse `footerHandle.requestRender()` on a `setInterval`. |
| T12 | Prompt arrow `❯` | **No** (documented limitation) | `[extension]` (high cost) | `ctx.ui.setEditorComponent(factory)` swapping the whole editor (extend `CustomEditor`, call `super.handleInput` for unhandled keys). High cost, high risk; documented as a known limitation. Defer. |
| T13 | Diamond glyphs + `⇣` token arrow | Partial (footer has context %, no `⇣`) | `[extension]` | In `footer.ts`, prefix the context segment with `⇣ ` (U+21E3) and show raw token count: `⇣48k`. Use `◆`/`◇` for a mini usage bar at high %. |
| T14 | Turn status line (dedicated row) | Partial (in footer) | `[extension]` | Use `ctx.ui.setWidget("turn-status", lines, { placement: "aboveEditor" })` to render a 1-row `⠧ <activity> <phase>s    <turn>m <ss>s ⇣<tokens>k` above the editor. Update on `message_*`/`tool_execution_*`/`turn_*`. Or use `setStatus("grok-turn", text)` for a core status-bar slot. |
| T15 | Pending diamond pulse | No | `[extension]` | When waiting on user (idle after a question), pulse the footer dot via `sin²` brightness between `#7AA2F7` and `bg_base` (0.3-1.0 range). Reuse `footerHandle.requestRender()` on a 80ms tick. |
| T16 | Still-running watcher cue | No | `[upstream-blocked]` (data) | pi doesn't expose background-task/monitor/loop counts to extensions. The *render* is `[extension]` but the data is unavailable. Skip until pi adds a watcher API. |
| T17 | BtwBlock side-question panel | No | `[extension]` (high cost) | `setWidget("grok-ask", lines, { placement: "aboveEditor" })` + a `/grok ask <q>` command that calls `pi.sendUserMessage` and renders the response via `registerMessageRenderer`. Persist via `appendEntry`. High cost, medium value for pi's chat model. |
| T18 | Todo pane styling | No | `[upstream-blocked]` (data) | pi doesn't expose todo state to extensions. The *render* is `[extension]` via `custom()` overlay but there's no todo data API. Skip. |
| T19 | Context bar color blending | **No** (static-colored %) | `[extension]` | In `footer.ts`, color the context % segment by threshold: `<50%` → `fg`, `50-75%` → `blue`, `75-85%` → `amber`, `>85%` → `red`. Pure string coloring, no new API. High impact, low cost. |
| T20 | Permission prompt styling | No | `[upstream-blocked]` | pi owns tool-approval prompts; only `project_trust` is extension-hookable. Skip. |
| T21 | `/theme` live preview | Partial (see T7) | `[extension]` | (Same as T7.) |
| T22 | Vim mode | No | `[extension]` (high cost) | `setEditorComponent` with a `CustomEditor` subclass (documented pattern). Large surface area; consider a separate `pi-grok-vim` package. Out of scope for a theme. |
| T23 | Mouse / scrollback / copy | No | `[upstream-blocked]` | pi owns mouse/scrollback/selection. `onTerminalInput` gives raw bytes but no hit-testing. Skip. |
| T24 | Session picker / fork | No | `[upstream-blocked]` | pi has its own session manager UI. Skip. |
| T25 | Pulse/wave brightness | No | `[extension]` | Reusable `pulseBrightness(tick, speed) = Math.sin(tick*speed)**2` helper in `status.ts` for T15/T11. |
| T26 | Color blend toward base | No | `[extension]` (partial) | A `lerpColor(a, b, t)` helper in `status.ts` for T15/T19. The sticky-header fade use is `[upstream-blocked]`. |
| T27 | Timeline sidebar | No | `[upstream-blocked]` | pi owns the transcript. Skip. |

---

## 4. Prioritized Top-10 Unported Traits (visual impact ÷ cost)

Ordered by ratio of visual payoff to implementation effort. Each lists
its portability class.

1. **Braille spinner frames via `setWorkingIndicator`** — `[extension]`
   (T9). Replace the static `●` with `⠋⠙⠹⠸⠼⠴⠦⠧` at ~120ms. One API call in
   `message_start`; restore on `session_shutdown`. Highest impact/cost
   ratio in the whole catalog.

2. **Context % color blending by threshold** — `[extension]` (T19).
   Color the footer context segment `fg`→`blue`→`amber`→`red` across
   50/75/85% breakpoints. Pure string coloring in `footer.ts`; no new
   API. Turns the context metric into an urgency gauge.

3. **System appearance `auto` theme switching** — `[extension]` (T2).
   Poll OS dark/light every 5s; `ctx.ui.setTheme("grok-build"|"grok-build-day")`.
   Add `/grok auto` toggle. Reuses both existing themes. Survives SSH if
   you also honor a `PI_GROK_APPEARANCE` env stamp.

4. **`/grok theme <name>` live preview** — `[extension]` (T7/T21).
   `ctx.ui.setTheme(name)` immediately on command; `getArgumentCompletions`
   returns `getAllThemes()` so the slash completer previews each theme as
   the user arrows through them. Replaces the current "open /settings"
   instructions with instant switching.

5. **Token `⇣Nk` glyph + raw count in footer** — `[extension]` (T13).
   Prefix the context segment with `⇣ ` (U+21E3) and show `⇣48k` alongside
   the % — matches grok's turn-status vocabulary. Trivial; pure string
   change in `footer.ts`.

6. **Pending diamond pulse for "waiting on you"** — `[extension]`
   (T15/T25). When idle after a question, pulse the footer dot via
   `sin²(tick*0.08)` between `#7AA2F7` and `bg_base` (0.3-1.0). Reuse the
   footer render tick. Adds a polite breathing cue without a blink.

7. **Monitor pulse `○ ◎ ◉ ◎` idle indicator** — `[extension]` (T11).
   In the idle footer state, animate `○ ◎ ◉ ◎` at half-speed instead of a
   flat `○ idle`. Same render-tick mechanism as #6; reads as "alive but
   waiting".

8. **Dual timers (phase + turn) in footer/status** — `[extension]`
   (T14). `statusController` already tracks `turnStartAt` and
   `stateStartAt`; expose both: `● running bash (0.4s) · turn 1m20s`. Small
   `status.ts` change; gives turn economics at a glance.

9. **Legacy console glyph fallback** — `[extension]` (T8). Detect
   `process.platform === "win32"` without `WT_SESSION`/`TERM_PROGRAM` and
   substitute ASCII for `●`/`⚡`/`✻`/`▸` in `footer.ts`/`header.ts`/
   `status.ts`. Cheap insurance; gate behind `PI_GROK_LEGACY_GLYPHS=1`
   for QA on any platform.

10. **Per-heading-level colors (h1-h6)** — `[upstream-blocked]` (T6).
    High visual impact (document structure) but blocked: pi's theme
    schema has only `mdHeading`. File a pi schema request for
    `mdHeadingH1..H6` (+ optional `*Mod` bold flags). A
    `registerMarkdownTransformer` workaround would inject raw ANSI codes
    and fight pi's renderer — not recommended.

---

## 5. Traits NOT Worth Porting

- **T1 OSC 11 background detection** — pi owns raw stdin; an extension
  can't safely emit/parse the OSC 11 reply mid-session. The desktop half
  (T2) covers the common case. Skip.
- **T3/T4/T5 color quantization / ANSI16 overrides / Windows contrast
  boost** — all pi core render concerns; no extension hook. pi targets
  truecolor terminals. Skip.
- **T16 still-running watcher cue / T18 todo pane** — pi doesn't expose
  background-task or todo state to extensions. No data, no render. Skip
  until pi adds watcher/todo APIs.
- **T20 permission prompt styling** — pi owns tool approval; only
  `project_trust` is hookable. Skip.
- **T22 vim mode** — large surface area, orthogonal to theming. Belongs
  in a separate `pi-grok-vim` package. Out of scope.
- **T23 mouse / scrollback selection / copy / T24 session picker / T27
  timeline sidebar** — all pi core UI. No extension override path. Skip.
- **T17 BtwBlock side-question panel** — feasible but high cost for
  medium value in pi's chat-first model; pi already supports queued
  follow-ups. Defer.
- **Voice record dot** (glyphs.rs `record_dot`) — pi has no voice
  capture. Not applicable.

---

## 6. Notable Surprises in grok-build's Source

1. **The legacy-console glyph fallback system (T8) is extraordinarily
   thorough.** Every chrome glyph has a *tested* 1-column ASCII or CP437
   fallback (`❯`→`>`, `✓`→`√` U+221A, `◆`→`♦` U+2666, `⇣`→`↓`), with
   unit tests asserting every fancy glyph and its fallback are exactly 1
   column so fixed-width button layouts never shift between platforms. The
   `GROK_FORCE_LEGACY_CONSOLE` env lets you eyeball the ASCII fallbacks on
   macOS/Linux — a QA affordance I didn't expect. The detection is
   default-deny on Windows (unknown terminal brand = legacy), which is the
   safe call.

2. **OSC 11 detection is startup-only and carefully avoids stdin
   contention.** The `TermiosGuard` in `osc11.rs` restores termios on drop
   *without* calling `crossterm::disable_raw_mode`, because that would
   restore the shell's pre-pager cooked termios and break the pager's own
   raw mode. The bare query is sent first (tmux ≥3.2 answers from the
   pane), and the DCS-wrapped passthrough is only a short 80ms retry —
   because `allow-passthrough` is off by default and the outer reply
   lands on tmux's tty, not the pane. The result is cached so the runtime
   watcher never re-probes and never lets a stale `COLORFGBG` override a
   live OSC 11 reading.

3. **The pending-diamond pulse never disappears.**
   `pending_diamond_color` blends `accent` toward `bg_base` with
   `sin²(tick*0.08)` but clamps brightness to **0.3–1.0**, so the diamond
   stays visible at the trough of the pulse — a subtle but important
   detail for "waiting on you" cues, where a disappearing indicator would
   read as "done." Three call sites (permission prompts,
   `ask_user_question`, drain-blocked idle) share one helper so they can
   never drift apart in cadence or color.

---

## 7. Summary

- **File written:** `/home/tcuni-claw/pi/pi-grok-theme/docs/grok-build-ui-gaps.md`
- **Top 10 unported traits** (with portability classes): see §4 above.
  The five cheapest, highest-impact wins are all `[extension]`:
  braille spinner (#1), context-% color blending (#2), auto dark/light
  (#3), live `/grok theme` preview (#4), and the `⇣Nk` token glyph (#5).
- **One high-impact trait is `[upstream-blocked]`**: per-heading-level
  colors (T6/#10) — worth a pi schema request.
- **Three surprises** documented in §6: the rigor of the legacy-glyph
  fallback system, the stdin-contention-aware OSC 11 design, and the
  never-disappear pulse clamping.
