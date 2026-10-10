# Solar remainder

Widget id: `home-widget-solar` (catalog id `solar`, tile `data-widget="solar"`).

Daylight phase against the pinned city’s sun. The tile is `components/Home/home-solar-tile.tsx`. It ticks every 15 seconds, takes minutes from the wall clock, and paints `solarRemainderFace` (`lib/solar-remainder.ts`) from a fresh `computeDaySun` (`lib/sun-times.ts`). The pin is the weather latitude and longitude when those are set, otherwise the Settings city, otherwise the built-in San Diego coordinate. `rememberIfAbsent` writes the result into `brain2-sun-times` only when that calendar day has no row yet. The face does not read the cache back.

Chrome is the shared instrument: `TileOpen` / `HomeWidgetDialog` / `WidgetWell` in `components/Home/home-widget-dialog.tsx`, mounted from `components/Home/home-overview.tsx`. Order and visibility live in `brain2-home-widgets` (`lib/home-widgets.ts`). The city pin lives in `brain2-home-weather`; Settings `homeCity` is the fallback.

## Data source + snapshot

**Source:** Electron localStorage, origin `http://localhost:3000`, LevelDB at `~/Library/Application Support/cogs/Local Storage/leveldb`. Profile key `brain2-data-profile` is absent, so this is the live vault. `127.0.0.1:3000` has no copy of these keys. The hub file `data/shared-persist.json` (`source: electron`, `updatedAt` 2026-10-10T06:09:31.476Z, 11:09 PM PDT) is a thinner, different snapshot and is not what the tile reads.

Sampled **Friday 9 October 2026, 11:10 PM PDT** (`America/Los_Angeles`, clock minute 1390). The glass moves on the minute.

| | Live LevelDB | Hub file |
|---|---|---|
| Weather pin | San Diego, 32.71571, −117.16472 | Portland, Oregon, 45.52345, −122.67621 |
| Settings city | San Diego, California | San Diego, California |
| Solar on the strip | showing (order index 11, Follow the clock on) | hidden |
| Sun rows | 57, 24 Aug–19 Oct, no missing dates | 21 |

Live weather has no beach and no station. `brain2-sun-times` `places` is empty. Fifty-five rows use the built-in pin 32.7157, −117.1611. Two rows use the weather pin rounded to 32.7157, −117.1647 (26 Sep and 5 Oct). Today’s stored row is the built-in pin. A fresh compute of both pins for 9 Oct lands on the same minute, and all 57 stored rows match a fresh compute of their own pin. The `cogs-sun-times` twin has 31 older rows and no 9 Oct key; reads prefer `brain2-sun-times`.

**Today, both pins:** sunrise 6:49 AM (minute 409), sunset 6:24 PM (minute 1104). Day length 11h 35m. Tomorrow (10 Oct, already cached, and the same from the weather pin) is 6:50 AM / 6:23 PM.

**Phase the tile should show at 11:10 PM:** `after-sunset`. CRT `4h 46m`. Footer `after sunset · 6:24 PM`. That is minutes since 6:24 PM. Midnight is 50m away. The next sunrise is 6:50 AM, 7h 40m away.

The stored times are present, they are San Diego, and they match a fresh compute. They are not stale, not the wrong city, and not missing. The cache key for today is the built-in coordinate; the weather pin’s key `2026-10-09|32.7157|-117.1647` was never written, because the first row for a date sticks. The minute is the same, so the glass and the stored row agree tonight.

## a. Biggest problems right now

The number on the glass changes meaning at sunset. Before sunset the CRT is time remaining (`to sunset · 6:24 PM`). After sunset `solarRemainderFace` returns `now − sunset`, so at 11:10 PM the CRT is `4h 46m` with footer `after sunset · 6:24 PM`. The widget is named Solar remainder. The dialog says the night runs “after sunset until midnight, then the next day’s sunrise.” The catalog says the CRT is the phase and the footer is the next clock. What is on screen is time already past a sunset that has happened. The next clock, 6:50 AM, is already in the cache and is not shown. At midnight the same glass jumps from a large elapsed count to a countdown until sunrise.

