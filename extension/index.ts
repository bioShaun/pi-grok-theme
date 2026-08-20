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
      setupUi(ctx);
    } catch (err) {
      console.error("[pi-grok-build] session_start error:", err);
    }
  });

  pi.on("session_shutdown", (_event, _ctx) => {
    try {
      statusController.endTurn();
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
    description: "Inspect or configure pi-grok-build theme and UI extension (/grok [info|status|toggle|header])",
    handler: (args, ctx) => {
      const sub = (args || "").trim().toLowerCase();

      if (sub === "status" || sub === "info" || !sub) {
        const badge = statusController.getBadge();
        const msg = [
          `${ANSI_COLORS.bold}${ANSI_COLORS.blue}π Grok Build v0.2.0${ANSI_COLORS.reset}`,
          `${ANSI_COLORS.muted}Theme:${ANSI_COLORS.reset} GrokNight (TokyoNight Accents)`,
          `${ANSI_COLORS.muted}Status:${ANSI_COLORS.reset} ${badge.formattedText}`,
          `${ANSI_COLORS.muted}Workspace:${ANSI_COLORS.reset} ${ctx.cwd}`,
          `${ANSI_COLORS.muted}Model:${ANSI_COLORS.reset} ${ctx.model?.name || ctx.model?.id || "default"}`,
        ].join("\n");

        if (ctx.hasUI && typeof ctx.ui?.notify === "function") {
          ctx.ui.notify(msg, "info");
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
        ctx.ui.notify(`Unknown subcommand "${sub}". Usage: /grok [info|status|toggle|header]`, "warning");
      }
    },
  });
}
