# Shared chrome

Overview type is already changing. `components/Home/home-chrome.css` paints the collapsed strip and the Modules catalog cards in Karla: nameplates 13px, footers and the old 9px labels 11px, CRT values 20px, award 22px, the weather degree 24px. Detail handhelds, the date plate, and Home panels stay on the pixel face. This plan does not run a second size pass. It covers the chrome that is still hard to read, or still untrue, once those words are slightly larger.

The shell to keep is the one already built. A tile is a milled bay: caption, black-glass CRT, silver footer, equal height (`--home-tile-h`), × outside the open target. A click opens `HomeWidgetDialog`: power lamp, caption, one scroll, metal close key. Settings show up only when that widget has any. Phosphor on the value stays `--hab-crt-green` (`#7dffc4`).

When a check needs a tucked tile, Add it from Widgets, look, then Hide it and confirm. Leave the strip as you found it. Tucked by default: affirmation, weather, next, day lamp, solar, tracking, night, harvest, inbox, flow, paint.

## Repeated problems

These show up in the layout notes for more than one tile. Each widget’s data bug stays in that widget’s own plan.

**The plate, the dialog, and the catalog sample use different names.** Latest on the glass, Latest award on the dialog, Award on the sample. Left / Harvest leftover. Flowing / Already flowing. Lived / Plan and lived. Night / Night well. Inbox / Inbox mill. Rituals due / Rituals. Tracking’s plate is Now or Last, and the instrument’s name is only the button label. `HOME_WIDGET_LABEL` in `lib/home-widgets.ts` is already the dialog title for some tiles and a local string for others. A larger plate makes the wrong word easier to see.

**A footer is engraved as a nameplate.** Detail wells still use `.home-widget-well-label`: 9px, uppercase, tracked. That size is the short engraved word from `docs/DESIGN_STYLE.md`. Days Until, Night well, Solar remainder, and Harvest leftover pass `face.footer` into it, so the sentence the square already showed becomes something like `1 LEFT OF 465`. The overview type pass does not touch this rule. Tracking’s well labels do the same with `Mood (last known)`.

**The CRT changes color when it opens.** The square is phosphor on `#040a08`. The handheld paints the same figure `--friend-nixie` (`#4a7fd4`) because that well is `tone="nixie"`. Points does it for all four lines. Night, Harvest’s opening digit, Solar’s remainder, and Days Until do it for the one number the tile exists to show. Day lamp paints Dim, Warm, Bright, and Full with the habit-tube stops, including navy `#25366a` on the glass, while the detail lead uses a different amber scale. The award caption pip is that same navy stop, so the lamp reads unlit on silver. Larger type does not fix a value that changes material.

**Open does not open the thing.** `.home-tile-open`, `.home-weather-open`, and the overview `.home-review-key` use `cursor: default`, so the square looks like furniture. Rituals Open and `handleStartReview` in `home-dashboard.tsx` click `[data-rituals-entry]` / `[data-home-review-entry]`, which is the header dropdown trigger. Inbox “Open Inbox” clicks `[data-inbox-entry]`. The square opens a handheld. The key opens a menu, or nothing if that button is missing. Next already calls `onOpenHomeTab`, and that only switches the Home tab.

**The handheld repeats the tile.** Affirmation’s dialog is the same line, larger, with label tracking (`letter-spacing: 0.03em` on `.home-widget-lead`). Night well is one well of the footer plus the CRT. Solar and Days Until put the footer in the nameplate and the CRT in nixie, then stop. Harvest’s first well is that pair again. A second copy stays hard to read after the strip type grows, because the dialog puts the sentence in the word slot and the figure in the other color.

**A missing square and a hidden square look the same.** `hidden` in `lib/home-widgets-store.ts` is the user’s choice, confirmed, and reversible from Widgets. Rituals also returns nothing when the due count is 0, so the bay leaves the row without being hidden. Session Dismiss is a third way off the strip, and it already expires next session.

## Do these, in order

### 1. One name on the plate, in the dialog, and on the catalog sample

**Change.** Identity text uses `HOME_WIDGET_LABEL`. That means the tile caption, the `HomeWidgetDialog` title, the catalog `name` (already aligned), and `preview.caption`.

Live plates that change: Latest → Latest award, Left → Harvest leftover, Flowing → Already flowing, Lived → Plan and lived, Night → Night well, Inbox → Inbox mill, Rituals due → Rituals, Now/Last → Tracking now. Sample captions that are those short aliases change with them, including Progress → Today's Progress and Solar → Solar remainder.

Weather keeps the city on the plate. The catalog name stays Weather, and the sample caption stays an example city. The screen pet keeps the clock on the plate. The catalog name stays Screen pet, and the sample caption stays an example time. Tracking’s footer keeps the mode line it already has (`last known` or the live equivalent). The plate stops being the mode.

