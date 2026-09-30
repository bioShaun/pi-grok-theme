# pi-grok-build ⚡

<p align="center">
  <b>A terminal-native workspace theme and presentation UI extension for <a href="https://github.com/earendil-works/pi">Pi Coding Agent</a></b><br>
  Inspired by the visual aesthetics and ergonomics of <b>xAI Grok Build</b> (<code>xai-org/grok-build</code>).
</p>

<p align="center">
  <a href="#installation"><b>Installation</b></a> •
  <a href="#features"><b>Features</b></a> •
  <a href="#themes"><b>Themes</b></a> •
  <a href="#extension--footer"><b>UI Extension</b></a> •
  <a href="#workflow-guidelines"><b>Workflow Guidelines</b></a> •
  <a href="README.zh-CN.md"><b>简体中文</b></a>
</p>

---

## 🎨 Aesthetic & Visual Hierarchy

Designed for high-contrast, low-saturation, multi-hour coding sessions with a true neutral **GrokNight** charcoal base and balanced **TokyoNight** semantic accents.

```text
#0A0A0A (terminal canvas)
  ↓
#141414 (main surface & tool cards)
  ↓
#242424 (selected items & active highlights)
  ↓
#414141 (gutters & muted separators)
  ↓
#E1E1E1 (primary text)
  +
TokyoNight Accents (#7AA2F7 Blue, #7DCFFF Cyan, #E0AF68 Amber Gold, #9ECE6A Green, #BB9AF7 Purple, #F7768E Coral)
```

### Terminal Preview

```text
▸ my-project · ⎇ main

✓ read_file src/auth.ts (1.2s)
✓ bash npm test (842ms)

● thinking (1.4s)

────────────────────────────────────────────────────────────────────────────
claude-3.7-sonnet · ⎇ main · ⇣48k/200k (24%) · ✻ high          ● working  3.1s
```

