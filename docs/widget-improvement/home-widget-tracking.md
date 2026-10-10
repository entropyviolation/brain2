# Tracking now

Widget id: `home-widget-tracking` (catalog id `tracking`, tile `data-widget="tracking"`, test id `home-tracking-tile`).

Current or last Activity, Location, Mood, and Company. The tile is `components/Home/home-tracking-tile.tsx`. It reads `trackingPresenceSnapshot` in `lib/tracking-presence.ts` from the time grid, plus a live Working-on-now session and a pen-color session when either is running. A lane is current when a block covers this minute, or a live session owns that scope. Otherwise the latest interval that has already started is last. Instants are skipped. The caption is `Now` when any lane is current, and `Last` when none is.

Chrome is the shared instrument: `TileOpen` / `TileHide` / `HomeWidgetDialog` / `WidgetWell` in `components/Home/home-widget-dialog.tsx`, mounted from `components/Home/home-overview.tsx`. Order and visibility live in `brain2-home-widgets` (`lib/home-widgets.ts`, persist v9). The grid is `brain2-timegrid-store` (persist v15).

The header Now dialog already renders the richer form of this same helper: `trackingScopeStatuses` carries `loggedAt` and `estimated`, and `components/header-tracking/current-moment.tsx` prints the clock. The Home square calls `trackingPresenceSnapshot`, which keeps kind and name and drops the stamp.

## Data source + snapshot

**Source:** Electron localStorage, origin `http://localhost:3000`, LevelDB at `~/Library/Application Support/cogs/Local Storage/leveldb`. Key `brain2-timegrid-store`. Profile key `brain2-data-profile` is absent, so this is the live vault. `http://127.0.0.1:3000` has no copy of this key. There is no `cogs-timegrid-store` twin. `brain2-work-session` and `brain2-pen-color-session` are present and idle, so nothing overrides the grid.

Sampled **Friday 9 October 2026, 11:09 PM PDT** (`America/Los_Angeles`, clock minute 1389). The tile does not tick. This is a fresh classification at that minute.

The hub file `data/shared-persist.json` (`source: electron`, `updatedAt` 2026-10-10T06:11:52.783Z) holds the same 2,221 entry records and the same four lane rows. The byte gap is `untrackedNotes` (longer in LevelDB). Tracking now does not read that field. Live LevelDB is the source below.

The grid runs 2026-06-19 through 2026-10-09. Nine scopes. The four presence scopes:

| Scope | Pens | Intervals | Today |
|---|---:|---:|---|
| Activity | 70 | 238, plus 80 instants | 6 intervals, 1,096 min, and 21 instants |
| Location | 24 | 69 | 1 interval, 1,136 min |
| Mood | 11 | 9, first on 2026-09-09 | 2 intervals, 356 min |
| Company | 5 | 16 | 1 interval, 250 min |

**What a fresh render shows at 11:09 PM:** caption `Last`, CRT activity `Computer Work`, meta `Home · "a bit stressing but i love working on brain 2 but i should stop i guess"`, company `Alone`, footer `last known`. All four lanes are last. None is estimated. None is `generatedBy` sleep, screentime, or text. Every winning `penId` still resolves (`act-work`, `loc-home`, the mood pen, `co-alone`).

The four intervals end on the same exclusive minute, **1316 (9:56 PM)**. The last minute they still name is **9:55 PM**. That is 74 minutes before the sample. The open, unpainted stretch is the 73 minutes from 9:56 PM to 11:09 PM. Starts differ, so this is four older blocks extended to one shared end, which is what one open-span Update writes:

| Lane | Block the square names | Last named minute | Open since |
|---|---|---|---|
| Activity | Computer Work, 6:47 PM–9:56 PM (189 min) | 9:55 PM | 73 min |
| Location | Home, 3:00 AM–9:56 PM (1,136 min) | 9:55 PM | 73 min |
| Mood | the long sentence above, 4:01 PM–9:56 PM (355 min) | 9:55 PM | 73 min |
| Company | Alone, 5:46 PM–9:56 PM (250 min) | 9:55 PM | 73 min |

