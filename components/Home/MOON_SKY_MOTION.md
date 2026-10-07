# Moon chart motion — handoff

The motion bar under the Moon detail is shipped. The date control, Now, and
the one clock are shipped. The true-scale sky is not: the chart is still √r,
and view width does not move it yet.
This note is the contract for the next pass. Do not start that pass from a
blank chart, and do not paste the reference page’s light paper UI.

The next chart is: **one AU scene driven by the Kepler elements already in
`lib/solar-system.ts`, a log camera, and explicit scale controls.** Chrome,
chart drawing, stars, and heavier physics can be split across agents. Time
rate, view width, and a chosen date are **inputs to that scene**, not a
second toy beside it.

## Goal

See how fast familiar motions cross the screen at a chosen zoom and time
rate. Save that rate and the view width. Reset the rate to real time in one
action. **Simulate a chosen date** — pick an instant and see the sky then.
The date control and Now are built. The log camera is not.

## Settings bar

This is the contract for the controls under the chart. The bar is shipped.
Date simulation is shipped beside it and is not part of the saved store.
Do not fold the true-scale camera into the date control.

### What is saved

`lib/sky-motion-store.ts`, persist **v1**, key `brain2-sky-motion` (alias
`cogs-sky-motion`). Two fields only:

| Field | Meaning | Default |
| --- | --- | --- |
| `viewWidthLog` | `z` in `W = 10^z` kilometres across a 1,000 px view. Range 3–10, step 0.05. | 3.5 (about 3,162 km) |
| `rateIndex` | Index into the rate table. `M` is universe seconds per real second. | 0 (real time, `M = 1`) |

There is no per-body speed. There is no second store. Garbage rehydrates
through `clampViewWidthLog` and `clampRateIndex`. The Settings full backup
includes this store and labels it **Moon chart motion**. A test reset puts
the store back to 3.5 and real time so a suite does not leave the chart
sped up.

`M` by index: 1, 60, 3,600, 86,400, 604,800, 2,629,800, 31,557,600. Labels:
real time, 1 min / 1 hour / 1 day / 1 week / 1 month / 1 year per second.

### Reset to real time

The key sets `rateIndex` to 0. It does **not**:

- change the view width
- clear the chosen date
- jump the chart to the widget's today
- write elapsed fast-forward into the store

Closing the Moon detail drops elapsed time and the chosen date, because
both live on the mounted chart. Reopening starts at the widget date, played
at the saved rate. A reload keeps `z` and `M` and does not keep how far a
fast rate had run. Defaults stay width 3.5 and real time.

### Date simulation (shipped)

The Date control and the Now key sit in the Moon readout
(`home-moon-orrery.tsx`, `.home-sky-when`). They are session state. They
are not fields of `brain2-sky-motion`.

Default anchor is the widget date from `home-moon-tile.tsx` when the detail
opens: the live clock when that day is today, noon local on any other day.
That anchor stays put while the clock runs. The Date input replaces it.
Now clears the chosen date so the anchor is the widget date again, and
clears elapsed. Now does not change `M` or `W`.

When `M` is 1, `useChartDate` shows that anchor and does not run a private
clock. When `M` is greater than 1, and only while the detail is open:

```text
dt     = min(frame seconds, 0.1)
simMs += dt * M * direction * 1000
scene  = anchor + elapsed × M × direction
```

`direction` is +1 or −1. It lives on the open detail and is not saved.
Forward real time still shows the anchor. Reverse runs the same elapsed
backward at the current rate, including real time.

Positions come from `planetPlaces(simDate)` in `lib/solar-system.ts`. That
file stays the only ephemeris. Reduced motion still advances the clock; it
only slows how often React commits (0.25 s instead of about 1/24 s).

While the chart is following the widget date, a same-day minute tick does
not move the anchor and does not clear elapsed. Elapsed keeps accumulating
while the detail is open and the rate is faster than real time. A new
widget day replaces the anchor and clears elapsed. A picked date holds
until Now or until the detail closes. Parent re-renders, star redraws, and
orbit resampling do not clear elapsed. Reset to real time clears elapsed, returns to forward, and leaves the anchor. **Play**, **Reverse**, and **Pause** sit on the motion bar. Reverse plays `elapsed × M` backward. Pause freezes either direction and does not zero elapsed. Neither writes the rate, the view width, or `brain2-sky-motion`. Real time paused
holds the anchor, including across a new widget day, until Play.

