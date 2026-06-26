# `electron/` — Desktop shell

The Electron desktop wrapper around the static Next.js export (spec §2.1
"Option B — Electron"). In production it serves the contents of `out/` through a
custom `app://` protocol; in development it loads the Next dev server at
`http://localhost:3000`.

## Files

| File | Purpose |
|------|---------|
| `main.js` | Electron **main process**. Registers the privileged `app://` scheme, creates the `BrowserWindow` (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`), loads the dev server (dev) or the `app://` static export (prod), resolves static files from `out/` (with `trailingSlash` `index.html` handling), opens external links in the system browser, and manages app/window lifecycle. |
| `preload.js` | **Preload script** (context-isolated). Exposes a minimal, read-only `window.desktop` API (`isElectron`, `platform`, `versions`) to the renderer via `contextBridge` — the only privileged surface available to the web app today. |
| `ipc/` | **Scaffolding** for the future `DataSource` IPC bridge (Phase 10). `channels.js` holds the channel-name constants (mirror of `COGS_IPC_CHANNELS` in `lib/data/sources/ipc-data-source.ts`); not yet imported by `main.js`. See `ipc/README.md`. |

## Build & run
Driven by the root `package.json` (`main: "electron/main.js"`,
`electron:dev`/`electron:build` scripts, and the `build` config for
electron-builder). Output installers go to `dist/` (git-ignored).

## Data & sync direction
COGS is **offline-first**: the renderer's local store (localStorage/Zustand) is
the working source of truth, so the main process stays a **thin shell** rather
than the data host. The IPC scaffolding under `ipc/` is preserved as *one
transport on the remote/sync side* — a way for a desktop renderer to reach a
remote `DataSource`/`MongoDataSource` (spec §3; **MongoDB Atlas**, replacing the
spec's original SQLite suggestion). When sync lands, the connection lifecycle and
`ipcMain.handle` registrations live here; see `ipc/README.md` and
`docs/SPEC_MAPPING.md` §3.
