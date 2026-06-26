# `hooks/` — Shared React hooks

App-wide reusable hooks that aren't tied to a single feature.

**Module-specific hooks** live next to their UI instead of here — e.g.
`components/Lists/hooks/` (`useListsNavigation`, `useListsSearch`,
`useListsDragDrop`, `useListsSelection`, `useListsTaskActions`).

## Files

| File | Purpose |
|------|---------|
| `useQuickCaptureHotkey.ts` | `useQuickCaptureHotkey(options?)` — owns the open/closed state of the quick-capture surface and toggles it on the in-app capture chord (Cmd/Ctrl+Shift+K, distinct from the Cmd/Ctrl-K search palette). Attaches a single `keydown` listener while mounted and bridges an Electron global accelerator via `window.electron?.onQuickCapture` when present (no-op in the browser). Exports `QUICK_CAPTURE_GLOBAL_ACCELERATOR` (`CommandOrControl+Alt+Space`) + `QUICK_CAPTURE_IPC_CHANNEL` for the integration pass (Feature 10). |
| `useVocalConfidence.ts` | `useVocalConfidence(options?)` — mic-streaming hook behind the Morning **spoken affirmations** ritual. Owns the `getUserMedia` → `AudioContext`/`AnalyserNode` lifecycle, decimates analysis to `ANALYSIS_INTERVAL_MS`, feeds frames into a `ConfidenceTracker` (`lib/vocal-confidence.ts`), and exposes a live `ConfidenceScore` + mic status (`idle`/`requesting`/`listening`/`denied`/`error`) with `start`/`stop`/`reset`. Audio never leaves the device; degrades gracefully when no mic/permission. See `components/Reviews/README.md`. |