> Trustworthy preview assets (rendered deterministically from the real chrome
> code, not hand-drawn) live in [`docs/previews/`](docs/previews/) — see
> [Visual Previews](#-visual-previews).

---

## 📦 What's Included (3-in-1 Suite)

| Component | Layer | Description |
|---|---|---|
| **Phase 1: Native Themes** | Visual Theme | High-contrast `grok-build-coding`, minimalist `grok-build`, and clean light `grok-build-day` JSON themes calibrated with official Grok Build palettes. |
| **Phase 2: UI Extension** | Presentation UI | Single-line responsive metadata footer, workspace header banner, OSC 12 terminal cursor sync (`#E0AF68`), and compact working state indicators (`● working (2.4s)`). |
| **Phase 3: Workflow Guidelines** | Behavior Standard | Standardized 4-stage **Plan → Search → Build → Verify** interaction rules with zero conversational filler. |

---

## 🆕 Current Adaptive Chrome

The presentation layer provides theme-native, responsive chrome with durable preferences:

- **Theme-native chrome.** Footer, header, status badge, and `/grok` notifications take every color from the active Pi theme's semantic tokens — no more hard-coded GrokNight ANSI. Branches and untracked counts stay neutral, icons use a predictable monochrome family, and the day theme uses accessible gray roles for readable secondary text. Dark, day, and third-party themes render natively. The OSC 12 cursor follows a named-theme policy: bundled darks use Grok amber `#E0AF68`, `grok-build-day` uses a darker amber `#B45309`, unknown themes keep the terminal default.
- **Controlled motion.** `normal` uses Pi's supported animated working indicator. `quiet` requests one static frame and reduces plugin timers to integer seconds with fewer redraws. If the installed Pi host cannot customize its indicator, the command reports that limitation while the rest of quiet mode remains active.
- **Context pressure metric.** The footer shows Grok's compact token notation `⇣48k/200k (24%)` (compact: `24%`), escalating through semantic tones at 65% (accent), 80% (warning), and 90% (error). Missing usage data renders no fabricated segment.
- **Dual timing + coalesced renders.** The status label shows **phase** time (resets per thinking/streaming/tool transition); the `full` preset adds whole-turn time. Renders are coalesced on a 250 ms clock — token bursts no longer force per-token redraws.
- **Footer presets.** `/grok footer default|minimal|full` switches presentations immediately. `default` is the responsive default; the old `auto` spelling remains a migration alias.
- **Asynchronous Git status.** Git discovery and status run outside rendering with a short cache. Refreshes retain the last good snapshot; a failed read shows `git?` and hides unreliable counts instead of looking like a clean worktree.
- **Unified glyph policy.** `auto` is the default glyph preference, with explicit `unicode`, `nerd`, and `ascii` modes. The same resolved choice drives Footer, Header, title, separators, and the working indicator.
- **Compact Header and two-zone Footer.** Header remains off by default and opens in a one-line compact style. At 80 columns and wider, the Footer reserves a stable 24-column activity zone on the right; narrower layouts preserve the model and activity core before optional metadata.
- **Direct theme switching.** `/grok theme` lists installed themes (active marked); `/grok theme <name|coding|minimal|day>` switches instantly with argument completion, reporting host errors without changing the active theme on failure.
- **Reliable preferences.** UI choices persist atomically in `pi-grok-theme.json` under the Pi agent directory. A failed save keeps the session change, preserves the previous file, and produces one clear notification.
- **Compatibility.** New UI APIs are feature-detected. The chrome extension targets Pi; omp receives the generated palette files only, without Pi's Footer, Header, commands, or motion behavior.

---

## 🚀 Installation

`pi-grok-theme` is packaged as a standard **Pi Extension & Theme Package**.

### Install via Pi CLI (Recommended)

Run directly inside your terminal:

```bash
pi install https://github.com/bioShaun/pi-grok-theme
```

Or for local development / clone:

```bash
git clone https://github.com/bioShaun/pi-grok-theme.git
cd pi-grok-theme
pi install . -l
```


### Install themes: Pi vs Oh My Pi (omp)

- **Pi:** themes ship via this package (`package.json` → `pi.themes` → `themes/grok-build*.json`).
- **omp:** copy or symlink files from `themes/omp/` into your omp themes directory. These JSON files add `pythonMode` and `statusLine*` tokens and are **not** registered in `pi.themes`. This is palette export only; the Pi chrome extension is not ported to omp.

### Or configure in `~/.pi/agent/settings.json`
Add the package repository to your Pi settings packages list:

```json
{
  "theme": "grok-build-coding",
  "packages": [
    "https://github.com/bioShaun/pi-grok-theme"
  ]
}
```

---

## 🎯 Activation

### 1. In Pi Interactive Session
Launch Pi, type `/settings`, navigate to **Theme**, and select `grok-build-coding`.

### 2. In `~/.pi/agent/settings.json`
```json
{
  "theme": "grok-build-coding"
}
```

### 3. From Command Line
```bash
pi --use-theme grok-build-coding
```

---

## 🌓 Theme Variants

| Theme | Best For | Highlights |
|---|---|---|
| **`grok-build-coding`** *(Recommended)* | Daily software development | Rich syntax coloring (keywords in lavender `#BB9AF7`, functions in blue `#7AA2F7`, types in cyan `#7DCFFF`), instant diff distinction (`#9ECE6A` / `#F7768E`), cyan headings, warm amber focus borders. |
| **`grok-build`** | Maximum monochrome minimalism | Monochromatic white/gray syntax with subtle cyan/blue accents, cyan headings, flat `#141414` tool backgrounds. |
| **`grok-build-day`** | Daylight & bright environments | Clean neutral gray `#EEEEEE` base, crisp `#1A1A1A` text with darkened TokyoNight accents for daylight coding. |

---

## 🖼️ Visual Previews

All previews are generated by `npm run previews` from the real rendering path
(bundled theme JSON → genuine Pi `Theme` instances → `renderHeader` /
`renderGrokFooter` → ANSI→SVG). The three current chrome previews show richer
compact/boxed Header, wide/narrow Footer, Git, context, and activity scenarios:

| Theme | Preview |
|---|---|
| `grok-build-coding` | [docs/previews/grok-build-coding.svg](docs/previews/grok-build-coding.svg) |
| `grok-build` | [docs/previews/grok-build.svg](docs/previews/grok-build.svg) |
| `grok-build-day` | [docs/previews/grok-build-day.svg](docs/previews/grok-build-day.svg) |

A release test byte-compares the committed SVGs against a fresh render, so the
previews can never go stale or hand-drawn.

The companion content showcases use real Pi Markdown, syntax highlighting, tool,
Diff and filtered-selection renderers in isolated theme sessions:
[coding](docs/previews/grok-build-coding-content.svg),
[minimal](docs/previews/grok-build-content.svg), and
[day](docs/previews/grok-build-day-content.svg).
Previews assume the matching terminal background and DejaVu Sans Mono or a compatible monospace font.
They verify static rendering; animation and physical font rendering require terminal checks.

---

## 🖥️ UI Extension & Footer

### Using with pi-open-tui

When another extension owns the footer/header, Grok yields automatically. Theme colors, the amber cursor, Braille working indicator, and terminal title remain active, while footer rendering and Git counts stop. `/grok header` is disabled while the other extension owns the footer.

The Phase 2 presentation extension provides a single-line, responsive statusline inspired by Grok Build.

### Responsive Footer Layouts

- **Standard / Wide Screen (≥ 80 columns):** the left metadata zone yields to a stable 24-column activity zone at the right edge.
  ```text
  claude-3.7-sonnet · ⎇ main · ⇣48k/200k (24%) · ✻ high          ● working  3.1s
  ```

- **Narrow Screen (< 80 columns):**
  ```text
  sonnet-3.7 · ⎇ main · 24% · ● working
  ```

### Footer Presets
- `/grok footer` — report the current preset and available values.
- `/grok footer default` — responsive hierarchy with all eligible segments (default; legacy `auto` is accepted as an alias).
- `/grok footer minimal` — model · context · status.
- `/grok footer full` — model · branch · context · extension statuses · thinking · cwd · turn time · status.

Presets apply immediately and persist across sessions. Whole-turn timing appears
only in the `full` preset and only while a turn is active. Git refreshes are
asynchronous: `git?` means status is unknown, and counts are hidden until a
successful read. A clean repository does not show that marker.

### Smart Dropping Priority Hierarchy
When terminal width narrows, segments recede by metadata-driven priority
(status and model are never dropped; wide context compacts to a percentage
before being dropped; third-party statuses are individually droppable and can
never push core fields off-screen):
1. `Working State Badge` (never dropped)
2. `Active Model Name` (shrinks to its short name)
3. `Git Branch`
4. `Context Usage / %` (compacts to `24%` first)
5. `Third-party Extension Statuses` (dropped individually)
6. `Thinking Level`
7. `Turn Duration` (full preset only)
8. `Project Directory / CWD` (first to hide)

### Extension Commands
- `/grok` or `/grok info`: Inspect current workspace, model, cursor color, and theme status.
- `/grok theme`: List installed themes (active one marked) with completion support.
- `/grok theme <name|coding|minimal|day>`: Switch themes directly — refreshes cursor, working indicator, header, and footer; failures leave the active theme unchanged.
- `/grok footer [default|minimal|full]`: Switch Footer presets immediately (`auto` remains a legacy alias).
- `/grok footer glyphs [auto|unicode|nerd|ascii]`: Query or select the glyph policy. `PI_GROK_LEGACY_GLYPHS=1` always forces ASCII; `=0` resolves `auto` to modern Unicode. Nerd Font glyphs are opt-in.
- `/grok footer sep [dot|powerline-thin|slash|ascii]`: Query or select the separator. In effective ASCII mode, unsupported decorative separators fall back safely without overwriting the saved selection.
- `/grok toggle`: Toggle between auto-responsive and always-compact footer density.
- `/grok header [compact|boxed|on|off]`: Toggle or configure the optional Header. New installs default to off with compact as the first style; an old enabled Header migrates to boxed.
- `/grok motion [normal|quiet]`: Query or select motion. `normal` is the default; `quiet` uses a static host frame when supported and reduces plugin timer redraws.

Footer, glyph, separator, Header, and motion choices are saved atomically in
`pi-grok-theme.json`. The directory defaults to `~/.pi/agent` and follows
`PI_CODING_AGENT_DIR` when set. If a command cannot save, its change still
applies to the current session and one notification explains that it was not persisted.

---

## 📋 Phase 3 Workflow Guidelines

To align your Pi agent's responses with Grok Build's high information density and structured execution:

```text
1. PLAN          2. SEARCH / INSPECT      3. BUILD             4. VERIFY & REVIEW
Checklist ───>  Targeted Discoveries ───> Surgical Edits ───> Tests & Diff Summary
```

### Activation
```bash
# Global configuration for Pi Coding Agent
cp guidelines.md ~/.pi/agent/AGENTS.md

# Or project-level configuration
cp guidelines.md .pi/rules.md
```

See [guidelines.md](guidelines.md) for full interaction rules.

---

## 🛠️ Project Structure

```text
pi-grok-theme
├── package.json               # Root Pi plugin package manifest
├── LICENSE                    # MIT License
├── README.md                  # English Documentation
├── README.zh-CN.md            # Chinese Documentation (简体中文)
├── SPEC.md                    # Technical Specification
├── guidelines.md              # Phase 3 Workflow & Interaction Rules
│
├── themes/                    # Phase 1: Native Themes
│   ├── grok-build-coding.json # GrokNight daily driver theme
│   ├── grok-build.json        # Ultra-minimalist dark theme
│   └── grok-build-day.json    # GrokDay daylight theme
│
├── index.ts                   # Phase 2: UI Extension entrypoint & lifecycle
├── chrome-theme.ts            # Single styling adapter (semantic Pi theme tokens)
├── glyphs.ts                  # Capability-aware glyph vocabulary (modern/legacy)
├── cursor.ts                  # OSC 12 named-theme cursor policy
├── git-status.ts              # Async Git snapshot provider
├── footer.ts                  # Metadata-driven footer segments, presets & fitting
├── header.ts                  # Workspace header banner
├── status.ts                  # Semantic activity state controller & status tokens
├── render-clock.ts            # Coalescing 250 ms render clock (turn-scoped)
├── working-indicator.ts       # Grok Braille working spinner (feature-detected)
├── version.ts                 # Displayed version (synced with package.json)
│
├── docs/                      # Documentation & Specs
│   ├── previews/              # Deterministic chrome preview assets (SVG)
│   ├── guidelines.md
│   ├── pi-grok-build-theme.spec.md
│   └── development-notes.md
├── scripts/render-previews.js # Deterministic preview renderer (npm run previews)
├── .github/workflows/ci.yml   # CI: typecheck + tests on the Node matrix
├── tsconfig.json              # Strict type checking (no build artifacts)
└── test/                      # Unit Tests & release-gate checks
    ├── test.js
    ├── theme-quality.js       # Theme schema / token / contrast release gate
    └── fixtures/theme-schema.json
```

---

## ✅ Development & Release Gate

Every v0.4-or-later change must pass all of the following before it can land —
CI (`Node 22` + `Node 24`) enforces the same checks:

| Gate | Command | What it proves |
|---|---|---|
| Type checking | `npm run typecheck` | Strict `tsc --noEmit` over the extension source; no build artifacts emitted. |
| Unit & regression tests | `npm test` | Existing behavior (footer, header, commands, lifecycle) keeps passing. |
| Theme schema validation | included in `npm test` | Every bundled theme JSON satisfies Pi's theme schema (`test/fixtures/theme-schema.json`). |
| Theme token completeness | included in `npm test` | Every theme explicitly defines **all** required **and** optional Pi theme tokens, and every var reference resolves. |
| Contrast gates | included in `npm test` | WCAG-derived minimums: primary & muted text ≥ 4.5:1, warning & error ≥ 3.0:1 on the terminal background; diff colors ≥ 3.0:1 on their tool-box surfaces. |

These are the **required release gates** for all later v0.4 tickets: a slice is
not done until `npm run typecheck && npm test` is green.

---

## ⚠️ Known Limitations

- **Prompt arrow (`❯`) cannot be themed.** Replacing it requires swapping the entire editor via `ctx.ui.setEditorComponent`, which is far out of scope for a theme extension.
- **Window title may be overwritten by Pi core.** The title uses the resolved brand glyph and `|` separators (for example, `◇ grok | <dir> | <branch>`, or `#` in ASCII mode). It is applied at session start and updated when the workspace, branch snapshot, or resolved glyphs change. Pi core can overwrite it when renaming or switching a session; it returns on the next session start or a change to those title fields.

---

## 📄 License

MIT © [earendil-works](https://github.com/earendil-works)