`motionReadout` stays the readout of the same `W` and `M`. It is not a
clock and it is not the chart magnifier.

### Chart zoom (session)

The glass has its own magnifier, `lib/sky-zoom.ts`. It is not view width.
View width stays the 1,000 px motion reference and does not move the glass.
Zoom is session state on the open detail. It is not a field of
`brain2-sky-motion`.

**Chart zoom** is a row of keys: **Inner**, **Earth**, **Moon**, **System**,
**Stars**, **Galaxy**. Each key eases to that frame with `approachZoom`
over about 700 ms. It does not snap. **System** sets factor 1 (today's √r
framing). It does not reset the time rate. A planet name eases to
`orbitFitFactor` for that body's distance, Sun at the center, and the
header names that orbit. Double-click eases to `bodyCloseFactor` and lands
on that planet's moons: Earth keeps the lunar phase and the Earth–Moon
frame; Mercury and Venus are the globe alone; the others draw `moonsOf` on
circular mean orbits (`orbitKm` against the planet radius, angle from
`moonAngle` at the simulation instant). Other moons are small disks at the
true size ratio to their planet. The header names the planet, and names
Earth and Moon only for Earth. **Facts** on that row eases closer still,
until the globe fills the glass, and the card shows `planetFacts`: short Name, Seen, and Science lines. A
close-up or a facts zoom keeps lon, lat, r, and from. From any of these,
another planet or a zoom stop eases there. After a flight the wheel still
calls `zoomByWheel`. Wheel notches coalesce to one frame. A flight eases that
same world-group transform and commits the factor once at the end.
Positions and orbit samples go through `chartPoint` on that commit. Between
commits the glass scales the last layout, which matches `chartPoint` because
the factor is linear. Factor 1 is
`√r × 34` with tilt `0.72`. Disks use `displayBodyRadiusPx` (Sun larger
than Jupiter at every factor; the factor-1 Sun stays near 12 px). **True
sizes** is a session toggle, off by default, and is not a field of
`brain2-sky-motion`. On, disks use `trueBodyRadiusPx` with
`kmPerPxForOrbit`. Orbits may still be the √r layout; only the disks are
true kilometres. A true disk under 2 px stays a 2 px marker, and the zoom
note says “true size, marked”. **Moon** is the true-size Earth–Moon frame.
**Earth** centers Earth at the Earth-orbit factor. **Stars** and **Galaxy**
pull the system back; the Hipparcos field stays (1625 stars to magnitude 5).
On that wide field the Milky Way is a faint band on the galactic plane, behind
the stars. Galaxy mounts `GalaxySchematic`: a face-on wash, with the Sun in
the Orion spur. It is a schematic of our galaxy, not a catalog of other
galaxies and not a photograph.

**Scale** is a separate session tour (`lib/sky-scale.ts`), and it is not saved. One stop for each decade of metres, from a proton near 10^-16 m through a house mouse near 10^-1 m, a person, and a western gull at Ocean Beach, San Diego (32.75°N, 117.25°W), out to the observable universe near 10^26 m. The default pace is about four seconds a decade, not one rush through the ladder. Pause, Play, Slower, Faster, Previous, and Next belong to the tour. Opening Scale does not pause the chart clock, and it does not write `brain2-sky-motion` or change the saved time rate or the view width. Decades inside the chart clamp ease with `approachZoom`. Smaller decades, and decades past the Milky Way, use a full-frame card (a simple silhouette, or the Moon and Earth disks) so the object is visible. The 10^21 m step mounts `GalaxySchematic`. The idea is inspiration only: Powers of Ten (Charles and Ray Eames, 1977), the Florida State University optical microscopy primer, and Scale of the Universe. The captions and silhouettes are original.

### How the bar fits the true-scale sky

Today `W` feeds only `motionReadout`. The chart's orbit radius is
`√r × 34 × factor` with tilt `0.72`. Factor 1 is the wide framing. That
is still not the log camera. When a one-AU scene exists:

```text
chosen date  ──┐
time rate M  ──┼──►  planetPlaces(simDate)
view width W ──┘         log camera: 1,000 px = W km
                         km per pixel = W / 1000
                         motionReadout reads the same W and M
```

- Do not draw positions from anywhere but `planetPlaces` / `orbitSamples`
  in `lib/solar-system.ts`, projected with `chartPoint`. No second ephemeris.
