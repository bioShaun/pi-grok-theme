/**
 * tps.ts — Honest turn-average output token rate ("tok/s") tracker for pi-grok-build.
 *
 * Design contract (R2, frozen by planner):
 * - tok/s = message_end.assistantMessage.usage.output ÷ wall-clock seconds of the turn.
 * - Both inputs come from real event payload fields (message timestamps + usage.output).
 *   No estimation, no chars/4 heuristics, no fallback fabrication.
 * - Hidden (returns undefined) when: usage missing/zero, turn < 0.5s, or result <= 0/NaN.
 *
 * This module is pure state + math: it never touches ctx, never does IO, and only
 * accepts numbers. Tests inject fixed timestamps so the math is deterministic.
 */

/** Footer status slot key. footer.ts renders every setStatus key via extraStatuses. */
export const TPS_STATUS_KEY = "grok-tps";

/** Turns shorter than this are not worth reporting (R2 spec, fixed threshold). */
export const MIN_TURN_SECONDS = 0.5;

/** Max visible width of the status text (footer budget, R2 spec). */
export const TPS_MAX_WIDTH = 12;

/** Minimal sink interface — satisfied by ctx.ui (setStatus). */
export interface TpsStatusSink {
  setStatus(key: string, text: string | undefined): void;
}

export class TpsTracker {
  private currentTurnStartTs: number | null = null;
  private lastEmittedValue: string | undefined = undefined;

  /** Record the turn start (event.message.timestamp, ms) and forget the last emitted value. */
  onAssistantMessageStart(timestamp: number): void {
    this.currentTurnStartTs = timestamp;
    this.lastEmittedValue = undefined;
  }

  /**
   * Compute the turn-average output rate.
   * Returns "↑ <N> tok/s" or undefined when any hide condition holds.
   */
  onAssistantMessageEnd(
    timestamp: number,
    outputTokens: number | null | undefined,
  ): string | undefined {
    const startTs = this.currentTurnStartTs;
    this.currentTurnStartTs = null;
    if (startTs === null) return undefined;

    // Hide condition 1: usage missing or zero output
    if (outputTokens === null || outputTokens === undefined || outputTokens === 0) {
      return undefined;
    }

    const seconds = (timestamp - startTs) / 1000;
    // Hide condition 2: turn too short to be meaningful (also guards negative durations)
    if (seconds < MIN_TURN_SECONDS) return undefined;

    const tps = outputTokens / seconds;
    // Hide condition 3: defensive catch-all for NaN/Infinity/<=0
    if (!Number.isFinite(tps) || tps <= 0) return undefined;

    let value = `↑ ${Math.round(tps)} tok/s`;
    if (value.length > TPS_MAX_WIDTH) {
      // Defensive compact form for unrealistically high rates (≥ ~10k tok/s):
      // keeps the ≤12 visible-width budget intact.
      value = `↑ ${Math.round(tps / 1000)}k tok/s`;
    }

    this.lastEmittedValue = value;
    return value;
  }

  /**
   * Immediately clear the footer slot. Unconditional by design: setStatus(key, undefined)
   * on an unset key is a no-op delete, and the R2 spec requires a clear on every
   * assistant message_start so stale values never ride into a new turn.
   */
  clearNow(ui: TpsStatusSink): void {
    ui.setStatus(TPS_STATUS_KEY, undefined);
    this.lastEmittedValue = undefined;
  }
}
