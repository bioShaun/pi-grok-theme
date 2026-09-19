import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { GitStatusProvider, parseGitPorcelain, readGitStatus } from "../git-status.ts";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function createRepository(t) {
  const parent = process.env.TMPDIR;
  assert.ok(parent, "TMPDIR must point to project-local test storage");
  const dir = fs.mkdtempSync(path.join(parent, "git-status-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  git(dir, "init", "-b", "main");
  git(dir, "config", "user.email", "test@example.invalid");
  git(dir, "config", "user.name", "Git Status Test");
  fs.writeFileSync(path.join(dir, "tracked.txt"), "initial\n");
  git(dir, "add", "tracked.txt");
  git(dir, "commit", "-m", "initial");
  return dir;
}

test("parseGitPorcelain counts index and worktree columns", () => {
  const counts = parseGitPorcelain([
    "## main...origin/main", "M  staged.txt", " M dirty.txt", "MM both.txt",
    "?? untracked.txt", "!! ignored.txt",
  ].join("\n"));
  assert.deepEqual(counts, { staged: 2, dirty: 2, untracked: 1 });
});

test("provider coalesces reads, retains good data while refreshing, and honors TTL", async () => {
  const first = deferred();
  const second = deferred();
  const reads = [first, second];
  let readCount = 0;
  let now = 100;
  let changes = 0;
  const provider = new GitStatusProvider({
    onChange: () => changes += 1,
    now: () => now,
    ttlMs: 3_000,
    reader: () => reads[readCount++].promise,
  });
  provider.setContext("/repo");
  const a = provider.refresh();
  const b = provider.refresh();
  assert.strictEqual(a, b);
  assert.equal(readCount, 1);
  first.resolve({ state: "ready", branch: "main", staged: 1, dirty: 2, untracked: 3 });
  await a;
  assert.deepEqual(provider.getSnapshot(), { state: "ready", branch: "main", staged: 1, dirty: 2, untracked: 3 });
  await provider.refresh();
  assert.equal(readCount, 1);
  now += 3_001;
  const refreshing = provider.refresh();
  assert.deepEqual(provider.getSnapshot(), { state: "refreshing", branch: "main", staged: 1, dirty: 2, untracked: 3 });
  second.resolve({ state: "ready", branch: "next", staged: 0, dirty: 0, untracked: 0 });
  await refreshing;
  assert.equal(readCount, 2);
  assert.equal(provider.getSnapshot().branch, "next");
  assert.ok(changes >= 4);
});

test("invalidation during a query schedules one coalesced followup", async () => {
  const first = deferred();
  const second = deferred();
  let reads = 0;
  const provider = new GitStatusProvider({
    onChange() {},
    reader: () => (++reads === 1 ? first.promise : second.promise),
  });
  provider.setContext("/repo");
  const refresh = provider.refresh();
  provider.invalidate();
  provider.invalidate();
  first.resolve({ state: "ready", branch: "old", staged: 0, dirty: 0, untracked: 0 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reads, 2);
  second.resolve({ state: "ready", branch: "new", staged: 1, dirty: 0, untracked: 0 });
  await refresh;
  assert.equal(reads, 2);
  assert.equal(provider.getSnapshot().branch, "new");
});

test("context changes and disposal suppress late results", async () => {
  const oldRead = deferred();
  const newRead = deferred();
  let changes = 0;
  const provider = new GitStatusProvider({
    onChange: () => changes += 1,
    reader: (cwd) => cwd === "/old" ? oldRead.promise : newRead.promise,
  });
  provider.setContext("/old");
  void provider.refresh();
  provider.setContext("/new");
  oldRead.resolve({ state: "ready", branch: "old", staged: 9, dirty: 9, untracked: 9 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(provider.getSnapshot(), { state: "loading" });
  void provider.refresh();
  provider.dispose();
  const before = changes;
  newRead.resolve({ state: "ready", branch: "new", staged: 1, dirty: 1, untracked: 1 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(changes, before);
  assert.notEqual(provider.getSnapshot().branch, "new");
});

test("failure hides counts, retains branch, and can recover", async () => {
  const results = [
    { state: "ready", branch: "main", staged: 1, dirty: 2, untracked: 3 },
    new Error("git failed"),
    { state: "ready", branch: "fixed", staged: 0, dirty: 0, untracked: 0 },
  ];
  const provider = new GitStatusProvider({
    onChange() {},
    reader: async () => {
      const result = results.shift();
      if (result instanceof Error) throw result;
      return result;
    },
  });
  provider.setContext("/repo");
  await provider.refresh();
  await provider.refresh(true);
  assert.deepEqual(provider.getSnapshot(), { state: "error", branch: "main" });
  await provider.refresh(true);
  assert.deepEqual(provider.getSnapshot(), { state: "ready", branch: "fixed", staged: 0, dirty: 0, untracked: 0 });
});

test("provider aborts a timed-out read and reports error", async () => {
  let observedAbort = false;
  const provider = new GitStatusProvider({
    onChange() {},
    timeoutMs: 10,
    reader: (_cwd, { signal }) => new Promise((resolve) => {
      signal.addEventListener("abort", () => {
        observedAbort = true;
        resolve({ state: "error" });
      }, { once: true });
    }),
  });
  provider.setContext("/repo");
  await provider.refresh();
  assert.equal(observedAbort, true);
  assert.deepEqual(provider.getSnapshot(), { state: "error" });
});

test("branch-only reads request no counts", async () => {
  let observedCounts;
  const provider = new GitStatusProvider({
    onChange() {},
    reader: async (_cwd, options) => {
      observedCounts = options.counts;
      return { state: "ready", branch: "main", staged: 99 };
    },
  });
  provider.setContext("/repo", false);
  await provider.refresh();
  assert.equal(observedCounts, false);
  assert.deepEqual(provider.getSnapshot(), { state: "ready", branch: "main" });
});

test("readGitStatus treats a missing Git executable as an error", async () => {
  const previousPath = process.env.PATH;
  process.env.PATH = "";
  try {
    const result = await readGitStatus(process.cwd(), {
      counts: false,
      signal: new AbortController().signal,
    });
    assert.deepEqual(result, { state: "error" });
  } finally {
    process.env.PATH = previousPath;
  }
});

test("readGitStatus handles counts, subdirectories, detached HEAD, worktrees, and non-repositories", async (t) => {
  const repo = createRepository(t);
  const nested = path.join(repo, "nested");
  fs.mkdirSync(nested);
  fs.appendFileSync(path.join(repo, "tracked.txt"), "dirty\n");
  fs.writeFileSync(path.join(repo, "staged.txt"), "staged\n");
  fs.writeFileSync(path.join(repo, "untracked.txt"), "untracked\n");
  git(repo, "add", "staged.txt");
  const counted = await readGitStatus(nested, { counts: true, signal: new AbortController().signal });
  assert.deepEqual(counted, { state: "ready", branch: "main", staged: 1, dirty: 1, untracked: 1 });
  const branchOnly = await readGitStatus(repo, { counts: false, signal: new AbortController().signal });
  assert.deepEqual(branchOnly, { state: "ready", branch: "main" });
  git(repo, "checkout", "--detach");
  const hash = git(repo, "rev-parse", "--short", "HEAD");
  const detached = await readGitStatus(repo, { counts: false, signal: new AbortController().signal });
  assert.deepEqual(detached, { state: "ready", branch: hash });
  const detachedWithCounts = await readGitStatus(repo, { counts: true, signal: new AbortController().signal });
  assert.deepEqual(detachedWithCounts, { state: "ready", branch: hash, staged: 1, dirty: 1, untracked: 1 });
  git(repo, "checkout", "main");
  const worktree = `${repo}-worktree`;
  t.after(() => fs.rmSync(worktree, { recursive: true, force: true }));
  git(repo, "worktree", "add", "-b", "worktree-test", worktree);
  const worktreeResult = await readGitStatus(worktree, { counts: false, signal: new AbortController().signal });
  assert.deepEqual(worktreeResult, { state: "ready", branch: "worktree-test" });
  const outside = fs.mkdtempSync(path.join(process.env.TMPDIR, "not-repo-"));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  const previousCeiling = process.env.GIT_CEILING_DIRECTORIES;
  process.env.GIT_CEILING_DIRECTORIES = process.env.TMPDIR;
  const nonRepository = await readGitStatus(outside, { counts: true, signal: new AbortController().signal });
  if (previousCeiling === undefined) delete process.env.GIT_CEILING_DIRECTORIES;
  else process.env.GIT_CEILING_DIRECTORIES = previousCeiling;
  assert.deepEqual(nonRepository, { state: "not-repo" });
});

test("failed reads back off for the cache interval rather than retrying every frame", async () => {
  let count = 0, now = 0;
  const provider = new GitStatusProvider({ onChange() {}, now: () => now, reader: async () => { count++; return { state: "error" }; } });
  provider.setContext("/missing"); await provider.refresh();
  for (now = 250; now < 3000; now += 250) await provider.refresh();
  assert.equal(count, 1);
  await provider.refresh(); assert.equal(count, 2);
  provider.dispose();
});

test("branch-only mode supports an unborn branch", async (t) => {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR, "git-unborn-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  git(dir, "init", "-b", "new-branch");
  assert.deepEqual(await readGitStatus(dir, { counts: false, signal: new AbortController().signal }), { state: "ready", branch: "new-branch" });
});
