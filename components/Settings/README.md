# `components/Settings/`

Cross-cutting settings UI that isn't tied to a single feature screen.

**Chrome:** milled fascia (`.set95` / `.set95-dialog` in `settings-chrome.css`) —
brushed silver section bays, engraved uppercase nameplates (`#2a2c2e`, 11px / 700 /
tracking ~0.14em), raised metal keys (title-bar close is the shared `.b2-close-key`:
opaque 22px square, × optically centered, same key as Inbox / pin-bar `.hpp95`),
CRT black glass only for the dialog title, the selected section, and
the message-ingest pairing code (phosphor `#7dffc4`). The main dialog
(`.set95-settings`) is one instrument: caption, find well, sunken index,
sunken body of raised bays. Nested Item Types stays a plain `.set95-dialog`.
Imported from `app/layout.tsx`.

| File | Purpose | Spec |
|------|---------|------|
| `settings-chrome.css` | Milled fascia skin for Settings + nested Item Types dialogs (`.set95`). `.set95-settings` is the find well, the index, and one selected bay in the body. | — |
| `settings-index.ts` | Group and section catalog, plus the words search matches (title, group, visible labels). | — |
| `settings-nav.tsx` | Find well and the section index. The dialog owns the query and the selection. | — |
| `SettingsDialog.tsx` | Header gear (`title` **Settings**, `data-ui-name="Settings"` on the dialog content). Names nameplate portals above this overlay. Six groups — see below. The body mounts the selected bay only and scrolls inside it. Renders `<PointAllocationField />` for Points. Wired into `app/page.tsx`. Fields auto-save (`isDirty: false`); close does not prompt. | §3.2 / §5 |
| `DataProfileField.tsx` | Settings → **Data profile**. Live is the real vault. Demo is invented stock data (River Hale) on `brain2-demo-*` keys only. Never writes Live `brain2-*` / `cogs-*`. Reset Demo wipes only demo keys + demo IndexedDB. | — |
| `BabyAnimalFriendField.tsx` | Settings → **Baby animal friend**. Same gallery as the header nest: preapproved pack plus your cards, shuffle among gallery, name every friend, find-another / request / upload, per-card **Details** (history, mission journal, personality) / change picture / remove (**Are you sure** confirm). Bytes live in IndexedDB `idb:friend_<id>` (gallery JSON holds `friend:<id>`) or `/friend-pack/*.png`. Header photograph opens that same details page. The chat button above Gallery speaks; the bubble opens the mission sheet (task row opens item detail on top; Accept until end of day; Decline walks smaller tasks → first step → a reason). Plan: [`docs/FRIEND_COMPANION.md`](../../docs/FRIEND_COMPANION.md). | — |
| `ChromeFaceField.tsx` | Settings → **Window gray**. Warmth slider along the design-ref grays (0 olive … 50 classic `#c0c0c0` … 100 cool silver). **Default** restores the stored classic tokens and pauses. Drift speed, pause, and a manual shift (Instant, or Timed + duration + Start). A timed shift previews only in this panel. | — |
| `BoubaKikiField.tsx` | Settings → **Bouba/Kiki** (experimental). The same control family for chrome corners. **Default** restores the measured radii and pauses. Timed shifts preview in the panel, then the app commits. | — |
| `DriftAxisControls.tsx` | Shared drift-speed, pause, and manual-shift controls for those two fields. Timed shows duration, then Start. | — |
| `panel-preview.ts` | While a timed shift runs, writes the in-between `--chrome-*` or radius tokens on the settings `.set95-dialog` that contains the field. Adds `.set95-drift-preview` so that panel may ease between samples. Clears both when the shift ends. | — |
| `PcbBackdropField.tsx` | Settings → **Desktop**. Plain **teal** (default) plus five photographed plates (`ceramic` / `mint` / `ice` / `xray` / `fr4`) writing `theme-store.pcbMode` and the **`brain2-pcb-mode`** pin (legacy `cogs-pcb-mode` still read/written). Theme store persist **v5** (the v4 plate rules still hold). Each pick stamps a wall-clock **`appearanceRev`** (`lib/appearance-rev.ts`) so a plate chosen before hydration finished still wins the merge — the old 0-based counter lost to the stored rev and got rewritten to `xray`. A saved plate also wins over a stale pin. Saved plates are never migrated onto teal. | — |
| `HomeLocationField.tsx` | Home city autocomplete writing `lib/user-settings-store.ts`. Empty values snap back to San Diego. | — |
| `BirthdayField.tsx` | Settings → **Birthday**. `YYYY-MM-DD` on `user-settings` (persist **v4**). Month and day open the birthday Star Lord Report. February 29 is read on March 1 in a common year. Clear removes it. | §13 |
| `DayAnchorField.tsx` | **Default time of day** — the time assumed for work ticked off after the day has ended, when there is no tracked time to read a real one from. Since the sleep log landed this is the *last* resort: `lib/completion-window.ts` prefers the half hour before that night's bedtime, taken from the log, from sleep painted on the grid, or from the user's median bedtime over the last month. The field therefore shows **which of those is actually in force**, so a setting that has quietly stopped applying cannot pass itself off as the answer. | §9 / §12 |
| `PointAllocationField.tsx` | Settings → **Points** → **Automatic point allocation**. Short summary and a **Points rules** button. | §14 |
| `PointsRulesDialog.tsx` | Nested Win95 dialog (`.set95-dialog`, portaled into the open Settings dialog) with every global points rule, a filter, and a per-row Default. See **Points rules** below. | §14 |
| `BackupRestore.tsx` | Full-app backup + **per-part preview restore** — downloads `brain2-backup-*.json` (`app: "brain2"`; restore still accepts legacy `app: "cogs"`). The file is every saved store, plan log, attachment, doc, and other durable key for this profile (item history, home layout, friend pins, module notes, navigation, ingested-note ids, unprefixed relics). Split `brain2-*` / `cogs-*` copies are folded together, a bare plan draft is merged onto the key restore reads, and a hydrated store is included even when its last disk write failed. Gallery pictures still held as `data:image` are exported with the file. Pick parts, merge or replace, then a Win95 OK/Cancel confirm (not a red Delete). If `data/recovery-backups/` exists, those snapshots list as a read-only restore source — including the `auto-*.json` copies the dev hub writes itself whenever a vault write shrinks or is refused, so rows lost to a stale second window can be merged back without leaving the app. | §3.2 |
| `MobileSyncPanel.tsx` | Confirm-gated manual hub push/pull for `/mobile`. | mobile |
| `MessageIngestPanel.tsx` | **BIM** (Brain2 Ingestion Messenger — you can call him BIM for short) at [t.me/brain2_phone_bot](https://t.me/brain2_phone_bot): token via desktop `safeStorage` or gitignored `.env.local`, pairing code **or** **Texted but not paired** (one-click allowlist of a sender the log already refused — permanent; the code's 10-minute TTL is not the pairing's; a refresh cannot wipe the allowlist), always-on hub URL + Sync vault, live grocery list picker (`groc` / bare `store` dump that list; the `store` → `groc` shortcut is optional and does nothing while the map is empty; bare `g` retired), **discrete event triggers** (smoked weed / ate {item} / …; `log:` stays separate; `tp:` / `thought process:` / `log: tp:` are a Thought process, a guiding strand of this moment (`eventKind` `thought-process`); log-line clocks with no am/pm are military time, and that applies to log lines, switch lines, and tracking-note clocks, not every text field; saved log keywords are edited in Tracking settings (the gear)), in-chat manuals (`info` / `{prefix} info` / `{prefix} commands` / `all commands`), **iPhone Notes** shortcut is generated by `npm run shortcut:iphone-notes` ([recipe](../../docs/shortcuts/dump-iphone-notes-to-brain2.md); the signed `.shortcut` is not in the repo). **Screen Time / Call / Text / Location Shortcuts** (AirDrop the signed `.shortcut` files next to those recipes), allowlist, cheat-sheet, **Simulate a message**, **Simulate a scan** (receipt / journal / PDF). Pairing code reads in a CRT well (`.set-crt`) when Settings is milled. See [`docs/MESSAGE_INGEST.md`](../../docs/MESSAGE_INGEST.md) and [`docs/shortcuts/`](../../docs/shortcuts/). | §4 |
| `ScreenTimePanel.tsx` | Settings → **Screen Time**. Brain2 reads a running ActivityWatch server (not a window watcher; no Apple Screen Time / pre-install import). Connection lamp, URL (default `http://127.0.0.1:5600`), lookback days, min duration, store-window-titles off by default, **Sync now**, last-success sentence plus an honest `lastSyncNote` (empty AW vs filtered events vs painted blocks — 0 blocks is not dressed as a failure), ActivityWatch + macOS Accessibility links. One line notes that phone usage is a different Tracking view (iPhone Screen Time / Calls / Texts). Prefs auto-save. | — |
| `ScreenTimePanel.test.tsx` | Heading, default URL, Sync now, empty-success copy. | — |
| `InstagramImportPanel.tsx` | Settings → **Import from Instagram data**. Steps for Instagram → Settings and activity → Your activity → Download your information → **Followers and following** (JSON when a format is offered). Unzip on the computer — this app does not. Choose `following.json` and every `followers_N.json` from `connections/followers_and_following/` (or the older `followers_and_following/` folder) in one upload so Follows me back and I follow them back fill. Follower count is not in the file and stays editable. The upload calls `importInstagramExportTexts`, which ensures both lists and uses the existing parser. One side alone leaves the other column blank. No password form. | §6 |
| `InstagramImportPanel.test.tsx` | The download steps, and a following file written through that importer with the blank-side sentence. | — |
| `settings-index.test.ts` | Group order, one home per section, search matches, and which bay a selection or a group click resolves to. | — |
| `settings-nav.test.tsx` | The index hides groups that do not match, and arrow keys move. | — |
| `SettingsDialog.test.tsx` | The scroll well renders the selected bay and does not render the other bays beside it. | — |

## How the dialog is arranged

The gear opens one milled instrument (`.set95-settings`, up to 940px wide, 90vh tall). A CRT caption, a find well, then a sunken index beside a sunken body. The index selection is the source of truth. The body mounts that one bay, so wheel, trackpad, keyboard scroll, and the scrollbar stay inside it. A taller bay scrolls in the well and starts at the top when the selection changes. Fields still auto-save (`isDirty: false`).

**Find.** The well matches the section title, the group name, and a small index of the labels in that bay (`settings-index.ts`). The body shows the selected match only. If the current selection drops out of the query, the first remaining match is selected. An empty query restores the full index and keeps the current selection. No match leaves a quiet “Nothing matches” line and hides empty groups. `/` focuses the well unless the caret is already in a field. Escape clears the well when it is focused and still has text; otherwise it closes through the unsaved guard (still clean). Enter selects the first match. Arrow down walks into the index.

**Index.** Groups are labels, then their sections. A section click shows that bay. A group click selects its first matching section. The CRT chip is the selection (`aria-current="location"`); its group keeps a power lamp. Scrolling the bay does not move the chip. Arrow keys move along the index and change the selection. Arrow up from the first row returns to Find. Under 720px the rail becomes a Group menu plus a horizontal strip of sections, and that strip still shows one bay.

**Groups.** Everyday bays come first inside each group.

| Group | Sections |
|-------|----------|
| You | Baby animal friend, Home location, Birthday, Default time of day |
| Appearance | Window gray, Desktop, Bouba/Kiki |
| Points | Automatic point allocation only (`<PointAllocationField />`). The bay opens the Points rules dialog. Find matches points, inbox, ritual, and multiplier. Habit bonuses stay in Habits → Settings and share those rows. |
| Data | Data profile (Live / Demo), Full App Backup, Phone ↔ Desktop Live Sync |
| Imports | Notes and ingest (Ingest, From Notes, Phone Notes), Message ingest, Screen Time, Import from Instagram data |
| Library | Item Types (Manage Item Types still opens its nested dialog), Second Brain |

Notes and ingest sits with Imports: those doors are how notes enter. There is no separate profile bay under You. Data profile is the Live / Demo vault, so it lives in Data, ahead of backup and the phone hub, because the other two act on whichever vault is showing.

## Points rules

Settings → **Points** → **Automatic point allocation** → **Points rules** opens one nested dialog (`PointsRulesDialog.tsx`) with every global rule. Each row is a label, a number, a unit, **Default**, and a plain explanation of when it fires, what it does not do, and whether saving it rewrites points already earned. A filter matches the label, the section, and that explanation. Sections stay grouped. A change saves immediately.

The decision: one popup is the full catalog. Habit accomplishment, lift, average-beat, morning-review mark, and default points per period stay in Habits → Settings and are the same numbers — the popup writes those setters, it does not keep a second copy. Ritual section points, the whole-ritual bonus, and tomorrow’s goal focus stay on `user-settings` the same way. Everything else is the `pointsRules` map (persist **v5**). A missing key means today’s default, so an existing install does not change until that row is edited.

Per-habit points, per-goal points, an item’s own reward, a list’s Points attribute or formula, one objective’s multiplier for a specific period, and a friend’s personality reward scale stay on the item. The note at the bottom of the dialog says so. A new completion-tier formula reads the tier rows; a formula already stored on a list is not rewritten.

Past ledger rows stay as written, except daily habit marks and habit grade, accomplishment, and lift bonuses. Those the app already replaces the next time habits sync, so saving a new number can rewrite those rows then. The morning-review × is a mark on the habit, not a ledger multiplier. A daily habit pays completion ratio × the daily full mark. The habit’s own points field is what a weekly, monthly, or season habit pays the first time its goal is met.

## Window gray

One metal for every beveled face (Lists, Plan, Scheduler, Operations, Habits
chrome — not Lists orbs/velvet, not Analytics charts). Warmth walks the
design-ref computer grays, piecewise, so every frame is on the way from one
of those hexes to the next. It is not a red/blue filter on an arbitrary gray.

| Mix | Face | Source |
|----:|------|--------|
| 0 | `#999683` | IRIX cattle `designrefs/designref1.jpg` |
| 8 | `#999686` | Warmer olive on that walk |
| 16 | `#9a9889` | TENO `designrefs/5d58e7b46cf9bd493eb09f761340fb17.jpg` |
| 32 | `#c0c1b9` | Pocket PC `designrefs/36bc1715c629f42e163d54abe8741ac6.jpg` |
| 40 | `#c0bfba` | Pocket PC and Tek 465B |
| 50 | `#c0c0c0` | Display Properties, Win95, `app/win95.css` — the stored default |
| 75 | `#b7bcbf` | Cooler silver (flower CRTs / gadget wall family) |
| 100 | `#b8bbc0` | Flower CRTs `designrefs/9d225800a3f631bc7559c83d11f1aaa2.jpg` |

Mix 50 restores the chrome colors captured before the swatch path replaced
the warmth endpoints (classic `#c0c0c0` and the companion tokens in
`app/win95.css` / `DEFAULT_CHROME_TOKENS`). **Default** sets that mix and
pauses. Sheen, shadow, and highlight at each knot are that swatch’s own
companions, sampled from the same still. Ink `#404040` / `#3a3a3a` stays the
stored ink. A frozen local `#c5c3bc` is still the wrong Habits override;
warmth is this one live face.

| Piece | Role |
|-------|------|
| Anchor | `useThemeStore.chromeFace` (`brain2-theme-store`, persist **v5**). 0 warm, 50 classic, 100 cool. |
| Clock | `chromePhase` + `chromeEpochMs` + `chromePeriodMs` + `chromePaused` + optional `chromeTransition`. `lib/drift-clock.ts`. |
| Live metal | `lib/chrome-patina.ts` writes `--chrome-face` and that swatch’s companion stops on `:root`. `app/chrome-patina.tsx` paints the committed position on load and on a tick. A short cycle ticks fast. A timed shift also ticks fast, but the root stays on the previous gray until the interval ends. |
| Drift speed | How long one full cycle takes: warm pole → cool pole → warm pole. Presets: 1 week, 1 day (the default), hours, 1 minute, 30 seconds, custom. Custom clamps to 1 second … 10 years. |
| Pause | Holds the phase. |
| Manual shift | **Instant** sets the phase to the slider, writes that gray on the whole app, and the drift period takes over. **Timed** (duration, then Start) previews only in the settings panel: the panel’s faces, fields, buttons, and edges move through the in-between values, and the rest of the app keeps the previous chrome. When the interval ends, the whole app takes the new gray and drift resumes. The transition does not replace `chromePeriodMs`. Dragging the slider does not start the shift. Reduced motion jumps to the end, and that end state is committed to the whole app. Another popup does not change the stored speed, clear pause, or start this shift, and it does not fade the app gray. Dialog `duration-200` is the enter/exit animation; `app/win95.css` sets `transition-property: none` on dialogs so that duration does not interpolate `--chrome-face`. |
| Default | Instant apply of mix 50 (the stored classic palette) and pause. |

`app/win95.css` owns the tokens; `--w95-*` aliases them. `app/chrome-patina.css`
remaps module names (`--hab-metal`, `--s-surface`, `--fm-surface`, …) with
`body.win95-app` specificity. Fascia stops follow the active swatch’s own
companions. CRT green, navy focus, and the desktop plate stay their own
colors. A pre-v5 `chromeFace` was a lightness thumb, so migration parks
warmth at 50.

## Bouba/Kiki

Experimental corner mix, same control family as Window gray. 0 is rounded
(bouba), 100 is pointy (kiki), 50 is the named preset **default**.

`lib/corner-mix.ts` stores the radii measured before the mix existed, plus
`11px` and `20px` from GradSearch (the first CSS census never saw that
stylesheet; it lives in a TypeScript string). Mix 50 writes those literals:
`--radius` `0.75rem`, `--r-tw` `0.25rem` (bare `rounded`), chrome `0` /
`1px`–`12px` / `14px` / `16px` / `18px` / `20px` (`--r-20px`), and the rem
literals `0.375rem`, `0.5rem`, `0.3rem`, `0.2rem` (`--r-20`, the rem, not the
20px token), `0.35rem`. Census counts are in that file. Mix 0 lifts each
length by 12px. Mix 100 takes each length to 0.

Fields, buttons, selects, windows, dialogs, panels, title bars, and the
list, habit, plan, tracking, settings, and header chrome follow those
tokens. So do Tailwind `rounded-none` (square `0` via `--r-0` on
`body.win95-app`), the header tracking color swatch (`--r-1`), Tidy’s cards
and fields (the local `--r: 10px` is now `--r-10`), and GradSearch’s
shadow-root controls (the local `--radius: 14px` no longer freezes the
token; those corners read `--r-14` and the other `--r-*` tokens). Under the
Win95 body, `.rounded`, `.rounded-sm`, `.rounded-md`, `.rounded-lg`,
`.rounded-xl`, `.rounded-2xl`, and `.rounded-3xl` are square chrome via
`--r-0`. The Tailwind config still defines `rounded-lg` / `rounded-xl` as
`--radius` and `rounded-md` / `rounded-sm` as `calc(var(--radius) ± …)` for
anything that rule does not catch.

Circles (`50%`), pills (`999px` and near-pills `99px`), elliptical lamps
(`50% / 42%`), hairline `0.5px`, and non-chrome art (clock paintings, SVG
animals, the noble-gas tube drawing) stay put.

**Default** sets mix 50 and pauses, so today’s corners sit still. Corner drift
starts paused. A timed corner shift previews only in the settings panel. When
the interval ends, the whole app takes the new corners and drift resumes.
`prefers-reduced-motion` jumps a timed corner shift to the end, and that jump
commits to the whole app.

## Warmth and Bouba/Kiki — how it is built

Window gray walks the design-ref gray swatches on the `--chrome-*` family.

A second experimental control, **Bouba/Kiki**, uses the same control family
for corners: rounded (bouba) ↔ pointy (kiki). One `--corner-mix` drives the
shared radius tokens. Fields, buttons, windows, dialogs, Tidy, GradSearch,
and `rounded-none` follow those tokens. Circles (`50%`), pills (`999px` and
`99px`), elliptical lamps, and non-chrome art stay as they are.

### Approach

One clock in `lib/drift-clock.ts`, used by both axes.

- Persist `anchor` (0–100), `phase` at `epochMs` (the phase encodes which way
  the cycle is heading), `periodMs`, `paused`, and an optional one-shot
  `transition` `{ from, to, startedAt, durationMs }`.
- A full cycle is pole → opposite pole → back (`periodMs`).
- Pause freezes the phase. Reload reconstructs it from epoch + phase.
- **Instant** sets the phase so the live position is the slider target, writes
  that state on `:root`, then the stored drift period governs again.
- **Start** (Timed) interpolates from the live position to the slider target
  over the chosen duration, and that in-between is visible only inside the
  settings dialog (local CSS variables on `.set95-dialog`). The rest of the
  app keeps the previous chrome. On completion the phase is the new position,
  `:root` takes it, and drift resumes at the drift-period setting. The
  transition never overwrites `periodMs`.
- `prefers-reduced-motion` completes a timed shift immediately. There is no
  in-between to preview, so that end state is written on the whole app.
- Theme store persist bumps to **v5**. A pre-v5 `chromeFace` was a lightness
  set-point, so migration parks the warmth anchor at **50** (classic neutral)
  rather than reading “lighter” as “cooler”. Drift starts unpaused. Default
  period is **1 day**.

Warmth paint stays in `lib/chrome-patina.ts` / `app/chrome-patina.tsx`. The
pre-change palette is the named default. At mix 50 the face is `#c0c0c0` and
the companions are the hexes captured from `win95.css` before the swatch path
landed: sheen `#d4d8dc`, shade `#969a9e`, key sheen `#eceef0`, key mid
`#d4d6d8`, key shade `#9a9ea2`, inset `#b0b4b8`, ring `#5c6064`, mid
`#dfdfdf`, hi `#ffffff`, lo `#808080`, brush `#acacac`, frame `#0a0a0a`, plus
the rest of `DEFAULT_CHROME_TOKENS`. Other mixes walk the documented swatches.
Each knot carries that gray’s own sheen, shadow, and highlight. Between knots
the family interpolates only from one real palette to the next. Ink stays
`#404040` / `#3a3a3a`. Aliases in `chrome-patina.css` already read
`--chrome-*`; they keep doing that.

Corners: `lib/corner-mix.ts` holds the named preset **default** — the radii
measured before any corner edit, plus GradSearch `11px` (`--r-11`) and `20px`
(`--r-20px`). Mix 50 writes those literals (`--radius` `0.75rem`, Tailwind
`rounded` `--r-tw` `0.25rem`, chrome `0` / `1px`–`12px` / `14px` / `16px` /
`18px` / `20px`, and the rem literals `0.375rem`, `0.5rem`, `0.3rem`,
`0.2rem` as `--r-20`, `0.35rem`). Census counts live in that file. Mix 0
(bouba) lifts each length by 12px.
Mix 100 (kiki) takes each length to 0. Piecewise, so 50 is the snapshot and
not merely the average of the poles. **Default** on the Bouba/Kiki control
sets mix 50 and pauses drift, so today’s corners sit still. Chrome corners
on fields, buttons, windows, dialogs, the milled rooms, Tidy, and the
GradSearch shadow root read `var(--r-*)` / `var(--radius)`. `rounded-none`
reads `--r-0`. Bare `rounded` reads `--r-tw`.

### Duration vocabulary (drift speed and manual shift)

Presets: **1 week**, **1 day**, **hours** (any positive number), **1 minute**,
**30 seconds**, **custom** (number + seconds/minutes/hours/days/weeks). Custom
may be faster than 30 seconds or slower than a week. Clamp custom to 1 second
… 10 years so the phase math stays finite.

### Files expected

| File | Why |
|------|-----|
| `lib/drift-clock.ts` + test | Phase, pause, instant, timed ends, reload |
| `lib/chrome-patina.ts` + test | Warmth axis; neutral at 50; contrast |
| `lib/corner-mix.ts` + test | Default radius snapshot; mix 50 restores it |
| `lib/theme-store.ts` + test | Persist v5; both clocks |
| `app/chrome-patina.tsx` | Paint both axes; faster tick while a short period or a transition is running |
| `app/win95.css`, `app/globals.css`, `app/chrome-patina.css` | Tokens; fascia stops follow the face |
| `tailwind.config.ts` | `rounded` → `--r-tw` |
| Chrome CSS `border-radius` literals | Route through the radius tokens |
| `components/Settings/ChromeFaceField.tsx` | Warmth slider, drift, pause, instant / Start |
| `components/Settings/BoubaKikiField.tsx` | Same family; Default revert |
| `components/Settings/DriftAxisControls.tsx` | Shared controls |
| `components/Settings/SettingsDialog.tsx` | Appearance group: Window gray, then Desktop, then Bouba/Kiki |
| `tests/test-utils.tsx`, `lib/demo-vault.ts` | New clock fields on the theme blob |

### Risks

- A v4 lightness thumb (for example 80 = lighter) becomes neutral 50 on
  migrate. The number is not reused as warmth.
- Square chrome (`0`, and `0 !important` that beats Tailwind) only moves
  toward bouba. Kiki is already 0 there. Corners that have radius do get
  pointier.
- Metal stops follow the active swatch’s companions. Nameplate ink
  `#2a2c2e`, CRT green, navy focus, desktop teal, and LED colors stay put.
  A gray that was never one of those stops can still sit still.
- Rem literals are restored exactly at mix 50. Other mixes are px, assuming a
  16px root. `calc(var(--radius) - 2px)` follows whatever `--radius` is.
- Circles, pills, elliptical lamps, hairline `0.5px` marks, and non-chrome
  art do not join the mix. Chrome corners, including square `rounded-none`, do.
- `20-dialog-settings` needs a recapture because the dialog copy changed.
  `docs/SPEC_MAPPING.md` has no row for window gray or corner mix; none moves.

### Progress

- [x] Read the room README and the closed laws that touch it
- [x] Draft plan (approach, files, risks) and write it into docs before code
- [x] Snapshot current corner radii as the **default** preset before any corner edit (`lib/corner-mix.ts`)
- [x] Run the colocated tests as a baseline (26 passed)
- [x] Implement warmth drift on the existing store / CSS variables, including full-app consumers
- [x] Implement drift speed, pause, and manual timed/instant shift for gray warmth
- [x] Implement Bouba/Kiki on shared radius tokens; default preset stays selectable
- [x] Add or extend colocated tests (45 passed across the clock, patina, theme store, and both fields)
- [x] Update colocated README, parent README, and any other stale docs
- [x] Browser-check the gear settings flow; recapture `20-dialog-settings` (Window gray and Bouba/Kiki in frame)
- [x] Focused tests, then the relevant suite (45 focused, 120 across theme, persist, vault, and Settings); review the diff

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
  Moon chart motion, and Names), free-text plan keys, attachments, docs, and `extras` (every other
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