The detail repeats that elapsed count and teaches the wrong cycle in a sentence under it. Rise and Set are there. The city is not, so the pin that chose those clocks is invisible. The hub still names Portland and hides the tile; the running profile does not. Anyone “fixing” the widget from the hub file would move the sun to the wrong city.

`data-phase` is set on the readout and has no rule. At 11:10 PM the square still wears the daytime amber pip (`#ff9a3c`) and a green duration, with no night state.

## b. Layout, UI, design, and style

### Overview

The tile is one equal-height well on the Home strip (`--home-tile-h`), after Moon and before Tracking now. Caption “Solar remainder”, CRT, then a 40–44px foot. Hide sits outside the open button and confirms. That structure matches the other squares.

The CRT is the house glass: `#040a08` range, `--hab-crt-green` (`#7dffc4`), phosphor bloom. Solar drops the readout to 16px so a span like `4h 46m` fits; sibling scores sit at 20px. The foot is 10px ink `#2a2c2e`, clamped to two lines. `after sunset · 6:24 PM` fits. The caption pip is the strip’s per-tile lamp; solar’s lamp is amber and does not follow `data-phase`.

The footer is the only place the phase is a word, except for the single minute of sunrise and the single minute of sunset, when the CRT itself becomes the word `Sunrise` or `Sunset` and the duration disappears. The rest of the day the phase is a prefix on a clock, in the smallest type on the tile.

The city never appears. San Diego is implied by the clocks. A later pin change would change the number with no name on the square.

Follow the clock is on. Solar ignores the selected Home day and always uses the wall clock, which is the right job for a live remainder. The selected day and this tile are two clocks; the tile does not say so.

### Detail view

The dialog is the shared silver handheld: caption, power lamp, one scroll, close key. Solar’s body is a nixie well of the same CRT string, a gray note, then Rise and Set.

The hero label is `face.footer`. Well labels are 9px, uppercase, tracking 0.12em. “AFTER SUNSET · 6:24 PM” is a sentence engraved as a nameplate. Design style keeps a 9px nameplate to a short word. Rise and Set are the right size of label. The hero is not.

The tile value is CRT green. The dialog value is nixie blue (`#4a7fd4`) because the hero well is `tone="nixie"`. Set is nixie too; Rise is the green glow. One number should stay one green CRT when the instrument opens. Sibling wells should share a tone. The note under them is 11px `#333` on the silver, outside the glass, and it describes a midnight countdown the function does not compute.

There is no arc, no now-mark, no day length (11h 35m), no next sunrise, and no city. The detail is the tile repeated, plus two clocks, plus a paragraph that disagrees with the code.

## c. New features for the detail view

1. **One daylight arc.** A single well from midnight to midnight. Rise and set are ticks. The span between them is the lit band. Now is a lamp on that line. At 11:10 PM the lamp sits past the 6:24 PM tick, in the dark portion, with 6:50 AM marked on the far side. Phosphor on black glass, gunmetal ring, the same material as the CRT. No second ephemeris: the ticks are `computeDaySun` for today and tomorrow.

2. **The CRT stays a remainder.** After sunset the primary glass counts to the next sunrise. At this sample that is `7h 40m` and the footer is the next clock, `6:50 AM`. Elapsed time since sunset (`4h 46m`) can sit in a short sibling well labeled Since, if that span is still wanted. The big number keeps one meaning from dawn through the night. The dialog sentence goes away; the arc is the cycle.

3. **Short nameplates, and the city.** Phase as one word (After sunset). Rise `6:49 AM`. Set `6:24 PM`. Length `11h 35m`. City `San Diego`, taken from the weather pin the tile already uses. Nameplates stay engraved words. The city is how you see that the hub’s Portland is not this profile.

4. **A phase lamp.** Drive the dialog power lamp and the tile pip from `data-phase`. Day keeps the amber lamp. After sunset the lamp cools. The CRT green stays the value color. The square on the strip then changes with the sky, which it does not do tonight.
