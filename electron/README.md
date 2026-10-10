# `electron/` — Desktop shell

The Electron desktop wrapper around the static Next.js export (spec §2.1
"Option B — Electron"). In production it serves the contents of `out/` through a
custom `app://` protocol; in development it loads the Next dev server at
`http://localhost:3000`.

## Files

| File | Purpose |
|------|---------|
| `main.js` | Electron **main process**. Window title **BRAIN2**. Pins `userData` to the historical `cogs` vault (`user-data-path.js`) before `ready`, then registers the privileged `app://` scheme, creates the `BrowserWindow` (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`), loads the dev server (dev) or the `app://` static export (prod), resolves static files from `out/` (with `trailingSlash` `index.html` handling), opens external links in the system browser, and manages app/window lifecycle. `app://` lookups are memoized (`static-file.js`) so a repeat asset request does not `stat` again. The Chrome persist hub is parsed once per file mtime and size (`persist-hub-cache.js`) before the first window; pop-outs reuse that snapshot. IPC: PDF text extraction, **pop-out windows** (`/popout/?module=` / `?sheet=`), Apple Notes ingest, **ActivityWatch screen time** (`activitywatch.js`), **Telegram long-poll** (`telegram-ingest.js`). The Notes / Screen Time / Telegram registrations each log and continue on failure, so one broken module cannot leave the others unwired (the renderer would only see `No handler registered`). Channel names still use a historical `cogs:` prefix. Both the main window and pop-outs set `v8CacheOptions: "bypassHeatCheck"` so V8 writes a code cache the first time a script compiles, instead of waiting until that script is hot and recompiling the same Next.js bundles in every pop-out. |
| `user-data-path.js` | Stable Application Support folder name (`cogs`). Electron would otherwise derive `userData` from package.json `name` / `productName` and boot an empty profile after a brand rename. |
| `persist-hub-cache.js` | In-memory cache of `data/shared-persist.json`. One parse per mtime and size. The revision token is what preload compares so a pop-out can skip the hub IPC. |
| `static-file.js` | Memoized `app://` resolver: file, `route.html`, `route/index.html`, then the SPA `index.html`. |
| `preload.js` | **Preload script** (context-isolated). Exposes a minimal `window.desktop` API (`isElectron`, `platform`, `versions`, `extractPdfText`, `openModulePopout`, `fetchAppleNotes`, `fetchScreenTime`, `telegram`) via `contextBridge`. Seeds **missing** persist keys from `data/shared-persist.json` (skips `cogs-*` when the `brain2-*` twin is in the hub). The preload is sandboxed, so `require` of `lib/vault-guard.js` does not run; a present local value is kept and the hub only fills empty keys. The old fallback copied the hub over local on every launch, which reset Home from Habits to Tracking and replaced the time grid with a hub copy that was missing blocks. A present **theme blob** or PCB / LED **pin** is never replaced from the hub on launch. A plate or LED hue picked this page is remembered in sessionStorage so Fast Refresh cannot roll it back; hub POST merge keeps a newer `appearanceRev` instead of painting the old hub plate onto the save. Each window gets `--brain2-hub-rev` (mtime, size, and `updatedAt`). If `brain2-telegram-hub-seed` already lists those keys and they are still in localStorage, preload does **no** hub IPC. That marker is not a vault store (phone vault push ignores the `brain2-telegram` prefix; full backup treats it as ephemeral). The first seed is still `sendSync` from the main-process cache, so the boot script and Zustand see the same keys. On localhost, when that marker's keys are already present and only the revision changed, preload uses `invoke` instead, because persist `getItem` already waits on `/api/persist`. `app://` has no waiter, so a revision change there stays synchronous. |
| `telegram-ingest.js` | Telegram Bot API long-poll in main. Token in userData via `safeStorage`, or gitignored `.env.local`. Downloads photo/PDF bytes (`telegram-file.js`); accepts location and live-location edits (`edited_message`). A text ritual pauses those edits until it ends; the Telegram share stays on. A batch is forwarded in `message.date` order (`telegram-file.js` stamps `date`, not `edit_date`). A failed poll waits 1s. **Yields** when `npm run phone:hub` is alive. See [`docs/MESSAGE_INGEST.md`](../docs/MESSAGE_INGEST.md). |
| `telegram-file.js` | `getFile` download of Telegram photos and PDFs for ingest. |
| `apple-notes.js` / `apple-notes.jxa` | Notes.app reader (iCloud / iPhone + On My Mac). Modes: `preview` (titles/dates), `snippet` (short body for swipe cards), `bodies` (full text for bulk-add / park). |
| `activitywatch.js` | Loopback client for a running ActivityWatch install (`127.0.0.1:5600`). Modes: `health` (`/api/0/info`), `events` (window / AFK / optional web buckets). Never embeds aw-server. |
| `entitlements.mac.plist` | Hardened runtime + Apple Events so packaged Mac builds can ask to control Notes. |
| `ipc/` | **Scaffolding** for the future `DataSource` IPC bridge (Phase 10). `channels.js` holds the channel-name constants (mirror of `COGS_IPC_CHANNELS` in `lib/data/sources/ipc-data-source.ts`); not yet imported by `main.js`. See `ipc/README.md`. |

## Build & run
Driven by the root `package.json` (`main: "electron/main.js"`,
`electron:dev`/`electron:build` scripts, and the `build` config for
electron-builder). Output installers go to `dist/` (git-ignored).

`electron:dev` starts `scripts/cogs-dev-server.mjs` directly under
`concurrently -k` — not via `npm run dev` — so the kill signal reaches the
server instead of only the npm wrapper, which used to leave an orphan holding
port 3000. With `COGS_STRICT_PORT=1` it never hops to another port (Electron
always loads 3000). A leftover **Node** listener from an OOM abort is SIGTERM’d
on the next start (`scripts/dev-port.mjs`); anything else still refuses. The
script also sets `NODE_OPTIONS=--max-old-space-size=8192`. Next’s own dev
webpack cache is already on disk with `maxMemoryGenerations: 0`, which is what
keeps a long Fast Refresh session from heap-aborting. `next.config.mjs` only
adds watch ignores; it must not replace that cache object.

## Apple Notes ingest

`ipcMain.handle("cogs:notes:fetchAppleNotes")` runs `osascript` against **Notes.app** (macOS only). The preview walks each account folder and reads ids, titles, and modification dates in bulk, then keeps notes inside the chosen dates. One fetch runs at a time; a new one stops the previous `osascript`. Notes that have synced through iCloud show up with On My Mac. Packaged builds declare `NSAppleEventsUsageDescription` and Apple Events entitlements (`entitlements.mac.plist`). Restart `electron:dev` after changing the JXA/preload bridge.

DevTools do not open on launch. Set `COGS_DEVTOOLS=1` to detach them, or use Cmd-Opt-I. A detached inspector on this vault is enough to make the window feel frozen.

The renderer UI is `components/notes-ingest.tsx` (**From Notes** in Settings and Lists settings). In local `npm run dev` / `electron:dev`, Chrome at `http://localhost:3000` can use the same reader through `/api/notes` (loopback only; phones on the LAN are refused).

## ActivityWatch screen time

`ipcMain.handle("cogs:screentime:fetchScreenTime")` queries a **running** ActivityWatch server on this machine (default `http://127.0.0.1:5600`). LAN and public hosts are refused. Bridged as `window.desktop.fetchScreenTime`. In local `npm run dev` / `electron:dev`, Chrome at `http://localhost:3000` can use the same client through `/api/screentime` (loopback only; phones on the LAN are refused). Brain2 does not start or bundle aw-server. ActivityWatch only stores events from when its watchers run — there is no import of Apple Screen Time or pre-install history. A Brain2 sync that returns 0 blocks is an honest empty read, not an unreachable server.

## Data & sync direction
**Vault path.** Renderer localStorage lives in Chromium `userData`. That folder
is pinned to `~/Library/Application Support/cogs` (Windows/Linux: `%APPDATA%/cogs`)
and must not follow a package.json `name`, `productName`, or **git folder**
rename. The checkout folder is `brain2` (it was `cogs copy`). That is safe: the
vault is not inside the repo. The empty `brain2` / `BRAIN2` Application Support
profiles from 2026-09-21 are leftovers, not the live vault. A Settings export
from that day (`cogs-backup-2026-09-21.json`, 2437 items) is slightly behind
the live `cogs` profile (2455 items) — keep the live profile; do not restore
the export over it.

Brain2 is **offline-first**: the renderer's local store (localStorage/Zustand) is
the working source of truth, so the main process stays a **thin shell** rather
than the data host. The IPC scaffolding under `ipc/` is not wired into
`main.js`. MongoDB Atlas as a remote `DataSource` is speculation, not the
storage plan. The sync that exists is the manual phone hub
(`lib/mobile-sync.ts`). See `ipc/README.md` and `docs/SPEC_MAPPING.md` §3.
