import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { renderOpenTuiPreviews } from "../scripts/render-open-tui-preview.js";

test("real open-tui editor/footer fit widths and match committed previews", { skip: !process.env.PI_OPEN_TUI_DIR }, async () => {
  const artifacts = await renderOpenTuiPreviews(process.env.PI_OPEN_TUI_DIR);
  for (const [name, contents] of Object.entries(artifacts)) {
    assert.equal(fs.readFileSync(`docs/previews/${name}`, "utf8"), contents, `${name} is stale`);
  }
});
