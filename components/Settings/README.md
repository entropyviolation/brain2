# `components/Settings/`

Cross-cutting settings UI that isn't tied to a single feature screen.

| File | Purpose | Spec |
|------|---------|------|
| `SettingsDialog.tsx` | The app's **Settings** entry point — a header-launched dialog (`SettingsDialog`) that hosts **Home location** (`<HomeLocationField />` — city for Plan sunrise/sunset, default San Diego), full backup/restore (renders `<BackupRestore />`), **Mobile Sync** (`<MobileSyncPanel />` — live sync is parked; manual hub push/pull only), and a one-click **"Set up Second Brain"** action that seeds the Source + Belief item types via `useItemTypeStore.seedSecondBrainTypes`. Wired into the global header in `app/page.tsx`. | §3.2 |
| `HomeLocationField.tsx` | Home city autocomplete writing `lib/user-settings-store.ts`. Empty values snap back to San Diego. | — |
| `BackupRestore.tsx` | Full-app backup/restore controls — exports every persisted store + free-text plans to one JSON file and restores from one (full replace, with confirm). Thin UI over `lib/data/backup.ts`. | §3.2 |
| `MobileSyncPanel.tsx` | Explains that continuous live sync is paused until a **semi-mobile live sync** component lands; keeps confirm-gated manual hub push/pull for `/mobile`. | mobile |

## Related

- `lib/data/backup.ts` — the backup engine `BackupRestore` defers to:
  `createBackup`/`serializeBackup`/`downloadBackup` snapshot every registered
  store (`BACKUP_STORES`) plus free-text plan keys; `parseBackup` validates with
  Zod; `restoreBackup` overwrites localStorage and rehydrates the live stores.
  It also exports the per-category subtree export/import helpers
  (`buildCategoryExport`, `importCategory`, `downloadCategoryExport`).

`<BackupRestore />` is also surfaced inside the Lists settings dialog's **Data**
tab (`components/Lists/settings-dialog.tsx`); drop it anywhere a global "manage
my data" affordance is wanted.
