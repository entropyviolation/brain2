# `electron/` — Desktop shell

The Electron desktop wrapper around the static Next.js export (spec §2.1
"Option B — Electron"). In production it serves the contents of `out/` through a
custom `app://` protocol; in development it loads the Next dev server at
`http://localhost:3000`.

## Files

| File | Purpose |
|------|---------|
| `main.js` | Electron **main process**. Registers the privileged `app://` scheme, creates the `BrowserWindow`, loads the dev server (dev) or the `app://` static export (prod), resolves static files from `out/` (with `trailingSlash` `index.html` handling), opens external links in the system browser, and manages app/window lifecycle. |
| `preload.js` | **Preload script** (context-isolated). Exposes a minimal, read-only `window.desktop` API (`isElectron`, `platform`, `versions`) to the renderer via `contextBridge` — the only privileged surface available to the web app. |

## Build & run
Driven by the root `package.json` (`main: "electron/main.js"`,
`electron:dev`/`electron:build` scripts, and the `build` config for
electron-builder). Output installers go to `dist/` (git-ignored).

## Spec note
This repo targets **MongoDB** (replacing the spec's original SQLite
recommendation) accessed from the main process via IPC (§3). When that lands, the
connection lifecycle, collection access, text/vector search indexes, and IPC
handlers will live here. MongoDB supports the flexible document model, fuzzy and
semantic search, and aggregation pipelines needed as the dataset grows relational.
