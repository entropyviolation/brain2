# `components/Settings/`

Cross-cutting settings UI that isn't tied to a single feature screen.

| File | Purpose | Spec |
|------|---------|------|
| `SettingsDialog.tsx` | The app's **Settings** entry point — a header-launched dialog (`SettingsDialog`) that hosts cross-cutting utilities: full backup/restore (renders `<BackupRestore />`) and a one-click **"Set up Second Brain"** action that seeds the Source + Belief item types via `useItemTypeStore.seedSecondBrainTypes`. Wired into the global header in `app/page.tsx`. | §3.2 |
| `BackupRestore.tsx` | Full-app backup/restore controls — exports every persisted store + free-text plans to one JSON file and restores from one (full replace, with confirm). Thin UI over `lib/data/backup.ts`. | §3.2 |

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
