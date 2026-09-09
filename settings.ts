/**
 * settings.ts — persistent footer/header prefs for pi-grok-theme
 *
 * Pi has no package-scoped settings API, so the extension mirrors the host
 * convention of writing under `~/.pi/agent/` (see Pi's own settings.json).
 * Defaults: footer preset `default`, header off, unicode glyphs, dot separator.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { FOOTER_PRESETS, SEPARATOR_STYLES, type FooterPreset, type SeparatorStyle } from "./footer.ts";
import { GLYPH_DENSITIES, type GlyphDensity } from "./glyphs.ts";

export type { GlyphDensity, SeparatorStyle };

export interface GrokThemeSettings {
  footerPreset: FooterPreset;
  showHeader: boolean;
  glyphDensity: GlyphDensity;
  separatorStyle: SeparatorStyle;
}

export const DEFAULT_GROK_SETTINGS: GrokThemeSettings = {
  footerPreset: "default",
  showHeader: false,
  glyphDensity: "unicode",
  separatorStyle: "dot",
};

/** Filename under `~/.pi/agent/` (and under an injected agentDir in tests). */
export const SETTINGS_FILENAME = "pi-grok-theme.json";

export function defaultSettingsPath(agentDir?: string): string {
  const dir = agentDir ?? path.join(os.homedir(), ".pi", "agent");
  return path.join(dir, SETTINGS_FILENAME);
}

function isFooterPreset(value: unknown): value is FooterPreset {
  return typeof value === "string" && (FOOTER_PRESETS as readonly string[]).includes(value);
}

function isGlyphDensity(value: unknown): value is GlyphDensity {
  return typeof value === "string" && (GLYPH_DENSITIES as readonly string[]).includes(value);
}

function isSeparatorStyle(value: unknown): value is SeparatorStyle {
  return typeof value === "string" && (SEPARATOR_STYLES as readonly string[]).includes(value);
}

/** Load prefs; missing/invalid files yield defaults. Migrates `auto` → `default` with write-back. Never throws. */
export function loadSettings(settingsPath: string = defaultSettingsPath()): GrokThemeSettings {
  try {
    if (!fs.existsSync(settingsPath)) return { ...DEFAULT_GROK_SETTINGS };
    const raw = JSON.parse(fs.readFileSync(settingsPath, "utf8")) as Record<string, unknown>;
    const hadAuto = raw.footerPreset === "auto";

    let footerPreset: FooterPreset;
    if (hadAuto || raw.footerPreset === undefined || raw.footerPreset === null) {
      footerPreset = "default";
    } else if (isFooterPreset(raw.footerPreset)) {
      footerPreset = raw.footerPreset;
    } else {
      footerPreset = DEFAULT_GROK_SETTINGS.footerPreset;
    }

    const showHeader =
      typeof raw.showHeader === "boolean" ? raw.showHeader : DEFAULT_GROK_SETTINGS.showHeader;
    const glyphDensity = isGlyphDensity(raw.glyphDensity)
      ? raw.glyphDensity
      : DEFAULT_GROK_SETTINGS.glyphDensity;
    const separatorStyle = isSeparatorStyle(raw.separatorStyle)
      ? raw.separatorStyle
      : DEFAULT_GROK_SETTINGS.separatorStyle;

    const loaded: GrokThemeSettings = { footerPreset, showHeader, glyphDensity, separatorStyle };

    // Write-back when on-disk contained legacy "auto" (best-effort).
    if (hadAuto) {
      saveSettings(loaded, settingsPath);
    }

    return loaded;
  } catch {
    return { ...DEFAULT_GROK_SETTINGS };
  }
}

/** Persist prefs; creates the parent directory when needed. Never throws. Never writes `auto`. */
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
          glyphDensity: settings.glyphDensity,
          separatorStyle: settings.separatorStyle,
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
