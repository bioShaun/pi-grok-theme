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
╭─ GROK BUILD ─────────────────────────────────────────────────────────────╮
│ 📁 my-project  ⎇ main  ·  model: claude-3.7-sonnet  ·  v0.3.0            │
╰──────────────────────────────────────────────────────────────────────────╯

✓ read_file src/auth.ts (1.2s)
✓ bash npm test (842ms)

● thinking (1.4s)

────────────────────────────────────────────────────────────────────────────
~/my-project  main · claude-3.7-sonnet · ⇣48k/200k (24%) · ✻ high · ● working (3.1s)
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

## 🆕 What's New in v0.4 — Adaptive Chrome

v0.4 turns the presentation layer into **theme-native adaptive chrome**:

- **Theme-native chrome.** Footer, header, status badge, and `/grok` notifications take every color from the active Pi theme's semantic tokens — no more hard-coded GrokNight ANSI. Dark and day themes (and third-party themes) render natively, and switching themes recolors chrome instantly. The OSC 12 cursor follows a named-theme policy: bundled darks use Grok amber `#E0AF68`, `grok-build-day` uses a darker amber `#B45309`, unknown themes keep the terminal default.
- **Grok working indicator.** While Pi streams, the one-column Braille spinner (`⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧`, 120 ms cadence) animates in the active theme's accent. Legacy terminals get ASCII `| / - \`. Pi's default indicator is restored on shutdown, and the footer never shows a second animated spinner.
- **Context pressure metric.** The footer shows Grok's compact token notation `⇣48k/200k (24%)` (compact: `24%`), escalating through semantic tones at 65% (accent), 80% (warning), and 90% (error). Missing usage data renders no fabricated segment.
- **Dual timing + coalesced renders.** The status label shows **phase** time (resets per thinking/streaming/tool transition); the `full` preset adds whole-turn time. Renders are coalesced on a 250 ms clock — token bursts no longer force per-token redraws.
- **Footer presets.** `/grok footer auto|minimal|full` switches presentations immediately: `auto` (default responsive hierarchy), `minimal` (model · context · status), `full` (everything + turn time).
- **Direct theme switching.** `/grok theme` lists installed themes (active marked); `/grok theme <name|coding|minimal|day>` switches instantly with argument completion, reporting host errors without changing the active theme on failure.
- **Legacy glyph fallback.** `PI_GROK_LEGACY_GLYPHS=1` forces ASCII chrome glyphs; automatic on Windows outside modern terminals; `PI_GROK_LEGACY_GLYPHS=0` overrides detection.
- **Compatibility.** On older Pi versions every new UI API is feature-detected: the extension keeps v0.3 behavior instead of failing. Footer presets are session-local.

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
`renderGrokFooter` → ANSI→SVG). Narrow and wide footer layouts are both shown:

| Theme | Preview |
|---|---|
| `grok-build-coding` | [docs/previews/grok-build-coding.svg](docs/previews/grok-build-coding.svg) |
| `grok-build` | [docs/previews/grok-build.svg](docs/previews/grok-build.svg) |
| `grok-build-day` | [docs/previews/grok-build-day.svg](docs/previews/grok-build-day.svg) |

A release test byte-compares the committed SVGs against a fresh render, so the
previews can never go stale or hand-drawn.

---

## 🖥️ UI Extension & Footer

The Phase 2 presentation extension provides a single-line, responsive statusline inspired by Grok Build.

### Responsive Footer Layouts

- **Standard / Wide Screen (≥ 80 columns):**
  ```text
  ~/my-project  main · claude-3.7-sonnet · ⇣48k/200k (24%) · ✻ high · ● working (3.1s)
  ```

- **Narrow Screen (< 80 columns):**
  ```text
  main · sonnet-3.7 · 24% · ● working
  ```

### Footer Presets
- `/grok footer` — report the current preset and available values.
- `/grok footer auto` — responsive hierarchy with all eligible segments (default).
- `/grok footer minimal` — model · context · status.
- `/grok footer full` — cwd · branch · model · context · thinking · turn time · extension statuses · status.

Presets apply immediately and are session-local. Whole-turn timing appears only
in the `full` preset and only while a turn is active.

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
- `/grok footer [auto|minimal|full]`: Switch footer presets immediately.
- `/grok toggle`: Toggle between auto-responsive and always-compact footer density.
- `/grok header`: Toggle the workspace header banner on or off (opt-in, disabled by default).

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
- **Window title may be overwritten by Pi core.** The grok-style title (`⚡ grok · <dir> · <branch>`) is applied on `session_start`, but Pi core re-applies its own title when a session is renamed or switched (`updateTerminalTitle()`). The grok title returns on the next session start.

---

## 📄 License

MIT © [earendil-works](https://github.com/earendil-works)
