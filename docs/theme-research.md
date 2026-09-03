# Pi Theme Research: Best-Made Themes and Takeaways for pi-grok-theme

**Date:** 2026-09-02
**Scope:** Investigate well-executed themes for the Pi Coding Agent (https://github.com/earendil-works/pi, npm org `@earendil-works`) and extract concrete, actionable takeaways for improving `pi-grok-theme`. Primary sources only: installed package source code, official docs, GitHub repos, npm/pi.dev package pages.

---

## 1. Theme Engine Capabilities — What a Theme Can and Cannot Control

### What a theme JSON can control (51 required + 4 optional tokens)

Source: `node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme-schema.json` and `docs/themes.md`

| Category | Tokens | Count |
|---|---|---|
| **Core UI** | `accent`, `border`, `borderAccent`, `borderMuted`, `success`, `error`, `warning`, `muted`, `dim`, `text`, `thinkingText` | 11 |
| **Backgrounds & Content** | `selectedBg`, `scrollbarThumb` *(opt)*, `searchMatchBg` *(opt)*, `searchMatchText` *(opt)*, `userMessageBg`, `userMessageText`, `customMessageBg`, `customMessageText`, `customMessageLabel`, `toolPendingBg`, `toolSuccessBg`, `toolErrorBg`, `toolTitle`, `toolOutput` | 11 req + 3 opt |
| **Markdown** | `mdHeading`, `mdLink`, `mdLinkUrl`, `mdCode`, `mdCodeBlock`, `mdCodeBlockBorder`, `mdQuote`, `mdQuoteBorder`, `mdHr`, `mdListBullet` | 10 |
| **Tool Diffs** | `toolDiffAdded`, `toolDiffRemoved`, `toolDiffContext` | 3 |
| **Syntax Highlighting** | `syntaxComment`, `syntaxKeyword`, `syntaxFunction`, `syntaxVariable`, `syntaxString`, `syntaxNumber`, `syntaxType`, `syntaxOperator`, `syntaxPunctuation` | 9 |
| **Thinking Level Borders** | `thinkingOff`, `thinkingMinimal`, `thinkingLow`, `thinkingMedium`, `thinkingHigh`, `thinkingXhigh`, `thinkingMax` *(opt)* | 6 req + 1 opt |
| **Bash Mode** | `bashMode` | 1 |
| **HTML Export** *(optional section)* | `export.pageBg`, `export.cardBg`, `export.infoBg` | 3 opt |

**Color value formats:** hex (`#RRGGBB`), 256-color index (0–255 int), variable reference (string key in `vars`), or empty string `""` for terminal default.
Source: `theme-schema.json` `$defs.colorValue`

### What requires an extension (cannot be done via theme JSON alone)

Source: `theme.d.ts`, `theme-controller.d.ts`, and pi-grok-theme's own `docs/development-notes.md` (坑 #1, #6)

| Capability | Mechanism | Discovered by |
|---|---|---|
| **Editor border color** | Driven by `thinkingLevel` tokens via `getThinkingBorderColor(level)`, not `border`/`borderAccent`. `updateEditorBorderColor()` in `interactive-mode.js` overrides the initial `borderMuted` on session start. | pi-grok-theme dev notes 坑 #1 |
| **Terminal cursor color** | OSC 12 escape sequence (`\x1b]12;rgb:RR/GG/BB\x07`); restore via OSC 112. Not a theme token. | pi-grok-theme `cursor.ts` |
| **Prompt arrow character** | Requires `ctx.ui.setEditorComponent()` to swap the entire editor component. | pi-grok-theme README "Known Limitations" |
| **Window title** | `ctx.ui.setTitle()` API; core may overwrite on session rename/switch. | pi-grok-theme `index.ts` |
| **Footer / statusline** | Extension API: `installFooter()` or equivalent; not a theme token. | pi-grok-theme `footer.ts` |
| **Working state messages** | Intercept `ctx.ui.setWorkingMessage()`. | pi-grok-theme `status.ts` |
| **Hidden thinking label** | `ctx.ui.setHiddenThinkingLabel()`. | pi-grok-theme `index.ts` |
| **Auto light/dark switching** | System appearance detection (e.g. `osascript` on macOS); requires an extension. | pi-theme-vitesse extension |

### Theme discovery locations

Source: `docs/themes.md` and https://pi.dev/docs/latest/themes

- Built-in: `dark`, `light`
- Global: `~/.pi/agent/themes/*.json`
- Project: `.pi/themes/*.json` (only after project is trusted)
- Packages: `themes/` directories or `pi.themes` entries in `package.json`
- Settings: `themes` array with files or directories
- CLI: `--theme <path>` (repeatable); `--use-theme <name>` for one-run; `--no-themes` to disable

---

## 2. Built-in Pi Themes

Source: `node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/dark.json` and `light.json` (pi v0.84.2)

| Theme | Palette Character | Notable Choices |
|---|---|---|
| **`dark`** | VS Code-derived dark with teal accent (`#8abeb7`), blue borders (`#5f87ff`), cyan highlights (`#00d7ff`). Syntax colors closely match VS Code Dark+ (e.g. `syntaxKeyword: #569CD6`, `syntaxString: #CE9178`). | Uses `vars` with 16 named colors; all 51 required + 4 optional tokens defined (including `scrollbarThumb`, `searchMatchBg`, `searchMatchText`, `thinkingMax`). Has `export` section. Thinking levels progress from `darkGray` → blue → purple → magenta → pink (`#ff5fff`). `bashMode` = green. |
| **`light`** | Clean light theme with teal accent (`#5a8080`), blue borders (`#547da7`). Syntax colors match VS Code Light+ (e.g. `syntaxKeyword: #0000FF`, `syntaxString: #A31515`). | 15 `vars`; all 51+4 tokens defined. `export` section with `pageBg: #f8f8f8`, `cardBg: #ffffff`. Thinking levels: `lightGray` → blue → teal → purple → magenta. `bashMode` = green. |

**Key observation:** Both built-in themes define all 55 tokens (51 required + 4 optional) explicitly and include the `export` section. They use `vars` for all color definitions, referencing variables consistently in `colors`. This is the reference standard.

---

## 3. Community Themes

### 3.1 Summary Table

| Repo / npm Package | Author | What It Includes | Polish Assessment | Adoption Signals |
|---|---|---|---|---|
| **hasit/pi-community-themes** (GitHub, v0.5.0) | hasit (Hasit Mistry) + 2 contributors | 18 themes across 8 families: atom-one (light/dark), catppuccin (4 variants), dracula, gruvbox (6 variants: light/dark × soft/medium/hard), macbook-neo (8 variants), material-palenight, nord, solarized (light/dark). Preview PNG for every theme. | High. Well-known palette ports (Catppuccin, Gruvbox, Nord, Solarized, Dracula). Per-theme screenshots in `assets/previews/`. Clean `pi.themes` manifest. 26 commits, 7 releases, versioned tags. | 30 stars, 5 forks. Published Aug 28 2026. |
| **isashi/awesome-pi-themes** (npm: `awesome-pi-themes`) | isashi | 46 original dark themes with live browser preview (https://isashi.github.io/awesome-pi-themes/). Screenshot JPG for every theme. CI (GitHub Actions, Node 24). | Very high. Standout feature: interactive web preview simulating the Pi terminal UI. 52 commits, 26 tagged releases. Creative original palettes (starry-night, neon-sakura, cosmic-lagoon, etc.). `npm run check` validation + `npm run build` for static site. | 9 stars. npm package. Featured in pi discussion #7213. Topics: pi-coding-agent-theme, pi-theme, pi-themes. |
| **luongnv89/pi-extensions** (GitHub + npm) | luongnv89 (Luong NGUYEN) + 2 contributors | 12 extensions + 1 skill + 3 themes (neon-green, neon-green-light, opencode). Notable extensions: `statusline-pi` (footer: git, PR, context, tok/s, cost, CPU/MEM), `timestamp-pi`, `cache-warm`, `subagents-pi`. | Very high. Most comprehensive pi extension collection. Full OSS setup (CONTRIBUTING, SECURITY, DEVELOPMENT, DECISIONS, CODE_REVIEW). One-package-per-extension architecture. `install.sh` with auto-discovery. 102 commits, 3 releases. | 105 stars, 7 forks. Very active (commits within hours of research date). |
| **@spences10/pi-themes** (npm) | spences10 | 11 themes: Catppuccin Mocha, Dracula, Gruvbox Dark, Night Owl, Neon Afterglow, Neon Noir, Nord, One Dark, Rosé Pine, Solarized Dark, Tokyo Night. Part of "my-pi" monorepo (Vite+ workspace). | High. Preview image. Clean docs about upstream Pi boundary (hot-reload only applies to global dir, not package themes). 0 dependencies, 0 peers. | 1,538 downloads/mo, 271/wk. Published Jul 20 2026. |
| **pi-theme-vitesse** (npm, v0.0.1) | hannoeru | 2 themes (vitesse-dark, vitesse-light) + extension for macOS auto-switching via `osascript` polling every 2s. | Medium. Small package (9.3 KB). Notable for being the only theme package that ships an auto light/dark switching extension. Adapts antfu/vscode-theme-vitesse palette. | Published Jun 2 2026. Low downloads (v0.0.1). |
| **@bacnh85/pi-themes** (npm, v0.1.0) | bacnh85 | Ayu-based themes: dark, mirage, light variants. | Medium. 3 variants from a recognized palette family. | Published Aug 8 2026. |
| **@ifi/oh-pi-themes** (npm, v0.5.1) | ifi | Color themes: cyberpunk, nord, gruvbox, tokyo-night, catppuccin, and more. | Medium. Multi-palette collection, 5+ releases. | Published Apr 28 2026. |
| **@firstpick/pi-themes-bundle** (npm) | firstpick | Firstpick's custom Pi coding agent themes. | Unknown (not deeply inspected). | Published Jul 24 2026. |
| **@smoose/pi-themes** (npm) | smoose | Theme pack with file-based theme switching. | Unknown (not deeply inspected). | Published May 29 2026. |

### 3.2 Detailed Quality Assessment of Noteworthy Themes

#### hasit/pi-community-themes — `catppuccin-mocha.json`

Source: https://raw.githubusercontent.com/hasit/pi-community-themes/main/themes/catppuccin-mocha.json

- **Token coverage:** All 51 required tokens defined. Missing 4 optional tokens: `thinkingMax` (falls back to `thinkingXhigh`), `scrollbarThumb`, `searchMatchBg`, `searchMatchText` (all fall back to `selectedBg`/`text`). Has `export` section.
- **vars discipline:** 17 vars, all referenced in `colors`. Clean naming (`bg`, `panel`, `panelAlt`, `selected`, `border`, `accent`, `cyan`, `green`, `red`, `yellow`, `orange`, `purple`, `text`, `muted`, `dim`, `toolSuccessBg`, `toolErrorBg`).
- **Dark/light:** Multiple families have both (atom-one, gruvbox, solarized, macbook-neo).
- **Schema URL:** Points to `badlogic/pi-mono` (old repo path) instead of `earendil-works/pi`. Minor staleness issue.
- **Extension:** None. Pure theme JSON package.
- **Docs:** Per-theme preview screenshots. README with install instructions and theme list.

#### isashi/awesome-pi-themes — `starry-night.json`

Source: https://raw.githubusercontent.com/isashi/awesome-pi-themes/main/themes/starry-night.json

- **Token coverage:** All 51 required tokens defined. `thinkingMax` IS explicitly defined (goes beyond minimum). Missing `scrollbarThumb`, `searchMatchBg`, `searchMatchText` (use fallbacks). Has `export` section.
- **vars discipline:** 18 vars with descriptive names (`accent`, `accentSoft`, `accentDeep`, `secondary`, `secondaryDeep`, `ink`, `muted`, `dim`, `bgPanel`, `bgPanelAlt`, `bgSelected`, `bgTool`, `bgSuccess`, `bgError`, `borderSubtle`, `borderSoft`). Rich layering with soft/deep variants.
- **Dark only:** 46 dark themes, no light variants.
- **Schema URL:** Correct (`earendil-works/pi`).
- **Extension:** None. Pure theme JSON package with web preview tool.
- **Docs:** Live browser preview (GitHub Pages), per-theme JPG screenshots, CHANGELOG, CONTRIBUTING, SECURITY. CI pipeline.

#### pi-grok-theme — `grok-build-coding.json` (self-assessment baseline)

Source: `/home/tcuni-claw/pi/pi-grok-theme/themes/grok-build-coding.json`

- **Token coverage:** All 51 required + ALL 4 optional tokens explicitly defined (`thinkingMax`, `scrollbarThumb`, `searchMatchBg`, `searchMatchText`). Has `export` section. **Most complete token coverage of any theme examined.**
- **vars discipline:** 15 vars, all referenced. Named after semantic roles (`terminalBg`, `surface1-3`, `fg`, `fgSecondary`, `muted`, `dim`, `border`, `borderMuted`, `blue`, `cyan`, `amber`, `purple`, `green`, `red`, `orange`).
- **Dark + light:** 3 themes (coding dark, minimal dark, day light).
- **Extension:** Full UI extension (footer, header, cursor OSC 12, status controller, `/grok` commands). **Only theme package examined that ships both themes AND a presentation extension.**
- **Docs:** Bilingual README (EN + zh-CN), SPEC.md, development-notes.md, guidelines.md, tests.

---

## 4. What Good Looks Like — Quality Criteria for a Pi Theme Package

Synthesized from the best community themes and the built-in reference:

### 4.1 Token Coverage (Table Stakes)
- Define all 51 required tokens. No exceptions.
- Define all 4 optional tokens explicitly (`thinkingMax`, `scrollbarThumb`, `searchMatchBg`, `searchMatchText`) rather than relying on fallbacks. This is what the built-in themes do and what pi-grok-theme does.
- Include the `export` section (`pageBg`, `cardBg`, `infoBg`) for HTML export fidelity.

### 4.2 vars / Color Layering Discipline
- Use `vars` for all color definitions; reference variables in `colors`, never inline hex in `colors`.
- Name vars semantically (surface layers, accent roles), not by hue alone.
- Maintain a coherent surface hierarchy (e.g. `surface0` < `surface1` < `surface2` < `surface3`) for backgrounds.
- Use 3+ accent colors with clear semantic roles (primary, secondary, warning, error, success).

### 4.3 Dark / Light Variants
- Ship both dark and light variants. The built-in themes do; the best community collections (hasit, @spences10) do. Light themes need darkened accents for WCAG AA contrast.
- Consider auto-switching (pi-theme-vitesse demonstrates the extension approach).

### 4.4 Thinking Level Progression
- Map `thinkingOff` through `thinkingMax` as a deliberate visual progression from subtle to prominent. The built-in dark theme goes gray → blue → purple → magenta → pink. pi-grok-theme goes borderMuted → border → dim → amber. Both are intentional hierarchies.

### 4.5 Documentation & Preview
- Per-theme screenshots (hasit does PNG, isashi does JPG + live web preview).
- Install instructions with both `pi install` and manual `settings.json` approaches.
- List of included themes with one-line descriptions.
- Bilingual README if targeting international audience (pi-grok-theme does EN + zh-CN).

### 4.6 Package Hygiene
- Correct `$schema` URL pointing to `earendil-works/pi` (not stale `badlogic/pi-mono`).
- `pi.themes` manifest entry in `package.json`.
- `pi-package` and `pi-theme` npm keywords for gallery discoverability.
- Versioned releases with tags.
- CI validation (`npm run check` or equivalent schema validation).

### 4.7 Extension Integration (Differentiator)
- Shipping an extension alongside themes is rare and high-value. Only pi-grok-theme and pi-theme-vitesse do this.
- OSC 12 cursor color sync is a unique differentiator (only pi-grok-theme).
- Footer/statusline extensions are the most popular extension type (luongnv89's statusline-pi, pi-signal-footer, pi-powerline-footer).

---

## 5. Gaps & Takeaways for pi-grok-theme

### 5.1 Where pi-grok-theme is already ahead (honest assessment)

1. **Most complete token coverage:** pi-grok-theme is the only package examined that defines all 55 tokens (51 required + 4 optional) explicitly across all 3 themes. Even the built-in themes do this, but no community package matches.
2. **Only theme + extension hybrid:** No other community theme package ships both JSON themes AND a full presentation extension (footer, header, cursor, status). pi-theme-vitesse ships an extension but only for auto-switching, not for UI presentation.
3. **OSC 12 cursor sync:** Unique feature. No other theme package does this.
4. **Bilingual docs:** EN + zh-CN README. Only package examined with this.
5. **Workflow guidelines:** Phase 3 `guidelines.md` (Plan → Search → Build → Verify) is unique among theme packages.
6. **Development notes:** `docs/development-notes.md` with detailed gotchas (thinkingLevel border mechanism, OSC 12, contrast calibration) is exceptional documentation that no other theme package has.

### 5.2 Concrete, prioritized improvements

| Priority | Takeaway | Rationale | Source |
|---|---|---|---|
| **P1** | **Add per-theme screenshots** to README. Render each of the 3 themes (grok-build-coding, grok-build, grok-build-day) as PNG/JPG showing tool output, diffs, markdown, syntax highlighting. | hasit and isashi both provide per-theme screenshots. This is the #1 factor for theme adoption — users want to see before installing. pi-grok-theme's README has only a text-art mockup, no real screenshots. | hasit/pi-community-themes `assets/previews/`, isashi/awesome-pi-themes `docs/screenshots/` |
| **P2** | **Add a live or static web preview** (single HTML page showing all 3 themes side by side, similar to isashi's GitHub Pages preview). The repo already has `docs/PROTOTYPE-optimizations.html` — extend this concept. | isashi's browser preview is a standout differentiator cited in the pi discussion. It lets users evaluate before installing. | isashi/awesome-pi-themes `preview-themes-web.js`, `docs/index.html` |
| **P3** | **Add `pi-package` and `pi-theme` npm keywords** and ensure the package is listed on pi.dev/packages. Check if pi-grok-theme is discoverable in the pi package gallery. | luongnv89/pi-extensions explicitly added `pi-package` keyword for gallery discoverability. The pi.dev/packages catalog is the primary discovery surface. | luongnv89/pi-extensions commit `eb053ea`, pi.dev/packages |
| **P4** | **Add a CI workflow** that validates all theme JSON files against `theme-schema.json` on push. A simple `ajv` or `node --test` check. | isashi has CI (GitHub Actions, Node 24) running `npm run check`. pi-grok-theme has `test/test.js` but no CI workflow file. | isashi/awesome-pi-themes `.github/workflows/`, `npm run check` |
| **P5** | **Consider auto light/dark switching** via a lightweight extension that detects terminal background or system appearance. Pi supports `lightTheme/darkTheme` syntax natively (`pi --use-theme light/dark`), but automatic detection requires an extension. pi-theme-vitesse demonstrates the macOS `osascript` approach. | pi-theme-vitesse is the only package doing this. Adding it would make pi-grok-theme's 3-theme system more ergonomic (auto-switch between grok-build-coding and grok-build-day). | pi-theme-vitesse `extensions/vitesse-system-theme.ts`, pi docs `--use-theme light/dark` |
| **P6** | **Add a `CONTRIBUTING.md` and `CHANGELOG.md`** at repo root for OSS hygiene. | luongnv89 and isashi both have these. Improves contributor onboarding and release traceability. | luongnv89/pi-extensions, isashi/awesome-pi-themes |
| **P7** | **Consider porting additional recognized palettes** (Catppuccin, Gruvbox, Nord, Tokyo Night) as optional themes within the package. @spences10 and hasit both offer these familiar palettes, which are user magnets. | The most downloaded community theme packages all include Catppuccin and/or Tokyo Night. pi-grok-theme already uses TokyoNight accents but doesn't ship a "tokyo-night" named theme. | @spences10/pi-themes (11 themes, 1,538/mo downloads), hasit/pi-community-themes (18 themes) |

### 5.3 What NOT to change

- **Do not drop the extension.** It is pi-grok-theme's primary differentiator. No community theme-only package has this.
- **Do not simplify the token coverage.** Having all 55 tokens is correct and matches the built-in reference.
- **Do not change the `vars` naming.** The semantic naming (`surface1`, `fgSecondary`, etc.) is already best-practice.
- **Do not remove the workflow guidelines.** Unique among theme packages.

---

## 6. Verification Notes

### Verified directly from source
- Built-in theme JSON files: read from installed `node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/dark.json` and `light.json` (pi v0.84.2).
- Theme schema: read from `theme-schema.json` in the same directory.
- Theme docs: read from `node_modules/@earendil-works/pi-coding-agent/docs/themes.md` and https://pi.dev/docs/latest/themes (identical content).
- Theme engine types: read from `theme.d.ts` and `theme-controller.d.ts`.
- pi-grok-theme's own themes, extension, and docs: read from local repo at `/home/tcuni-claw/pi/pi-grok-theme/`.
- hasit/pi-community-themes: fetched GitHub repo page and `catppuccin-mocha.json` raw file.
- isashi/awesome-pi-themes: fetched GitHub repo page and `starry-night.json` raw file.
- luongnv89/pi-extensions: fetched GitHub repo page (full README).
- @spences10/pi-themes: fetched pi.dev package page.
- pi-theme-vitesse: fetched pi.dev package page and README (extension source URL returned 404 — could not verify the `osascript` polling code directly, relying on package description).

### Could not fully verify
- **pi-theme-vitesse extension source code:** The raw URL `https://raw.githubusercontent.com/hannoeru/pi-custom/main/packages/pi-theme-vitesse/extensions/vitesse-system-theme.ts` returned 404. The auto-switching behavior is described in the package README on pi.dev but the actual code was not inspected. The repo is `hannoeru/pi-custom` (a monorepo) and the file path may differ.
- **@bacnh85/pi-themes, @ifi/oh-pi-themes, @firstpick/pi-themes-bundle, @smoose/pi-themes:** Identified via web search and pi.dev package pages but not deeply inspected (theme JSON not fetched). Listed in the table for completeness but not assessed for token coverage.
- **npm download counts:** Only @spences10/pi-themes had visible download numbers (1,538/mo). Other packages' npm pages were not individually fetched for download metrics.
- **pi-grok-theme's presence on pi.dev/packages:** Not verified. The package may or may not be listed in the pi package gallery.