`Today's Progress` and `Solar remainder` are already long plates at 13px with `0.14em` tracking, `nowrap`, and ellipsis inside `max-width: calc(100% - 28px)`. After this step, Harvest leftover, Already flowing, Plan and lived, and Tracking now join them. If any of those ellipsize at the 132px bay, tighten letter-spacing on `.home-overview .hab-score-caption` only, and put the full label in the caption `title`. Leave the 13px size alone.

**Why.** A wrong name is easier to read once the type grows. The hidden sample and the shown tile should name one instrument.

**Files.** `lib/home-widgets.ts`. Captions and any literal dialog titles in `components/Home/home-award-tile.tsx`, `home-glance-tiles.tsx`, `home-reading-tiles.tsx`, `home-review-banner.tsx`, `home-tracking-tile.tsx`. `components/Home/home-chrome.css` only if overview caption tracking has to come in so the label fits. `home-widget-catalog.tsx` already prints `preview.caption`. `home-overview.tsx` already passes `HOME_WIDGET_LABEL` through `OverviewTile`.

**How to check.** Latest award (on the strip): plate, dialog title, and catalog sample caption all read Latest award, and the plate fits the narrow bay. Harvest leftover: Add, confirm the plate is Harvest leftover and the dialog title matches, then Hide and confirm.

### 2. A well label is a word. The footer stays a sentence.

**Change.** `WidgetWell`’s `label` is one or two words. Days Until, Night well, Solar remainder, and Harvest leftover stop passing `face.footer`. The sentence renders in `.home-widget-note` under the well.

Days Until’s word follows the count: Until, Since, or Today. Night’s word is Hours. Solar’s word is the phase (After sunset is the long one; Rise and Set stay the clock labels). Harvest’s hero word is Left, under the plate Harvest leftover from step 1.

Tracking’s four labels are Activity, Location, Mood, and Company. The “(last known)” clause leaves the label. Putting the clock on the value is the tracking plan.

`.home-widget-lead` drops its letter-spacing, so a spoken line is a line. Short verdicts (Close, Warm, the flowing word) stay 18px phosphor.

**Why.** Nine pixels, uppercase, tracked, is a short engraved word. The overview type pass never reaches this slot. A footer forced through it is the tile printed again in a size that was never for a sentence.

**Files.** `components/Home/home-widget-dialog.tsx` (say so on `WidgetWell`). `home-days-until.tsx`, `home-glance-tiles.tsx` (night and harvest), `home-solar-tile.tsx`, `home-tracking-tile.tsx`. `home-chrome.css` for `.home-widget-lead` letter-spacing.

**How to check.** Days Until: Add, open it, the label is one word, and the arrival sentence is body copy under the figure. Hide it again. Night well: Add, open it, the label is Hours, and the asleep/woke sentence is the note. Hide it again.

### 3. The figure you clicked stays green

**Change.** A well that repeats the CRT figure uses the default glow, `--hab-crt-green`. Remove `tone="nixie"` from that well: Points’ four lines, Night’s duration, Harvest’s opening digit, Solar’s remainder, Days Until’s countdown.

Nixie stays available for a sibling that is a different quantity. The pet’s Clock is a clock. Harvest’s Still possible can stay nixie beside Earned. Rise and Set on Solar share one tone with each other; they are a pair of clocks, and the remainder above them matches the CRT green.

`.home-daylamp-word` stays `--hab-crt-green` for every `data-lamp`. The tube stops (`--home-grad-led`, `--home-grad-grade`, `--home-grad-output`) come off the glass. The detail lead for that word uses the same green, so Warm is one color in both rooms. Already flowing uses that class with no `data-lamp`, so it is already green and stays green.

The award caption pip leaves `#25366a`. Give `.home-tile.is-award` a lit phosphor in the same pip row as the other tiles, bright enough to read on the silver plate.

**Why.** Opening the square swaps phosphor for navy. Tube navy on black glass is a color lie. A larger digit in the wrong color is still the wrong color.

**Files.** `components/Home/home-chrome.css` (day-lamp word, day-lamp lead, award pip). `components/Home/points-stats.tsx`, `home-glance-tiles.tsx`, `home-solar-tile.tsx`, `home-days-until.tsx`.

**How to check.** Points: the four CRT lines and the four wells are the same green. Day lamp: Add if it is tucked, the word on the glass and the lead in the dialog are both phosphor, and the award pip on the strip reads as lit. Hide Day lamp again if you added it.

### 4. The square looks pressable, and Open calls a function

**Change.** `.home-tile-open` and `.home-weather-open` use `cursor: pointer` and the same focus ring as `.home-presence-update`. Overview `.home-review-key` uses `cursor: pointer` too. The × hide control stays a separate hit target.

