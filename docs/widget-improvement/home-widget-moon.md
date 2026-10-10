# Moon

Widget id: `home-widget-moon`  
Strip id in code: `moon` (`data-widget="moon"` on `components/Home/home-moon-tile.tsx`).

## Data source + snapshot

**Source used:** Electron localStorage, origin `http://localhost:3000`, LevelDB at `~/Library/Application Support/cogs/Local Storage/leveldb`. Read 9 Oct 2026, 11:07 pm Pacific (`America/Los_Angeles`). `brain2-data-profile` is absent, so the profile is Live. Demo keys for these stores are absent. The `cogs-*` twins match the `brain2-*` values below.

The hub file `data/shared-persist.json` (source `electron`, updated 9 Oct 2026, 11:09 pm Pacific) has the same `brain2-sky-motion`. It does not match the live widget layout or the home cursor (`widgetsFollowClock` false there, home date `2026-09-23`). Live LevelDB wins.

Phase math is `moonGlance` in `lib/lunar.ts` (Meeus, *Astronomical Algorithms*, ch. 49; terrestrial time treated as UTC). Chart places are a separate Kepler set in `lib/solar-system.ts`. Saved chart prefs are `brain2-sky-motion` persist v1 (`viewWidthLog`, `rateIndex` only). Layout is `brain2-home-widgets` persist v9.

**Layout.** Moon is showing. Visible strip, in order: Rituals, Points, Latest award, Today's Progress, Weather, Screen pet, Day lamp, **Moon**, Solar remainder, Tracking now. In the full order it sits after Days Until (hidden) and before Solar remainder. `widgetsFollowClock` is **true**, so the square reads the wall clock (`homeWidgetDate`), then `MoonTile` uses that same local day and its own minute tick. The pinned home cursor is `2026-09-24` with `brain2-home-date-follows-today` = `0`. That cursor does not reach the Moon while Follow the clock is on.

**Saved sky motion.** `viewWidthLog` **3** (the slider minimum; the code default is 3.5). `rateIndex` **0**, real time. `motionReadout(3, 0)` says:

- View width **1,000 km** across a 1,000 px view
- Scale: **About 0.1 x Earth diameter**
- Light: **Light crosses this in 0.0 s** (`1000 / 299792` s is 0.0033, and `formatDuration` prints one decimal under a minute)
- Summary: **6 of 8 objects show visible motion** on that view at this rate (equator barely moving at 0.47 px/s; Moon through Earth visible; light too fast to follow at 299,792 px/s)

Zoom, pause, reverse, true sizes, stars-near, the scale tour, and a chosen date are session-only. They are not in this blob.

**Phase the tile would show at that read** (Follow the clock on, so `moonGlance` of 9 Oct 2026, 11:07 pm Pacific):

| Line | Value |
| --- | --- |
| Phase name | New moon (`phase` `new`, cycle 0.986) |
| Illumination | Illumination: ~0% visible (decreasing each night) |
| Footer | 1 day until new moon |
| Days to full / new | 16 / 1 |
| Previous major | Third Quarter on October 3, 2026, at 6:26 am |
| Next major | New Moon on October 10, 2026, at 8:51 am |

The eight-phase name flipped to **New moon** at **October 8, 2026, at 12:34 pm**, while the footer was still **2 days until new moon**. The name is a ±1/16 cycle bin (`phaseIdForCycle`). The footer counts local midnights to the Meeus instant (`calendarDaysUntil`). Those two clocks have disagreed since that Thursday afternoon. The next full moon falls on the local day of 25 Oct 2026 (16 midnights from the 9th).

If Follow the clock were off, the same functions at noon on the pinned day (24 Sep 2026) would show Waxing gibbous, ~95% and increasing, footer **3 days until full moon**, previous First Quarter on September 18, 2026, at 1:44 pm, next Full Moon on September 26, 2026, at 9:54 am. That is the unused path. The square on screen is the October new-moon window above.

## a. Biggest problems right now

