# `electron/ipc/` — DataSource IPC contract (Phase 10 scaffolding)

This folder holds the **channel contract** for exposing a `DataSource` to the
renderer over Electron IPC. It is **scaffolding only** — nothing here is imported
by `electron/main.js` yet, so the running app is unaffected. Wiring it is not
scheduled. Channel string prefixes stay `cogs:` (historical);
the product name is **BRAIN2**.

> **See [`../../docs/SPEC_MAPPING.md`](../../docs/SPEC_MAPPING.md) §3.** Brain2 is
> **offline-first**: the renderer's local store is the source of truth, and
> Electron main is a **thin shell**, not the data host. This folder is unwired
> scaffolding. MongoDB Atlas, `@brain2/core`, and Expo are speculation, not the
> storage plan. The sync that exists is the manual phone hub. Wording below
> that describes a host `DataSource` in main is that same unwired sketch.

## Sketch (not the storage plan)

```
┌── renderer (Next.js) ───────────────┐        ┌── main process (electron) ──────────┐
│ IpcDataSource (DataSource)          │        │ ipcMain.handle(channel, handler)    │
│   → window.cogs.invoke(channel, p)  │ ──IPC─▶ │   → hostDataSource[op](payload)     │
│   (validates with Zod first)        │ ◀─IPC── │   → LocalDataSource (now)           │
└─────────────────────────────────────┘        │     MongoDataSource (Phase 11)      │
        ▲ contextBridge exposes window.cogs     └──────────────────────────────────────┘
        └── preload.js (contextIsolation)
```

- **Renderer** uses `IpcDataSource` (`lib/data/sources/ipc-data-source.ts`),
  which validates inputs with the shared Zod schemas (`lib/data/schemas.ts`),
  then calls `window.cogs.invoke(channel, payload)`.
- **Preload** (`electron/preload.js`) exposes a minimal `window.cogs.invoke`
  through `contextBridge` (alongside the existing `window.desktop`).
- **Main process** registers one `ipcMain.handle(channel, ...)` per channel and
  delegates to a single host `DataSource` instance — `LocalDataSource` today
  (running in main, persisting via a main-side store/file), `MongoDataSource`
  once Phase 11 lands.
- **Channel names** live in `channels.js` (main side) and must mirror
  `COGS_IPC_CHANNELS` in `ipc-data-source.ts` (renderer side).

## Why a typed bridge (not `nodeIntegration`)

`main.js` runs with `contextIsolation: true`, `nodeIntegration: false`,
`sandbox: true`. The renderer must never touch Node/Electron or the DB directly;
the preload's `contextBridge` is the only privileged surface. `invoke` (backed by
`ipcRenderer.invoke` ⇄ `ipcMain.handle`) is the promise-based request/response
channel that maps cleanly onto the async `DataSource` interface.

## Integration TODO (ordered — do NOT do while `electron:dev` is running)

1. **Preload** — in `electron/preload.js`, add:
   ```js
   const { ipcRenderer } = require("electron")
   const { ALL_CHANNELS } = require("./ipc/channels")
   contextBridge.exposeInMainWorld("cogs", {
     available: true,
     invoke: (channel, payload) => {
       if (!ALL_CHANNELS.includes(channel)) {
         return Promise.reject(new Error(`Unknown cogs channel: ${channel}`))
       }
       return ipcRenderer.invoke(channel, payload)
     },
   })
   ```
2. **Main handlers** — add `electron/ipc/handlers.js` exporting
   `registerCogsIpc(dataSource)` that loops `ipcMain.handle(channel, (_e, p) => …)`
   mapping each channel to the matching `DataSource` method. Validate payloads on
   the main side too (defense in depth) before calling the host source.
3. **Host source** — instantiate the host `DataSource` in main (start with a
   main-process `LocalDataSource`; swap to `MongoDataSource` in Phase 11) and
   call `registerCogsIpc(hostSource)` inside `app.whenReady()` in
   `electron/main.js`, BEFORE `createWindow()`.
4. **Renderer composition root** — pick the source once at startup:
   `isIpcDataSourceAvailable() ? new IpcDataSource() : localDataSource`. Flip
   call sites from `taskRepository` to the chosen `DataSource` incrementally.
5. **Serialization** — `Task.createdAt`/`deadline`/`scheduledDate` are `Date`
   objects. Structured-clone over IPC preserves `Date`, but the Zod schemas also
   coerce ISO strings, so either is safe; keep payloads JSON-shaped.
6. **Atomic workflows** — do NOT expose a generic renderer-driven
   `transaction()`. Instead add dedicated channels for each server-side atomic
   workflow (tag rename/merge, link symmetry, review carry-over, module
   instantiation) that run inside one main-process transaction.

## Files

| File | Purpose |
|------|---------|
| `channels.js` | Channel-name constants (mirror of `COGS_IPC_CHANNELS`). |
| `README.md` | This document. |
| `handlers.js` | _(future, step 2)_ `registerCogsIpc(dataSource)`. |