A newer activity mark exists and the lane rule skips it. An activity instant, pen `Text log`, sits at **10:41 PM**, 46 minutes after 9:55 PM and 28 minutes before the sample. It is the latest activity fact on the day. The square still says Computer Work.

Today’s activity intervals, all exact: Sleep 3:00 AM–12:40 PM, then a 35-minute hole, then Computer Work 1:15–4:00, 4:00–4:40, and 4:40–5:47, a 3-minute hole, Computer Work 5:50–6:45, a 2-minute hole, then 6:47–9:56. Mood’s other block today is one minute, 4:00–4:01 PM, pen “very very excited and focused on this.” The long mood block also stores a reading the tile never opens: sensation, vibe, energy, and tension. There is no `moodReading.word`, so the quoted string is the pen name.

October days with an interval: Activity, Location, and Company on the 4th, 5th, 6th, 7th, and 9th. **The 8th has none of the four.** Mood in October is only the 6th and the 9th.

Missing pens are in the catalog, not on these four rows. Location’s 24 pens include five whose names are raw coordinates (used on 6, 2, 0, 0, and 2 entries) and one named `Recovered pen` with no entries. Activity has a pen named `o` on 2 entries, inside a 70-pen datalist. No future blocks sit after 11:09 PM on these four scopes.

`brain2-home-widgets` v9 keeps `tracking` in the order and out of `hidden`. On this profile it is the last visible square, after Solar remainder. Visible ahead of it: Rituals, Points, Latest award, Today’s Progress, Weather, Screen pet, Day lamp, Moon, Solar remainder.

## a. Biggest problems right now

The square says `last known` and never says when. At 11:09 PM that word covers a fact whose last named minute is 9:55 PM, shared by all four lanes, with 73 minutes of empty grid after it. Location’s Home block is 1,136 minutes long and still exact, so the glass treats a stretch from 3:00 AM as the same kind of fact as a mood that started at 4:01 PM. The age is one number, and it is the same number, and it is not on screen.

The newest activity mark is the 10:41 PM Text log instant. `classifyScope` drops instants, so the lane stays Computer Work from 9:55 PM. The log moved. The square did not.

Update is loaded to do that again. The editor seeds every current name, and a confirm sends every non-empty field through `applyTrackingPresenceUpdate` on the open span. Leaving the seeded text is the stamp. The placeholder says a blank keeps the old grid. The filled fields are what get painted. From this snapshot that confirm would fill 9:56 PM–11:09 PM with Computer Work, Home, the mood sentence, and Alone, and clear 11:10 PM through midnight. Tonight those later minutes are already empty, so the clear hits nothing painted. The fill would still write 73 minutes nobody logged. The shared 9:56 PM end is that mechanism already on the grid.

The classification uses `new Date()` during render and subscribes to no clock. After a block’s end minute passes, `Now` / `live` stays until some other store update renders the tile. A fresh render at 11:09 PM is `Last`. A render that last ran at 9:50 PM would still be saying live.

## b. Layout, UI, design, and style

### Overview

The tile is one equal-height well on the Home strip (`--home-tile-h: 156px`, flex basis 132px, max 200px). Hide sits outside the open button and confirms. The face is a nameplate, a CRT, and a foot. That is the right instrument. The nameplate is the word `LAST` (or `NOW`), 9px, uppercase, tracking 0.14em, with the tracking pip `#6ae0ff`. The widget’s own name is only the button’s aria-label. The foot then repeats the same bit as `last known`.

The CRT is the house glass (`#040a08`, `--hab-crt-green` `#7dffc4`). Inside it the type splits into three value sizes: activity 15px, the location · mood line 11px in `#9adbb8` with the glow turned off, company 10px in `#7ec8a8`. Design style wants one size for the value. Company is a value set smaller than the line above it, and it is omitted entirely when the lane is empty, so a missing company changes the figure of the square. Tonight Alone is present, at 10px, under a mood sentence that ellipsizes on the meta line. The sentence is the most specific fact on the tile and the one the square cannot show.

The mood is wrapped in quotation marks. Those marks are decorative around a pen name. On this vault the pen name is a first-person sentence, so the meta line reads as a citation. A quote on screen needs a source. This one has the pen, and the quotes fight that.

