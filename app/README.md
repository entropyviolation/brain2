# `app/` — Next.js App Router entry

The Next.js App Router root for Brain2 — a **living perfect second brain**
(item used everywhere; **Analytics** is the heart — see the vision in the root
[`README.md`](../README.md)). The UI is client-side and
exported statically (`output: "export"`), so these files mostly set up the
shell and mount the single page. Trip maps / weather / places hit public APIs
from the browser (`lib/city-search.ts`, `lib/weather-client.ts`,
`lib/places-search.ts`, cached in `lib/api-cache.ts`) — no App Router API
routes are required for the static Electron build.

## Public door

`page.tsx` is the shell. Other rooms may not take over this file. Tabs stay
mounted on purpose (hidden, not unmounted) so Lists can return without
rebuilding its task index: `DeskTab` sets `forceMount` and the `hidden` class,
and `rememberWarm` keeps the current tab plus the previous one. Full-page item
detail hides that desk the same way; the desk stays mounted.

The shell mounts:

- `AppHeader` (`components/AppHeader.tsx`) — the pin bar; it mounts `HeaderNowBox`
- `PersistStatusBanner`, `PenSettingsHost`
- Tab panels, once warm: `HomeDashboard`, `EnhancedCategoryView`, `DocsPanel`, `EnhancedScheduler`, `OperationsView`, `ModulesPanel`, `EnhancedAnalytics`

`EnhancedTaskDetail`, `GlobalSearch`, and `TaskDetailPopup` mount when they
open. A legacy `#popout/…` hash skips the shell and mounts `ModulePopoutView`
or `SheetPopoutView` alone.

Live timer: `components/header-now-box.tsx` (`HeaderNowBox`) is the header well
inside Capture (idle → hidden). The shared clock hook is `useWorkSessionClock` from
`components/Operations/WorkingNowControl.tsx`. The same well also reads a
pen-color session through `usePenColorSessionClock`
(`components/Home/Tracking/pen-color-now-strip.tsx`).
`components/Home/Tracking/working-now-strip.tsx` (`WorkingNowStrip`) is the
Tracking strip. Other rooms may import the header well and `useWorkSessionClock`.
They may not fork a second timer.

## Files

