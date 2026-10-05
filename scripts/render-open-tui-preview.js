/** Real pi-open-tui renderer integration. Pass its installed package directory explicitly. */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import * as Pi from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import { loadBundledTheme, toTerminalSvg, contentPreviewSections } from "./render-previews.js";
import { withOpenTuiProfile } from "../integration.ts";

const root = path.resolve(new URL("..", import.meta.url).pathname);
export async function renderOpenTuiPreviews(packageDir) {
  assert.ok(packageDir, "Pass a pi-open-tui package directory or set PI_OPEN_TUI_DIR");
  const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8"));
  assert.equal(pkg.name, "pi-open-tui");
  const base = path.join(root, ".scratch/test-tmp"); fs.mkdirSync(base, { recursive: true });
  // Node cannot strip TypeScript inside node_modules. Copy unmodified source to a local scratch directory.
  const stage = fs.mkdtempSync(path.join(base, "open-preview-"));
  const source = path.join(packageDir, "extensions/open-tui");
  const files = fs.readdirSync(source).filter(name => name.endsWith(".ts")).sort();
  const hash = createHash("sha256");
  for (const name of files) { const bytes = fs.readFileSync(path.join(source, name)); hash.update(name); hash.update(bytes); fs.writeFileSync(path.join(stage, name), bytes); }
  try {
    const load = name => import(pathToFileURL(path.join(stage, name)).href);
    const { installFooter } = await load("footer.ts");
    const { OpenTuiEditor } = await load("editor.ts");
    const { OpenTuiHeader } = await load("header.ts");
    const { createInitialState, invalidateUsageCache } = await load("state.ts");
    const { DEFAULT_CONFIG } = await load("config.ts");
    const { buildPeekLabel } = await load("peek.ts");
    const { resolveGlyphs } = await load("icons.ts");
    Pi.initTheme("dark", false);
    const artifacts = {};
    for (const name of ["grok-open", "grok-open-day"]) {
      const theme = loadBundledTheme(name);
      const json = JSON.parse(fs.readFileSync(path.join(root, "themes", `${name}.json`)));
      let config = withOpenTuiProfile({ ...structuredClone(DEFAULT_CONFIG), icons: { mode: "ascii" } }, "daily");
      const ctx = {
        ui: { theme }, hasUI: true, cwd: "/workspace/项目/主题适配",
        model: { id: "claude-sonnet-4", name: "claude-sonnet-4", provider: "anthropic", contextWindow: 200000 },
        getContextUsage: () => ({ tokens: 48000, contextWindow: 200000, percent: 24 }),
        sessionManager: { getCwd: () => "/workspace/项目/主题适配", getEntries: () => [], getSessionName: () => "Theme integration" },
      };
      const state = { ...createInitialState(), lastDoneIn: 3200 };
      state.git = { ...state.git, branch: "feature/主题适配", modified: 2, staged: 1 };
      const footerData = { getExtensionStatuses: () => new Map([["workflow", "Build / Verify"]]) };
      const meta = { provider: "Anthropic", model: "claude-sonnet-4", effort: "high" };
      invalidateUsageCache();
      const sections = [];
      const terminal = { columns: 160, rows: 40, write() {}, start() {}, stop() {}, hideCursor() {}, showCursor() {} };
      const tui = { terminal, requestRender() {}, setShowHardwareCursor() {}, getShowHardwareCursor: () => false };
      const pi = { getCommands: () => [{ name: "open-tui", source: "extension" }], getThinkingLevel: () => "high" };
      // Header tips are randomized by upstream; a one-command fixture fixes the pool.
      let header;
      const random = Math.random;
      try { Math.random = () => 0; header = new OpenTuiHeader(pi, ctx, tui); }
      finally { Math.random = random; }
      let footerComponent;
      ctx.ui.setFooter = factory => {
        footerComponent?.dispose?.();
        footerComponent = factory?.(tui, theme, { ...footerData, onBranchChange: () => () => {} });
      };
      const footer = installFooter(ctx, () => state, () => config, () => meta, { setRequestRender() {}, onBranchChange() {} });
      sections.push({ caption: `${name} + pi-open-tui ${pkg.version}: actual header (100 columns)`, lines: header.render(100) });
      for (const width of [80, 100, 160]) {
        const renderFooter = budget => ({ inlineLines: footer.renderInline(budget), extensionLines: footerComponent.render(budget) });
        const editor = new OpenTuiEditor(tui, { borderColor: text => theme.fg("thinkingHigh", text), selectList: Pi.getSelectListTheme() }, { matches: () => false, getKeys: () => [] }, "block", { enabled: () => true, render: budget => renderFooter(budget).inlineLines });
        editor.borderColor = text => theme.fg("thinkingHigh", text);
        editor.setText("请检查主题适配，并验证失败工具的输出。 / Review the theme integration.");
        const lines = [...editor.render(width), ...renderFooter(width).extensionLines];
        for (const line of lines) assert.ok(visibleWidth(line) <= width, `editor/footer overflows ${width} columns`);
        sections.push({ caption: `Daily: actual editor + inline footer / ${width} columns`, lines });
        config = withOpenTuiProfile(config, "diagnostic");
        footerComponent.invalidate?.();
        const detailedLines = footerComponent.render(width);
        for (const line of detailedLines) assert.ok(visibleWidth(line) <= width, `diagnostic footer overflows ${width}`);
        sections.push({ caption: `Diagnostic: actual footer / ${width} columns`, lines: detailedLines });
        config = withOpenTuiProfile(config, "daily");
        footerComponent.invalidate?.();
      }
      footer.cleanup();
      const peek = buildPeekLabel({ phase: "thinking", tail: "正在检查中文路径和主题颜色的可读性。" }, 0, resolveGlyphs("ascii"), 80, 1);
      sections.push({ caption: "Actual thinking preview", lines: [theme.fg("thinkingText", peek)] });
      sections.push(...contentPreviewSections(name).filter(section => /tool error|Diff/.test(section.caption)));
      artifacts[`${name}-open-tui.svg`] = toTerminalSvg({ background: json.vars.terminalBg, foreground: json.vars.fg, sections });
    }
    artifacts["open-tui-source.json"] = JSON.stringify({ piVersion: JSON.parse(fs.readFileSync(path.join(root, "node_modules/@earendil-works/pi-coding-agent/package.json"))).version, package: pkg.name, version: pkg.version, sourceSha256: hash.digest("hex"), files, widths: [80, 100, 160], iconMode: "ascii", note: "Unmodified upstream renderers; fixture data. Terminal canvas must match the theme. SVG cannot validate terminal animation or font fallback." }, null, 2) + "\n";
    return artifacts;
  } finally { fs.rmSync(stage, { recursive: true, force: true }); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const artifacts = await renderOpenTuiPreviews(process.argv[2] ?? process.env.PI_OPEN_TUI_DIR);
  for (const [name, contents] of Object.entries(artifacts)) {
    const target = path.join(root, "docs/previews", name);
    if (process.argv.includes("--check")) assert.equal(fs.readFileSync(target, "utf8"), contents, `${name} is stale or source version changed`);
    else fs.writeFileSync(target, contents);
  }
  console.log(`pi-open-tui integration: ${Object.keys(artifacts).length} verified artifacts`);
}
