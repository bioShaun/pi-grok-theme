/**
 * index.ts — Extension entry point for pi-grok-build (Phase 2 UI Extension)
 *
 * Implements:
 * - Single-line Grok-style footer with responsive dropping priority
 * - Workspace header banner
 * - Compact working state controller and working message filtering
 * - Slash command `/grok` for status inspection and configuration
 * - 100% crash resistance and graceful fallback
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { installFooter, type FooterConfig, DEFAULT_FOOTER_CONFIG } from "./footer.ts";
import { installHeader } from "./header.ts";
import { WorkingStateController, ANSI_COLORS } from "./status.ts";
import { setCursorColor, resetCursorColor } from "./cursor.ts";

export default function registerGrokBuildExtension(pi: ExtensionAPI): void {
  const statusController = new WorkingStateController();
  let footerHandle: { dispose: () => void; requestRender: () => void } | null = null;
  let headerHandle: { dispose: () => void } | undefined;
  let showHeader = false;
  const config: FooterConfig = { ...DEFAULT_FOOTER_CONFIG };

  // Track original setWorkingMessage to intercept gracefully
  let originalSetWorkingMessage: ((message?: string) => void) | undefined;

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
      console.error("[pi-grok-build] Failed to initialize UI:", err);
    }
  }

  // Lifecycle Events
  pi.on("session_start", (_event, ctx) => {
    try {
      statusController.endTurn();
      setCursorColor(); // OSC 12: set terminal cursor to Grok amber (#E0AF68)
      setupUi(ctx);
    } catch (err) {
      console.error("[pi-grok-build] session_start error:", err);
    }
  });

  pi.on("session_shutdown", (_event, _ctx) => {
    try {
      statusController.endTurn();
      resetCursorColor(); // OSC 112: restore terminal default cursor color
      footerHandle?.dispose();
      footerHandle = null;
      headerHandle?.dispose();
      headerHandle = undefined;
    } catch (err) {
      console.error("[pi-grok-build] session_shutdown error:", err);
    }
  });

  // Turn & Message Lifecycle
  pi.on("message_start", (event, ctx) => {
    try {
      if (event.message.role === "assistant") {
        statusController.startTurn();
        statusController.startThinking();
        footerHandle?.requestRender();
      }
    } catch (err) {
      console.error("[pi-grok-build] message_start error:", err);
    }
  });

  pi.on("message_update", (event, _ctx) => {
    try {
      if (event.message.role === "assistant") {
        statusController.startStreaming();
        footerHandle?.requestRender();
      }
    } catch (err) {
      console.error("[pi-grok-build] message_update error:", err);
    }
  });

  pi.on("message_end", (event, _ctx) => {
    try {
      if (event.message.role === "assistant") {
        statusController.endTurn();
        footerHandle?.requestRender();
      }
    } catch (err) {
      console.error("[pi-grok-build] message_end error:", err);
    }
  });

  // Tool Execution Lifecycle
  pi.on("tool_start", (event, _ctx) => {
    try {
      statusController.startTool(event.toolName);
      footerHandle?.requestRender();
    } catch (err) {
      console.error("[pi-grok-build] tool_start error:", err);
    }
  });

  pi.on("tool_end", (event, _ctx) => {
    try {
      statusController.endTool(event.toolName);
      footerHandle?.requestRender();
    } catch (err) {
      console.error("[pi-grok-build] tool_end error:", err);
    }
  });

  // Register interactive slash command
  pi.registerCommand("grok", {
    description: "Inspect or configure pi-grok-build theme and UI extension (/grok [info|status|theme|toggle|header])",
    handler: (args, ctx) => {
      const sub = (args || "").trim().toLowerCase();

      if (sub === "status" || sub === "info" || !sub) {
        const badge = statusController.getBadge();
        const msg = [
          `${ANSI_COLORS.bold}${ANSI_COLORS.blue}π Grok Build v0.3.0${ANSI_COLORS.reset}`,
          `${ANSI_COLORS.muted}Theme:${ANSI_COLORS.reset} GrokNight / GrokDay (TokyoNight Accents)`,
          `${ANSI_COLORS.muted}Cursor:${ANSI_COLORS.reset} Amber Gold (#E0AF68, OSC 12)`,
          `${ANSI_COLORS.muted}Status:${ANSI_COLORS.reset} ${badge.formattedText}`,
          `${ANSI_COLORS.muted}Workspace:${ANSI_COLORS.reset} ${ctx.cwd}`,
          `${ANSI_COLORS.muted}Model:${ANSI_COLORS.reset} ${ctx.model?.name || ctx.model?.id || "default"}`,
        ].join("\n");

        if (ctx.hasUI && typeof ctx.ui?.notify === "function") {
          ctx.ui.notify(msg, "info");
        }
        return;
      }

      if (sub === "theme" || sub.startsWith("theme ") || sub === "themes") {
        const themeArg = sub.replace(/^themes?/, "").trim();
        if (!themeArg) {
          const msg = [
            `${ANSI_COLORS.bold}${ANSI_COLORS.blue}π Grok Build Themes (v0.3.0)${ANSI_COLORS.reset}`,
            `  • ${ANSI_COLORS.cyan}grok-build-coding${ANSI_COLORS.reset} ${ANSI_COLORS.dim}(Dark, TokyoNight syntax, Recommended)${ANSI_COLORS.reset}`,
            `  • ${ANSI_COLORS.blue}grok-build${ANSI_COLORS.reset} ${ANSI_COLORS.dim}(Dark, Minimal monochrome)${ANSI_COLORS.reset}`,
            `  • ${ANSI_COLORS.amber}grok-build-day${ANSI_COLORS.reset} ${ANSI_COLORS.dim}(Light, GrokDay clean canvas)${ANSI_COLORS.reset}`,
            ``,
            `${ANSI_COLORS.muted}Switch theme via:${ANSI_COLORS.reset}`,
            `  1. Run ${ANSI_COLORS.bold}/settings${ANSI_COLORS.reset} -> Theme`,
            `  2. In ${ANSI_COLORS.dim}~/.pi/agent/settings.json${ANSI_COLORS.reset}: {"theme": "grok-build-coding"}`,
            `  3. CLI flag: ${ANSI_COLORS.dim}pi --use-theme <name>${ANSI_COLORS.reset}`,
          ].join("\n");
          if (ctx.hasUI && typeof ctx.ui?.notify === "function") {
            ctx.ui.notify(msg, "info");
          }
          return;
        }

        const validThemes: Record<string, string> = {
          coding: "grok-build-coding",
          "grok-build-coding": "grok-build-coding",
          dark: "grok-build",
          minimal: "grok-build",
          "grok-build": "grok-build",
          day: "grok-build-day",
          light: "grok-build-day",
          "grok-build-day": "grok-build-day",
        };

        const targetTheme = validThemes[themeArg];
        if (targetTheme) {
          const msg = [
            `${ANSI_COLORS.bold}${ANSI_COLORS.blue}To activate ${targetTheme}:${ANSI_COLORS.reset}`,
            `1. Run ${ANSI_COLORS.bold}/settings${ANSI_COLORS.reset} -> Theme -> Select ${ANSI_COLORS.cyan}${targetTheme}${ANSI_COLORS.reset}`,
            `2. Or update ${ANSI_COLORS.dim}~/.pi/agent/settings.json${ANSI_COLORS.reset}:`,
            `   {"theme": "${targetTheme}"}`,
          ].join("\n");
          if (ctx.hasUI && typeof ctx.ui?.notify === "function") {
            ctx.ui.notify(msg, "info");
          }
        } else {
          if (ctx.hasUI && typeof ctx.ui?.notify === "function") {
            ctx.ui.notify(
              `Unknown theme variant "${themeArg}". Available: coding, minimal (dark), day (light)`,
              "warning",
            );
          }
        }
        return;
      }

      if (sub === "header") {
        showHeader = !showHeader;
        headerHandle?.dispose();
        if (showHeader) {
          headerHandle = installHeader(ctx);
        } else {
          headerHandle = undefined;
        }
        if (ctx.hasUI && typeof ctx.ui?.notify === "function") {
          ctx.ui.notify(
            `pi-grok-build header: ${showHeader ? "enabled" : "disabled"}`,
            "info",
          );
        }
        return;
      }

      if (sub === "toggle" || sub === "compact") {
        config.compactThreshold = config.compactThreshold === 80 ? 9999 : 80;
        footerHandle?.requestRender();
        if (ctx.hasUI && typeof ctx.ui?.notify === "function") {
          ctx.ui.notify(
            `pi-grok-build footer mode: ${config.compactThreshold > 1000 ? "always-compact" : "auto-responsive"}`,
            "info",
          );
        }
        return;
      }

      if (ctx.hasUI && typeof ctx.ui?.notify === "function") {
        ctx.ui.notify(`Unknown subcommand "${sub}". Usage: /grok [info|status|theme|toggle|header]`, "warning");
      }
    },
  });
}
