/** @typedef {{ name: string, varsExtra?: Record<string,string>, colors: Record<string,string>, export: Record<string,string> }} ThemeOverlay */

/** @type {ThemeOverlay} */
export const overlayDay = {
  name: "grok-build-day",
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
    mdListBullet: "cyan",

    toolDiffAdded: "green",
    toolDiffRemoved: "red",
    toolDiffContext: "fgSecondary",

    syntaxComment: "muted",
    syntaxKeyword: "purple",
    syntaxFunction: "blue",
    syntaxVariable: "fg",
    syntaxString: "green",
    syntaxNumber: "orange",
    syntaxType: "cyan",
    syntaxOperator: "fgSecondary",
    syntaxPunctuation: "fgSecondary",

    thinkingOff: "borderMuted",
    thinkingMinimal: "border",
    thinkingLow: "dim",
    thinkingMedium: "muted",
    thinkingHigh: "fgSecondary",
    thinkingXhigh: "blue",
    thinkingMax: "amber",

    bashMode: "amber",
  },
  export: {
    pageBg: "#EEEEEE",
    cardBg: "#E4E4E4",
    infoBg: "#DADADA",
  },
};
