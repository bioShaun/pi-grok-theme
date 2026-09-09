Preview cwd fixture for deterministic SVG renders.

`render-previews.js` sets `HOME` to this directory and uses
`pi/pi-grok-theme` as cwd so `formatCwd` emits `~/pi/pi-grok-theme`.
A fake `.git/HEAD` pinned to `main` is created at render time (nested
`.git` directories cannot be committed).

Do not treat this as a real project.
