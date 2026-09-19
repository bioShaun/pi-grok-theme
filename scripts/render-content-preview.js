/** Public Pi rendering components, isolated per theme by the parent renderer. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { initTheme, getMarkdownTheme, highlightCode, renderDiff, ToolExecutionComponent } from "@earendil-works/pi-coding-agent";
import { Markdown, SelectList } from "@earendil-works/pi-tui";
import { loadBundledTheme, PREVIEW_CWD } from "./render-previews.js";
// Child process only: freeze the host tool renderer's elapsed-time labels.
Date.now = () => 1700000000000;
const name = process.argv[2];
const theme = loadBundledTheme(name);
initTheme(name, false);
// initTheme silently falls back on load errors: never publish a mislabeled preview.
assert.equal(getMarkdownTheme().heading("probe"), theme.fg("mdHeading", "probe"));
const md = new Markdown("# Review the change\n\nReadable **primary text**, `inline code`, and [documentation](https://example.invalid).\n\n> Secondary text stays readable on the matching terminal background.\n\n- Inspect the change\n- Run the checks\n\n```typescript\nconst count: number = 3;\nif (count > 0) console.log(\"ready\");\n```", 1, 0, getMarkdownTheme(), { color: (s) => theme.fg("text", s) });
const tui = { requestRender() {} };
const makeTool = (id, args, result) => {
  const component = new ToolExecutionComponent("bash", id, args, { showImages: false }, undefined, tui, PREVIEW_CWD);
  component.markExecutionStarted(); component.setArgsComplete(); component.updateResult(result);
  return component.render(80);
};
const select = new SelectList([
  { value: "footer", label: "Footer", description: "Metadata and activity" },
  { value: "header", label: "Header", description: "Compact or boxed" },
  { value: "motion", label: "Motion", description: "Normal or quiet" },
], 3, { selectedPrefix: (s) => theme.fg("accent", s), selectedText: (s) => theme.fg("accent", s), description: (s) => theme.fg("muted", s), scrollInfo: (s) => theme.fg("muted", s), noMatch: (s) => theme.fg("muted", s) });
select.setFilter("Header");
const sections = [
  { caption: `${name} — real Pi Markdown and syntax highlighting`, lines: md.render(80) },
  { caption: "real Pi tool output", lines: makeTool("success", { command: "npm test" }, { content: [{ type: "text", text: "All fixture checks passed.\nNo failed checks." }], isError: false }) },
  { caption: "real Pi tool error", lines: makeTool("error", { command: "npm run missing" }, { content: [{ type: "text", text: "Missing script: missing\nCheck the package scripts and try again." }], isError: true }) },
  { caption: "real Pi Diff — added / removed / context", lines: renderDiff(" 1 const mode = settings.motion;\n-2 const tick = 250;\n+2 const tick = 1000;\n 3 render(mode, tick);").split("\n") },
  { caption: "real Pi filtered selection", lines: select.render(80) },
];
assert.ok(highlightCode("const x = 1;", "typescript").length);
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(sections));
else process.stdout.write(JSON.stringify(sections));
