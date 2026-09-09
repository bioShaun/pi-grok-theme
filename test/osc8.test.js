import test from "node:test";
import assert from "node:assert/strict";

import { toFileUrl, wrapOsc8Hyperlink, stripOsc8, visibleWidth, formatCwd } from "../footer.ts";

test("toFileUrl builds file:// for absolute paths", () => {
  const url = toFileUrl("/tmp/demo");
  assert.ok(url?.startsWith("file://"));
  assert.ok(url.includes("tmp"));
});

test("toFileUrl soft-fails for relative paths", () => {
  assert.equal(toFileUrl("relative/path"), undefined);
});

test("wrapOsc8Hyperlink + stripOsc8: visible width equals label width", () => {
  const label = "~/pi/pi-grok-theme";
  const wrapped = wrapOsc8Hyperlink("file:///tmp/demo", label);
  assert.ok(wrapped.includes("\x1b]8;;"));
  assert.equal(stripOsc8(wrapped), label);
  assert.equal(visibleWidth(wrapped), visibleWidth(label));
});

test("formatCwd still produces a plain label without OSC", () => {
  const formatted = formatCwd("/tmp/demo");
  assert.ok(!formatted.includes("\x1b"));
});