1. **The tile says the new moon is both now and tomorrow.** The CRT name is **New moon**. The footer is **1 day until new moon**. The detail repeats it: the lead is New moon, and the next line is **Next Major Phase: New Moon on October 10, 2026, at 8:51 am**. The dark 8-bit disk matches a cycle of 0.986. The words do not match each other. The name has been early since 8 Oct, 12:34 pm.

2. **The saved view width does not move the sky.** Live prefs ask for a 1,000 km glass at real time. The chart still opens on the √r system view. Chart zoom is a separate session magnifier (`lib/sky-zoom.ts`). The handoff in `components/Home/MOON_SKY_MOTION.md` still marks the log camera ahead: 1,000 px = `W` km, and that camera is not wired. The motion bar then reports visible motion and a light-crossing time of **0.0 s** for a picture that is not at that scale. The summary’s “at this zoom” sits under a Chart zoom that is a different control.

3. **The detail is three instruments and a build list.** Opening Moon shows a 252 px photographic disk and three fact lines, then an eight-planet orrery, then an eight-row motion lab, inside a dialog capped at `min(92vh, 920px)`. The readout pins **This sky**, with Log camera, Chrome, and Light-time still marked ahead. Those rows are the engineering checklist from `SKY_BUILD` in `home-moon-orrery.tsx`. The catalog line for this widget is the month’s light. The first screen spends itself on crater callouts and a solar-system lab.

4. **Two phase clocks once the chart leaves the anchor.** The header disk and the three lines use `moonGlance(when)` from the widget day. The Earth–Moon card uses `moonGlance(shown)` from the chart clock (chosen date, rate, reverse). At real time with no chosen date they match, which is tonight’s case (`rateIndex` 0). A Date edit or a faster rate splits the photograph from the card. Elapsed and direction are not saved, so a reload returns to the widget day while the width and rate remain.

## b. Layout, UI, design, and style

Judged against `docs/DESIGN_STYLE.md`: one job per region, no orphan wrap, no dead instrument, phosphor and pixel type on the mill, a clock that belongs to the instrument.

### Overview

The square is the right object for the strip. It is an equal-height tile (`--home-tile-w` 148 px, `--home-tile-h` 156 px) with a hide key, a CRT well (`#070b16`), a 72 px 8-bit moon, a 10 px phosphor name, and a milled footer clamped to two lines. **New moon** and **1 day until new moon** both fit. Nothing is clipped. The 8-bit face, the hard pixels, and the green CRT are the DSi / phosphor direction the style doc asks for. Stars blink in steps. The face (eyes and smile) only draws near full (`cycle` 0.4–0.6), so tonight the disk is shade and craters, which matches a cycle of 0.986.

The miss is the copy, not the frame. One region is doing two jobs: a phase name from a wide bin, and a countdown to the instant. They should be one sentence. The footer is the place for the countdown. The CRT should use the same calendar day as that countdown, so it stays **Waning crescent** until the local day that contains the new moon, and reads **New moon** on that day (the footer’s “New moon today”).

Follow the clock is on, and the home cursor is a pinned 24 Sep. The date plate is the wall clock. The Moon agrees with the plate. Habits stay on September. That split is the stored switch working as written. The Moon square does not label which day it used. With the switch on, the day is tonight, and the broken pair of sentences is what a person reads.

### Detail view

The dialog (`home-widget-dialog` plus `is-sky`) is one scrolling stack: phase plate, chart, motion bar. Width is `min(68rem, 100vw - 1.5rem)`. Max height is `min(92vh, 920px)`.

**Phase plate.** `MoonPhaseDisk` is a 252 px orthographic photo (`public/planets/moon.jpg`), north up, waxing from the right, with a soft terminator. Four names — Aristarchus Plateau, Kepler Crater, Copernicus Crater, Tycho Crater — sit in Karla at 11 px. There is no libration, the near side always faces the viewer, and all four stay on the disk. The plate is about 252 px tall before the chart’s 520×400 stage (min-height 240 px) and the motion list. On a laptop the chart and the motion bar start below the fold. The widget’s answer (what phase, when is the next major) is the three bullets; the disk is a large illustration beside them. Related facts are one group, which is right. The size makes the orrery a second page.

