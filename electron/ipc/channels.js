/**
 * electron/ipc/channels.js — IPC channel-name constants (Phase 10)
 *
 * GROUNDWORK / SCAFFOLDING. The single source of channel strings for the
 * DataSource IPC bridge, consumed by the (future) main-process handlers and the
 * preload. NOT yet imported by `electron/main.js` — wiring is a deliberate
 * follow-up (see ./README.md).
 *
 * IMPORTANT: these strings MUST stay byte-for-byte identical to
 * `COGS_IPC_CHANNELS` in `lib/data/sources/ipc-data-source.ts` (the renderer
 * side). They are duplicated rather than shared because the main process is
 * plain CommonJS JS and the renderer is bundled TS; keep both lists in sync.
 *
 * CommonJS module (matches electron/main.js + electron/preload.js conventions).
 */
const COGS_IPC_CHANNELS = {
  getTasks: "cogs:tasks:getAll",
  getTaskById: "cogs:tasks:getById",
  addTask: "cogs:tasks:add",
  updateTask: "cogs:tasks:update",
  removeTask: "cogs:tasks:remove",
  tasksByTag: "cogs:tasks:byTag",
  addLink: "cogs:tasks:addLink",
  removeLink: "cogs:tasks:removeLink",
  getCategories: "cogs:categories:getAll",
  addCategory: "cogs:categories:add",
  updateCategory: "cogs:categories:update",
  removeCategory: "cogs:categories:remove",
  getFolders: "cogs:folders:getAll",
  addFolder: "cogs:folders:add",
  updateFolder: "cogs:folders:update",
  removeFolder: "cogs:folders:remove",
  getReviews: "cogs:reviews:getAll",
  getReview: "cogs:reviews:get",
  saveReview: "cogs:reviews:save",
  getPoints: "cogs:points:getAll",
  addPoints: "cogs:points:add",
  getPlanText: "cogs:plans:get",
  savePlanText: "cogs:plans:save",
  transaction: "cogs:tx:run",
  // Optional best-effort PDF → text extraction (Workstream D). Bridged to the
  // renderer as `window.desktop.extractPdfText(dataUrl)`; absent in the web
  // build (lib/file-extract.ts degrades gracefully when not present).
  extractPdfText: "cogs:file:extractPdfText",
  // Open a module in its own BrowserWindow (Module platform, Workstream C).
  // Bridged to the renderer as `window.desktop.openModulePopout(hash)`; absent in
  // the web build (components fall back to `window.open`).
  openModulePopout: "cogs:window:openModulePopout",
}

/** All channel strings (handy for bulk `ipcMain.handle` registration). */
const ALL_CHANNELS = Object.freeze(Object.values(COGS_IPC_CHANNELS))

module.exports = { COGS_IPC_CHANNELS: Object.freeze(COGS_IPC_CHANNELS), ALL_CHANNELS }