The foot was built as a two-line caption: max-height 44px, overflow hidden, 17px of horizontal padding. Update is a second control in that band (`home-presence-update`, 9px, uppercase, tracking 0.1em). Nine pixels is the nameplate size for a short engraved word. Update is the verb. At the 132px minimum the foot’s inner width is about 98px, and the status plus the key do not both fit, so the band clips. The key is visible in the tree, which keeps the door rule, and it is still the control most likely to be cut.

The pip stays `#6ae0ff` for a last-known fact. A small lamp is supposed to mean power or mode. This one means “the tracking tile,” including when every lane stopped 74 minutes ago.

### Detail view

The dialog is the shared silver handheld: caption, a green power lamp that does not follow the caption, one scroll, the square close key. The lead is the same word as the nameplate, `Last`, at 18px phosphor. Then a 2×2 of dark wells. Last lanes use nixie blue (`#4a7fd4`); a current lane would use CRT green. Empty lanes also take nixie, and their label drops the “(last known)” suffix, so empty and last share a tone. Tonight all four are last, so the grid is four blue wells.

Well labels are 9px uppercase. “MOOD (LAST KNOWN)” is a sentence engraved as a nameplate. The value under it is 18px monospace with no ellipsis. The mood sentence wraps inside a half-width well. Activity, Home, and Alone fit. The clock that would make the four wells one story — 9:55 PM, 73 minutes open — is not a well.

The only action is `Update Tracking`. It closes this dialog and opens a second one. The lanes disappear while you edit. The editor is four uppercase labels, four free-text fields with a datalist of every pen, and one confirm. Activity’s list is 70 names, including the one-letter pen. Location’s list includes the coordinate pens and `Recovered pen`. There is no clock, no gap, no `~` / est. treatment, and no unsaved-changes guard. A dirty close dismisses as if the draft were clean. The header Update state already has the two stamps this dialog collapses into one button: add a separate minute, or continue the open stretch.

The 2×2 is one instrument, which is the right shape. The miss is that the wells have no time, the lamp stays green on `Last`, and the verb leaves the instrument to stamp every seeded lane.

## c. New features for the detail view

1. **A stamp on every lane.** Read `trackingScopeStatuses` instead of the snapshot that drops `loggedAt`. Each well keeps the name, then the logged clock from `formatLoggedMoment`, then the open minutes. Tonight that is Computer Work, Home, the mood sentence, and Alone, each with 9:55 PM and 73 min open. The lead stops being the word `Last` and becomes that clock. The header Current moment already draws this. The Home detail should be the same fact in the handheld, with short nameplates (Activity, Location, Mood, Company) and the age in the value.

2. **The latest instant beside the interval.** Activity’s lane stays the covering or last interval, and the detail adds the newest instant the rule skipped. Tonight that row is Text log, 10:41 PM, 28 minutes before the sample. A lane with no later instant leaves the row out.

3. **Update one changed lane, and say the stretch.** Seed the fields, and send a scope only when its text changed. Show the minutes about to be painted (9:56 PM–11:09 PM on this sample) before the confirm. Offer the header’s two verbs: this minute alone, or the open stretch through now. Keep the clear-after-now rule, and say so when later minutes already hold a block. Tonight they do not. An unchanged confirm writes nothing.

4. **Today’s sequence, with the holes.** `recentScopeSequence` already returns the blocks. For this day the activity list is Sleep, the 35-minute hole, the Computer Work seams, the 3- and 2-minute holes, then the 73-minute open. Mood shows the one-minute block at 4:00 PM and then the long one. Company starts at 5:46 PM. Estimated steps wear `~` and the est. chip. Tonight’s four winning blocks are exact, so the chip stays off. The same mark appears the moment a block is estimated. The 8th, which has no interval on any of the four, is a blank day in that list rather than a silent jump from the 7th to the 9th.

5. **The mood reading, and a lamp that can go quiet.** Under the mood pen, show the reading already stored on the block (sensation, vibe, energy, tension). Leave the pen name unquoted. The power lamp and the tile pip follow the lanes: CRT green when a block covers this minute, amber when every lane is last. The value color stays `--hab-crt-green`. A minute tick reclassifies when an end minute passes, so `Now` cannot outlive the block.
