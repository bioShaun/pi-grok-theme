import { overlayCoding } from "./overlay-coding.js";
import { overlayDay } from "./overlay-day.js";

// open-tui uses thinking tokens for footer text AND the editor rail.
// Keep these readable; separating text/rail styling needs an upstream API.
export function companionOverlay(base, name, errorSurface) {
  return {
    ...base,
    name,
    varsExtra: { ...base.varsExtra, errorSurface },
    colors: {
      ...base.colors,
      text: "fg",
      thinkingText: "muted",
      thinkingMinimal: "muted",
      thinkingLow: "muted",
      thinkingMedium: "muted",
      thinkingHigh: "fgSecondary",
      thinkingXhigh: "fgSecondary",
      thinkingMax: "amber",
      toolErrorBg: "errorSurface",
    },
  };
}
export const overlayOpen = companionOverlay(overlayCoding, "grok-open", "#281B20");
export const overlayOpenDay = companionOverlay(overlayDay, "grok-open-day", "#F0DDDF");
