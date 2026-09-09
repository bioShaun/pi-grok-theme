/**
 * settings.ts — persistent footer/header prefs for pi-grok-theme
 *
 * Pi has no package-scoped settings API, so the extension mirrors the host
 * convention of writing under `~/.pi/agent/` (see Pi's own settings.json).
 * Defaults match the historical session-local behavior: footer preset `auto`,
 * header disabled.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { FOOTER_PRESETS, type FooterPreset } from "./footer.ts";

export interface GrokThemeSettings {
  footerPreset: FooterPreset;
  showHeader: boolean;
}

export const DEFAULT_GROK_SETTINGS: GrokThemeSettings = {
  footerPreset: "auto",
  showHeader: false,
};

/** Filename under `~/.pi/agent/` (and under an injected agentDir in tests). */
export const SETTINGS_FILENAME = "pi-grok-theme.json";

export function defaultSettingsPath(agentDir?: string): string {
  const dir = agentDir ?? path.join(os.homedir(), ".pi", "agent");
  return path.join(dir, SETTINGS_FILENAME);
}

/** Load prefs; missing/invalid files yield defaults. Never throws. */
export function loadSettings(settingsPath: string = defaultSettingsPath()): GrokThemeSettings {
  try {
    if (!fs.existsSync(settingsPath)) return { ...DEFAULT_GROK_SETTINGS };
    const raw = JSON.parse(fs.readFileSync(settingsPath, "utf8")) as Partial<GrokThemeSettings>;
    const footerPreset =
      typeof raw.footerPreset === "string" && FOOTER_PRESETS.includes(raw.footerPreset as FooterPreset)
        ? (raw.footerPreset as FooterPreset)
        : DEFAULT_GROK_SETTINGS.footerPreset;
    const showHeader =
      typeof raw.showHeader === "boolean" ? raw.showHeader : DEFAULT_GROK_SETTINGS.showHeader;
    return { footerPreset, showHeader };
  } catch {
    return { ...DEFAULT_GROK_SETTINGS };
  }
}

/** Persist prefs; creates the parent directory when needed. Never throws. */
export function saveSettings(
  settings: GrokThemeSettings,
  settingsPath: string = defaultSettingsPath(),
): void {
  try {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(
      settingsPath,
      `${JSON.stringify(
        {
          footerPreset: settings.footerPreset,
          showHeader: settings.showHeader,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  } catch {
    // Persistence is best-effort; chrome must keep working without it.
  }
}
