# Pi Grok Build Theme & Extension — Implementation & Optimization Spec

**Project name:** `pi-grok-build`  
**Status:** Complete / v0.2.0 Fully Implemented  
**Version:** `0.2.0`  
**Target:** Pi Coding Agent  
**Primary platform:** truecolor terminal (Ghostty, WezTerm, iTerm2, Kitty, VS Code)  
**Scope:** Phase 1 (GrokNight Native Theme) → Phase 2 (UI Extension) → Phase 3 (Workflow & Output Guidelines)

---

# 1. Goal & Vision

Create an immersive, terminal-native workspace theme and extension for Pi Coding Agent inspired by the visual language and interaction design of **xAI Grok Build** (`xai-org/grok-build` / `xai-grok-pager`).

The implementation prioritizes:

1. **GrokNight Neutral Dark Appearance:** Neutral charcoal/black base (`#0A0A0A` / `#141414` / `#242424`) without artificial blue/brown color casts;
2. **TokyoNight-derived Semantic Accents:** Balanced, restrained accents (`#7AA2F7` Blue, `#7DCFFF` Cyan, `#E0AF68` Amber Gold, `#9ECE6A` Green, `#BB9AF7` Lavender Purple, `#F7768E` Coral Red);
3. **Amber/Gold Critical Highlights:** Distinctive warm amber accents for cursors, warnings, bash modes, and active highlights;
4. **Information Density & Long-Session Ergonomics:** Quiet background layers with crisp `#E1E1E1` text to ensure multi-hour readability without visual fatigue;
5. **Zero-Fluff Agent States:** Minimalist, single-line status indicators and quiet working state (`● working`);
6. **Clean Semantic Distinction:** Immediate visual scanning across user turns, assistant reasoning, tool invocations, and git diffs.

```text
#0A0A0A (terminal canvas)
  ↓
#141414 (main surface)
  ↓
#242424 (card & highlight surface)
  ↓
#414141 (gutters & muted borders)
  ↓
#E1E1E1 (primary text)
  +
TokyoNight Accents (#7AA2F7, #7DCFFF, #E0AF68, #9ECE6A, #BB9AF7)
```

---

# 2. Benchmarking & Deep Alignment with Grok Build

Based on research into the official `xai-org/grok-build` codebase and `xai-grok-pager-render`:

| Dimension | Initial Theme (Draft) | Official Grok Build (`grok-night`) | Optimization in v0.2.0 |
|---|---|---|---|
| **Base Canvas** | Saturated blue-black `#0D0F11` | Pure neutral dark `#0A0A0A` / `#141414` | Align canvas with true neutral GrokNight palette |
| **Accent Palette** | Single cool cyan `#7DD3FC` | Multi-accent TokyoNight system (Blue, Cyan, Amber, Purple, Green) | Introduce balanced TokyoNight accents |
| **Highlight & Cursor** | Cool cyan | Warm Amber Gold (`#E0AF68`) / Orange (`#FF9E64`) | Warm amber for cursor, bash mode, warnings & active badges |
| **Tool Execution** | Plain flat block | Streamlined 1-line summary (`✓ tool`) with flat `#141414` background | Unified flat background + compact status markers |
| **TUI Architecture** | Line-by-line streaming terminal | Full-screen Ratatui workspace (Pinned Header/Footer, BtwBlock) | Add Phase 2 Extension (Custom Header/Footer/Status) |
| **Working State** | Default Pi streaming spinner | Compact `● working` / `● thinking (2.4s)` | Intercept working messages via Extension API |
| **Workflow Paradigm** | Unstructured chat conversation | Plan → Search → Build → Review structured delivery | Standardize agent interaction guidelines (Phase 3) |

---

# 3. Architecture

The project is structured in three modular layers:

```text
pi-grok-build
│
├── Phase 1: Native Themes (Theme Layer)
│   ├── grok-build-coding.json  (GrokNight palette + rich syntax for daily coding)
│   └── grok-build.json         (Pure minimalist GrokNight palette)
│
├── Phase 2: Presentation Extension (UI Layer)
│   ├── index.ts                (Extension entry point & lifecycle)
│   ├── header.ts               (Grok-style workspace header)
│   ├── footer.ts               (Compact single-line metadata footer)
│   └── status.ts               (Working indicator & status badges)
│
└── Phase 3: Workflow Guidelines (Behavior Layer)
    └── guidelines.md           (Plan → Search → Build prompt & output rules)
```

