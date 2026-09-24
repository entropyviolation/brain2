# `app/` — Next.js App Router entry

The Next.js App Router root for Brain2 — a **living perfect second brain**
(item used everywhere; **Analytics** is the heart — see the vision in the root
[`README.md`](../README.md)). The UI is client-side and
exported statically (`output: "export"`), so these files mostly set up the
shell and mount the single page. Trip maps / weather / places hit public APIs
from the browser (`lib/city-search.ts`, `lib/weather-client.ts`,
`lib/places-search.ts`, cached in `lib/api-cache.ts`) — no App Router API
routes are required for the static Electron build.

## Files

| File | Purpose |
|------|---------|
| `layout.tsx` | Root HTML layout. Loads the Karla Google font, imports `globals.css`, **`win95.css`**, then module chrome CSS (Lists/Home/Tracking/Plan/Habits grid+console/Operations/Scheduler/Analytics/**Modules catalog**/Docs/Editor/Mobile) plus **`baby-animal-nest.css`** (friend nest), **`shell-chrome.css`** (pinned mill title bar), **`ui-names.css`** (Names overlay), **`chrome-patina.css`**, and **`pcb-backdrop.css`**. Mounts `ChromePatina` (live gunmetal), `PcbBackdrop` (`data-pcb-mode` on `<html>`, `suppressHydrationWarning`), `CompletionPopupHost`, and `UiNamesHost` (`data-ui-mode` on `<html>` when Names is on; nameplate portals to `document.body` at z-index 310 so it sits above dialogs). A blocking boot script reads **`brain2-pcb-mode`** (then **`cogs-pcb-mode`**) then the theme blob so the first paint is the saved plate, not seed teal. Electron restamps the pin from a saved theme blob so a stale hub pin cannot win. Sets metadata (title **BRAIN2**, description of a living application) and `win95-app` on `<body>`. Server component (no `"use client"`). |
| `chrome-patina.css` | Remaps `--h-surface` / `--hab-metal` / `--fm-surface` / `--mod-surface` / `--s-surface` / … onto `--chrome-*` with `body.win95-app` specificity so a local hex (Habits `#c5c3bc`) cannot win after Fast Refresh. Dual-thumb slider chrome for Settings. |
| `chrome-patina.tsx` | Client applicator: writes `--chrome-face` (and bevel kin) on load, on set-point change, and once a minute. |
| `pcb-backdrop.css` | Desktop field behind the shell. Default `teal` is solid `#008080`. Other `html[data-pcb-mode]` values paint photographed plates from `/pcb/` plus a soft veil/grain. Light plates (`ceramic` / `mint` / `ice`) switch gutter ink dark; dark plates (`xray` / `fr4`) keep white title type. Settings chip grid. |
| `pcb-backdrop.tsx` | Client applicator: does not stamp seed teal from the unhydrated store (boot script already painted the pin). After persist hydration, follows `theme-store.pcbMode` (a saved plate wins over a stale pin). |
| `page.tsx` | The single application page. Renders the pinned full-width mill title bar (`AppHeader`: navy **BRAIN2** caption + today's-friend jewel + Friend / Review / System / optional **now** / Capture groupboxes) *outside* the desk container so the fascia is edge-to-edge, then the top-level tab bar (`data-ui-name="App tabs"`), lazy-loading each module panel. On mount, calls `initWorkflowEngine` so module workflows and implied-action rules (`logAction` / `incrementHabit`) run on item mutations. When an item is selected, `EnhancedTaskDetail` fills the desk **below** the pin bar (header stays mounted; tabs from the item type, not Task defaults). Legacy `#popout/…` hashes still skip the shell if they land here. |
| `page.test.tsx` | Pin bar stays mounted when item detail is open. |
| `popout/page.tsx` | **Standalone pop-out window.** No global header or app tabs. `?module=<id>` renders `ModulePopoutView`; `?sheet=<id>` renders `SheetPopoutView`. This is what **Pop out** opens. |
| `globals.css` | Tailwind base/components/utilities + CSS variables for theme colors/radii and custom utility classes. Imported first by `layout.tsx`. House CRT / milled fascia tokens live on `:root` in `win95.css` (not duplicated here). |
| `win95.css` | Global Windows 95 skin + **house milled fascia defaults** for unskinned surfaces. Bevels, scrollbars, pixel font (`w95fa`), `.cogs-color-swatch` (beveled color picker), and **navy `#000080` text-field and checkbox/radio focus** on every input/textarea/select (never WebKit orange). `:root` exposes `--fascia-*` + `--hab-crt-green` / `--hab-crt-glow`; default dialogs / menus / buttons / nested tab strips use them (brushed bay, raised metal keys, active tab = CRT + power lamp — not equal-fill). The top-level **App tabs** keep their milled equal-fill CRT keys ([`docs/DESIGN_STYLE.md`](../docs/DESIGN_STYLE.md#milled-fascia)). Portaled private skins (`.set95`, `.inbox-dialog`, `.id95`, `.hab-grade-sheet`, `.hpp95`, …) are scoped out of the global dialog face; module CSS imported after this file in `layout.tsx` still overrides. Scoped under `body.win95-app` with real specificity (not `:where()`) so Fast Refresh cannot let Tailwind utilities win. Desktop muted text follows `data-pcb-ink` (white on dark plates, ink on light plates); light surfaces (including Tracking `.trk95` / `.trk-desktop`) restore readable gray. **`--chrome-*` family** (below) is the one gunmetal. `--w95-desktop` aliases `--pcb-desk`. `chrome-patina.css` remaps face tokens back. This file is the **quoted ancestor** (bevel, pixel font, navy focus) plus the default mill — not a law that every frame must stay a Windows dialog. Pair with Lists velvet/orbs for the cabinet — [`docs/DESIGN_STYLE.md`](../docs/DESIGN_STYLE.md). |
| `loading.tsx` | Next.js route-level loading boundary for the root route. Renders `null` — the app mounts quickly and uses per-panel Suspense fallbacks instead. |

## Chrome tokens (`:root`)

Settings → **Window gray** owns the set-point; `ChromePatina` writes the live
values. Channels stay equal (never brown, never `#c5c3bc`).

| Token | Role |
|-------|------|
| `--chrome-face` | Displayed gunmetal (source of truth; default `#c0c0c0`) |
| `--chrome-mid` / `--chrome-hi` / `--chrome-lo` / `--chrome-brush` / `--chrome-frame` | Bevel family |
| `--chrome-set` | Persisted set-point (0–100; 50 = classic) |
| `--chrome-live` | Current displayed percent (ghost tick) |
| `--chrome-mix` | Signed 24-minute drift sine |
| `--w95-surface` and kin | Aliases of `--chrome-*` |
| `--w95-desktop` | Alias of `--pcb-desk` — the PCB plate fallback color |
| `--hab-crt-green` / `--hab-crt-glow` | House CRT phosphor (`#7dffc4`) |
| `--fascia-mill` / `--fascia-bay` / `--fascia-bay-ring` | Brushed bay face + stacked ring |
| `--fascia-key-face` / `--fascia-key-ring` / `--fascia-key-pressed` | Raised metal keys |
| `--fascia-crt-glass` / `--fascia-crt-ring` / `--fascia-scope` | Black-glass CRT well |
| `--fascia-dialog-face` / `--fascia-dialog-ring` | Default unskinned dialog bay |
| `--fascia-nameplate` | Engraved nameplate ink (`#2a2c2e`) |

## Shell layout (`page.tsx`)

**Global header** (visible on every tab **and** on item detail) is a full-width mill title bar pinned to the viewport (`components/AppHeader.tsx`, `shell-chrome.css`, `position: sticky; top: 0; z-index: 40`): navy **BRAIN2** caption with a Tek POWER lamp, today's-friend jewel in a chrome + black-mirror well, and Friend / Review / System / optional **now** well / Capture as one row of Win95 groupboxes. The **now** well (`header-now-box.tsx`) sits between System and Capture only while an Operations or pen-color Working session is live (name, tabular elapsed, Stop, Pause↔Resume; idle → hidden). The fascia is edge-to-edge; brand left, keys right, **Quick Add** docked at the right of Capture. Same doors as before — not a menu bar and not an inset card. Pin-bar dialogs (Quick Add, Bulk Add, Ingest, From Notes, Phone Notes, Metrics, Reviews / Morning, Tracking compact frame) share milled fascia `.hpp95` (`components/header-popup-chrome.css`); Settings stays `.set95`, Inbox stays `.inbox-dialog`.

| Control | Component | Purpose |
|---------|-----------|---------|
| BRAIN2 caption | `AppHeader.tsx` | Window title of the header cabinet, Tek POWER lamp at the left |
| Today's friend | `baby-animal-nest.tsx` | 64px photograph in a chrome + black-mirror jewel inside the Friend groupbox. Stays until **Monday** (or a manual shuffle/pick); pinned on `cogs-friend-worn`. Click the **photograph** for this friend’s details (history, mission journal, personality). The **chat button** above Gallery asks for a Stardew-style chat bubble (unmet **daily habit**, **today's To Do**, **Next Action**, affection, or a whim — species quirks); click it again for another line. Click the **bubble** for the mission sheet: the task opens item detail on top of the sheet, **Accept** lasts until the end of the day, **Decline** asks to break the task down, then to do the first step, then for a reason. Finish an accepted mission (or **I did it** on a whim) for friend points and a small cheer. **Escape**, the bubble ×, or a click outside closes the bubble without declining. Returning friends (history, not refresh) may say **Hi again**. **Gallery** (naming is only inside that dialog; **Details** is the same page as the photograph; navy text-field focus). Preapproved `animalsrcs/` pack cards start unnamed so you can name them; shuffle wears another gallery card and naming names the next unnamed one. **Pictures only come from the pack or your own upload — nothing is fetched** — and persist in `cogs-friend-pic:<id>` or `/friend-pack/*.png`. **Remove** confirms delete; dismissed friends do not come back on refresh. Same gallery in Settings. Companion plan: [`docs/FRIEND_COMPANION.md`](../docs/FRIEND_COMPANION.md). |
| Morning / Review | `Reviews/reviews.tsx` | Start-of-day ritual + end-of-period dropdown. Review count well tooltips *N end-of-period reviews due*. |
| Settings | `Settings/SettingsDialog.tsx` | Full-app JSON backup/restore, window gray, **desktop PCB** plate, Message ingest (Telegram writes + `groc` grocery pin + discrete triggers + receipt/journal/PDF scans + always-on hub), Manage Item Types, Second Brain setup |
| Tracking | `cognitive-state.tsx` | Opens TimeGrid dialog + Operations **Working on this now** strip |
| Names | `AppHeader.tsx` → `lib/ui-names-store.ts` | Persisted System-group latch. Caption stays **Names**; sunken + `aria-pressed` while on (tooltip **Stop naming**). First `data-ui-mode`. Help / Inspect would sit beside it later and load living READMEs via `data-ui-docs`. |
| now | `header-now-box.tsx` | Optional groupbox between System and Capture. Absent when idle; one or two rows for live Operations **Working on this now** and/or pen-color **Working on right now** (name, tabular elapsed, Stop, Pause↔Resume). Same session stores as the Tracking strips. |
| Inbox | `inbox.tsx` | Two piles: **Inbox** (revisit) and **Monkey brain** (dump; `-mb` / `-monkey`). Walk **selected** ideas (rename, discard, recent lists). +1 point per handle, +50 when the revisit Inbox hits 0. Select all / Deselect all. Multi-select batch: list (Apply stays in Inbox; Apply and clarify files them out), deadline, merge, mark clarified, move piles, bulk edit, delete with Are you sure?. Navy selection outline. Count well is the revisit pile. |
| Ingest | `ingest-log-dialog.tsx` | Log of phone-message ingest (Telegram / simulate) |
| Metrics | `Tracking/MetricLogger.tsx` | Wellbeing datapoints |
| Bulk Add | `enhanced-bulk-add.tsx` | Multi-line capture; `list:` / `folder: list:` headers; optional Inbox |
| From Notes | `notes-ingest.tsx` | This Mac: iCloud/iPhone + On My Mac notes (Electron IPC or localhost `/api/notes`) → parse/skip → bulk add or park on **notes to ingest**. Close/reopen keeps the session so a slow first listing can finish in the background. |
| Phone Notes | `iphone-notes-store.tsx` | On My iPhone notes dumped via Telegram Shortcut (`iphone-notes:`) → **iPhone Notes Store** / **Parked**. AirDrop `Dump iPhone Notes to Brain2.shortcut`. Bulk-add, keep parked, skip, Open in Lists. |
| Quick Add | `quick-add.tsx` | Single-line smart capture; colon paths; live chips; optional skip Inbox. `-mb` / `-monkey` → Monkey brain. Default (bold, framed) press key. |

A global **Cmd/Ctrl-K** search palette (`Search/GlobalSearch.tsx`, wired via
`useGlobalSearchHotkey`) is mounted at the page root and available on every tab.
**Cmd/Ctrl-Z** undoes the last Home/Tracking action (`hooks/useUndoHotkey.ts` →
`lib/action-history.ts`): a painted or erased block, a week fill, a sleep log
edit, a habit cell, a completed to-do, or a Day Log time entry. Home → Tracking
adds a capture-phase listener (`components/Home/Tracking/tracking-undo.ts`) so
the chord still works while the timegrid is focused. Redo is
Cmd/Ctrl-Shift-Z (Ctrl+Y on Windows). Text fields keep the browser's own undo.

**Top-level tabs** (`data-ui-name="App tabs"` on the Radix tablist; Names outlines use `!important` to beat Radix `outline: none`) (7, lazy-loaded):

| Tab | Panel | Folder |
|-----|-------|--------|
| Home | `HomeDashboard` | `components/Home/` |
| Lists | `EnhancedCategoryView` | `components/Lists/` (`enhanced-list-view.tsx` orchestrator) |
| Docs | `DocsPanel` | `components/Docs/` |
| Scheduler | `EnhancedScheduler` | `components/Scheduler/` |
| Operations | `OperationsView` | `components/Operations/` (category-grouped board → per-operation workspace) |
| Modules | `ModulesPanel` | `components/Modules/` |
| Analytics | `EnhancedAnalytics` | `components/Analytics/` |

Task detail: selecting a task (from Lists, Modules, Inbox, or global Search) sets
`selectedTaskId` and replaces the **desk** (tabs) with `EnhancedTaskDetail` until the
user navigates back — the pin bar stays. Last place in the app persists via `lib/app-navigation.ts`:
top-level tab, open item + its detail tab, Docs folder/doc **and scroll**,
Operations workspace + panel, Modules workspace + view, Scheduler view/date,
Home date / Habits period / Goals filters, Analytics view + group memory + canvas scroll.
Hiding a tab does not wipe stored scroll (Docs, Analytics, Operations panels).

## Spec

Implements the application shell that hosts every module (§2.2, §8 Home Dashboard
top bar). Consistent with the local-first, client-only architecture (map/weather
helpers call public APIs from the renderer). A future **MongoDB** connection
(via Electron IPC) will provide durable storage, text/vector search indexes, and
aggregation-based routing without changing this shell layout.

See also `components/README.md` for module-level UI documentation and `lib/README.md`
for the stores the page's children read/write.
