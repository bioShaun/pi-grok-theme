/**
 * theme-quality.js — v0.4 release gate for bundled themes
 *
 * Release-gate checks required by the v0.4 quality baseline:
 * 1. every bundled theme validates against the Pi theme schema
 *    (fixture copied from upstream; see test/fixtures/README.md);
 * 2. every theme explicitly defines ALL required AND optional tokens;
 * 3. variable references resolve to defined `vars` entries;
 * 4. WCAG contrast gates cover primary text, muted text, warnings, errors,
 *    and diff colors on their relevant surfaces.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const THEMES_DIR = path.resolve("themes");
const SCHEMA_PATH = path.resolve("test/fixtures/theme-schema.json");
const THEME_FILES = ["grok-build-coding.json", "grok-build.json", "grok-build-day.json"];

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));

// ---------------------------------------------------------------------------
// Minimal JSON Schema (draft-07 subset) validator covering the constructs the
// Pi theme schema uses: type, required, properties, additionalProperties,
// pattern, minimum/maximum, oneOf, and local $ref (#/$defs/...).
// ---------------------------------------------------------------------------

function resolveRef(ref) {
  assert.ok(ref.startsWith("#/"), `unsupported non-local ref: ${ref}`);
  let node = schema;
  for (const part of ref.slice(2).split("/")) {
    node = node[part.replace(/~1/g, "/").replace(/~0/g, "~")];
    assert.ok(node !== undefined, `schema ref target missing: ${ref}`);
  }
  return node;
}

function validateAgainstSchema(value, node, errors, where = "(root)") {
  if (node.$ref) {
    return validateAgainstSchema(value, resolveRef(node.$ref), errors, where);
  }
  if (node.oneOf) {
    const attempts = node.oneOf.map((branch) => {
      const branchErrors = [];
      validateAgainstSchema(value, branch, branchErrors, where);
      return branchErrors;
    });
    if (!attempts.some((e) => e.length === 0)) {
      errors.push(`${where}: does not match any oneOf branch (${attempts.map((e) => e.join("; ")).join(" | ")})`);
    }
    return;
  }
  const type = node.type;
  if (type) {
    const actual = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
    const ok =
      (type === "object" && actual === "object") ||
      (type === "string" && actual === "string") ||
      (type === "integer" && actual === "number" && Number.isInteger(value)) ||
      (type === "number" && actual === "number") ||
      (type === "boolean" && actual === "boolean") ||
      (type === "array" && actual === "array");
    if (!ok) {
      errors.push(`${where}: expected ${type}, got ${actual}`);
      return;
    }
  }
  if (typeof value === "string" && node.pattern) {
    if (!new RegExp(node.pattern).test(value)) {
      errors.push(`${where}: ${JSON.stringify(value)} does not match pattern ${node.pattern}`);
    }
  }
  if (typeof value === "number" && type === "integer") {
    if (node.minimum !== undefined && value < node.minimum) errors.push(`${where}: ${value} < minimum ${node.minimum}`);
    if (node.maximum !== undefined && value > node.maximum) errors.push(`${where}: ${value} > maximum ${node.maximum}`);
  }
  if (type === "object") {
    for (const key of node.required ?? []) {
      if (!(key in value)) errors.push(`${where}: missing required property "${key}"`);
    }
    const props = node.properties ?? {};
    if (node.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in props)) errors.push(`${where}: additional property "${key}" not allowed`);
      }
    }
    for (const [key, sub] of Object.entries(props)) {
      if (key in value) validateAgainstSchema(value[key], sub, errors, `${where}.${key}`);
    }
    if (node.additionalProperties && node.additionalProperties !== false && typeof node.additionalProperties === "object") {
      for (const [key, sub] of Object.entries(value)) {
        if (!(key in props)) validateAgainstSchema(sub, node.additionalProperties, errors, `${where}.${key}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex) {
  const clean = hex.replace(/^#/, "");
  assert.match(clean, /^[0-9a-fA-F]{6}$/, `not a 6-digit hex color: ${hex}`);
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]) {
  const lin = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrastRatio(fgHex, bgHex) {
  const l1 = relativeLuminance(hexToRgb(fgHex));
  const l2 = relativeLuminance(hexToRgb(bgHex));
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Resolve a colorValue: hex passthrough, var reference, or null when empty (terminal default). */
function resolveColorValue(theme, value) {
  if (typeof value === "number") return null; // 256-color index: contrast not checkable here
  if (value === "" || value === undefined) return null; // terminal default
  if (value.startsWith("#")) return value;
  const resolved = theme.vars?.[value];
  assert.ok(resolved !== undefined, `var reference "${value}" not defined in vars`);
  return resolved;
}