- **Phase 1 is strictly zero-dependency** and runs on any Pi installation.
- **Phase 2 is a pure presentation extension** (never alters model logic, tool execution, or context).
- **Phase 3 provides best-practice prompt behaviors** for agentic coding.

---

# 4. Phase 1 — Native Themes (GrokNight System)

## 4.1 Base GrokNight Palette

```text
Canvas & Surfaces:
  terminal-bg       #0A0A0A   (Deepest background / terminal canvas)
  surface-0         #0E0E0E   (Base level)
  surface-1         #141414   (Main surface / tool background)
  surface-2         #1A1A1A   (User message cards)
  surface-3         #242424   (Selected items / active highlights)

Text & Monochromes:
  fg-primary        #E1E1E1   (High-contrast crisp white)
  fg-secondary      #C8C8C8   (Secondary information)
  muted             #6C6C6C   (Comments, thinking text)
  dim               #414141   (Gutters, inactive separators)

Borders:
  border            #2E3035   (Standard UI borders)
  border-muted      #202226   (Subtle card dividers)
  border-accent     #7AA2F7   (Focused/active borders)

Accents (TokyoNight System):
  blue              #7AA2F7   (Primary accent / links / function names)
  cyan              #7DCFFF   (Types / code spans / bullets)
  amber             #E0AF68   (Gold accent / warnings / bash mode / cursor)
  purple            #BB9AF7   (Keywords / thinking high)
  green             #9ECE6A   (Diff additions / string literals / success)
  red               #F7768E   (Diff removals / errors)
  orange            #FF9E64   (Numbers / alerts)
```

---

## 4.2 `grok-build-coding.json` (Recommended Daily Driver)

Optimized for daily software development with clear syntax differentiation and high-contrast diffs:

```json
{
  "$schema": "https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json",
  "name": "grok-build-coding",
  "vars": {
    "terminalBg": "#0A0A0A",
    "surface1": "#141414",
    "surface2": "#1A1A1A",
    "surface3": "#242424",

    "fg": "#E1E1E1",
    "fgSecondary": "#C8C8C8",
    "muted": "#6C6C6C",
    "dim": "#414141",

    "border": "#2E3035",
    "borderMuted": "#202226",

    "blue": "#7AA2F7",
    "cyan": "#7DCFFF",
    "amber": "#E0AF68",
    "purple": "#BB9AF7",
    "green": "#9ECE6A",
    "red": "#F7768E",
    "orange": "#FF9E64"
  },
  "colors": {
    "accent": "blue",

    "border": "border",
    "borderAccent": "blue",
    "borderMuted": "borderMuted",

    "success": "green",
    "error": "red",
    "warning": "amber",

    "muted": "fgSecondary",
    "dim": "dim",
    "text": "",
    "thinkingText": "muted",

    "selectedBg": "surface3",
    "scrollbarThumb": "border",

    "searchMatchBg": "surface3",
    "searchMatchText": "fg",

    "userMessageBg": "surface2",
    "userMessageText": "fg",

    "customMessageBg": "surface1",
    "customMessageText": "fg",
    "customMessageLabel": "amber",

    "toolPendingBg": "surface1",
    "toolSuccessBg": "surface1",
    "toolErrorBg": "surface1",

    "toolTitle": "blue",
    "toolOutput": "fgSecondary",

    "mdHeading": "fg",
    "mdLink": "blue",
    "mdLinkUrl": "muted",
    "mdCode": "cyan",
    "mdCodeBlock": "fg",
    "mdCodeBlockBorder": "borderMuted",
    "mdQuote": "fgSecondary",
    "mdQuoteBorder": "border",
    "mdHr": "borderMuted",
    "mdListBullet": "cyan",

    "toolDiffAdded": "green",
    "toolDiffRemoved": "red",
    "toolDiffContext": "fgSecondary",

    "syntaxComment": "muted",
    "syntaxKeyword": "purple",
    "syntaxFunction": "blue",
    "syntaxVariable": "fg",
    "syntaxString": "green",
    "syntaxNumber": "orange",
    "syntaxType": "cyan",
    "syntaxOperator": "fgSecondary",
    "syntaxPunctuation": "fgSecondary",

    "thinkingOff": "dim",
    "thinkingMinimal": "muted",
    "thinkingLow": "fgSecondary",
    "thinkingMedium": "blue",
    "thinkingHigh": "cyan",
    "thinkingXhigh": "purple",
    "thinkingMax": "amber",

    "bashMode": "amber"
  },
  "export": {
    "pageBg": "#0A0A0A",
    "cardBg": "#141414",
    "infoBg": "#1A1A1A"
  }
}
```