| File | Purpose |
|------|---------|
| `layout.tsx` | Root HTML layout. Loads the Karla Google font, imports `globals.css`, **`win95.css`**, then module chrome CSS (Lists/Home/Tracking/Plan/Habits grid+console/Operations/Scheduler/Analytics/**Modules catalog**/Docs/Editor/Mobile) plus **`baby-animal-nest.css`** (friend nest), **`shell-chrome.css`** (pinned mill title bar), **`search-chrome.css`** (Cmd/Ctrl-K palette), **`ui-names.css`** (Names overlay), **`chrome-patina.css`**, and **`pcb-backdrop.css`**. Mounts `ChromePatina` (live gunmetal), `PcbBackdrop` (`data-pcb-mode` on `<html>`, `suppressHydrationWarning`), `CompletionPopupHost`, and `UiNamesHost` (`data-ui-mode` on `<html>` when Names is on; nameplate portals to `document.body` at z-index 310 so it sits above dialogs). A blocking boot script reads **`brain2-pcb-mode`** (then **`cogs-pcb-mode`**) then the theme blob so the first paint is the saved plate, not seed teal. A second script stamps **`data-boot-tab`** from the saved app tab so that key is lit before hydration (`data-nav-ready` hands the look back to React). Electron restamps the pin from a saved theme blob so a stale hub pin cannot win. Sets metadata (title **BRAIN2**, description of a living application) and `win95-app` on `<body>`. Server component (no `"use client"`). |
| `chrome-patina.css` | Remaps `--h-surface` / `--hab-metal` / `--fm-surface` / `--mod-surface` / `--s-surface` / … onto `--chrome-*` with `body.win95-app` specificity so a local hex (Habits `#c5c3bc`) cannot win after Fast Refresh. Slider chrome for Settings. |
| `chrome-patina.tsx` | Client applicator: writes the committed `--chrome-*` and Bouba/Kiki radius tokens on `:root`. A timed shift holds the previous chrome here until the interval ends (the settings panel previews the in-between). A short cycle, and that shift, tick faster. |
| `pcb-backdrop.css` | Desktop field behind the shell. Default `teal` is solid `#008080`. Other `html[data-pcb-mode]` values paint photographed plates from `/pcb/` plus a soft veil/grain. Light plates (`ceramic` / `mint` / `ice`) switch gutter ink dark; dark plates (`xray` / `fr4`) keep white title type. Settings chip grid. |
| `pcb-backdrop.tsx` | Client applicator: does not stamp seed teal from the unhydrated store (boot script already painted the pin). After persist hydration, follows `theme-store.pcbMode` (a saved plate wins over a stale pin). |
| `page.tsx` | The single application page. Renders the pinned full-width mill title bar (`AppHeader`: navy **BRAIN2** caption + **Nav** Back/Forward + today's-friend jewel + Friend / Review / System / Capture groupboxes (optional **now** well inside Capture)) and the top-level tab bay (`data-ui-name="App tabs"`) in one sticky stack (`.b2-app-pin` in `win95.css`, `top: 0`). The fascia stays edge-to-edge. The bay stays in the desk container (`container mx-auto` with the same horizontal padding), flush under the title bar, so the keys keep their width when the header wraps. The shell hydrates on the fallback tab, then a layout effect selects the saved tab and mounts that panel only — a refresh on Lists does not download Home. The previous tab stays mounted and hidden (its own Suspense), so Lists → Home → Lists does not rebuild the list index. Item detail, search, and the search popup load when they open. On mount, calls `initWorkflowEngine` so module workflows and implied-action rules (`logAction` / `incrementHabit`) run on item mutations, and `useDayScheduleRollover` so an unfinished past period either rolls up one funnel level or, when `autoPush` is on, pushes onto the next To Do period of the same grain (both keep `schedulePlacements`), and `useProcessInboxTodo` so more than 100 revisit Inbox ideas add today's **process inbox information** To Do with Auto-push on. `useReminderTick` delivers due Reminders into the Inbox and texts Telegram while this window is open. `useSystemHomeListPins` keeps the built-in singleton lists on Lists Home. `usePeopleIKnowList` creates or adopts the People I Know list after the task vault hydrates. `useCloseGiftIdeas` ensures a Gift ideas list for each person already marked Close, and a later save that turns Close on or renames the person updates that list. `useInstagramFollowingList` and `useInstagramFollowersList` sit beside `usePeopleIKnowList` and create or adopt People I follow on Instagram and People who follow me on Instagram after the same hydrate. When an item is selected, `EnhancedTaskDetail` fills the desk **below** the pin bar (header stays mounted; tabs from the item type, not Task defaults). Screen history Back/Forward rewrites `appItemId` and other nav pins; the page re-reads item selection on `cogs-nav-restore`. Legacy `#popout/…` hashes still skip the shell if they land here. `performance.mark("brain2-nav-ready")` is the production timing point (`scripts/speed-timings.mjs`). |
| `page.test.tsx` | Pin bar stays mounted when item detail is open. |
| `popout/page.tsx` | **Standalone pop-out window.** No global header or app tabs. `?module=<id>` renders `ModulePopoutView`; `?sheet=<id>` renders `SheetPopoutView`. This is what **Pop out** opens. |
| `globals.css` | Tailwind base/components/utilities + CSS variables for theme colors/radii and custom utility classes. Imported first by `layout.tsx`. House CRT / milled fascia tokens live on `:root` in `win95.css` (not duplicated here). |
| `win95.css` | Global Windows 95 skin + **house milled fascia defaults** for unskinned surfaces. Bevels, **vintage scrollbars** (16px `::-webkit-scrollbar` hatch + raised thumb; Firefox `scrollbar-width` / `scrollbar-color` only inside `@supports (-moz-appearance: none)` — setting those properties in Chromium replaces the vintage bar; see [`docs/DESIGN_REFS.md`](../docs/DESIGN_REFS.md#vintage-scrollbars-hard-rule)), pixel font (`w95fa`), `.cogs-color-swatch` (beveled color picker), and **navy `#000080` text-field and checkbox/radio focus** on every input/textarea/select (never WebKit orange). `:root` exposes `--fascia-*` + `--hab-crt-green` / `--hab-crt-glow`; default dialogs / menus / buttons / nested tab strips use them (brushed bay, raised metal keys, active tab = CRT + power lamp — not equal-fill). The top-level **App tabs** keep their milled equal-fill CRT keys ([`docs/DESIGN_STYLE.md`](../docs/DESIGN_STYLE.md#milled-fascia)). `.b2-app-pin` sticks that bay flush under the title bar (the shell's own sticky is released inside the stack so a wrapping header and the keys move as one unit; key flex and min-width are unchanged). Portaled private skins (`.set95`, `.inbox-dialog`, `.id95`, `.hab-grade-sheet`, `.hpp95`, …) are scoped out of the global dialog face; module CSS imported after this file in `layout.tsx` still overrides. Scoped under `body.win95-app` with real specificity (not `:where()`) so Fast Refresh cannot let Tailwind utilities win. Desktop muted text follows `data-pcb-ink` (white on dark plates, ink on light plates); light surfaces (including Tracking `.trk95` / `.trk-desktop`) restore readable gray. **`--chrome-*` family** (below) is the one gunmetal. `--w95-desktop` aliases `--pcb-desk`. `chrome-patina.css` remaps face tokens back. This file is the **quoted ancestor** (bevel, pixel font, navy focus) plus the default mill — not a law that every frame must stay a Windows dialog. Pair with Lists velvet/orbs for the cabinet — [`docs/DESIGN_STYLE.md`](../docs/DESIGN_STYLE.md). |
| `loading.tsx` | Next.js route-level loading boundary for the root route. Renders `null` — the app mounts quickly and uses per-panel Suspense fallbacks instead. Those fallbacks are the scope instrument (`components/machine-loading.tsx`). |

## Chrome tokens (`:root`)

Settings → **Window gray** owns the warmth; `ChromePatina` writes the live
values. The face walks the design-ref grays (`#999683` … `#c0bfba` …
`#c0c0c0` … `#b7bcbf` … `#b8bbc0`), piecewise. It is not a red/blue filter.
Mix 50 is the stored classic default (`#c0c0c0` and its companion tokens);
**Default** restores that palette and pauses. A frozen Habits `#c5c3bc` still
must not win. Settings → **Bouba/Kiki** writes the corner tokens; mix 50 is
the measured radius default.

| Token | Role |
|-------|------|
| `--chrome-face` | Displayed gunmetal (source of truth). Warmth 50 = stored classic `#c0c0c0`. Other mixes are the design-ref swatches. |
| `--chrome-mid` / `--chrome-hi` / `--chrome-lo` / `--chrome-brush` / `--chrome-frame` | Bevel family of the active swatch. At warmth 50: mid `#dfdfdf`, hi `#ffffff`, lo `#808080`, brush `#acacac`, frame `#0a0a0a`. |
| `--chrome-sheen` / `--chrome-shade` / `--chrome-key-*` / `--chrome-ring` and kin | Fascia stops. At warmth 50 they are the stored hexes (`#d4d8dc`, `#969a9e`, …). Other knots use that gray’s own companions. |
| `--chrome-set` / `--chrome-live` | Warmth 0–100 (50 = classic) |
| `--chrome-mix` | Signed warmth, −1 warm … 0 classic … +1 cool |
| `--radius` / `--r-tw` / `--r-0` … `--r-18` / `--r-375` and kin | Bouba/Kiki corners. Mix 50 writes the measured literals. `--corner-mix` is the live 0–100. |
| `--w95-surface` and kin | Aliases of `--chrome-*` |
| `--w95-desktop` | Alias of `--pcb-desk` — the PCB plate fallback color |
| `--hab-crt-green` / `--hab-crt-glow` | House CRT phosphor (`#7dffc4`) |
| `--fascia-mill` / `--fascia-bay` / `--fascia-bay-ring` | Brushed bay face + stacked ring |
| `--fascia-key-face` / `--fascia-key-ring` / `--fascia-key-pressed` | Raised metal keys |
| `--fascia-crt-glass` / `--fascia-crt-ring` / `--fascia-scope` | Black-glass CRT well |
| `--fascia-dialog-face` / `--fascia-dialog-ring` | Default unskinned dialog bay |
| `--fascia-nameplate` | Engraved nameplate ink (`#2a2c2e`) |

## Shell layout (`page.tsx`)

**Global header** (visible on every tab **and** on item detail) is a full-width mill title bar pinned to the viewport (`components/AppHeader.tsx`, `shell-chrome.css`, `position: sticky; top: 0; z-index: 40`): navy **BRAIN2** caption with a Tek POWER lamp, leading **Nav** Back/Forward keys (`header-nav-buttons.tsx`), today's-friend jewel in a chrome + black-mirror well, and Friend / Review / System / Capture as Win95 groupboxes. Wide enough, they are one instrument row: **Nav** stays the left anchor, and Friend, Rituals, System, and Capture are one group centered in the space to its right. The column gap between those clusters stays tight — leftover mill is equal on both sides of the group, not a hole between Friend and Rituals. Capture’s Now, Inbox, and Quick Add keys are content-wide and share one gap (**Quick Add** stays in that rhythm); the live now well sits beside them at its own content size. Narrower than the group, whole clusters wrap onto the full shell (keys do not flex-shrink), and a cluster wider than the shell scrolls inside its bay with counts still on the keys. The **now** well (`header-now-box.tsx`) lives in Capture, as a peer of the Capture keys, only while an Operations or pen-color Working session is live (name, tabular elapsed, Stop, Pause↔Resume; idle → hidden). The fascia is edge-to-edge. System is the gear, the question mark, search, and the reminders bell. Capture is Now, Inbox, and Quick Add. Metrics is not on this bar; it is the milled key on Current moment inside Now. Ingest, From Notes, and Phone Notes sit in Settings and in Lists settings — still labeled buttons, not a menu, and not an inset card. Pin-bar dialogs (Quick Add, including its Bulk field, plus Inbox bulk edit, Ingest, From Notes, Phone Notes, Metrics, Reviews / Morning, the Now frame) share milled fascia `.hpp95` (`components/header-popup-chrome.css`); Settings stays `.set95`, Inbox stays `.inbox-dialog`.

| Control | Component | Purpose |
|---------|-----------|---------|
| BRAIN2 caption | `AppHeader.tsx` | Window title of the header cabinet, Tek POWER lamp at the left |
| Nav | `header-nav-buttons.tsx` | Back / Forward through in-app screens (tabs, Lists folders, full-page item detail, Docs/Ops/Modules selections). Disabled when the stack has nowhere to go. Not browser `window.history` — see `lib/screen-history.ts`. |
| Today's friend | `baby-animal-nest.tsx` | 64px photograph in a chrome + black-mirror jewel inside the Friend groupbox. Stays until **Monday** (or a manual shuffle/pick); pinned on `brain2-friend-worn` (reads prefer `brain2-*`). Click the **photograph** for this friend’s details (history, mission journal, personality). The **chat button** above Gallery asks for a Stardew-style chat bubble (unmet **daily habit**, **today's To Do**, **Next Action**, affection, or a whim — species quirks); click it again for another line. Click the **bubble** for the mission sheet: the task opens item detail on top of the sheet, **Accept** lasts until the end of the day, **Decline** asks to break the task down, then to do the first step, then for a reason. Finish an accepted mission (or **I did it** on a whim) for friend points and a small cheer. **Escape**, the bubble ×, or a click outside closes the bubble without declining. Returning friends (history, not refresh) may say **Hi again**. **Gallery** (naming is only inside that dialog; **Details** is the same page as the photograph; navy text-field focus). Preapproved `animalsrcs/` pack cards start unnamed so you can name them; shuffle wears another gallery card and naming names the next unnamed one. **Pictures only come from the pack or your own upload — nothing is fetched** — and persist in IndexedDB `idb:friend_<id>` (gallery JSON holds `friend:<id>`) or `/friend-pack/*.png`. **Remove** confirms delete; dismissed friends do not come back on refresh. Same gallery in Settings. Companion plan: [`docs/FRIEND_COMPANION.md`](../docs/FRIEND_COMPANION.md). |
| Morning / Review | `Reviews/reviews.tsx` | Start-of-day ritual + end-of-period dropdown, including yesterday's night, plus a Star Lord Report on the local new moon, full moon, and birthday. Close saves a draft; submit awards points. Review count well tooltips *N end-of-period reviews due*. |
| Settings | `Settings/SettingsDialog.tsx` | Gear key (hover **Settings**). Grouped index and search: You, Appearance, Points, Data, Imports, Library. Points rules opens from Automatic point allocation. Full-app JSON backup/restore, window gray, **desktop PCB** plate, **Notes and ingest** (Ingest, From Notes, Phone Notes), Message ingest (Telegram writes + `groc` grocery pin + discrete triggers + receipt/journal/PDF scans + always-on hub), **Import from Instagram data**, Manage Item Types, Second Brain setup |
| Names | `AppHeader.tsx` → `lib/ui-names-store.ts` | Question-mark key. Hover **Names help mode**. Sunken + `aria-pressed` while on, with a diagonal strike through the mark. The mode stays **names**. First `data-ui-mode`. |
| Search | `Search/GlobalSearch.tsx` | Magnifying-glass key in the System group. Opens the same palette as Cmd/Ctrl-K. Hover **Search**. |
| Now | `cognitive-state.tsx` | Word key in Capture. Opens the Now popup (`components/header-tracking/`): Current moment above the Tracking / Plan switch (four lanes, a **Metrics** key to their right — `Tracking/MetricLogger.tsx`, same wellbeing write — Working on, Events, Thought process, Update state that can extend or split a block), then the day grid or the day plan. Frame `min(94vw, 66rem)`. Home → Tracking is the full desk. |
| now | `header-now-box.tsx` | Optional well inside Capture, beside the Now, Inbox, and Quick Add keys. Absent when idle; one or two rows for live Operations **Working on this now** and/or pen-color **Working on right now** (name, tabular elapsed, Stop, Pause↔Resume). Same session stores as the Tracking strips. |
| Inbox | `inbox.tsx` | Two piles: **Inbox** (revisit) and **Monkey brain** (dump; `-mb` / `-monkey`). The header key counts the revisit pile only (`monkeyBrain` not set); Monkey brain stays on its tab and does not fill that well when the revisit pile is empty. Partition titles stay ink; lamp and CRT count still change. Hairline rows, caret bar vs checked well. Walk from the caret, or **Walk selected** after a check; the walk sheet stays mounted and the pile behind it waits. That sheet names the stored door under the subtitle (**BIM**, **Quick Add**, **Bulk Add**, **From notes**, **Phone Notes**, or **Scheduled**) when the idea has one. Select all / **Select N** / **Select unsorted** / Dated-or-Bare slice. After a check: Apply list (search `folder: all` or `all folder` for that folder’s All Items plate; Apply adds that pool and keeps other lists; Apply stays; Apply and clarify files them out), due, **File**, **Transfer to log** (rows leave on the click; one later write paints a Tracking log instant at each idea's `createdAt`, the inbox arrival; chord `t`; a failed write puts the rows back), move piles, bulk edit (rewritten lines keep that arrival and `captureOrigin`), delete (Are you sure?, including one row). Merge at two keeps the earliest `createdAt`. Clarify does not replace the arrival with the save time. +1 per handle, +50 when the revisit pile hits 0; the foot counts the sitting. |
| Quick Add | `quick-add.tsx` | Smart capture. Off **Bulk**: one line, live chips (new list / new folder). A leading `log:` is a dark blue **LOG** mark and the tracking log (same write as Telegram), never Inbox. On **Bulk**: taller box and `writeBulkCapture` (colon paths, `folder: list: item`, `folder: all: item` for that folder's All Items, names that end in a number such as `brain2`, `before` dates, inbox checkbox). Date, time, duration, and priority stay in the title. **Plain** (default off) or `-p` / `-plain` stores the line as written. `-mb` / `-monkey` → Monkey brain. After a successful write, a small fixed flag names where it went (Inbox, the list, folder All Items, Monkey brain, or the tracking log; Bulk adds a count) and then dismisses — click, ×, or a few seconds. A no-op or a log error stays quiet. Default (bold, framed) press key. **Cmd/Ctrl-Shift-A** opens it; a highlighted selection prefills the box. |

A global **Cmd/Ctrl-K** search palette (`Search/GlobalSearch.tsx`, `search-chrome.css`,
wired via `useGlobalSearchHotkey`) is mounted at the page root and available on every tab.
The System-group magnifying glass opens that same palette. **Cmd/Ctrl-Shift-A** opens Quick Add.
**Cmd/Ctrl-Z** undoes the last Home/Tracking action (`hooks/useUndoHotkey.ts` →
`lib/action-history.ts`): a painted or erased block, a week fill, a sleep log
edit, a habit cell, a completed to-do, or a Day Log time entry. Home → Tracking
adds a capture-phase listener (`components/Home/Tracking/tracking-undo.ts`) so
the chord still works while the timegrid is focused. A stroke on the plot
focuses that grid so a text field does not keep the chord. The grid updates on
that keydown; the rest of the snapshot follows immediately after, and derived
sync stays quiet until it has landed. A later entries write that still carries the undone id is dropped, so the block does not come back. Redo is
Cmd/Ctrl-Shift-Z (Ctrl+Y on Windows). Text fields keep the browser's own undo.

**Top-level tabs** (`data-ui-name="App tabs"` on the Radix tablist; Names outlines use `!important` to beat Radix `outline: none`) sit in `.b2-app-pin`, flush under the mill title bar, and scroll with it as one stuck unit. The bay keeps the desk container width (7, lazy-loaded):

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
`selectedTaskId` and shows `EnhancedTaskDetail` over the desk — the pin bar stays,
and the tab desk stays mounted but hidden so Lists does not cold-remount when you
jump back (e.g. double-click a list chip on the item). List jumps use
`applyListsNavigation` / `requestNavigateToList` (`lib/app-navigation.ts`), which
persist location/openTarget and fire `cogs-navigate-to-list`; a mounted
`useListsNavigation` applies the target in place. The shell only switches to the
Lists tab and clears the open item — it does not remount `EnhancedCategoryView`.
Last place in the app persists via `lib/app-navigation.ts`:
top-level tab, open item + its detail tab, Docs folder/doc **and scroll**,
Operations workspace + panel, Modules workspace + view, Scheduler view/date,
Home date / Habits period / Goals filters, Analytics view + group memory + canvas scroll.
Hiding a tab does not wipe stored scroll (Docs, Analytics, Operations panels).

### Client mount & assets

The shell is one client page. Stores and header doors come with it; a few panels wait until they open.

- `layout.tsx` imports module chrome CSS on the root so Fast Refresh cannot drop a skin that a lazy tab imported itself.
- Header doors (Inbox, Reviews, Settings, Quick Add) stay in the first client graph. Ingest, From Notes, and Phone Notes mount with Settings and with Lists settings. The header Now button stays too; its popup (Time Grid chunk and Plan pane) loads when that dialog opens.
- Pop-out module ids are parsed by `components/Modules/workspace/module-popout.ts`.
- There is no provider wrapper. Zustand stores are imported where they are used.

## Spec

Implements the application shell that hosts every module (§2.2, §8 Home Dashboard
top bar). Consistent with the local-first, client-only architecture (map/weather
helpers call public APIs from the renderer). MongoDB via Electron IPC is
speculation, not the storage plan. The sync that exists is the manual phone hub.
This shell layout does not depend on either.

See also `components/README.md` for module-level UI documentation and `lib/README.md`
for the stores the page's children read/write.
