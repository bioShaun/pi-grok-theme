/**
 * status.ts — Working indicator & status controller for pi-grok-build
 *
 * Implements Grok Build-style compact working states:
 * - Single-line minimal indicators: `● working (2.4s)`, `● thinking (1.2s)`, `● running bash...`
 * - Working message filtering and sanitization
 * - Duration tracking and state lifecycle
 */

export type AgentActivityState = "idle" | "thinking" | "streaming" | "running_tool" | "working";

export interface StatusBadge {
  dot: string;
  label: string;
  duration?: string;
  rawText: string;
  formattedText: string;
}

/** ANSI color codes calibrated with GrokNight & TokyoNight palette */
export const ANSI_COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[38;2;65;65;65m", // #414141
  muted: "\x1b[38;2;108;108;108m", // #6C6C6C
  fg: "\x1b[38;2;225;225;225m", // #E1E1E1
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
  private stateStartAt: number | undefined;
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
    this.stateStartAt = now;
    this.currentTool = undefined;
  }

  public startThinking(now = Date.now()): void {
    this.state = "thinking";
    this.stateStartAt = now;
  }

  public startStreaming(now = Date.now()): void {
    this.state = "streaming";
    if (!this.stateStartAt) this.stateStartAt = now;
  }

  public startTool(toolName: string, now = Date.now()): void {
    this.state = "running_tool";
    this.currentTool = toolName;
    this.stateStartAt = now;
  }

  public endTool(_toolName?: string, now = Date.now()): void {
    this.currentTool = undefined;
    this.state = "working";
    this.stateStartAt = now;
  }

  public endTurn(now = Date.now()): void {
    if (this.turnStartAt) {
      this.lastActiveDurationMs = Math.max(0, now - this.turnStartAt);
    }
    this.state = "idle";
    this.currentTool = undefined;
    this.turnStartAt = undefined;
    this.stateStartAt = undefined;
  }

  public getElapsedMs(now = Date.now()): number {
    if (this.state === "idle") return this.lastActiveDurationMs;
    const start = this.turnStartAt ?? this.stateStartAt ?? now;
    return Math.max(0, now - start);
  }

  /**
   * Get the current status badge formatted with ANSI colors
   */
  public getBadge(now = Date.now()): StatusBadge {
    if (this.state === "idle") {
      return {
        dot: "○",
        label: "idle",
        rawText: "○ idle",
        formattedText: `${ANSI_COLORS.dim}○ idle${ANSI_COLORS.reset}`,
      };
    }

    const elapsed = this.getElapsedMs(now);
    const durationStr = formatDuration(elapsed);

    let dotColor = ANSI_COLORS.blue;
    let label = "working";

    switch (this.state) {
      case "thinking":
        dotColor = ANSI_COLORS.purple;
        label = `thinking (${durationStr})`;
        break;
      case "running_tool":
        dotColor = ANSI_COLORS.amber;
        label = `${normalizeToolAction(this.currentTool)} (${durationStr})`;
        break;
      case "streaming":
        dotColor = ANSI_COLORS.cyan;
        label = `generating (${durationStr})`;
        break;
      case "working":
      default:
        dotColor = ANSI_COLORS.blue;
        label = `working (${durationStr})`;
        break;
    }

    const rawText = `● ${label}`;
    const formattedText = `${dotColor}●${ANSI_COLORS.reset} ${ANSI_COLORS.fgSecondary}${label}${ANSI_COLORS.reset}`;

    return {
      dot: "●",
      label,
      duration: durationStr,
      rawText,
      formattedText,
    };
  }

  /**
   * Filter and compress verbose working messages from Pi into compact Grok tokens.
   */
  public filterWorkingMessage(originalMessage?: string, now = Date.now()): string {
    const elapsed = this.getElapsedMs(now);
    const durationStr = formatDuration(elapsed);

    if (!originalMessage) {
      if (this.state === "thinking") return `● thinking (${durationStr})`;
      if (this.state === "running_tool") return `● ${normalizeToolAction(this.currentTool)} (${durationStr})`;
      return `● working (${durationStr})`;
    }

    const trimmed = originalMessage.trim();

    // Check if message is a tool execution announcement
    if (trimmed.toLowerCase().includes("bash") || trimmed.toLowerCase().includes("executing")) {
      return `● running bash (${durationStr})`;
    }
    if (trimmed.toLowerCase().includes("edit") || trimmed.toLowerCase().includes("writing")) {
      return `● editing file (${durationStr})`;
    }
    if (trimmed.toLowerCase().includes("read") || trimmed.toLowerCase().includes("inspect")) {
      return `● reading file (${durationStr})`;
    }
    if (trimmed.toLowerCase().includes("search") || trimmed.toLowerCase().includes("grep")) {
      return `● searching (${durationStr})`;
    }
    if (trimmed.toLowerCase().includes("think")) {
      return `● thinking (${durationStr})`;
    }

    // Default compact fallback
    return `● ${trimmed.slice(0, 24)} (${durationStr})`;
  }
}
