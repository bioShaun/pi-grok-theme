/**
 * status.ts — Working indicator & status controller for pi-grok-build
 *
 * Implements Grok Build-style compact working states:
 * - Single-line minimal indicators: `● working (2.4s)`, `● thinking (1.2s)`, `● running bash...`
 * - Working message filtering and sanitization
 * - Duration tracking and state lifecycle
 *
 * v0.4: the controller exposes activity as a **semantic** badge (state, icon
 * key, tone, label, phase/turn elapsed) with no embedded ANSI; the legacy
 * `formattedText`/`rawText` fields remain as compatibility shims until the
 * migration ticket removes the old rendering path.
 */

import type { GlyphKey } from "./glyphs.ts";

export type AgentActivityState = "idle" | "thinking" | "streaming" | "running_tool" | "working";

/** Semantic tone of an activity state — styled by the chrome theme adapter. */
export type StatusTone = "muted" | "accent" | "thinking" | "warning";

export interface StatusBadge {
  // --- semantic v0.4 fields (no ANSI) ---
  state: AgentActivityState;
  icon: GlyphKey;
  tone: StatusTone;
  label: string;
  /** Time since the current thinking/streaming/tool phase began. */
  phaseElapsedMs?: number;
  /** Time since the assistant turn began. */
  turnElapsedMs?: number;
  // --- v0.3 compatibility fields (shim; scheduled for removal in migration) ---
  dot: string;
  duration?: string;
  rawText: string;
  formattedText: string;
}

/** ANSI color codes calibrated with GrokNight & TokyoNight palette */
export const ANSI_COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[38;2;104;110;120m", // #686E78 (readable dim/separator)
  muted: "\x1b[38;2;136;144;159m", // #88909F (readable comments/secondary text)
  fg: "\x1b[38;2;225;225;225m", // #E1E1E1 (primary text)
  fgSecondary: "\x1b[38;2;200;200;200m", // #C8C8C8
  blue: "\x1b[38;2;122;162;247m", // #7AA2F7 (TokyoNight Blue)
  cyan: "\x1b[38;2;125;207;255m", // #7DCFFF (TokyoNight Cyan)
  amber: "\x1b[38;2;224;175;104m", // #E0AF68 (Grok Amber Gold)
  green: "\x1b[38;2;158;206;106m", // #9ECE6A (TokyoNight Green)
  purple: "\x1b[38;2;187;154;247m", // #BB9AF7 (TokyoNight Purple)
  red: "\x1b[38;2;247;118;142m", // #F7768E (TokyoNight Red)
};

/** Format milliseconds into concise Grok-style duration string (e.g., 1.4s, 12s, 1m24s) */
export function formatDuration(elapsedMs: number): string {
  if (elapsedMs < 0) return "0.0s";
  const seconds = elapsedMs / 1000;
  if (seconds < 10) {
    return `${seconds.toFixed(1)}s`;
  }
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSec = Math.floor(seconds % 60);
  return `${minutes}m${remainingSec.toString().padStart(2, "0")}s`;
}

/** Normalize tool name to a short display label */
export function normalizeToolAction(toolName?: string): string {
  if (!toolName) return "working";
  const lower = toolName.toLowerCase();
  if (lower.includes("bash") || lower.includes("exec") || lower.includes("command") || lower.includes("terminal")) {
    return "running bash";
  }
  if (lower.includes("edit") || lower.includes("write") || lower.includes("replace") || lower.includes("patch")) {
    return "editing file";
  }
  if (lower.includes("read") || lower.includes("view") || lower.includes("cat")) {
    return "reading file";
  }
  if (lower.includes("grep") || lower.includes("find") || lower.includes("search") || lower.includes("list")) {
    return "searching";
  }
  if (lower.includes("subagent") || lower.includes("agent") || lower.includes("invoke")) {
    return "subagent";
  }
  return `running ${toolName.replace(/_/g, " ")}`;
}

/** Working state controller for Grok Build UI */
export class WorkingStateController {
  private state: AgentActivityState = "idle";
  private currentTool: string | undefined;
  private turnStartAt: number | undefined;
  private phaseStartAt: number | undefined;
  private lastActiveDurationMs: number = 0;

  constructor() {}

  public getState(): AgentActivityState {
    return this.state;
  }

  public getCurrentTool(): string | undefined {
    return this.currentTool;
  }

  public isWorking(): boolean {
    return this.state !== "idle";
  }

  public startTurn(now = Date.now()): void {
    this.state = "thinking";
    this.turnStartAt = now;
    this.phaseStartAt = now;
    this.currentTool = undefined;
  }

  public startThinking(now = Date.now()): void {
    if (this.state !== "thinking") {
      this.state = "thinking";
      this.phaseStartAt = now;
    }
  }

  public startStreaming(now = Date.now()): void {
    // message_update fires per token; only the transition into streaming
    // starts a new phase clock, repeated updates do not reset it.
    if (this.state !== "streaming") {
      this.state = "streaming";
      this.phaseStartAt = now;
    }
  }

  public startTool(toolName: string, now = Date.now()): void {
    this.state = "running_tool";
    this.currentTool = toolName;
    this.phaseStartAt = now;
  }

