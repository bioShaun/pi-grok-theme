/**
 * index.ts — Extension entry point for pi-grok-theme (Phase 2 UI Extension)
 *
 * Implements:
 * - Single-line Grok-style footer with responsive dropping priority
 * - Workspace header banner
 * - Compact working state controller and working message filtering
 * - Slash command `/grok` for status inspection and configuration
 * - Persistent footer preset + header toggle across sessions
 * - 100% crash resistance and graceful fallback
 */

import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import {
  installFooter,
  getGitBranch,
  type FooterConfig,
  type FooterPreset,
  type SeparatorStyle,
  DEFAULT_FOOTER_CONFIG,
  FOOTER_PRESETS,
  SEPARATOR_STYLES,
  separatorForStyle,
} from "./footer.ts";
import { installHeader } from "./header.ts";
import { WorkingStateController } from "./status.ts";
import { createChromeTheme } from "./chrome-theme.ts";
import { RenderClock, type RenderClockOptions } from "./render-clock.ts";
import { applyCursorPolicy, resetCursorColor, resolveCursorPolicy } from "./cursor.ts";
import { VERSION } from "./version.ts";
import { applyWorkingIndicator, restoreWorkingIndicator } from "./working-indicator.ts";
import { getGlyphs, GLYPH_DENSITIES, type GlyphDensity } from "./glyphs.ts";
import { loadSettings, saveSettings, type GrokThemeSettings } from "./settings.ts";

function readThinkingLevel(ctx: ExtensionContext): string | undefined {
  try {
    const direct = ctx as unknown as { getThinkingLevel?: () => string; thinkingLevel?: string };
    return direct.getThinkingLevel?.() ?? direct.thinkingLevel ?? undefined;
  } catch {
    return undefined;
  }
}

/** Live active theme name, or undefined when Pi does not expose one. */
function activeThemeName(ctx: ExtensionContext): string | undefined {
  try {
    return ctx.ui?.theme?.name ?? undefined;
  } catch {
    return undefined;
  }
}

/** Live active Theme instance for chrome styling, or undefined for the shim. */
function activeTheme(ctx: ExtensionContext): Theme | undefined {
  try {
    return ctx.ui?.theme ?? undefined;
  } catch {
    return undefined;
  }
}

export interface RegisterOptions {
  renderClock?: RenderClockOptions;
  /** Override settings file path (tests). Defaults to `~/.pi/agent/pi-grok-theme.json`. */
  settingsPath?: string;
}

