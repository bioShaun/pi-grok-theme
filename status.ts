/**
 * status.ts — Working indicator & status controller for pi-grok-theme
 *
 * Implements Grok Build-style compact working states:
 * - Single-line minimal indicators: `working (2.4s)`, `thinking (1.2s)`, `running bash...`
 * - Working message filtering and sanitization
 * - Duration tracking and state lifecycle
 *
 * v0.4.1: the controller exposes activity as a **semantic** badge (state, icon
 * key, tone, label, phase/turn elapsed) with no embedded ANSI. Production
 * chrome styles via the theme adapter only.
 */

import type { GlyphKey } from "./glyphs.ts";

export type MotionMode = "normal" | "quiet";

export type AgentActivityState = "idle" | "thinking" | "streaming" | "running_tool" | "working";

/** Semantic tone of an activity state — styled by the chrome theme adapter. */
export type StatusTone = "muted" | "accent" | "thinking" | "warning";

export interface StatusBadge {
  state: AgentActivityState;
  icon: GlyphKey;
  tone: StatusTone;
  label: string;
  /** Time since the current thinking/streaming/tool phase began. */
  phaseElapsedMs?: number;
  /** Time since the assistant turn began. */
  turnElapsedMs?: number;
}

/** Format milliseconds into concise Grok-style duration string (e.g., 1.4s, 12s, 1m24s) */
export function formatDuration(elapsedMs: number, motion: MotionMode = "normal"): string {
  if (elapsedMs < 0) return "0.0s";
  const seconds = elapsedMs / 1000;
  if (seconds < 10 && motion !== "quiet") {
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
   * Semantic activity badge — no ANSI. Consumers style via chrome tones + glyphs.
   */
  public getBadge(now = Date.now(), motion: MotionMode = "normal"): StatusBadge {
    if (this.state === "idle") {
      return {
        state: "idle",
        icon: "idleDot",
        tone: "muted",
        label: "idle",
      };
    }

    const phaseElapsedMs = this.getPhaseElapsedMs(now);
    const turnElapsedMs = this.getTurnElapsedMs(now);
    // Status label shows PHASE time (resets per thinking/streaming/tool
    // transition); turn time rides the semantic badge for the full preset.
    const durationStr = formatDuration(phaseElapsedMs ?? 0, motion);

    let tone: StatusTone;
    let label: string;

    switch (this.state) {
      case "thinking":
        tone = "thinking";
        label = `thinking (${durationStr})`;
        break;
      case "running_tool":
        tone = "warning";
        label = `${normalizeToolAction(this.currentTool)} (${durationStr})`;
        break;
      case "streaming":
        tone = "accent";
        label = `generating (${durationStr})`;
        break;
      case "working":
      default:
        tone = "accent";
        label = `working (${durationStr})`;
        break;
    }

    return {
      state: this.state,
      icon: "workingDot",
      tone,
      label,
      phaseElapsedMs,
      turnElapsedMs,
    };
  }

  /**
   * Filter and compress verbose working messages from Pi into compact Grok tokens.
   * Duration uses the phase clock so it matches the footer badge.
   */
  public filterWorkingMessage(originalMessage?: string, now = Date.now(), motion: MotionMode = "normal"): string | undefined {
    // Pass through the host's clear/restore-default contract untouched.
    if (originalMessage === undefined) return undefined;

    // Do not fabricate a working label while idle.
    if (this.state === "idle") return originalMessage;

    const elapsed = this.getPhaseElapsedMs(now) ?? 0;
    const durationStr = formatDuration(elapsed, motion);
    const trimmed = originalMessage.trim();

    if (!trimmed) {
      if (this.state === "thinking") return `thinking (${durationStr})`;
      if (this.state === "running_tool") return `${normalizeToolAction(this.currentTool)} (${durationStr})`;
      if (this.state === "streaming") return `generating (${durationStr})`;
      return `working (${durationStr})`;
    }

    // Check if message is a tool execution announcement
    const lower = trimmed.toLowerCase();
    if (lower.includes("bash") || lower.includes("executing")) {
      return `running bash (${durationStr})`;
    }
    if (lower.includes("edit") || lower.includes("writing")) {
      return `editing file (${durationStr})`;
    }
    if (lower.includes("read") || lower.includes("inspect")) {
      return `reading file (${durationStr})`;
    }
    if (lower.includes("search") || lower.includes("grep")) {
      return `searching (${durationStr})`;
    }
    if (lower.includes("think")) {
      return `thinking (${durationStr})`;
    }

    // Default compact fallback
    return `${trimmed.slice(0, 24)} (${durationStr})`;
  }
}
