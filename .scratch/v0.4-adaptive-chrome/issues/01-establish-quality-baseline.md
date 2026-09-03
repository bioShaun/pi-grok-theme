# 01: Establish the v0.4 quality baseline

**What to build:** Add an automated release baseline so every subsequent v0.4 slice is checked for runtime regressions, theme-schema completeness, readable contrast, and type correctness before it can land.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] The existing test suite runs in CI on the supported Node runtime matrix.
- [x] Type checking covers the extension source without emitting build artifacts.
- [x] Every bundled theme is validated against the Pi theme schema.
- [x] Every bundled theme explicitly defines all required and optional Pi theme tokens.
- [x] Automated contrast checks cover primary text, muted text, warnings, errors, and diff colors on their relevant surfaces.
- [x] The checks are documented as the required release gate for later tickets.

## Comments

Implemented 2026-09-02.

- **CI:** `.github/workflows/ci.yml` runs `npm run typecheck` + `npm test` on Node 22 and 24.
- **Type checking:** `tsconfig.json` (strict, `noEmit`, `allowImportingTsExtensions`, NodeNext) + `npm run typecheck`. Found and fixed two real v0.3 defects while bringing the source up to strict-clean:
  - `index.ts` registered tool handlers under nonexistent event names `tool_start`/`tool_end` (correct names: `tool_execution_start`/`tool_execution_end`), so tool state never updated against real Pi.
  - `footer.ts` didn't normalize `ContextUsage.tokens/percent` (`number | null`) and could return `undefined` from `shortenModelName` under `noUncheckedIndexedAccess`.
  - The `/grok` command handler is now `async` to match `RegisteredCommand`.
- **Schema validation:** `test/fixtures/theme-schema.json` (verbatim upstream copy, see `test/fixtures/README.md`) + a draft-07-subset validator in `test/theme-quality.js`. Validates all three bundled themes.
- **Token completeness:** every theme must explicitly define every `colors.*` token from the schema, including the optional ones (`thinkingMax`, `scrollbarThumb`, `searchMatchBg`, `searchMatchText`); var references must resolve.
- **Contrast gates:** primary & muted text ≥ 4.5:1 on `terminalBg`; warning & error ≥ 3.0:1; diff colors ≥ 3.0:1 on their tool-box surfaces (`toolDiffAdded`/`toolSuccessBg`, `toolDiffRemoved`/`toolErrorBg`, `toolDiffContext`/`toolPendingBg`). Current margins: dark themes 6.2–15.1:1 for checked text tokens; day theme muted 4.53:1, warning 4.33:1, error 4.16:1, diff 3.8–8.95:1. `dim` is intentionally subtle and not gated.
- **Documentation:** README "Development & Release Gate" section documents all gates as the required landing bar (`npm run typecheck && npm test`). Chinese README sync is ticket 10's scope.
- Test runner now discovers the whole `test/` directory (`node --test "test/**/*.js"`): 15 tests pass, `tsc --noEmit` clean.
