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
~/my-project  main · claude-3.7-sonnet · 48k/200k (24%) · ✻ high · ● working (3.1s)
```

---

## 📦 What's Included (3-in-1 Suite)

| Component | Layer | Description |
|---|---|---|
| **Phase 1: Native Themes** | Visual Theme | High-contrast `grok-build-coding`, minimalist `grok-build`, and clean light `grok-build-day` JSON themes calibrated with official Grok Build palettes. |
| **Phase 2: UI Extension** | Presentation UI | Single-line responsive metadata footer, workspace header banner, OSC 12 terminal cursor sync (`#E0AF68`), and compact working state indicators (`● working (2.4s)`). |
| **Phase 3: Workflow Guidelines** | Behavior Standard | Standardized 4-stage **Plan → Search → Build → Verify** interaction rules with zero conversational filler. |

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

## 🖥️ UI Extension & Footer

The Phase 2 presentation extension provides a single-line, responsive statusline inspired by Grok Build.

### Responsive Footer Layouts

- **Standard / Wide Screen (≥ 80 columns):**
  ```text
  ~/my-project  main · claude-3.7-sonnet · 48k/200k (24%) · ✻ high · ● working (3.1s)
  ```

- **Narrow Screen (< 80 columns):**
  ```text
  main · sonnet-3.7 · 24% · ● working
  ```

### Smart Dropping Priority Hierarchy
When terminal width narrows, items recede in strict priority order:
1. `Working State Badge` (Always visible)
2. `Active Model Name`
3. `Git Branch`
4. `Context Usage / %`
5. `Thinking Level`
6. `Project Directory / CWD` (First to hide)

### Extension Commands
- `/grok` or `/grok info`: Inspect current workspace, model, cursor color, and theme status.
- `/grok theme` / `/grok theme [coding|dark|day]`: View available themes and quick-switch instructions.
- `/grok toggle`: Toggle between auto-responsive and always-compact footer modes.
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
├── cursor.ts                  # OSC 12 terminal cursor color synchronization
├── footer.ts                  # Single-line responsive footer renderer
├── header.ts                  # Workspace header banner
├── status.ts                  # Working state controller & status tokens
│
├── docs/                      # Documentation & Specs
│   ├── guidelines.md
│   ├── pi-grok-build-theme.spec.md
│   └── development-notes.md
└── test/                      # Unit Tests
    └── test.js
```

---

## ⚠️ Known Limitations

- **Prompt arrow (`❯`) cannot be themed.** Replacing it requires swapping the entire editor via `ctx.ui.setEditorComponent`, which is far out of scope for a theme extension.
- **Window title may be overwritten by Pi core.** The grok-style title (`⚡ grok · <dir> · <branch>`) is applied on `session_start`, but Pi core re-applies its own title when a session is renamed or switched (`updateTerminalTitle()`). The grok title returns on the next session start.

---

## 📄 License

MIT © [earendil-works](https://github.com/earendil-works)
