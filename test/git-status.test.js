import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { parseGitPorcelain, getGitFooterInfo, clearGitFooterCache } from "../footer.ts";

test("parseGitPorcelain counts staged/dirty/untracked (index+worktree columns)", () => {
  const sample = [
    "## main...origin/main",
    "M  staged.txt",
    " M dirty.txt",
    "MM both.txt",
    "?? untracked.txt",
  ].join("\n");
  const c = parseGitPorcelain(sample);
  assert.equal(c.staged, 2); // staged.txt + both.txt
  assert.equal(c.dirty, 2);  // dirty.txt + both.txt
  assert.equal(c.untracked, 1);
});

test("getGitFooterInfo uses TTL cache and clearGitFooterCache", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pigt-"));
  try {
    spawnSync("git", ["init"], { cwd: dir, encoding: "utf8" });
    spawnSync("git", ["config", "user.email", "t@t"], { cwd: dir });
    spawnSync("git", ["config", "user.name", "t"], { cwd: dir });
    spawnSync("git", ["commit", "--allow-empty", "-m", "i"], { cwd: dir, encoding: "utf8" });
    clearGitFooterCache();
    const a = getGitFooterInfo(dir);
    assert.ok(a.branch, `expected branch, got ${JSON.stringify(a)}`);
    const b = getGitFooterInfo(dir);
    assert.deepEqual(b, a);
    clearGitFooterCache();
    const c = getGitFooterInfo(dir);
    assert.equal(c.branch, a.branch);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
