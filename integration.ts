/** Companion ownership and opt-in presets for pi-open-tui. No upstream monkey patches. */
import * as fs from "node:fs";
import * as path from "node:path";
import { defaultSettingsPath, saveJsonFile, type IntegrationMode, type SaveSettingsResult } from "./settings.ts";

export const INTEGRATION_MODES = ["auto", "standalone", "companion"] as const;
export const OPEN_TUI_PROFILES = ["daily", "diagnostic"] as const;
export type OpenTuiProfile = typeof OPEN_TUI_PROFILES[number];
export function openTuiSettingsPath(grokSettingsPath = defaultSettingsPath()): string {
  return path.join(path.dirname(grokSettingsPath), "open-tui.json");
}
export function usesCompanion(
  mode: IntegrationMode,
  getCommands: (() => { name: string; source?: string }[]) | undefined,
  configPath: string,
): boolean {
  if (mode !== "auto") return mode === "companion";
  try {
    if (!getCommands?.().some(command => command.name === "open-tui" && command.source === "extension")) return false;
  } catch { return false; }
  try { return JSON.parse(fs.readFileSync(configPath, "utf8"))?.enabled !== false; }
  catch { return true; } // open-tui also defaults to enabled for missing/invalid config.
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
/** Merge only density controls. Language, icons, cursor, extension statuses and future fields survive. */
export function withOpenTuiProfile(current: Record<string, unknown>, profile: OpenTuiProfile): Record<string, unknown> {
  for (const key of ["footerSegments", "telemetry"]) {
    if (current[key] !== undefined && !object(current[key])) throw new Error(`Invalid open-tui ${key}: expected an object`);
  }
  const detailed = profile === "diagnostic";
  return {
    ...current,
    inlineFooter: !detailed,
    footerSegments: { ...(current.footerSegments as object ?? {}), runtime: detailed, tokens: detailed, cost: detailed },
    telemetry: { ...(current.telemetry as object ?? {}), enabled: true, tps: detailed, ttft: detailed,
      duration: true, tokens: detailed, stalls: true, cost: detailed },
  };
}
export function saveOpenTuiProfile(profile: OpenTuiProfile, configPath: string): SaveSettingsResult {
  try {
    let current: unknown = {};
    try { current = JSON.parse(fs.readFileSync(configPath, "utf8")); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    if (!object(current)) throw new Error("Invalid open-tui config: expected an object");
    return saveJsonFile(withOpenTuiProfile(current, profile), configPath);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