Rituals and Inbox stop using `document.querySelector` on the header buttons. Reviews already opens a walk with `setActive` inside `components/Reviews/reviews.tsx`. Inbox already opens with `setOpen` inside `components/inbox.tsx`. Register those two functions where Home can call them, and have the header controls call the same functions. `handleStartReview` in `home-dashboard.tsx` uses that ritual opener. The row Open in the rituals handheld uses it for that slot. Inbox’s “Open Inbox” uses the inbox opener.

The rest of the square still opens the handheld. That is the shared click. The key labeled Open runs the opener.

**Why.** A larger label on a dead cursor still looks like a label. A click on the header trigger opens the Rituals menu, or misses entirely. The walk and the mill are the things the key names.

**Files.** `components/Home/home-chrome.css`. `components/Reviews/reviews.tsx`. `components/inbox.tsx`. `components/Home/home-dashboard.tsx`. `components/Home/home-review-banner.tsx`. `components/Home/home-glance-tiles.tsx`. One small module both sides import for the two openers. `app/page.tsx` can stay as it is.

**How to check.** Rituals: click the CRT, the handheld opens; click Open on a row, that slot’s walk opens, and the header menu does not. Inbox mill: Add, click Open Inbox, the inbox dialog opens, then Hide the tile and confirm.

### 5. A due count of zero stays on the strip

**Change.** Rituals with nothing due renders the shared tile, CRT `0`, and a clear-day footer. Session Dismiss still removes it until the next session. The persist `hidden` list is untouched.

**Why.** A bay that vanishes reads as hidden. User hide is the × confirm and the catalog. An empty reading is a reading.

**Files.** `components/Home/home-review-banner.tsx`.

**How to check.** Rituals: a day or a fixture with no due slot still shows the tile with 0. Days Until: still absent while it is tucked; the catalog still says Hidden; Add and Hide still ask, and Hide writes `hidden`. Leave it Hidden when the check is done.

### 6. The dialog names the day it read

**Change.** `HomeWidgetDialog` takes an optional short date and paints it in the caption, on the pixel face, after the title. Every day-scoped tile passes the `currentDate` the square already uses. Latest award and Inbox mill omit it. Solar passes the wall-clock day it actually computed.

**Why.** Follow the clock and the Home cursor are two jobs. `docs/DESIGN_STYLE.md` asks them to be labeled. The title Today's Progress is the unlabeled one. This does not change which day the square reads.

**Files.** `components/Home/home-widget-dialog.tsx`. `components/Home/home-overview.tsx` for progress and affirmation. Each tile component that already takes `currentDate`. `home-chrome.css` only for a caption slot, still on the pixel face.

**How to check.** Today's Progress and Harvest leftover, with Follow the clock on and the habits sheet on another day. Both dialogs show the day the numbers used. Hide Harvest again afterward.

### 7. An odd well takes the full row

**Change.** In `.home-widget-wells`, the last child spans both columns when it is also an odd child.

**Why.** Already flowing lays out Already, New today, then Habits finished alone under them. That is the orphan wrap in `docs/DESIGN_STYLE.md`. A 2×2 stays two and two.

**Files.** `components/Home/home-chrome.css`.

**How to check.** Already flowing: Add, open, the third well is full width, Hide and confirm. Points: the four wells still sit in a 2×2.

## Leave for later

Widget reports own their section c: ledgers, remain lists, moon rise and set, weather facts, points source stacks, and row keys that open a habit, an award, or an inbox idea.

Next’s key pinning the Home day and opening that hit. Step 4 only makes Open a real function. The hit belongs to the Next plan.

Pips and word colors that follow phase, pose, or verdict: solar after sunset, flowing versus pushed, paint’s Close / Short / Over, tracking Now versus Last. Step 3 only takes tube navy off the glass and lights the award pip.

The ceramic clock and date face in place of `<input type="date">` and `datetime-local`.

Catalog sample CRT text and footers that match live numbers. Step 1 only aligns the sample caption with the real name. The example digits stay examples.

Footer clamps, affirmation’s pool and index, and progress meters that still read as sentences inside the glass. Step 2 only stops the dialog from tracking a sentence like a plate.

The moon chart’s scale-key orphan and the This sky checklist. They sit in the orrery, outside `WidgetWells`.

Points sparkline stroke color. The wells match the CRT in step 3. The chart stays with the points plan.

Detail type sizes, including weather’s 8px week labels. Handhelds stay on the pixel face.

## Do not

Do not unhide the user’s widgets. Do not edit `DEFAULT_HOME_WIDGET_HIDDEN`, the tuck lists, or the persist migration so a tucked id becomes showing.

Do not replace the Win95 mill, the phosphor green, or the pixel face on the handheld.

Do not change overview font sizes again. The Karla ramp already in `home-chrome.css` belongs to the type pass that is underway.

Do not add per-widget features, new metrics, or a new strip. Equal height, caption, CRT, footer, × outside the open target, and the silver handheld stay.

Do not implement Open by clicking a header button with `querySelector`.
