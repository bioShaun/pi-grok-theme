/** @typedef {{ name: string, varsExtra?: Record<string,string>, colors: Record<string,string>, export: Record<string,string> }} ThemeOverlay */

/** @type {ThemeOverlay} */
export const overlayBase = {
  name: "grok-build",
  colors: {
    accent: "blue",

    border: "border",
    borderAccent: "blue",
    borderMuted: "borderMuted",

    success: "green",
    error: "red",
    warning: "amber",

    muted: "muted",
    dim: "dim",
    text: "",
    thinkingText: "muted",

    selectedBg: "surface3",
    scrollbarThumb: "border",

    searchMatchBg: "surface3",
    searchMatchText: "fg",

    userMessageBg: "surface2",
    userMessageText: "fg",

    customMessageBg: "surface1",
    customMessageText: "fg",
    customMessageLabel: "amber",

    toolPendingBg: "surface1",
    toolSuccessBg: "surface1",
    toolErrorBg: "surface1",

    toolTitle: "blue",
    toolOutput: "fgSecondary",

    mdHeading: "cyan",
    mdLink: "blue",
    mdLinkUrl: "cyan",
    mdCode: "cyan",
    mdCodeBlock: "fg",
    mdCodeBlockBorder: "borderMuted",
    mdQuote: "fgSecondary",
    mdQuoteBorder: "border",
    mdHr: "borderMuted",
    mdListBullet: "blue",

    toolDiffAdded: "green",
    toolDiffRemoved: "red",
    toolDiffContext: "fgSecondary",

    syntaxComment: "muted",
    syntaxKeyword: "blue",
    syntaxFunction: "fg",
    syntaxVariable: "fg",
    syntaxString: "fgSecondary",
    syntaxNumber: "fgSecondary",
    syntaxType: "cyan",
    syntaxOperator: "fgSecondary",
    syntaxPunctuation: "fgSecondary",

    thinkingOff: "borderMuted",
    thinkingMinimal: "borderMuted",
    thinkingLow: "border",
    thinkingMedium: "border",
    thinkingHigh: "border",
    thinkingXhigh: "dim",
    thinkingMax: "amber",

    bashMode: "amber",
  },
  export: {
    pageBg: "#0A0A0A",
    cardBg: "#141414",
    infoBg: "#1A1A1A",
  },
};