- Do not copy the px/s formula into the chart. The bar is the readout.
- The date anchor, the one clock, pause, and the session magnifier are in.
  The log camera is not. View width does not move the glass. When the
  one-AU scene exists, drive that camera from this view width: 1,000 px =
  `W` km. Leave the session magnifier as chart zoom; do not store it in
  `brain2-sky-motion`.
- Chrome and light-time are still ahead. The star field is in: 1625
  Hipparcos stars to visual magnitude 5.00
  (`naked-eye-stars.ts`), drawn on this glass. **Stars near** is a session
  list of named stars by ecliptic longitude and is not stored. Do not add a second
  ephemeris for light-time.
- Do not remove the 0.2 light coarsening on the globes. A fast rate must
  not repaint every photograph every frame. `moonGlance` on every fast
  frame is already a known cost if the Earth zoom stays.

A compact checklist in the readout (`.home-sky-progress`) names what is in
and what is still ahead: date control, Now, one clock, zoom, pause, orbit
zip, close-up, moons, reverse, Earth spin, stars, galaxy, true sizes, star identify, and powers of ten are in;
log camera, chrome, and light-time are still ahead. It is progress, not a
second settings system.

Earth's globe takes `spinTurns` from `earthSpinDegrees`: one turn per
sidereal day, 86164.0905 simulated seconds, including while reversed. At
real time forward the epoch stays on the anchor and the texture keeps the
wall seconds, so a close-up shows the true spin. The other planets stay fixed.

The camera, chrome, and light-time stay separate changes. Each change
leaves `lib/sky-motion.test.ts` green. The screenshot check is
`motionReadout(4.4, 0)`.

## What is in the repo now

| Piece | Where | State |
| --- | --- | --- |
| Kepler places | `lib/solar-system.ts` — `planetPlaces`, `orbitSamples`, `PLANETS` | Shipped. JPL approximate elements, epoch J2000, rates per century. Earth is the Earth–Moon barycenter. Not an n-body integrator. |
| Body sizes | `lib/sky-bodies.ts` — `displayBodyRadiusPx`, `trueBodyRadiusPx`, `kmPerPxForOrbit` | Shipped on the chart. Display disks keep the Sun larger than Jupiter. **True sizes** is session-only and does not write `brain2-sky-motion`. Earth–Moon close-up still uses `earthMoonRadii`. |
| Current projection | `chartPoint` in `lib/sky-zoom.ts`, used by the orrery | Shipped magnifier. Factor 1 is `√r × 34`, tilt `0.72`. Not the log camera. View width does not move the glass. |
| Photographs | `components/Home/planet-skins.ts`, `public/planets/` | Shipped. `usePlanetSkins` caches a globe by light rounded to 0.01 and by texture size. The wide chart is 96px. Close-up and Facts paint that body at 384px from the source photograph. The orrery also coarsens light to 0.2 before that, so a fast rate does not repaint every frame. |
| Stars | `naked-eye-stars.ts`, drawn in the orrery | Shipped. 1625 Hipparcos stars to magnitude 5.00, blackbody color, 397 proper names. Directions on the ecliptic glass. **Stars near** (`star-identify.tsx`) lists the named stars closest in ecliptic longitude to the selected planet. Session only. Not saved in `brain2-sky-motion`. |
| Galaxy | `sky-galaxy.tsx`, `lib/sky-galaxy.ts` | Shipped. Faint band on the wide star field, behind the stars. Galaxy stop and the powers-of-ten Milky Way step (10^21 m) use `GalaxySchematic`. `galaxyBandAngle` is the inclination, about 60.2°. |
| Moon phase | `lib/lunar.ts` `moonGlance` | Shipped for the tile and, while the chart is open, for the Earth zoom. Meeus. Calling it on every fast frame is a known cost. |
| Motion math | `lib/sky-motion.ts` | Shipped. Formulas below. Tested in `lib/sky-motion.test.ts`. |
| Saved settings | `lib/sky-motion-store.ts` | Shipped. Persist **v1**, key `brain2-sky-motion`. In the Settings full backup. Pref-only vault `cogs-sky-motion` (no row guard). |
| Bar | `components/Home/home-sky-motion.tsx`, `.home-sky-motion` in `home-chrome.css` | Shipped, under the chart. **Play**, **Reverse**, and **Pause** run or freeze the clock and do not write the store. Reverse is not saved. |
| Chart clock | `stepChartClock` in `lib/sky-motion.ts`, driven by `useChartDate` | Shipped. `anchor + elapsed × M × direction`, frame cap 0.1 s. Real time forward shows the anchor. Reverse runs backward. A same-day widget tick does not clear elapsed. Pause freezes either direction and does not zero it. Real time paused holds the anchor. Elapsed and direction are not persisted. |
| Date and Now | `.home-sky-when` in the orrery | Shipped. Session only, while the detail is mounted. Not in `brain2-sky-motion`. |
| Checklist | `.home-sky-progress` in the readout | Shipped. Done: date control, Now, one clock, zoom, pause, orbit zip, close-up, moons, reverse, Earth spin, stars, galaxy, true sizes, star identify, powers of ten. Ahead: log camera, chrome, light-time. Not a settings store. |
| Chart zoom | `lib/sky-zoom.ts`, **Chart zoom** keys and the planet roster | Shipped. Session magnifier. Keys, planet names, moon close-ups, and Facts ease with `approachZoom` (~700 ms). **System** is factor 1. Orbit fit keeps the Sun centered. Not saved in `brain2-sky-motion`. |
| Moons | `lib/sky-moons.ts` — `moonsOf`, `moonAngle`, `planetFacts` | Shipped on the close-up. Mean circular orbits. Earth’s Moon keeps `moonGlance`. Mercury and Venus have no moons. `planetFacts` is Name, Seen, and Science lines for the Sun, the planets, and the Moon. |
| Earth spin | `earthSpinDegrees` in `lib/sky-motion.ts`, `spinTurns` on the Earth globe | Shipped. One turn per sidereal day (86164.0905 s) of simulated time, including reverse. Other planets stay fixed. |