The lead and the bullets use the same disagreeing glance as the tile. **Illumination: ~0% visible (decreasing each night)** is the half-cycle flag (`cycle < 0.5` means increasing). At cycle 0.986 the disk is already dark, and the next night after the new moon the light grows. “Decreasing” describes the half of the month, not the next night.

**Chart.** The glass is a CRT well (`#050806`) with a gunmetal inner shadow, which matches the style’s black glass. Planet photographs, a star field, and zoom flights are the magical motion the style doc wants more of. The readout then packs several jobs into one column: a 3-column zoom grid (Inner, Earth, Moon, System, Stars, Galaxy), a **Scale** key set to `grid-column: 1` so it sits alone under that grid, a transport row only while the tour is open, a `datetime-local` Date plus Now, True sizes, the epoch line, a planet card, Stars near, an eight-planet roster with Facts, and the **This sky** checklist.

Scale under a full 3-column grid is the orphan wrap the style doc calls out (one peer left alone on the next row). **This sky** is a dead instrument: fourteen done rows and three ahead rows (Log camera, Chrome, Light-time), with the note “Bright is in. Dim is still ahead.” Chrome here is a developer restyle item, on a motion bar that already has its own phosphor keys. A person opening the Moon does not have a job called Chrome. Hide that list.

The Date control is the platform `datetime-local` field. The style doc’s clock is the ceramic face on the instrument panel, with Now inside that panel. This dialog already has Now beside the field. The field itself is the flat picker.

**Motion bar.** It is an honest hypothetical: “How fast things move across this 1,000 px view at the chosen width and time rate.” Play, Reverse, Pause, and Reset are one group, and the keys were restyled so the labels stay phosphor on this glass. At the saved width the light line prints **0.0 s**, which reads as a broken number. The eight colored dots move. The planets above them do not use that width, so the dots are a second sky. Until the log camera uses `viewWidthKm`, this slider changes a story under the picture and the stored 1,000 km on disk.

**Reading order to aim at.** Identity (phase name and the next instant, one voice), then the glass, then transport for that glass. The photographic disk can stay; it should sit with the facts at a size that leaves the chart on the first screen. Crater names can wait for a closer zoom. View width belongs on the glass or off the panel. The checklist leaves.

## c. New features for the detail view

1. **Put the saved width on the glass.** The log camera the handoff already specifies: 1,000 px = `W` km, fed by `viewWidthLog`, leaving Chart zoom as the session magnifier and keeping it out of `brain2-sky-motion`. Live `W` is 1,000 km. That is the feature the stored pref is already asking for. At that width the opening frame is a close Earth, and the motion rows describe the same picture. The **Moon** zoom stop (true size, true separation) can remain the one-click version of that frame.

2. **Say whether the moon is up.** Rise, transit, and set for the chart instant, in the same fact list as the next major phase, for the widget’s place (the weather pin, otherwise the Settings city). Nothing in the repo computes a moonrise. Solar remainder already does the sun’s day in words. Tonight’s new moon is in that list as a dark disk and a countdown, and the detail never says it shares the daylight sky. The catalog’s useful line is the month’s light without opening a calendar. Rise and set are that line.

3. **One phase for the whole dialog.** Drive the photographic disk, the illumination line, and the previous/next majors from the chart’s `shown` instant, so Date, rate, and reverse move the face with the Earth–Moon card. Keep the eight-phase name on the same local-day rule as the footer, so the lead cannot read New moon while the next bullet names a New Moon still ahead.

4. **Light-time on the Kepler places.** Already the next physics step in `MOON_SKY_MOTION.md`: delay the drawn positions from the same `planetPlaces`, and keep it off `motionReadout`. No second ephemeris. The chart date then matches the light that left the body.

5. **Libration on the phase disk.** The four crater marks use fixed selenographic coordinates and a near side that always faces us. A libration term from the same lunar chapter would let a label leave the limb, which the painter already supports (`onDisk`), and would make the marks a sky fact instead of a fixed caption.