export default function registerGrokBuildExtension(
  pi: ExtensionAPI,
  options: RegisterOptions = {},
): void {
  const statusController = new WorkingStateController();
  let footerHandle: { dispose: () => void; requestRender: () => void } | null = null;
  let headerHandle: { dispose: () => void } | undefined;
  const config: FooterConfig = { ...DEFAULT_FOOTER_CONFIG };
  let showHeader = false;
  const settingsPath = options.settingsPath;

  let glyphDensity: GlyphDensity = "unicode";
  let separatorStyle: SeparatorStyle = "dot";

  const persistPrefs = (): void => {
    const payload: GrokThemeSettings = {
      footerPreset: config.preset,
      showHeader,
      glyphDensity,
      separatorStyle,
    };
    saveSettings(payload, settingsPath);
  };

  const applyPersistedPrefs = (): void => {
    const loaded = loadSettings(settingsPath);
    config.preset = loaded.footerPreset;
    showHeader = loaded.showHeader;
    glyphDensity = loaded.glyphDensity;
    separatorStyle = loaded.separatorStyle;
    config.glyphDensity = glyphDensity;
    config.separator = separatorForStyle(separatorStyle);
  };

  // Only this module owns timers (spec §5.3): one coalescing render clock
  // drives elapsed-time refreshes while a turn is active.
  const renderClock = new RenderClock({
    requestRender: () => footerHandle?.requestRender(),
    ...options.renderClock,
  });

  // Track original setWorkingMessage to intercept gracefully
  let originalSetWorkingMessage: ((message?: string) => void) | undefined;
  let unwrapSetWorkingMessage: ((message?: string) => void) | undefined;

  // Most recently seen UI context — command argument completions receive no
  // ExtensionContext, so they read the live UI from here.
  let uiCtx: ExtensionContext | undefined;

  /** Installed theme names via the live UI context (feature-detected). */
  function installedThemeNames(): string[] | null {
    try {
      const ui = uiCtx?.ui;
      if (typeof ui?.getAllThemes !== "function") return null;
      return ui.getAllThemes().map((t) => t.name);
    } catch {
      return null;
    }
  }

  /**
   * Hook into UI context when session starts or changes
   */
  function setupUi(ctx: ExtensionContext): void {
    if (!ctx.hasUI) return;

    try {
      // Install Footer
      footerHandle?.dispose();
      footerHandle = installFooter(ctx, statusController, config);

      // Header is opt-in to match Grok Build's clean fullscreen canvas
      headerHandle?.dispose();
      if (showHeader) {
        headerHandle = installHeader(ctx);
      } else {
        headerHandle = undefined;
      }

      // Intercept setWorkingMessage for concise Grok status tokens
      if (typeof ctx.ui?.setWorkingMessage === "function" && !originalSetWorkingMessage) {
        unwrapSetWorkingMessage = ctx.ui.setWorkingMessage;
        originalSetWorkingMessage = ctx.ui.setWorkingMessage.bind(ctx.ui);
        ctx.ui.setWorkingMessage = (message?: string) => {
          try {
            const filtered = statusController.filterWorkingMessage(message);
            originalSetWorkingMessage?.(filtered);
          } catch {
            originalSetWorkingMessage?.(message);
          }
        };
      }
    } catch (err) {
      console.error("[pi-grok-theme] Failed to initialize UI:", err);
    }
  }

  // Lifecycle Events
  pi.on("session_start", (_event, ctx) => {
    try {
      uiCtx = ctx;
      statusController.endTurn();
      renderClock.stop(); // never inherit a stale clock from a previous session
      applyPersistedPrefs();
      // Named-theme cursor policy: bundled darks get Grok amber, the day
      // theme its darker amber, unknown themes keep the terminal default.
      applyCursorPolicy(activeThemeName(ctx));
      // Grok Braille working indicator (feature-detected; no-op on older Pi).
      applyWorkingIndicator(ctx);
      setupUi(ctx);

      // Shell chrome: grok-style window title + compact hidden-thinking label.
      // Applied once here; core's updateTerminalTitle() may overwrite the title on
      // session rename/switch (known limitation, see README). Never reset on
      // shutdown — core owns the title after us.
      if (ctx.hasUI && ctx.ui) {
        const glyphs = getGlyphs();
        if (typeof ctx.ui.setTitle === "function") {
          const branch = getGitBranch(ctx.cwd) ?? "no-git";
          ctx.ui.setTitle(`${glyphs.brandMark} grok · ${path.basename(ctx.cwd)} · ${branch}`);
        }
        if (typeof ctx.ui.setHiddenThinkingLabel === "function") {
          ctx.ui.setHiddenThinkingLabel(`${glyphs.disclosureArrow} thought`);
        }
      }
    } catch (err) {
      console.error("[pi-grok-theme] session_start error:", err);
    }
  });

  pi.on("session_shutdown", (_event, ctx) => {
    try {
      statusController.endTurn();
      renderClock.stop(); // no timers may survive shutdown
      if (ctx?.ui && unwrapSetWorkingMessage) {
        try {
          originalSetWorkingMessage?.(undefined);
          ctx.ui.setWorkingMessage = unwrapSetWorkingMessage;
        } catch {
          // ignore
        }
        originalSetWorkingMessage = undefined;
        unwrapSetWorkingMessage = undefined;
      }
      resetCursorColor(); // OSC 112: restore terminal default cursor color
      restoreWorkingIndicator(ctx); // restore Pi's default working indicator
      footerHandle?.dispose();
      footerHandle = null;
      headerHandle?.dispose();
      headerHandle = undefined;
    } catch (err) {
      console.error("[pi-grok-theme] session_shutdown error:", err);
    }
  });

  // Turn & Message Lifecycle
  pi.on("message_start", (event, ctx) => {
    try {
      if (event.message.role === "assistant") {
        statusController.startTurn();
        statusController.startThinking();
        // Turn boundary: start the clock exactly once, render immediately.
        renderClock.start();
        footerHandle?.requestRender();
      }
    } catch (err) {
      console.error("[pi-grok-theme] message_start error:", err);
    }
  });

  pi.on("message_update", (event, _ctx) => {
    try {
      if (event.message.role === "assistant") {
        statusController.startStreaming();
        // Per-token updates mark chrome dirty; the clock coalesces renders.
        renderClock.markDirty();
      }
    } catch (err) {
      console.error("[pi-grok-theme] message_update error:", err);
    }
  });

  pi.on("message_end", (event, ctx) => {
    try {
      if (event.message.role === "assistant") {
        statusController.endTurn();
        renderClock.stop();
        originalSetWorkingMessage?.(undefined);
        // Final render with the settled state.
        footerHandle?.requestRender();
      }
    } catch (err) {
      console.error("[pi-grok-theme] message_end error:", err);
    }
  });

  // Thinking Level changes (e.g. /thinking command)
  pi.on("thinking_level_select", (_event, _ctx) => {
    try {
      footerHandle?.requestRender();
    } catch (err) {
      console.error("[pi-grok-theme] thinking_level_select error:", err);
    }
  });

  // Tool Execution Lifecycle
  pi.on("tool_execution_start", (event, _ctx) => {
    try {
      statusController.startTool(event.toolName);
      renderClock.markDirty();
    } catch (err) {
      console.error("[pi-grok-theme] tool_execution_start error:", err);
    }
  });

  pi.on("tool_execution_end", (event, _ctx) => {
    try {
      statusController.endTool(event.toolName);
      renderClock.markDirty();
    } catch (err) {
      console.error("[pi-grok-theme] tool_execution_end error:", err);
    }
  });

  // Register interactive slash command
  pi.registerCommand("grok", {
    description: "Inspect or configure pi-grok-theme theme and UI extension (/grok [info|status|theme|footer|toggle|header])",
    // Completion offers theme aliases and installed theme names. It only
    // suggests — switching themes as a preview side effect is unsupported and
    // never happens here (spec §4.6).
    getArgumentCompletions: (argumentPrefix) => {
      const raw = (argumentPrefix ?? "").trim().toLowerCase();
      const parts = raw.split(/\s+/).filter(Boolean);

      // /grok footer <preset|glyphs|sep> …
      if (parts[0] === "footer") {
        const sub = parts.slice(1);
        if (sub[0] === "glyphs") {
          const densPrefix = sub[1] ?? "";
          const items = GLYPH_DENSITIES
            .filter((d) => d.startsWith(densPrefix))
            .map((d) => ({ value: `footer glyphs ${d}`, label: d, description: "glyph density" }));
          return items.length > 0 ? items : null;
        }
        if (sub[0] === "sep") {
          const sepPrefix = sub[1] ?? "";
          const items = SEPARATOR_STYLES
            .filter((s) => s.startsWith(sepPrefix))
            .map((s) => ({ value: `footer sep ${s}`, label: s, description: "separator style" }));
          return items.length > 0 ? items : null;
        }
        const footerItems = [
          ...FOOTER_PRESETS.map((p) => ({ value: `footer ${p}`, label: p, description: "footer preset" })),
          { value: "footer glyphs", label: "glyphs", description: "glyph density unicode|nerd|ascii" },
          { value: "footer sep", label: "sep", description: "separator style" },
        ];
        const rest = raw.slice("footer".length).trim();
        const filtered = rest
          ? footerItems.filter(
              (item) =>
                item.label.startsWith(rest) ||
                item.value.toLowerCase().startsWith(`footer ${rest}`),
            )
          : footerItems;
        return filtered.length > 0 ? filtered : null;
      }

      const aliasItems = [
        { value: "coding", label: "coding", description: "grok-build-coding (dark, recommended)" },
        { value: "minimal", label: "minimal", description: "grok-build (dark, monochrome)" },
        { value: "day", label: "day", description: "grok-build-day (light)" },
        { value: "footer", label: "footer", description: "footer preset / glyphs / sep" },
        { value: "header", label: "header", description: "toggle the workspace header" },
        { value: "info", label: "info", description: "extension status" },
      ];
      const installed = installedThemeNames();
      const themeItems = (installed ?? []).map((name) => ({
        value: name,
        label: name,
        description: "installed theme",
      }));
      const all = [...aliasItems, ...themeItems];
      const filtered = raw
        ? all.filter((item) => item.value.toLowerCase().startsWith(raw))
        : all;
      return filtered.length > 0 ? filtered : null;
    },
    handler: async (args, ctx) => {
      const sub = (args || "").trim().toLowerCase();
      // Notifications ride the active theme when Pi exposes one.
      const chrome = createChromeTheme(activeTheme(ctx));
      const notify = (msg: string, type?: "info" | "warning" | "error") => {
        if (ctx.hasUI && typeof ctx.ui?.notify === "function") {
          ctx.ui.notify(msg, type);
        }
      };

      if (sub === "status" || sub === "info" || !sub) {
        const badge = statusController.getBadge();
        const glyphs = getGlyphs();
        const iconGlyph = badge.icon === "spinnerFrames" ? undefined : glyphs[badge.icon];
        const statusIcon = (typeof iconGlyph === "string" ? iconGlyph : undefined)
          ?? (badge.state === "idle" ? glyphs.idleDot : glyphs.workingDot);
        const statusLine = `${chrome.fg(badge.tone, statusIcon)} ${chrome.fg("muted", badge.label)}`;
        const themeName = activeThemeName(ctx) ?? "(unknown)";
        const cursorPolicy = resolveCursorPolicy(activeThemeName(ctx));
        const cursorLine = cursorPolicy.color
          ? `${cursorPolicy.color} (OSC 12)`
          : "terminal default (OSC 112 restore)";
        const msg = [
          chrome.bold(chrome.fg("accent", `π Grok Theme v${VERSION}`)),
          `${chrome.fg("muted", "Package:")} pi-grok-theme`,
          `${chrome.fg("muted", "Theme:")} ${themeName}`,
          `${chrome.fg("muted", "Cursor:")} ${cursorLine}`,
          `${chrome.fg("muted", "Footer:")} ${config.preset}`,
          `${chrome.fg("muted", "Header:")} ${showHeader ? "enabled" : "disabled"}`,
          `${chrome.fg("muted", "Status:")} ${statusLine}`,
          `${chrome.fg("muted", "Workspace:")} ${ctx.cwd}`,
          `${chrome.fg("muted", "Model:")} ${ctx.model?.name || ctx.model?.id || "default"}`,
          `${chrome.fg("muted", "Thinking:")} ${readThinkingLevel(ctx) ?? "off"}`,
        ].join("\n");
        notify(msg, "info");
        return;
      }

      if (sub === "theme" || sub.startsWith("theme ") || sub === "themes") {
        const themeArg = sub.replace(/^themes?/, "").trim();
        const aliasToTheme: Record<string, string> = {
          coding: "grok-build-coding",
          "grok-build-coding": "grok-build-coding",
          dark: "grok-build",
          minimal: "grok-build",
          "grok-build": "grok-build",
          day: "grok-build-day",
          light: "grok-build-day",
          "grok-build-day": "grok-build-day",
        };
        const switchingSupported = typeof ctx.ui?.setTheme === "function";

        // No argument: list installed themes and mark the active one.
        if (!themeArg) {
          if (switchingSupported) {
            const activeName = activeThemeName(ctx);
            const installed = installedThemeNames();
            const names = installed ?? ["grok-build-coding", "grok-build", "grok-build-day"];
            const lines = [
              chrome.bold(chrome.fg("accent", "π Grok Theme Themes")),
              ...names.map((name) => {
                const marker = name === activeName ? `${chrome.fg("success", "●")} ` : "  ";
                const suffix =
                  name === activeName ? ` ${chrome.fg("muted", "(active)")}` : "";
                return `${marker}${chrome.fg("text", name)}${suffix}`;
              }),
              ``,
              `${chrome.fg("dim", "Switch with /grok theme <name|alias> · aliases: coding, minimal, day")}`,
            ];
            notify(lines.join("\n"), "info");
          } else {
            // Older Pi without theme APIs: keep the v0.3 guidance.
            const msg = [
              chrome.bold(chrome.fg("accent", `π Grok Theme Themes (v${VERSION})`)),
              `  • ${chrome.fg("accent", "grok-build-coding")} ${chrome.fg("dim", "(Dark, TokyoNight syntax, Recommended)")}`,
              `  • ${chrome.fg("accent", "grok-build")} ${chrome.fg("dim", "(Dark, Minimal monochrome)")}`,
              `  • ${chrome.fg("warning", "grok-build-day")} ${chrome.fg("dim", "(Light, GrokDay clean canvas)")}`,
              ``,
              `${chrome.fg("muted", "Switch theme via:")}`,
              `  1. Run ${chrome.bold("/settings")} -> Theme`,
              `  2. In ${chrome.fg("dim", "~/.pi/agent/settings.json")}: {"theme": "grok-build-coding"}`,
              `  3. CLI flag: ${chrome.fg("dim", "pi --use-theme <name>")}`,
            ].join("\n");
            notify(msg, "info");
          }
          return;
        }

        const targetTheme = aliasToTheme[themeArg] ?? themeArg;

        // Older Pi without switching APIs: existing manual activation guidance.
        if (!switchingSupported) {
          const msg = [
            chrome.bold(chrome.fg("accent", `To activate ${targetTheme}:`)),
            `1. Run ${chrome.bold("/settings")} -> Theme -> Select ${chrome.fg("accent", targetTheme)}`,
            `2. Or update ${chrome.fg("dim", "~/.pi/agent/settings.json")}:`,
            `   {"theme": "${targetTheme}"}`,
          ].join("\n");
          notify(msg, "info");
          return;
        }

        // Unknown theme: warn without touching the active theme.
        const installed = installedThemeNames();
        if (installed && !installed.includes(targetTheme)) {
          notify(
            `Unknown theme "${themeArg}". Active theme unchanged. Available: ${installed.join(", ")}`,
            "warning",
          );
          return;
        }

        const result = ctx.ui.setTheme(targetTheme);
        if (result?.success) {
          // Synchronize every theme-dependent chrome piece immediately.
          applyCursorPolicy(targetTheme);
          applyWorkingIndicator(ctx);
          footerHandle?.requestRender(); // footer/header re-render from the live theme
          notify(`Theme switched to ${chrome.fg("accent", targetTheme)}`, "info");
        } else {
          notify(
            `Theme switch failed: ${result?.error ?? "unknown error"}. Active theme unchanged.`,
            "error",
          );
        }
        return;
      }

      if (sub === "footer" || sub.startsWith("footer ")) {
        const rest = sub.replace(/^footer/, "").trim();
        const parts = rest.split(/\s+/).filter(Boolean);

        if (parts.length === 0) {
          const presetDescriptions: Record<FooterPreset, string> = {
            default: "responsive hierarchy with all eligible segments",
            minimal: "model · context · status",
            full: "cwd · branch · model · context · thinking · turn time · extension statuses · status",
          };
          const msg = [
            chrome.bold(chrome.fg("accent", "Grok footer")),
            `${chrome.fg("muted", "Current:")} preset=${config.preset} ${chrome.fg("dim", `(${presetDescriptions[config.preset]})`)}`,
            `${chrome.fg("muted", "Glyphs:")} ${glyphDensity}`,
            `${chrome.fg("muted", "Separator:")} ${separatorStyle}`,
            `${chrome.fg("muted", "Presets:")} ${FOOTER_PRESETS.join(", ")}`,
            `${chrome.fg("dim", "Usage: /grok footer <minimal|default|full>")}`,
            `${chrome.fg("dim", "       /grok footer glyphs <unicode|nerd|ascii>")}`,
            `${chrome.fg("dim", "       /grok footer sep <dot|powerline-thin|slash|ascii>")}`,
          ].join("\n");
          notify(msg, "info");
          return;
        }

        if (parts[0] === "glyphs") {
          const densityArg = parts[1] as GlyphDensity | undefined;
          if (!densityArg || !(GLYPH_DENSITIES as readonly string[]).includes(densityArg)) {
            notify(
              `Unknown glyph density "${densityArg ?? ""}". Available: ${GLYPH_DENSITIES.join(", ")}`,
              "warning",
            );
            return;
          }
          glyphDensity = densityArg;
          config.glyphDensity = glyphDensity;
          persistPrefs();
          footerHandle?.requestRender();
          notify(`pi-grok-theme footer glyphs: ${densityArg}`, "info");
          return;
        }

        if (parts[0] === "sep") {
          const styleArg = parts[1] as SeparatorStyle | undefined;
          if (!styleArg || !(SEPARATOR_STYLES as readonly string[]).includes(styleArg)) {
            notify(
              `Unknown separator style "${styleArg ?? ""}". Available: ${SEPARATOR_STYLES.join(", ")}`,
              "warning",
            );
            return;
          }
          separatorStyle = styleArg;
          config.separator = separatorForStyle(styleArg);
          persistPrefs();
          footerHandle?.requestRender();
          notify(`pi-grok-theme footer sep: ${styleArg}`, "info");
          return;
        }

        // Preset: accept legacy "auto" as alias for "default" (one release).
        const rawPreset = parts[0] ?? "";
        const presetArg = rawPreset === "auto" ? "default" : rawPreset;
        if (!(FOOTER_PRESETS as readonly string[]).includes(presetArg)) {
          notify(`Unknown footer preset "${rawPreset}". Available: ${FOOTER_PRESETS.join(", ")}`, "warning");
          return;
        }

        config.preset = presetArg as FooterPreset;
        persistPrefs();
        footerHandle?.requestRender();
        notify(`pi-grok-theme footer preset: ${presetArg}`, "info");
        return;
      }

      if (sub === "header") {
        showHeader = !showHeader;
        persistPrefs();
        headerHandle?.dispose();
        if (showHeader) {
          headerHandle = installHeader(ctx);
        } else {
          headerHandle = undefined;
        }
        notify(`pi-grok-theme header: ${showHeader ? "enabled" : "disabled"}`, "info");
        return;
      }

      if (sub === "toggle" || sub === "compact") {
        config.compactThreshold = config.compactThreshold === 80 ? 9999 : 80;
        footerHandle?.requestRender();
        notify(
          `pi-grok-theme footer mode: ${config.compactThreshold > 1000 ? "always-compact" : "auto-responsive"}`,
          "info",
        );
        return;
      }

      notify(`Unknown subcommand "${sub}". Usage: /grok [info|status|theme|footer|toggle|header]`, "warning");
    },
  });
}
