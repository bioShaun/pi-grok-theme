# 08: Enable direct theme switching

**What to build:** Let users list and activate bundled or installed themes directly from the Grok command, with completion, graceful failure, and immediate synchronization of all theme-dependent chrome.

**Blocked by:** 03: Make extension chrome theme-native; 06: Add the Grok working animation.

**Status:** resolved

- [x] The theme command lists installed themes and identifies the active theme.
- [x] Coding, minimal, and day aliases activate their bundled themes directly.
- [x] Installed theme names are offered through command argument completion.
- [x] Successful switching refreshes cursor policy, working-indicator styling, header, and footer.
- [x] A failed or unknown theme leaves the active theme unchanged and reports the host error.
- [x] Older Pi versions without the switching APIs receive the existing manual activation guidance.
- [x] Autocomplete does not change themes as an unsupported preview side effect.

## Comments

Implemented 2026-09-03.

- **Listing:** `/grok theme` with no argument uses `ctx.ui.getAllThemes()` (feature-detected), prints every installed theme, and marks the active one (`●` + `(active)`, active name from `ctx.ui.theme.name`); the footer-style hint advertises the aliases.
- **Switching:** aliases `coding`/`minimal`/`day` (plus the v0.3 aliases `dark`/`light` and full names) resolve to bundled themes; any other argument is treated as an installed theme name and passed to `ctx.ui.setTheme(name)`. On success the extension reapplies the named-theme cursor policy (OSC 12 for bundled matches, OSC 112 restore for third-party), re-applies the themed working-indicator frames, and requests a footer render — the footer/header read the live `ctx.ui.theme` per render, so all chrome synchronizes without reinstalling.
- **Failure paths:** a theme not present in `getAllThemes()` warns with the available names and never calls `setTheme`; a failing `setTheme` (or thrown host error) surfaces the returned error text and states the active theme is unchanged, with no cursor/indicator churn.
- **Older Pi:** without the switching APIs, both the listing and alias requests fall back to the exact v0.3 manual-activation guidance (`/settings`, settings.json, CLI flag).
- **Completion:** `getArgumentCompletions` on the `/grok` command offers subcommand keywords (`theme`-relevant aliases plus `footer`/`header`/`info`) and installed theme names, prefix-filtered. It reads the UI via the context captured at `session_start` (completions receive no `ExtensionContext`) and has zero side effects — no preview switching, per the spec's explicit non-requirement.
- **Tests (`test/theme-switch.test.js`, 7 new):** listing + active marking, all three aliases with cursor/indicator/render verification, third-party switching with cursor restore, host-failure reporting with no chrome churn, unknown-theme warning without calling `setTheme`, legacy-API fallback guidance, and completion contents/filtering with a `setTheme`-untouched assertion. Suite: 79 tests green, `tsc --noEmit` clean.