  public endTool(_toolName?: string, now = Date.now()): void {
    this.currentTool = undefined;
    this.state = "working";
    this.phaseStartAt = now;
  }

  public endTurn(now = Date.now()): void {
    if (this.turnStartAt) {
      this.lastActiveDurationMs = Math.max(0, now - this.turnStartAt);
    }
    this.state = "idle";
    this.currentTool = undefined;
    this.turnStartAt = undefined;
    this.phaseStartAt = undefined;
  }

  /** Whole-turn elapsed, or the last active turn duration when idle. */
  public getElapsedMs(now = Date.now()): number {
    if (this.state === "idle") return this.lastActiveDurationMs;
    const start = this.turnStartAt ?? this.phaseStartAt ?? now;
    return Math.max(0, now - start);
  }

  /** Time since the current phase (thinking/streaming/tool) began; undefined while idle. */
  public getPhaseElapsedMs(now = Date.now()): number | undefined {
    if (this.state === "idle") return undefined;
    return Math.max(0, now - (this.phaseStartAt ?? now));
  }

  /** Time since the assistant turn began; undefined while idle. */
  public getTurnElapsedMs(now = Date.now()): number | undefined {
    if (this.state === "idle") return undefined;
    return Math.max(0, now - (this.turnStartAt ?? this.phaseStartAt ?? now));
  }

  /**
   * Semantic activity badge. `formattedText`/`rawText` are v0.3 shims and
   * carry embedded ANSI; consume `state`/`tone`/`icon`/`label` instead.
   */
  public getBadge(now = Date.now()): StatusBadge {
    if (this.state === "idle") {
      return {
        state: "idle",
        icon: "idleDot",
        tone: "muted",
        label: "idle",
        dot: "○",
        rawText: "○ idle",
        formattedText: `${ANSI_COLORS.muted}○ idle${ANSI_COLORS.reset}`,
      };
    }

    const phaseElapsedMs = this.getPhaseElapsedMs(now);
    const turnElapsedMs = this.getTurnElapsedMs(now);
    // v0.4: the status label shows PHASE time (resets per thinking/streaming/
    // tool transition); turn time rides the semantic badge for the full preset.
    const durationStr = formatDuration(phaseElapsedMs ?? 0);

    let tone: StatusTone;
    let label: string;
    // Shim rendering keeps the exact v0.3 per-state dot colors.
    let shimDotColor: string;

    switch (this.state) {
      case "thinking":
        tone = "thinking";
        label = `thinking (${durationStr})`;
        shimDotColor = ANSI_COLORS.purple;
        break;
      case "running_tool":
        tone = "warning";
        label = `${normalizeToolAction(this.currentTool)} (${durationStr})`;
        shimDotColor = ANSI_COLORS.amber;
        break;
      case "streaming":
        tone = "accent";
        label = `generating (${durationStr})`;
        shimDotColor = ANSI_COLORS.cyan;
        break;
      case "working":
      default:
        tone = "accent";
        label = `working (${durationStr})`;
        shimDotColor = ANSI_COLORS.blue;
        break;
    }

    const rawText = `● ${label}`;
    const formattedText = `${shimDotColor}●${ANSI_COLORS.reset} ${ANSI_COLORS.muted}${label}${ANSI_COLORS.reset}`;

    return {
      state: this.state,
      icon: "workingDot",
      tone,
      label,
      phaseElapsedMs,
      turnElapsedMs,
      dot: "●",
      duration: durationStr,
      rawText,
      formattedText,
    };
  }

  /**
   * Filter and compress verbose working messages from Pi into compact Grok tokens.
   */
  public filterWorkingMessage(originalMessage?: string, now = Date.now()): string | undefined {
    // Pass through the host's clear/restore-default contract untouched.
    if (originalMessage === undefined) return undefined;

    // Do not fabricate a working label while idle.
    if (this.state === "idle") return originalMessage;

    const elapsed = this.getElapsedMs(now);
    const durationStr = formatDuration(elapsed);
    const trimmed = originalMessage.trim();

    if (!trimmed) {
      if (this.state === "thinking") return `● thinking (${durationStr})`;
      if (this.state === "running_tool") return `● ${normalizeToolAction(this.currentTool)} (${durationStr})`;
      if (this.state === "streaming") return `● generating (${durationStr})`;
      return `● working (${durationStr})`;
    }

    // Check if message is a tool execution announcement
    const lower = trimmed.toLowerCase();
    if (lower.includes("bash") || lower.includes("executing")) {
      return `● running bash (${durationStr})`;
    }
    if (lower.includes("edit") || lower.includes("writing")) {
      return `● editing file (${durationStr})`;
    }
    if (lower.includes("read") || lower.includes("inspect")) {
      return `● reading file (${durationStr})`;
    }
    if (lower.includes("search") || lower.includes("grep")) {
      return `● searching (${durationStr})`;
    }
    if (lower.includes("think")) {
      return `● thinking (${durationStr})`;
    }

    // Default compact fallback
    return `● ${trimmed.slice(0, 24)} (${durationStr})`;
  }
}