Widget date (`home-moon-tile.tsx`): today uses the live clock (minute tick);
another day uses noon local. That date is the default anchor. The Date
control can replace it until Now, or until the detail closes.

## Reference behavior (do not loosen this)

Source: `real_time_motion_by_zoom_level.html`. The screenshot at view width
25,119 km and real time is the check: About 2.0 × Earth diameter, light
crosses in 0.1 s, Earth at 1.2 px/s “visible motion”, light at 11,935 px/s
“too fast to follow”, footer “1 of 8…”. `motionReadout(4.4, 0)` matches that
screenshot, including the en-US commas.

### Sliders

View width `#z`: `min=3`, `max=10`, `step=0.05`, default `3.5`.

```text
W = 10 ^ z          kilometres across the view
```

Default `10^3.5` ≈ 3,162 km. The screenshot’s 25,119 km is `10^4.4`.

Time rate `#r`: `min=0`, `max=6`, `step=1`, default `0`. `M` is universe
seconds per real second:

| Index | M | Label |
| ---: | ---: | --- |
| 0 | 1 | real time |
| 1 | 60 | 1 min per second |
| 2 | 3600 | 1 hour per second |
| 3 | 86400 | 1 day per second |
| 4 | 604800 | 1 week per second |
| 5 | 2629800 | 1 month per second |
| 6 | 31557600 | 1 year per second |

There is no per-body speed multiplier. Do not add one. `M` is the only rate.

### Scale line and light

Pick the reference whose `log10(W / km)` is closest:

| km | Label |
| ---: | --- |
| 12742 | Earth diameter |
| 384400 | Earth-Moon distance |
| 1392700 | Sun diameter |
| 1.496e8 | 1 AU |
| 7.785e8 | Jupiter orbit radius |
| 4.5e9 | Neptune orbit radius |

```text
ratio = W / best.km
"About " + (ratio < 10 ? ratio.toFixed(1) : round(ratio) with en-US commas) + " x " + label
```

The screenshot’s “×” is the same “x” as the script.

Light crossing, `s = W / 299792`:

```text
s < 60        → s.toFixed(1) + " s"
s < 3600      → (s/60).toFixed(1) + " min"
s < 86400     → (s/3600).toFixed(1) + " h"
else          → (s/86400).toFixed(1) + " days"
"Light crosses this in " + that
```

View width text: under 1e6 km, `round(W)` with commas + ` km`; under 1e9,
`(W/1e6).toFixed(1) + " million km"`; else `(W/1e9).toFixed(1) + " billion km"`.

### Rows

Ranked slowest to fastest. The dot color is the reference color. km/s is the
constant `v` (`v > 1000` prints `299,792`).

