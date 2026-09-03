# 05: Add coalesced rendering and dual timing

**What to build:** Keep active phase and whole-turn duration visibly current without rendering once per streamed token or leaking timers across turns and sessions.

**Blocked by:** 02: Introduce the Adaptive Chrome foundation.

**Status:** resolved

- [x] Active turns refresh elapsed presentation at a bounded cadence no faster than the v0.4 specification allows.
- [x] Phase elapsed time resets on thinking, streaming, and tool-state transitions.
- [x] Whole-turn elapsed time remains continuous until the assistant turn ends.
- [x] High-frequency message updates are coalesced rather than each forcing an immediate render.
- [x] At most one render timer exists, and it cannot keep the process alive when unreferenced timers are supported.
- [x] Turn end and session shutdown stop the timer and request one final render.
- [x] Tests use a controllable clock and prove repeated lifecycle calls are idempotent.

## Comments

Implemented 2026-09-03.

- **`render-clock.ts` (new):** `RenderClock` with `RENDER_INTERVAL_MS = 250` (spec §4.4 budget). `start()` arms exactly one re-arming timer (repeated starts are no-ops), calls `unref()` when the host timer supports it, ticks request one render per interval and re-arm, `stop()` is idempotent, and `markDirty()` coalesces while running (falls back to a single immediate render outside an active turn so isolated updates aren't lost). `setTimer`/`clearTimer` are injectable for deterministic tests.
- **Timer ownership (spec §5.3):** only `index.ts` instantiates the clock; renderers and state objects create no timers. `registerGrokBuildExtension(pi, { renderClock })` accepts injected clock deps for tests.
- **Lifecycle rewiring:** `message_start` → start clock exactly once + immediate render; `message_update` → `markDirty()` (per-token updates no longer force renders); `tool_execution_start/end` → `markDirty()`; `message_end` → stop clock + one final render; `session_shutdown` and `session_start` stop the clock (stale sessions never inherit timers). Idle state never starts the clock.
- **Dual timing:** the status label now shows **phase** duration (resets on thinking/streaming/tool transitions per spec §4.4), while the semantic badge continues to carry `turnElapsedMs` for the full preset in ticket 07. `filterWorkingMessage` keeps turn-based durations (out of scope here).
- **Tests (`test/render-clock.test.js`, 10 new):** fake timer wheel with manual ticking; exactly-one-timer under repeated starts; unref called when supported and absence tolerated; bounded cadence + re-arm; coalescing (40 dirty marks → 1 tick render); stop idempotency; phase/turn clock continuity with injected timestamps; repeated `startTurn`/`startTool`/`endTool`/`endTurn` idempotency; extension-level harness proving token bursts are bounded, turn end stops the timer and renders once finally, shutdown stops the timer, and repeated `session_start` leaves the clock stopped while idle. Suite: 54 tests green, `tsc --noEmit` clean.

