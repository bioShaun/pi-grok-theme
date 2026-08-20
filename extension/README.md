# pi-grok-build Extension (Phase 2)

Presentation UI extension for [Pi Coding Agent](https://github.com/earendil-works/pi), bringing xAI Grok Build terminal workspace ergonomics to Pi.

---

## Features

- **Grok-Style Minimalist Footer:** Single-line metadata bar showing `CWD`, `Git Branch`, `Active Model`, `Context Usage / %`, `Thinking Level`, and live `Working State`.
- **Responsive Screen Adaptation:** Automatically adapts to wide vs. narrow terminals (< 80 columns) with a strict item-dropping priority hierarchy.
- **Quiet Working State Indicators:** Intercepts verbose thinking/tool execution messages into streamlined tokens (`● thinking (1.4s)`, `● running bash (3.2s)`, `● editing file...`).
- **Workspace Header:** Crisp Grok Build banner on startup and UI initialization.
- **`/grok` Slash Command:** Check theme status and toggle responsive footer modes.
- **Zero Behavioral Intrusion:** Pure presentation layer; never alters prompts, model calls, context logic, or tool execution.

---

## File Structure

```text
extension/
├── package.json    # Extension manifest (pi.extensions)
├── index.ts        # Lifecycle listeners and command registration
├── footer.ts       # Responsive single-line footer renderer
├── header.ts       # Workspace header banner
└── status.ts       # Working state controller and duration tracker
```

---

## Installation

### Method 1: Via install script
```bash
./scripts/install.sh --extension
```

### Method 2: Manual symlink / copy
Link or copy this directory to `~/.pi/agent/extensions/pi-grok-build`:

```bash
mkdir -p ~/.pi/agent/extensions
ln -s "$(pwd)/extension" ~/.pi/agent/extensions/pi-grok-build
```

Or add to your `~/.pi/agent/settings.json`:

```json
{
  "packages": [
    "./path/to/pi-grok-theme/extension"
  ]
}
```

---

## Commands

- `/grok` or `/grok info`: Display current workspace status, model, and active theme info.
- `/grok toggle`: Toggle footer mode between auto-responsive and always-compact.