| Name | v (km/s) | Color |
| --- | ---: | --- |
| Point on Earth equator | 0.465 | `#888780` |
| Moon around Earth | 1.022 | `#888780` |
| Neptune around Sun | 5.43 | `#378ADD` |
| ISS around Earth | 7.66 | `#7F77DD` |
| Jupiter around Sun | 13.06 | `#D85A30` |
| Voyager 1 vs Sun | 16.9 | `#1D9E75` |
| Earth around Sun | 29.78 | `#378ADD` |
| Light | 299792 | `#BA7517` |

On a **1,000 px** view:

```text
px/s = v * M / W * 1000
```

Print px/s: `>= 100` → rounded with commas; `>= 1` → one decimal; else
`toPrecision(2)`.

Labels, same thresholds, no gaps:

```text
px/s < 0.05   → frozen
px/s < 1      → barely moving
px/s < 600    → visible motion
else          → too fast to follow
```

Only “visible motion” counts. Footer, exact shape:

```text
N of 8 objects show visible motion on a 1,000 px wide view at this zoom and rate.
```

The dot’s track position advances by fraction `v * M / W` of the track per
real second (`pos = (pos + fraction * dt) % 1`). A frame’s `dt` is capped at
0.1 s. `px/s >= 600` draws the dot at opacity 0.35. Reduced motion holds the
dots still. The label still assumes 1,000 px even when the track element is
narrower. Keep that.

### Save and reset

The HTML page does not save. The app does.

- Persist `viewWidthLog` and `rateIndex` (`lib/sky-motion-store.ts`).
- **Reset to real time** sets `rateIndex` to 0 and **keeps** the view width.
- Garbage rehydrates through `clampViewWidthLog` (3–10, step 0.05, default
  3.5) and `clampRateIndex` (0–6, default 0).
- Closing the Moon detail does **not** keep elapsed fast-forward time or the
  chosen date. The rate and the view width are what survive. Reopening
  starts again at the widget date, played at the saved rate.
- **Reset to real time** does not clear a chosen date that is still on an
  open detail. **Now** does.

## How the bar meets the next sky

```text
chosen date  ──┐
time rate M  ──┼──►  planetPlaces(simDate)  on one AU scene
view width W ──┘         log camera: 1000 px = W km
                         motion bar reads the same W and M
```

- **View width** is the log camera. `z` from 3 to 10 is already a log zoom.
  Kilometres per pixel = `W / 1000`. Today `W` only feeds the bar. The √r
  chart ignores it. The session magnifier (`lib/sky-zoom.ts`) is a different
  control and is not stored. When the AU scene lands, drive the camera from
  `W`. Keep the magnifier off `brain2-sky-motion`.
- **Time rate** multiplies the scene clock. `stepChartClock` /
  `useChartDate` is that clock: while the detail is open and `M > 1`,
  `simMillis += min(dt, 0.1) * M * direction * 1000`, and positions come from
  `planetPlaces`. Elapsed keeps accumulating across parent re-renders and
  same-day widget ticks. Pause freezes that clock, in either direction, and does not change `M`.
  At `M = 1` forward the chart shows the anchor and does not run a private clock.
  Reverse runs backward at the current rate. Real time paused holds the anchor.
- **Chosen date** replaces the widget date as the anchor. Shipped, session
  only. **Now** returns the anchor to the widget date.

### Which stream owns what

| Stream | Owns | Does not own |
| --- | --- | --- |
| Chrome | `home-sky-motion.tsx`, `.home-sky-motion`, the reset key, slider thumbs. Restyle only inside the Moon dialog’s existing glass. | Kepler, camera math, star catalog |
| Chart drawing | `chartPoint` draws the √r glass. The log camera fed by `viewWidthKm` is still ahead. Keep `planetPlaces` / `orbitSamples`. | A second copy of the px/s formulas. Storing zoom in `brain2-sky-motion`. |
| Stars | `naked-eye-stars.ts` on the ecliptic glass. 1625 Hipparcos stars to magnitude 5, with **Stars near** as a session longitude list. | The motion rows. Do not store the toggle in `brain2-sky-motion`. |
| Galaxy | `sky-galaxy.tsx` and `lib/sky-galaxy.ts`. Band behind the stars; `GalaxySchematic` at the galaxy stop. | Planet sizes, the star catalog, view width, and the time rate. |
| Heavier physics / sky tools | Light-time, after the one scene. The date anchor and the scene clock (`M` on the Kepler date) are already in the orrery. Thin out per-frame `moonGlance` if the Earth zoom stays. | A new physics package. No matter.js, no n-body beside `solar-system.ts`. No second ephemeris. |

