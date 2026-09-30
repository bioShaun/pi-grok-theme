/**
 * index.ts — Extension entry point for pi-grok-theme (Phase 2 UI Extension)
 *
 * Implements:
 * - Single-line Grok-style footer with responsive dropping priority
 * - Workspace header banner
 * - Compact working state controller and working message filtering
 * - Slash command `/grok` for status inspection and configuration
 * - Persistent footer preset + header toggle across sessions
 * - Feature-detected host integration and graceful fallback
 */

import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import {
  installFooter,
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
import { resolveGlyphs, resolveGlyphDensity, GLYPH_DENSITIES, type GlyphDensity } from "./glyphs.ts";
import { loadSettings, saveSettings, type GrokThemeSettings, type HeaderStyle, type MotionMode } from "./settings.ts";

import { GitStatusProvider, type readGitStatus } from "./git-status.ts";

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

function isTerminalUi(ctx: ExtensionContext): boolean {
  return !!ctx.hasUI && ((ctx as ExtensionContext & { mode?: string }).mode ?? "tui") === "tui";
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
  gitReader?: typeof readGitStatus;
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

  let glyphDensity: GlyphDensity = "auto";
  let headerStyle: HeaderStyle = "compact";
  let motion: MotionMode = "normal";
  let indicatorSupported = false;
  let cursorTouched = false;
  let agentActive = false;
  let lastTimerLabel = "";
  let lastShellSignature = "";
  let git: GitStatusProvider | undefined;
  let separatorStyle: SeparatorStyle = "dot";

  const persistPrefs = () => {
    const payload: GrokThemeSettings = {
      footerPreset: config.preset,
      showHeader,
      glyphDensity,
      separatorStyle, headerStyle, motion,
    };
    return saveSettings(payload, settingsPath);
  };

  const applyPersistedPrefs = (): void => {
    const loaded = loadSettings(settingsPath);
    config.preset = loaded.footerPreset;
    showHeader = loaded.showHeader;
    glyphDensity = loaded.glyphDensity;
    separatorStyle = loaded.separatorStyle;
    headerStyle = loaded.headerStyle;
    motion = loaded.motion;
    syncConfig();
  };

  function syncConfig(): void {
    config.glyphDensity = glyphDensity;
    config.motion = motion;
    config.separator = separatorForStyle(separatorStyle, glyphDensity);
  }
  function requestImmediate(): void {
    lastTimerLabel = statusController.getBadge(Date.now(), motion).label;
    footerHandle?.requestRender();
  }
  function refreshGit(force = false): void {
    if (!uiCtx?.hasUI || !git) return;
    git.setContext(uiCtx.cwd, config.preset !== "minimal" && config.showGit);
    config.gitSnapshot = git.getSnapshot();
    if (config.preset === "minimal" && !showHeader && typeof uiCtx.ui?.setTitle !== "function") return;
    void git.refresh(force);
  }
  const renderClock = new RenderClock({
    ...options.renderClock,
    requestRender: () => {
      refreshGit();
      const label = statusController.getBadge(Date.now(), motion).label;
      if (motion !== "quiet" || label !== lastTimerLabel) {
        lastTimerLabel = label;
        footerHandle?.requestRender();
        options.renderClock?.requestRender?.();
      }
    },
  });

  // Track original setWorkingMessage to intercept gracefully
  let originalSetWorkingMessage: ((message?: string) => void) | undefined;
  let workingMessageOwner: ExtensionContext["ui"] | undefined;
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
  function updateHeader(ctx: ExtensionContext): void {
    headerHandle?.dispose();
    headerHandle = showHeader ? installHeader(ctx, { style: headerStyle, glyphDensity, showBranch: true, showModel: true, version: VERSION, getGitSnapshot: () => config.gitSnapshot ?? { state: "loading" } }) : undefined;
  }
  function updateShell(ctx: ExtensionContext): void {
    const glyphs = resolveGlyphs(glyphDensity);
    const branch = config.gitSnapshot?.branch;
    const signature = `${glyphs.brandMark}|${glyphs.disclosureArrow}|${ctx.cwd}|${branch ?? ""}`;
    if (ctx.hasUI && signature !== lastShellSignature) {
      ctx.ui.setHiddenThinkingLabel?.(`${glyphs.disclosureArrow} thought`);
      ctx.ui.setTitle?.(`${glyphs.brandMark} grok | ${path.basename(ctx.cwd)}${branch ? ` | ${branch}` : ""}`);
      lastShellSignature = signature;
    }
  }
  function updatePresentation(ctx: ExtensionContext): void {
    syncConfig();
    indicatorSupported = applyWorkingIndicator(ctx, glyphDensity, motion);
    updateHeader(ctx);
    updateShell(ctx);
    requestImmediate();
  }
  function restoreMessage(): void {
    if (workingMessageOwner && unwrapSetWorkingMessage) workingMessageOwner.setWorkingMessage = unwrapSetWorkingMessage;
    originalSetWorkingMessage = undefined;
    unwrapSetWorkingMessage = undefined;
    workingMessageOwner = undefined;
  }
  function setupUi(ctx: ExtensionContext): void {
    if (!ctx.hasUI) return;

    try {
      // Install Footer
      footerHandle?.dispose();
      footerHandle = installFooter(ctx, statusController, config);

      updateHeader(ctx);

      // Intercept setWorkingMessage for concise Grok status tokens
      if (typeof ctx.ui?.setWorkingMessage === "function" && !originalSetWorkingMessage) {
        workingMessageOwner = ctx.ui;
        unwrapSetWorkingMessage = ctx.ui.setWorkingMessage;
        originalSetWorkingMessage = ctx.ui.setWorkingMessage.bind(ctx.ui);
        ctx.ui.setWorkingMessage = (message?: string) => {
          try {
            const filtered = statusController.filterWorkingMessage(message, Date.now(), motion);
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
      restoreMessage();
      lastShellSignature = "";
      git?.dispose();
      uiCtx = ctx;
      agentActive = false;
      statusController.endTurn();
      renderClock.stop(); // never inherit a stale clock from a previous session
      applyPersistedPrefs();
      // Named-theme cursor policy: bundled darks get Grok amber, the day
      // theme its darker amber, unknown themes keep the terminal default.
      if (isTerminalUi(ctx)) {
        applyCursorPolicy(activeThemeName(ctx));
        cursorTouched = true;
      }
      // Grok Braille working indicator (feature-detected; no-op on older Pi).
      indicatorSupported = applyWorkingIndicator(ctx, glyphDensity, motion);
      git = new GitStatusProvider({ reader: options.gitReader, onChange: () => {
        config.gitSnapshot = git?.getSnapshot();
        updateShell(ctx);
        requestImmediate();
      } });
      config.onBranchChange = () => { git?.invalidate(); refreshGit(true); };
      setupUi(ctx);
      refreshGit();

      updateShell(ctx);
    } catch (err) {
      console.error("[pi-grok-theme] session_start error:", err);
    }
  });

  pi.on("session_shutdown", (_event, ctx) => {
    try {
      agentActive = false;
      statusController.endTurn();
      renderClock.stop(); // no timers may survive shutdown
      git?.dispose();
      git = undefined;
      originalSetWorkingMessage?.(undefined);
      restoreMessage();
      uiCtx = undefined;
      if (cursorTouched) {
        resetCursorColor(); // OSC 112: restore terminal default cursor color
        cursorTouched = false;
      }
      restoreWorkingIndicator(ctx); // restore Pi's default working indicator
      footerHandle?.dispose();
      footerHandle = null;
      headerHandle?.dispose();
      headerHandle = undefined;
    } catch (err) {
      console.error("[pi-grok-theme] session_shutdown error:", err);
    }
  });

  // Host agent boundaries include tools and the final abort/completion event.
  pi.on("agent_start", (_event, ctx) => {
    agentActive = true;
    uiCtx = ctx;
    statusController.startTurn();
    renderClock.start();
    refreshGit();
    requestImmediate();
  });
  pi.on("agent_end", () => {
    agentActive = false;
    statusController.endTurn();
    renderClock.stop();
    originalSetWorkingMessage?.(undefined);
    refreshGit();
    requestImmediate();
  });

  // Turn & Message Lifecycle
  pi.on("message_start", (event, ctx) => {
    try {
      if (event.message.role === "assistant") {
        if (!statusController.isWorking()) statusController.startTurn();
        statusController.startThinking();
        // Turn boundary: start the clock exactly once, render immediately.
        renderClock.start();
        refreshGit();
        requestImmediate();
      }
    } catch (err) {
      console.error("[pi-grok-theme] message_start error:", err);
    }
  });

  pi.on("message_update", (event, _ctx) => {
    try {
      if (event.message.role === "assistant") {
        const type = event.assistantMessageEvent?.type;
        const previousState = statusController.getState();
        if (type?.startsWith("thinking_")) statusController.startThinking();
        else if (!type || type.startsWith("text_") || type.startsWith("toolcall_")) statusController.startStreaming();
        else return;
        const changed = statusController.getState() !== previousState;
        if (changed) requestImmediate();
        else renderClock.markDirty();
      }
    } catch (err) {
      console.error("[pi-grok-theme] message_update error:", err);
    }
  });

  pi.on("message_end", (event, ctx) => {
    try {
      if (event.message.role === "assistant") {
        if (agentActive) { statusController.endTool(); requestImmediate(); return; }
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
      renderClock.start();
      requestImmediate();
    } catch (err) {
      console.error("[pi-grok-theme] tool_execution_start error:", err);
    }
  });

  pi.on("tool_execution_end", (event, _ctx) => {
    try {
      statusController.endTool(event.toolName);
      refreshGit();
      requestImmediate();
    } catch (err) {
      console.error("[pi-grok-theme] tool_execution_end error:", err);
    }
  });

  // Register interactive slash command
  pi.registerCommand("grok", {
    description: "Inspect or configure pi-grok-theme theme and UI extension (/grok [info|status|theme|footer|toggle|header|motion])",
    // Completion offers theme aliases and installed theme names. It only
    // suggests — switching themes as a preview side effect is unsupported and
    // never happens here (spec §4.6).
    getArgumentCompletions: (argumentPrefix) => {
      const raw = (argumentPrefix ?? "").trim().toLowerCase();
      const parts = raw.split(/\s+/).filter(Boolean);

      if (parts[0] === "header" || parts[0] === "motion") {
        const values = parts[0] === "header" ? ["compact", "boxed", "on", "off"] : ["normal", "quiet"];
        const items = values.filter((v) => v.startsWith(parts[1] ?? "")).map((v) => ({ value: `${parts[0]} ${v}`, label: v }));
        return items.length ? items : null;
      }
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
          { value: "footer glyphs", label: "glyphs", description: "glyph density auto|unicode|nerd|ascii" },
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
        { value: "motion", label: "motion", description: "normal or quiet motion" },
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
      const input = (args || "").trim();
      const sub = input.toLowerCase();
      // Notifications ride the active theme when Pi exposes one.
      const chrome = createChromeTheme(activeTheme(ctx));
      const glyphs = resolveGlyphs(glyphDensity);
      const notify = (msg: string, type?: "info" | "warning" | "error") => {
        if (ctx.hasUI && typeof ctx.ui?.notify === "function") {
          ctx.ui.notify(msg, type);
        }
      };

      const saved = (message: string): void => {
        const result = persistPrefs();
        notify(result.success ? message : `${message}. Applied for this session only; preferences could not be saved: ${result.error}`, result.success ? "info" : "warning");
      };
      if (sub === "status" || sub === "info" || !sub) {
        const badge = statusController.getBadge(Date.now(), motion);
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
          chrome.bold(chrome.fg("accent", `${glyphs.brandMark} Grok Theme v${VERSION}`)),
          `${chrome.fg("muted", "Package:")} pi-grok-theme`,
          `${chrome.fg("muted", "Theme:")} ${themeName}`,
          `${chrome.fg("muted", "Cursor:")} ${cursorLine}`,
          `${chrome.fg("muted", "Footer:")} ${config.preset}`,
          `${chrome.fg("muted", "Header:")} ${showHeader ? `enabled (${headerStyle})` : `disabled (${headerStyle})`}`,
          `${chrome.fg("muted", "Glyphs:")} ${glyphDensity} (effective ${resolveGlyphDensity(glyphDensity)})`,
          `${chrome.fg("muted", "Motion:")} ${motion}${motion === "quiet" && !indicatorSupported ? " (host animation cannot be customized)" : ""}`,
          `${chrome.fg("muted", "Status:")} ${statusLine}`,
          `${chrome.fg("muted", "Workspace:")} ${ctx.cwd}`,
          `${chrome.fg("muted", "Model:")} ${ctx.model?.name || ctx.model?.id || "default"}`,
          `${chrome.fg("muted", "Thinking:")} ${readThinkingLevel(ctx) ?? "off"}`,
        ].join("\n");
        notify(msg, "info");
        return;
      }

      if (sub === "theme" || sub.startsWith("theme ") || sub === "themes") {
        const themeArg = input.replace(/^themes?/i, "").trim();
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
              chrome.bold(chrome.fg("accent", `${glyphs.brandMark} Grok Theme Themes`)),
              ...names.map((name) => {
                const marker = name === activeName ? `${chrome.fg("success", glyphs.workingDot)} ` : "  ";
                const suffix =
                  name === activeName ? ` ${chrome.fg("muted", "(active)")}` : "";
                return `${marker}${chrome.fg("text", name)}${suffix}`;
              }),
              ``,
              `${chrome.fg("dim", "Switch with /grok theme <name|alias> | aliases: coding, minimal, day")}`,
            ];
            notify(lines.join("\n"), "info");
          } else {
            // Older Pi without theme APIs: keep the v0.3 guidance.
            const msg = [
              chrome.bold(chrome.fg("accent", `${glyphs.brandMark} Grok Theme Themes (v${VERSION})`)),
              `  ${glyphs.disclosureArrow} ${chrome.fg("accent", "grok-build-coding")} ${chrome.fg("dim", "(Dark, TokyoNight syntax, Recommended)")}`,
              `  ${glyphs.disclosureArrow} ${chrome.fg("accent", "grok-build")} ${chrome.fg("dim", "(Dark, Minimal monochrome)")}`,
              `  ${glyphs.disclosureArrow} ${chrome.fg("warning", "grok-build-day")} ${chrome.fg("dim", "(Light, GrokDay clean canvas)")}`,
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

        const targetTheme = aliasToTheme[themeArg.toLowerCase()] ?? themeArg;

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
          if (isTerminalUi(ctx)) {
            applyCursorPolicy(targetTheme);
            cursorTouched = true;
          }
          indicatorSupported = applyWorkingIndicator(ctx, glyphDensity, motion);
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
            minimal: "model / context / status",
            full: "model / branch / context / extension statuses / thinking / cwd / turn time / status",
          };
          const msg = [
            chrome.bold(chrome.fg("accent", "Grok footer")),
            `${chrome.fg("muted", "Current:")} preset=${config.preset} ${chrome.fg("dim", `(${presetDescriptions[config.preset]})`)}`,
            `${chrome.fg("muted", "Glyphs:")} ${glyphDensity} (effective ${resolveGlyphDensity(glyphDensity)})`,
            `${chrome.fg("muted", "Separator:")} ${separatorStyle} (effective ${config.separator.trim()})`,
            `${chrome.fg("muted", "Presets:")} ${FOOTER_PRESETS.join(", ")}`,
            `${chrome.fg("dim", "Usage: /grok footer <minimal|default|full>")}`,
            `${chrome.fg("dim", "       /grok footer glyphs <auto|unicode|nerd|ascii>")}`,
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
          updatePresentation(ctx);
          saved(`pi-grok-theme footer glyphs: ${densityArg} (effective ${resolveGlyphDensity(glyphDensity)})`);
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
          syncConfig();
          requestImmediate();
          saved(`pi-grok-theme footer sep: ${styleArg} (effective ${config.separator.trim()})`);
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
        refreshGit();
        requestImmediate();
        saved(`pi-grok-theme footer preset: ${presetArg}`);
        return;
      }

      if (sub === "header" || sub.startsWith("header ")) {
        const value = sub.slice(6).trim();
        if (value && !["compact", "boxed", "on", "off"].includes(value)) {
          notify("Usage: /grok header [compact|boxed|on|off]", "warning"); return;
        }
        if (value === "compact" || value === "boxed") { headerStyle = value; showHeader = true; }
        else showHeader = value === "on" ? true : value === "off" ? false : !showHeader;
        updateHeader(ctx);
        refreshGit();
        requestImmediate();
        saved(`pi-grok-theme header: ${showHeader ? "enabled" : "disabled"} (${headerStyle})`);
        return;
      }
      if (sub === "motion" || sub.startsWith("motion ")) {
        const value = sub.slice(6).trim();
        if (!value) { notify(`Motion: ${motion}${!indicatorSupported ? " (host animation cannot be customized)" : ""}`, "info"); return; }
        if (value !== "normal" && value !== "quiet") { notify("Usage: /grok motion normal|quiet", "warning"); return; }
        motion = value;
        updatePresentation(ctx);
        saved(`pi-grok-theme motion: ${motion}${motion === "quiet" && !indicatorSupported ? " (host animation cannot be customized)" : ""}`);
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

      notify(`Unknown subcommand "${sub}". Usage: /grok [info|status|theme|footer|toggle|header|motion]`, "warning");
    },
  });
}
