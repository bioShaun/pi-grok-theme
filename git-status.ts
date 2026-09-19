import { spawn } from "node:child_process";

export interface GitSnapshot {
  state: "loading" | "ready" | "refreshing" | "error" | "not-repo";
  branch?: string;
  staged?: number;
  dirty?: number;
  untracked?: number;
}

export interface ReadGitStatusOptions {
  counts: boolean;
  signal: AbortSignal;
}

interface GitCommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

const MAX_GIT_OUTPUT_BYTES = 8 * 1024 * 1024;

function isNotRepository(result: GitCommandResult): boolean {
  return result.code === 128 && /not a git repository/i.test(result.stderr);
}

function runGit(cwd: string, args: string[], signal: AbortSignal): Promise<GitCommandResult> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new Error("Git query aborted"));
      return;
    }

    const child = spawn("git", ["--no-optional-locks", ...args], {
      cwd,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C" },
      stdio: ["ignore", "pipe", "pipe"],
      signal,
      killSignal: "SIGKILL",
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let failure: unknown;
    const collect = (chunks: Buffer[], chunk: Buffer): void => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_GIT_OUTPUT_BYTES) {
        failure ??= new Error("Git status output exceeded the configured limit");
        child.kill("SIGKILL");
        return;
      }
      chunks.push(chunk);
    };

    child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk));
    child.once("error", (error) => { failure = error; });
    child.once("close", (code) => {
      if (failure) {
        reject(failure);
        return;
      }
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

/** Parse the index/worktree columns from `git status --porcelain=v1`. */
export function parseGitPorcelain(porcelainStdout: string): {
  staged: number;
  dirty: number;
  untracked: number;
} {
  let staged = 0;
  let dirty = 0;
  let untracked = 0;
  for (const line of porcelainStdout.split("\n")) {
    if (!line || line.startsWith("##")) continue;
    if (line.startsWith("??")) {
      untracked += 1;
      continue;
    }
    if (line.length < 2 || line.startsWith("!!")) continue;
    const index = line[0] ?? " ";
    const worktree = line[1] ?? " ";
    if (index !== " " && index !== "?") staged += 1;
    if (worktree !== " " && worktree !== "?") dirty += 1;
  }
  return { staged, dirty, untracked };
}

function branchFromStatus(stdout: string): string | undefined {
  const header = stdout.split("\n").find((line) => line.startsWith("## "));
  if (!header) return undefined;
  const value = header.slice(3);
  if (value.startsWith("HEAD ") || value === "HEAD") return undefined;
  if (value.startsWith("No commits yet on ")) return value.slice("No commits yet on ".length);
  if (value.startsWith("Initial commit on ")) return value.slice("Initial commit on ".length);
  const branch = value.split("...")[0]?.trim();
  return branch || undefined;
}

async function readDetachedHead(cwd: string, signal: AbortSignal): Promise<string | undefined> {
  const result = await runGit(cwd, ["rev-parse", "--short", "HEAD"], signal);
  return result.code === 0 ? result.stdout.trim() || undefined : undefined;
}

/** Read Git state without synchronous filesystem or subprocess calls. */
export async function readGitStatus(cwd: string, options: ReadGitStatusOptions): Promise<GitSnapshot> {
  try {
    if (!options.counts) {
      const inside = await runGit(cwd, ["rev-parse", "--is-inside-work-tree"], options.signal);
      if (isNotRepository(inside)) return { state: "not-repo" };
      if (inside.code !== 0) return { state: "error" };
      if (inside.stdout.trim() !== "true") return { state: "not-repo" };
      const result = await runGit(cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"], options.signal);
      const branch = result.code === 0 ? result.stdout.trim() : await readDetachedHead(cwd, options.signal);
      return branch ? { state: "ready", branch } : { state: "error" };
    }

    const result = await runGit(cwd, ["status", "--porcelain=v1", "-b"], options.signal);
    if (isNotRepository(result)) return { state: "not-repo" };
    if (result.code !== 0) return { state: "error" };
    const counts = parseGitPorcelain(result.stdout);
    const branch = branchFromStatus(result.stdout) ?? await readDetachedHead(cwd, options.signal);
    return branch ? { state: "ready", branch, ...counts } : { state: "ready", ...counts };
  } catch {
    return { state: "error" };
  }
}

export interface GitStatusProviderOptions {
  onChange: () => void;
  reader?: typeof readGitStatus;
  now?: () => number;
  ttlMs?: number;
  timeoutMs?: number;
}

export class GitStatusProvider {
  private readonly onChange: () => void;
  private readonly reader: typeof readGitStatus;
  private readonly now: () => number;
  private readonly ttlMs: number;
  private readonly timeoutMs: number;
  private cwd: string | undefined;
  private counts = true;
  private snapshot: GitSnapshot = { state: "loading" };
  private lastGood: GitSnapshot | undefined;
  private lastSuccessAt = Number.NEGATIVE_INFINITY;
  private generation = 0;
  private invalidated = false;
  private disposed = false;
  private controller: AbortController | undefined;
  private inFlight: Promise<void> | undefined;

  constructor(options: GitStatusProviderOptions) {
    this.onChange = options.onChange;
    this.reader = options.reader ?? readGitStatus;
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? 3_000;
    this.timeoutMs = options.timeoutMs ?? 500;
  }

  setContext(cwd: string, counts = true): void {
    if (!this.disposed && this.cwd === cwd && this.counts === counts) return;
    this.generation += 1;
    this.controller?.abort();
    this.controller = undefined;
    this.inFlight = undefined;
    this.cwd = cwd;
    this.counts = counts;
    this.snapshot = { state: "loading" };
    this.lastGood = undefined;
    this.lastSuccessAt = Number.NEGATIVE_INFINITY;
    this.invalidated = false;
  }

  getSnapshot(): GitSnapshot {
    return this.snapshot;
  }

  refresh(force = false): Promise<void> {
    if (this.disposed || !this.cwd) return Promise.resolve();
    if (this.inFlight) return this.inFlight;
    if (!force && !this.invalidated && this.now() - this.lastSuccessAt < this.ttlMs) {
      return Promise.resolve();
    }
    const generation = this.generation;
    const cwd = this.cwd;
    const counts = this.counts;
    this.inFlight = this.refreshLoop(generation, cwd, counts).finally(() => {
      if (this.generation === generation) this.inFlight = undefined;
    });
    return this.inFlight;
  }

  invalidate(): void {
    if (this.disposed || !this.cwd) return;
    this.invalidated = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    this.invalidated = false;
    this.controller?.abort();
    this.controller = undefined;
    this.inFlight = undefined;
  }

  private async refreshLoop(generation: number, cwd: string, counts: boolean): Promise<void> {
    do {
      this.invalidated = false;
      this.publishRefreshState(generation);
      await this.readOnce(generation, cwd, counts);
    } while (!this.disposed && this.generation === generation && this.invalidated);
  }

  private publishRefreshState(generation: number): void {
    if (this.disposed || this.generation !== generation) return;
    this.snapshot = this.lastGood?.state === "ready"
      ? { ...this.lastGood, state: "refreshing" }
      : { state: "loading" };
    this.onChange();
  }

  private async readOnce(generation: number, cwd: string, counts: boolean): Promise<void> {
    const controller = new AbortController();
    this.controller = controller;
    const timeout = setTimeout(() => controller.abort(new Error("Git query timed out")), this.timeoutMs);
    timeout.unref?.();
    let result: GitSnapshot;
    try {
      result = await this.reader(cwd, { counts, signal: controller.signal });
    } catch {
      result = { state: "error" };
    } finally {
      clearTimeout(timeout);
      if (this.controller === controller) this.controller = undefined;
    }
    if (this.disposed || this.generation !== generation) return;
    if (result.state === "ready") {
      result = counts
        ? { state: "ready", ...(result.branch ? { branch: result.branch } : {}), staged: result.staged ?? 0, dirty: result.dirty ?? 0, untracked: result.untracked ?? 0 }
        : { state: "ready", ...(result.branch ? { branch: result.branch } : {}) };
      this.lastGood = result;
      this.lastSuccessAt = this.now();
      this.snapshot = result;
    } else if (result.state === "not-repo") {
      this.lastGood = undefined;
      this.lastSuccessAt = this.now();
      this.snapshot = { state: "not-repo" };
    } else {
      this.lastSuccessAt = this.now(); // Back off failures as well as successful reads.
      this.snapshot = this.lastGood?.branch
        ? { state: "error", branch: this.lastGood.branch }
        : { state: "error" };
    }
    this.onChange();
  }
}