---

## 4.3 `grok-build.json` (Ultra-Minimalist Variant)

Designed for users seeking the strictest Grok-like monochrome simplicity:

- **Syntax:** Reduced strictly to monochromatic white/gray with occasional blue/cyan accents.
- **Thinking:** Narrow, quiet progression from `dim` to `blue`.
- **Backgrounds:** Flat, unified `#141414` tool blocks.

```json
{
  "$schema": "https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json",
  "name": "grok-build",
  "vars": {
    "terminalBg": "#0A0A0A",
    "surface1": "#141414",
    "surface2": "#1A1A1A",
    "surface3": "#242424",

    "fg": "#E1E1E1",
    "fgSecondary": "#C8C8C8",
    "muted": "#6C6C6C",
    "dim": "#414141",

    "border": "#2E3035",
    "borderMuted": "#202226",

    "blue": "#7AA2F7",
    "cyan": "#7DCFFF",
    "amber": "#E0AF68",
    "purple": "#BB9AF7",
    "green": "#9ECE6A",
    "red": "#F7768E"
  },
  "colors": {
    "accent": "blue",

    "border": "border",
    "borderAccent": "blue",
    "borderMuted": "borderMuted",

    "success": "green",
    "error": "red",
    "warning": "amber",

    "muted": "fgSecondary",
    "dim": "dim",
    "text": "",
    "thinkingText": "muted",

    "selectedBg": "surface3",
    "scrollbarThumb": "border",

    "searchMatchBg": "surface3",
    "searchMatchText": "fg",

    "userMessageBg": "surface2",
    "userMessageText": "fg",

    "customMessageBg": "surface1",
    "customMessageText": "fg",
    "customMessageLabel": "amber",

    "toolPendingBg": "surface1",
    "toolSuccessBg": "surface1",
    "toolErrorBg": "surface1",

    "toolTitle": "blue",
    "toolOutput": "fgSecondary",

    "mdHeading": "fg",
    "mdLink": "blue",
    "mdLinkUrl": "muted",
    "mdCode": "cyan",
    "mdCodeBlock": "fg",
    "mdCodeBlockBorder": "borderMuted",
    "mdQuote": "fgSecondary",
    "mdQuoteBorder": "border",
    "mdHr": "borderMuted",
    "mdListBullet": "blue",

    "toolDiffAdded": "green",
    "toolDiffRemoved": "red",
    "toolDiffContext": "fgSecondary",

    "syntaxComment": "muted",
    "syntaxKeyword": "blue",
    "syntaxFunction": "fg",
    "syntaxVariable": "fg",
    "syntaxString": "fgSecondary",
    "syntaxNumber": "fgSecondary",
    "syntaxType": "cyan",
    "syntaxOperator": "muted",
    "syntaxPunctuation": "muted",

    "thinkingOff": "dim",
    "thinkingMinimal": "dim",
    "thinkingLow": "muted",
    "thinkingMedium": "fgSecondary",
    "thinkingHigh": "blue",
    "thinkingXhigh": "cyan",
    "thinkingMax": "amber",

    "bashMode": "amber"
  },
  "export": {
    "pageBg": "#0A0A0A",
    "cardBg": "#141414",
    "infoBg": "#1A1A1A"
  }
}
```

---