function loadTheme(file) {
  return JSON.parse(fs.readFileSync(path.join(THEMES_DIR, file), "utf8"));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("every bundled theme validates against the Pi theme schema", () => {
  for (const file of THEME_FILES) {
    const theme = loadTheme(file);
    const errors = [];
    validateAgainstSchema(theme, schema, errors, file);
    assert.deepEqual(errors, [], `${file} must satisfy the Pi theme schema`);
  }
});

test("every bundled theme explicitly defines all required and optional tokens", () => {
  const colorTokens = Object.keys(schema.properties.colors.properties);
  assert.ok(colorTokens.length >= 50, `schema exposes the full token set (found ${colorTokens.length})`);
  // Optional-per-schema tokens must still be explicit in bundled themes.
  for (const optional of ["thinkingMax", "scrollbarThumb", "searchMatchBg", "searchMatchText"]) {
    assert.ok(colorTokens.includes(optional), `sanity: ${optional} is part of the schema token set`);
  }

  for (const file of THEME_FILES) {
    const theme = loadTheme(file);
    for (const token of colorTokens) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(theme.colors, token),
        `${file} must explicitly define colors.${token}`,
      );
    }
  }
});

test("every colorValue reference resolves to a defined var or hex", () => {
  for (const file of THEME_FILES) {
    const theme = loadTheme(file);
    const check = (section, value, where) => {
      if (typeof value === "string" && value !== "" && !value.startsWith("#")) {
        assert.ok(
          theme.vars && Object.prototype.hasOwnProperty.call(theme.vars, value),
          `${file}: ${where} references undefined var "${value}"`,
        );
      }
    };
    for (const [token, value] of Object.entries(theme.colors)) {
      check("colors", value, `colors.${token}`);
    }
    for (const [token, value] of Object.entries(theme.export ?? {})) {
      check("export", value, `export.${token}`);
    }
  }
});

test("contrast gates: primary + muted text, warning, error on terminal background", () => {
  // Gates: WCAG AA 4.5:1 for reading text (primary + muted); 3.0:1 for
  // alert/UI colors (warning, error), which render short chrome labels.
  const gates = { primary: 4.5, muted: 4.5, warning: 3.0, error: 3.0 };

  for (const file of THEME_FILES) {
    const theme = loadTheme(file);
    const bg = resolveColorValue(theme, theme.vars.terminalBg);
    assert.ok(bg, `${file}: vars.terminalBg must be a hex color for contrast checks`);

    const primary = resolveColorValue(theme, theme.vars.fg);
    assert.ok(primary, `${file}: vars.fg must be a hex color for contrast checks`);
    const cases = [
      ["primary text", primary, gates.primary],
      ["muted text", resolveColorValue(theme, theme.colors.muted), gates.muted],
      ["warning", resolveColorValue(theme, theme.colors.warning), gates.warning],
      ["error", resolveColorValue(theme, theme.colors.error), gates.error],
    ];
    for (const [label, fg, min] of cases) {
      const ratio = fg ? contrastRatio(fg, bg) : null;
      assert.ok(ratio !== null, `${file}: ${label} must be a checkable hex color`);
      assert.ok(
        ratio >= min,
        `${file}: ${label} contrast ${ratio.toFixed(2)}:1 on ${bg} is below the ${min}:1 gate`,
      );
    }
  }
});

test("contrast gates: diff colors on their tool-box surfaces", () => {
  const min = 3.0;
  for (const file of THEME_FILES) {
    const theme = loadTheme(file);
    const fallbackBg = resolveColorValue(theme, theme.vars.terminalBg);
    const cases = [
      ["toolDiffAdded", "toolSuccessBg"],
      ["toolDiffRemoved", "toolErrorBg"],
      ["toolDiffContext", "toolPendingBg"],
    ];
    for (const [fgToken, bgToken] of cases) {
      const fg = resolveColorValue(theme, theme.colors[fgToken]);
      const surface = resolveColorValue(theme, theme.colors[bgToken]) ?? fallbackBg;
      const ratio = fg && surface ? contrastRatio(fg, surface) : null;
      assert.ok(ratio !== null, `${file}: ${fgToken}/${bgToken} must be checkable hex colors`);
      assert.ok(
        ratio >= min,
        `${file}: ${fgToken} contrast ${ratio.toFixed(2)}:1 on ${surface} is below the ${min}:1 gate`,
      );
    }
  }
});
