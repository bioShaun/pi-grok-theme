/** Persistent preferences. Writes commit a complete snapshot atomically. */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { FOOTER_PRESETS, SEPARATOR_STYLES, type FooterPreset, type SeparatorStyle } from "./footer.ts";
import { GLYPH_DENSITIES, type GlyphDensity } from "./glyphs.ts";
import type { MotionMode } from "./status.ts";
export type { GlyphDensity, SeparatorStyle, MotionMode };
export type HeaderStyle = "compact" | "boxed";
export interface GrokThemeSettings {
  footerPreset: FooterPreset;
  showHeader: boolean;
  glyphDensity: GlyphDensity;
  separatorStyle: SeparatorStyle;
  headerStyle: HeaderStyle;
  motion: MotionMode;
}
export const DEFAULT_GROK_SETTINGS: GrokThemeSettings = {
  footerPreset: "default", showHeader: false, glyphDensity: "auto",
  separatorStyle: "dot", headerStyle: "compact", motion: "normal",
};
export const SETTINGS_FILENAME = "pi-grok-theme.json";
export function defaultSettingsPath(agentDir?: string): string {
  return path.join(agentDir ?? process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), ".pi", "agent"), SETTINGS_FILENAME);
}
function member<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return typeof value === "string" && values.includes(value as T) ? value as T : fallback;
}
export function loadSettings(settingsPath = defaultSettingsPath()): GrokThemeSettings {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_GROK_SETTINGS };
    const loaded: GrokThemeSettings = {
      footerPreset: member(raw.footerPreset, FOOTER_PRESETS, "default"),
      showHeader: typeof raw.showHeader === "boolean" ? raw.showHeader : false,
      glyphDensity: member(raw.glyphDensity, GLYPH_DENSITIES, "auto"),
      separatorStyle: member(raw.separatorStyle, SEPARATOR_STYLES, "dot"),
      headerStyle: member(raw.headerStyle, ["compact", "boxed"], raw.headerStyle === undefined && raw.showHeader === true ? "boxed" : "compact"),
      motion: member(raw.motion, ["normal", "quiet"], "normal"),
    };
    if (raw.footerPreset === "auto" || (raw.showHeader === true && raw.headerStyle === undefined)) {
      saveSettings(loaded, settingsPath);
    }
    return loaded;
  } catch { return { ...DEFAULT_GROK_SETTINGS }; }
}
export type SaveSettingsResult = { success: true } | { success: false; error: string };
export function saveSettings(settings: GrokThemeSettings, settingsPath = defaultSettingsPath()): SaveSettingsResult {
  let temporary: string | undefined;
  let fd: number | undefined;
  try {
    const directory = path.dirname(settingsPath);
    fs.mkdirSync(directory, { recursive: true });
    temporary = path.join(directory, `.${path.basename(settingsPath)}.${randomUUID()}.pending`);
    fd = fs.openSync(temporary, "wx", 0o600);
    fs.writeFileSync(fd, `${JSON.stringify({ ...DEFAULT_GROK_SETTINGS, ...settings }, null, 2)}\n`, "utf8");
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temporary, settingsPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch {} }
    if (temporary) { try { fs.unlinkSync(temporary); } catch {} }
  }
}