# 5. Phase 2 — `pi-grok-build` UI Extension

The Extension layer transforms Pi from a standard conversational CLI into an elegant Grok Build workspace.

## 5.1 Extension Architecture & File Structure

```text
extension/
├── index.ts        # Entrypoint registering UI lifecycle handlers
├── footer.ts       # Single-line Grok-style footer renderer
├── header.ts       # Clean workspace header
├── status.ts       # Compact status badges & working state controller
└── package.json    # Extension manifest
```

## 5.2 Custom Footer Specification

### Target Layout (Standard Terminal Width)
```text
~/my-project  main · claude-3.7-sonnet · 48k/200k (24%) · ✻ high · ● working (3.1s)
```

### Collapsed Layout (Narrow Terminal Width < 80 cols)
```text
main · sonnet-3.7 · 24% · ● working
```

### Hierarchy & Responsive Dropping Priority
1. `Working / Execution State` (Always visible)
2. `Active Model Name`
3. `Git Branch`
4. `Context Usage / Percentage`
5. `Thinking Level`
6. `Project Directory / CWD` (First to hide on narrow screens)

### Color Hierarchy in Footer
- **Working indicator:** `#7AA2F7` (Blue) or `#9ECE6A` (Green)
- **Active metrics:** `#E1E1E1` (Primary white)
- **Secondary labels:** `#6C6C6C` (Muted gray)
- **Separators (`·` / `│`):** `#414141` (Dim)

---

## 5.3 Working & Thinking State Controller

- Intercept `setWorkingMessage`:
  - Suppress verbose paragraphs like *"Thinking about your codebase..."*
  - Output clean Grok-style tokens:
    - `● thinking (1.4s)` during reasoning
    - `● running bash...` during command execution
    - `● editing file...` during code modification
    - `● idle` when awaiting user prompt

---

# 6. Phase 3 — Workflow & Output Interaction Guidelines

To match the precision and density of Grok Build in agent responses:

### 6.1 Four-Stage Execution Flow
1. **Plan:** Concise bullet-point checklist of intended modifications.
2. **Search / Inspect:** Targeted file reads and grep lookups without verbose commentary.
3. **Build:** Direct, surgical code changes.
4. **Verify & Review:** Summary of tests run and diff verification.

### 6.2 Zero Conversational Filler
- Avoid introductory chatter (*"Sure, I can help you with that! Let's get started..."*).
- Deliver findings in clean, structured Markdown tables and bulleted lists.

---

# 7. Validation & Acceptance Criteria

### AC-01: GrokNight Palette Compliance
- Canvas relies on `#0A0A0A` / `#141414` / `#242424` neutral dark values.
- Primary text is `#E1E1E1`, secondary text `#C8C8C8`, comments `#6C6C6C`.
- TokyoNight accents (`#7AA2F7`, `#7DCFFF`, `#E0AF68`, `#9ECE6A`, `#BB9AF7`, `#F7768E`) used with strict semantic discipline.

### AC-02: Instant Diff Readability
- Added lines (`#9ECE6A`) and removed lines (`#F7768E`) distinguish additions/deletions within 1 second.
- Context lines remain `#C8C8C8` on `#141414`.

### AC-03: Subdued Thinking Hierarchy
- Thinking body text uses `#6C6C6C`, visibly receding behind final assistant output.

### AC-04: Schema Integrity
- 100% of Pi's 51 required theme tokens + 4 optional tokens defined explicitly without schema validation errors.

### AC-05: Extension Resilience
- If Phase 2 Extension encounters runtime issues, Pi continues working seamlessly with fallback UI.

---

# 8. Implementation Roadmap

```text
[v0.1.0] Phase 1 MVP (Complete)
  └── Initial theme drafts, install/uninstall scripts, validation.

[v0.2.0] All 3 Phases Complete (Current)
  ├── Phase 1: Rebuilt grok-build-coding.json and grok-build.json with official GrokNight palette.
  ├── Phase 2: Built full UI presentation extension (index.ts, footer.ts, header.ts, status.ts, package.json).
  └── Phase 3: Created guidelines.md (Plan → Search → Build → Verify interaction standard).
```