## Visual language

Match the Moon dialog, not the reference page. The reference is a light
paper list. The dialog is the silver handheld (`home-widget-instrument`,
`is-sky` in `home-chrome.css`) with a black glass chart.

Reuse:

- Chart well: `#050806` / `#07110c`, inset `1px 1px #000` and `-1px -1px #1c3d2c`.
- Phosphor: `#c8ffe8`, `#e7fff4`, `#7dffc4`, muted at about 45–78% of the mint.
- Motion words: frozen muted, barely the secondary mint, visible `#7dffc4`,
  too fast `#e6a23c` (the handheld amber).
- Raised key: `.home-review-key` inside `.home-widget-dialog` for **Reset to
  real time**. Silver thumb on the range, same family as that key.
- Type: the dialog’s existing face. Tabular figures on the km and px values.
- Dots: the eight reference colors above, 10 px, on a sunken track.

[`docs/DESIGN_STYLE.md`](../../docs/DESIGN_STYLE.md) still rules the screen:
milled fascia, [the screen stays pleasing](../../docs/DESIGN_STYLE.md#the-screen-stays-pleasing),
no orphan wrap, no clipped sliders. Do not clone `.hab95` onto this glass.
Do not ship the reference page’s anthropic-sans / light-surface chrome.

`docs/UI_NEXT.md` is a placement backlog. This sky is not an item there.

## Ordered next steps

1. **Date anchor.** Done. The Date control sets the instant passed to
   `planetPlaces`. Default remains the widget date (live clock today, noon
   on another day). The chosen instant is session state on the open detail,
   not persist v1. **Reset to real time** clears `M` to 1 and leaves the
   view width and the chosen date. **Now** returns the anchor to the widget
   date and clears elapsed.
2. **Feed `W` to one camera.** Not done. The chart is still `√r × 34`,
   times a session magnifier whose factor 1 is that framing. View width
   does not move the glass. When the AU scene exists, `viewWidthKm` is the
   width of the view in kilometres (1,000 px = `W` km). The magnifier stays
   a separate session control. The Earth-and-Moon true-scale frame is the
   **Moon** stop. It is not a second view-width.
3. **Keep one clock.** Done. The scene date is `anchor + elapsed * M`, with
   the 0.1 s frame cap. Real time (`M = 1`) shows the anchor and does not
   spin a private timer. Elapsed time and direction are not persisted, and elapsed is not
   cleared by a parent re-render, a same-day widget tick, a star redraw,
   or an orbit resample. Now, a Date edit, a new widget day, and reset-rate
   are the clears. **Pause** on the motion bar freezes either direction and does not
   write the store. **Reverse** plays backward. Reset returns to forward. Real time paused holds the anchor.
4. **Draw on Kepler elements.** Positions and orbit samples stay
   `planetPlaces` / `orbitSamples`. If an element is wrong, fix it in
   `lib/solar-system.ts`. Do not fork a second ephemeris for the chart.
5. **Leave the bar’s math alone.** `motionReadout` is the readout of the
   same `W` and `M`. Extend it only if the reference set changes. Tests in
   `lib/sky-motion.test.ts` lock the screenshot.
6. **Chrome, then light-time.** Still ahead of this slice. Stars are in:
   1625 Hipparcos stars to magnitude 5 in place of the hashed dots. Light-time reads the
   same Kepler places and stays off `motionReadout`. The log camera still
   waits for the one-AU scene, driven by the saved view width (1,000 px =
   `W` km).

## What not to do

- Do not paste the reference HTML’s visual style into the dialog.
- Do not ignore `lib/solar-system.ts` and simulate orbits another way.
- Do not add a second physics engine, per-planet speed knobs, or a parallel
  settings store. `brain2-sky-motion` is the store.
- Do not make view width a decorative number once the log camera exists.
- Do not persist fast-forward elapsed time across reload. Persist the rate
  and the view width. The chosen date stays session-only unless a later
  decision adds it to the store on purpose.
- Do not treat `docs/UI_NEXT.md` as the home for this work.
- Do not invent an entry in `docs/BRAIN2_FEATURE_IDEAS.md`.
