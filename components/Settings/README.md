# `components/Settings/`

Cross-cutting settings UI that isn't tied to a single feature screen.

**Chrome:** milled fascia (`.set95` / `.set95-dialog` in `settings-chrome.css`) —
brushed silver section bays, engraved uppercase nameplates (`#2a2c2e`, 11px / 700 /
tracking ~0.14em), raised metal keys (close key 22px to match Inbox / pin-bar
`.hpp95`), CRT black glass only for the dialog title and
the message-ingest pairing code (phosphor `#7dffc4`). Looks only; fields and actions
unchanged. Imported from `app/layout.tsx`.

| File | Purpose | Spec |
|------|---------|------|
| `settings-chrome.css` | Milled fascia skin for Settings + nested Item Types dialogs (`.set95`). | — |
| `SettingsDialog.tsx` | Header **Settings** dialog (`data-ui-name="Settings"` on the dialog content). Names nameplate portals above this overlay. **Data profile** (Live vs stock Demo vault — first control, reload on switch), **Window gray**, **Desktop** (teal or a photographed plate behind the windows), **Baby animal friend** (photo gallery + cute names), **Home location**, full backup/restore (`<BackupRestore />`), **Mobile Sync**, **Message ingest**, **Screen Time** (ActivityWatch URL + Sync now), **Manage Item Types**, and **"Set up Second Brain"**. Wired into `app/page.tsx`. Fields auto-save (`isDirty: false`); close does not prompt. CRT title + milled bays via `settings-chrome.css`. | §3.2 / §5 |
| `DataProfileField.tsx` | Settings → **Data profile**. Live is the real vault. Demo is invented stock data (River Hale) on `brain2-demo-*` keys only. Never writes Live `brain2-*` / `cogs-*`. Reset Demo wipes only demo keys + demo IndexedDB. | — |
| `BabyAnimalFriendField.tsx` | Settings → **Baby animal friend**. Same gallery as the header nest: preapproved pack plus your cards, shuffle among gallery, name every friend, find-another / request / upload, per-card **Details** (history, mission journal, personality) / change picture / remove (**Are you sure** confirm). Bytes live in `cogs-friend-pic:*` or `/friend-pack/*.png`. Header photograph opens that same details page. The chat button above Gallery speaks; the bubble opens the mission sheet (task row opens item detail on top; Accept until end of day; Decline walks smaller tasks → first step → a reason). Plan: [`docs/FRIEND_COMPANION.md`](../../docs/FRIEND_COMPANION.md). | — |
| `ChromeFaceField.tsx` | Settings → **Window gray**. Dual-thumb: the range thumb is the persisted set-point (`theme-store.chromeFace`, 0–100, default **50** = classic `#c0c0c0`); the hollow tick is the live `--chrome-face` (24-minute sine, ±5 RGB, chroma 0 — never brown, never `#c5c3bc`). **Classic** restores 50. | — |
| `PcbBackdropField.tsx` | Settings → **Desktop**. Plain **teal** (default) plus five photographed plates (`ceramic` / `mint` / `ice` / `xray` / `fr4`) writing `theme-store.pcbMode` and the **`brain2-pcb-mode`** pin (legacy `cogs-pcb-mode` still read/written). Persist **v4**. Each pick stamps a wall-clock **`appearanceRev`** (`lib/appearance-rev.ts`) so a plate chosen before hydration finished still wins the merge — the old 0-based counter lost to the stored rev and got rewritten to `xray`. A saved plate also wins over a stale pin. Saved plates are never migrated onto teal. | — |
| `HomeLocationField.tsx` | Home city autocomplete writing `lib/user-settings-store.ts`. Empty values snap back to San Diego. | — |
| `DayAnchorField.tsx` | **Default time of day** — the time assumed for work ticked off after the day has ended, when there is no tracked time to read a real one from. Since the sleep log landed this is the *last* resort: `lib/completion-window.ts` prefers the half hour before that night's bedtime, taken from the log, from sleep painted on the grid, or from the user's median bedtime over the last month. The field therefore shows **which of those is actually in force**, so a setting that has quietly stopped applying cannot pass itself off as the answer. | §9 / §12 |
| `BackupRestore.tsx` | Full-app backup + **per-part preview restore** — downloads `brain2-backup-*.json` (`app: "brain2"`; restore still accepts legacy `app: "cogs"`). The file is every saved store, plan log, attachment, doc, and other durable key for this profile (item history, home layout, friend pins, module notes, navigation, ingested-note ids, unprefixed relics). Split `brain2-*` / `cogs-*` copies are folded together, a bare plan draft is merged onto the key restore reads, and a hydrated store is included even when its last disk write failed. Gallery pictures still held as `data:image` are exported with the file. Pick parts, merge or replace, then a Win95 OK/Cancel confirm (not a red Delete). If `data/recovery-backups/` exists, those snapshots list as a read-only restore source — including the `auto-*.json` copies the dev hub writes itself whenever a vault write shrinks or is refused, so rows lost to a stale second window can be merged back without leaving the app. | §3.2 |
| `MobileSyncPanel.tsx` | Confirm-gated manual hub push/pull for `/mobile`. | mobile |
| `MessageIngestPanel.tsx` | **BIM** (Brain2 Ingestion Messenger — you can call him BIM for short) at [t.me/brain2_phone_bot](https://t.me/brain2_phone_bot): token via desktop `safeStorage` or gitignored `.env.local`, pairing code **or** **Texted but not paired** (one-click allowlist of a sender the log already refused — permanent; the code's 10-minute TTL is not the pairing's; a refresh cannot wipe the allowlist), always-on hub URL + Sync vault, custom shortcuts (`store` → `groc`; bare `g` retired), **discrete event triggers** (smoked weed / ate {item} / …; `log:` stays separate), in-chat manuals (`info` / `{prefix} info` / `{prefix} commands` / `all commands`), **iPhone Notes / Screen Time / Call / Text / Location Shortcuts** (AirDrop the signed `.shortcut` files next to the recipes), allowlist, cheat-sheet, **Simulate a message**, **Simulate a scan** (receipt / journal / PDF). Pairing code reads in a CRT well (`.set-crt`) when Settings is milled. See [`docs/MESSAGE_INGEST.md`](../../docs/MESSAGE_INGEST.md) and [`docs/shortcuts/`](../../docs/shortcuts/). | §4 |
| `ScreenTimePanel.tsx` | Settings → **Screen Time**. Brain2 reads a running ActivityWatch server (not a window watcher; no Apple Screen Time / pre-install import). Connection lamp, URL (default `http://127.0.0.1:5600`), lookback days, min duration, store-window-titles off by default, **Sync now**, last-success sentence plus an honest `lastSyncNote` (empty AW vs filtered events vs painted blocks — 0 blocks is not dressed as a failure), ActivityWatch + macOS Accessibility links. One line notes that phone usage is a different Tracking view (iPhone Screen Time / Calls / Texts). Prefs auto-save. | — |
| `ScreenTimePanel.test.tsx` | Heading, default URL, Sync now, empty-success copy. | — |

## Window gray

One gunmetal for every beveled face (Lists, Plan, Scheduler, Operations, Habits
chrome — not Lists orbs/velvet, not Analytics charts).

| Piece | Role |
|-------|------|
| Set-point | `useThemeStore.chromeFace` (persist **v3**, `cogs-theme-store`). Slider thumb. |
| Live metal | `lib/chrome-patina.ts` writes `--chrome-face` / `--chrome-mid` / `--chrome-hi` / `--chrome-lo` / `--chrome-brush` plus `--chrome-set` / `--chrome-live` / `--chrome-mix` on `:root`. Ghost tick. |
| Lock | `R = G = B`. Cool/neutral only. The old Habits warm pole `#c5c3bc` is rejected. |

`app/win95.css` owns the tokens; `--w95-*` aliases them. `app/chrome-patina.css`
remaps module names (`--hab-metal`, `--s-surface`, `--fm-surface`, …) with
`body.win95-app` specificity. `app/chrome-patina.tsx` applies on load, on
set-point change, and once a minute.

## Desktop

The field behind every window. One `pcbMode` on the theme store, painted by
`app/pcb-backdrop.css`. Fresh installs are plain Win95 teal. Photographs in
`public/pcb/` stay opt-in. A saved ceramic (or other) plate is never rewritten
to teal.

| Mode | Plate | Ink |
|------|-------|-----|
| `teal` (default) | Solid `#008080` — no photograph | Dark |
| `ceramic` | Silver / white ceramic board | Dark |
| `mint` | Pale mint snowflake-circuitry | Dark |
| `ice` | Inverted icy blue | Dark |
| `xray` | Black substrate, lime traces | Light |
| `fr4` | Classic dark-green FR4 | Light |

`lib/pcb-backdrop.ts` names the modes. `app/pcb-backdrop.tsx` stamps
`data-pcb-mode` / `data-pcb-ink` on `<html>` only after persist hydration
(never seed teal over the boot script). A blocking boot script in
`app/layout.tsx` reads **`brain2-pcb-mode`** (then **`cogs-pcb-mode`**), then
the theme blob, before first paint. Electron restamps that pin from a saved
theme blob (`appearanceRev` > 0) so a stale hub pin cannot roll the plate
back. A plate picked this page is remembered on `brain2-pcb-pick` until the
next real reload. Blobs that never stored `pcbMode` keep ceramic. Restore of
the theme store rewrites the pin.

## Related

- `lib/data/backup.ts` — the backup engine `BackupRestore` defers to:
  `createBackup`/`createFullBackup`/`downloadBackup` snapshot every registered
  store (`BACKUP_STORES`, including home layout, weather place, sun history,
  and Names), free-text plan keys, attachments, docs, and `extras` (every other
  durable key). Leftover `friend-pic:` copies fold into attachments.
  `parseBackup` validates with Zod; `previewBackup` lists which parts the file
  contains; `restoreBackup` can still full-replace (one-arg / mobile hub) or
  write only chosen keys (`storeKeys` + `extras` + `mode: "merge" | "replace"`).
  An older file with no `extras` field does not wipe live extras.
  `listRecoveryBackups` /
  `loadRecoveryBackup` are GET-only against `/api/recovery-backups` when the
  folder exists. Per-category subtree helpers (`buildCategoryExport`,
  `importCategory`, `downloadCategoryExport`) are unchanged.

`<BackupRestore />` is also surfaced inside the Lists settings dialog's **Data**
tab (`components/Lists/settings-dialog.tsx`); drop it anywhere a global "manage
my data" affordance is wanted.
