# `hooks/` — Shared React hooks

App-wide reusable hooks for **Brain2** that aren't tied to a single feature.

**Module-specific hooks** live next to their UI instead of here — e.g.
`components/Lists/hooks/` (`useListsNavigation`, `useListsSearch`,
`useListsDragDrop`, `useListsSelection`, `useListsTaskActions`).

## Files

| File | Purpose |
|------|---------|
| `useQuickCaptureHotkey.ts` | `useQuickCaptureHotkey(options?)` — owns the open/closed state of the quick-capture surface and toggles it on the in-app capture chord (Cmd/Ctrl+Shift+K, distinct from the Cmd/Ctrl-K search palette). Attaches a single `keydown` listener while mounted and bridges an Electron global accelerator via `window.electron?.onQuickCapture` when present (no-op in the browser). Exports `QUICK_CAPTURE_GLOBAL_ACCELERATOR` (`CommandOrControl+Alt+Space`) + `QUICK_CAPTURE_IPC_CHANNEL` for the integration pass (Feature 10). |
| `useMessageIngest.ts` | `useMessageIngest()` — drains Telegram IPC (or `/api/ingest`) into `lib/ingest/ingestIncomingAsync`, buffers photo albums, chunks replies, pins grocery, yields to `npm run phone:hub`. Vault dump on a timer only hits a live always-on phone hub, never localhost `/api/persist`. Mounted once from `app/page.tsx`. |
| `useUndoHotkey.ts` | `useUndoHotkey()` — Cmd/Ctrl-Z undoes the last Home/Tracking action (`lib/action-history.ts`); Cmd/Ctrl-Shift-Z / Ctrl+Y redo. Leaves native undo alone when a text field or contenteditable is focused. Mounted once from `app/page.tsx`. Home → Tracking also mounts `components/Home/Tracking/tracking-undo.ts` in the capture phase so a focused timegrid still pops the same stack. |
| `use-day-rollover.ts` | `useDayScheduleRollover()` — after vault hydrate, at the next local midnight, and when the window becomes visible on a new day, rolls unfinished past period schedules up one level (`rollUpExpiredSchedules`) and bumps `lib/day-clock.ts`. Mounted once from `app/page.tsx`. |
| `useVocalConfidence.ts` | `useVocalConfidence(options?)` — mic-streaming hook behind the Morning **spoken affirmations** ritual. Owns the `getUserMedia` → `AudioContext`/`AnalyserNode` lifecycle, decimates analysis to `ANALYSIS_INTERVAL_MS`, feeds frames into a `ConfidenceTracker` (`lib/vocal-confidence.ts`), and exposes a live `ConfidenceScore` + mic status (`idle`/`requesting`/`listening`/`denied`/`error`) with `start`/`stop`/`reset`. Audio never leaves the device; degrades gracefully when no mic/permission. See `components/Reviews/README.md`. |
| `use-attachment-src.ts` | `useAttachmentSrc(uri)` / `useAttachmentSrcList(uris)` — resolve an attachment URI for an `<img src>`. `idb:<id>` (`lib/attachments.ts`) becomes an object URL, revoked on change/unmount; `data:` and `http(s)` pass through. Used by every `image` / `multiimage` attribute render site: the value editor thumbnails, the item-detail hero, and the Modules gallery card. |
| `use-screentime-sync.ts` | `useScreenTimeSync()` — polls ActivityWatch → Screen Time (~2 min while mounted, on focus, once on mount). Mounted on the Time Grid and Analytics only — **not** the block editor (sleep-lag lesson). Settings **Sync now** calls `syncScreenTime()` directly. Empty success (0 blocks) is not an error. |
