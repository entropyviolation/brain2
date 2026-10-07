# Moon chart motion — handoff

The motion bar under the Moon detail is shipped. The true-scale sky is not.
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
action. **Simulate a chosen date** — scrub or pick an instant and see the
sky at that time. The date control is a first-class next step. It is not
built.

## What is in the repo now

| Piece | Where | State |
| --- | --- | --- |
| Kepler places | `lib/solar-system.ts` — `planetPlaces`, `orbitSamples`, `PLANETS` | Shipped. JPL approximate elements, epoch J2000, rates per century. Earth is the Earth–Moon barycenter. Not an n-body integrator. |
| Body sizes | `BODY_RADIUS_KM`, `systemBodyRadiusPx`, `earthMoonRadii`, `MOON_DISTANCE_KM` | Shipped. Wide chart shares one km/px so the Moon is under a pixel. Earth zoom is true size and true separation. |
| Current projection | `toScreen` in `components/Home/home-moon-orrery.tsx` | Shipped, and **not** a linear camera. Orbit radius on screen is `√r × 34`, tilt `0.72`. Mercury and Neptune share the glass. Leave this until the AU scene replaces it. |
| Photographs | `components/Home/planet-skins.ts`, `public/planets/` | Shipped. `usePlanetSkins` caches a globe by light rounded to 0.01. The orrery also coarsens light to 0.2 before that, so a fast rate does not repaint every frame. |
| Stars | `STAR_DOTS` in the orrery | 56 hashed dots. Not a catalog. |
| Moon phase | `lib/lunar.ts` `moonGlance` | Shipped for the tile and, while the chart is open, for the Earth zoom. Meeus. Calling it on every fast frame is a known cost. |
| Motion math | `lib/sky-motion.ts` | Shipped. Formulas below. Tested in `lib/sky-motion.test.ts`. |
| Saved settings | `lib/sky-motion-store.ts` | Shipped. Persist **v1**, key `brain2-sky-motion`. In the Settings full backup. Pref-only vault `cogs-sky-motion` (no row guard). |
| Bar | `components/Home/home-sky-motion.tsx`, `.home-sky-motion` in `home-chrome.css` | Shipped, under the chart. |
| Chart clock | `useChartDate` in the orrery | Shipped, narrow. Real time uses the widget date. A faster rate plays forward only while the detail is open. |

Widget date (`home-moon-tile.tsx`): today uses the live clock (minute tick);
another day uses noon local. That date is the chart’s anchor. There is **no
date scrubber**.

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
- Closing the Moon detail does **not** keep elapsed fast-forward time. The
  rate is what survives. Reopening starts again at the widget date, played
  at the saved rate.

## How the bar meets the next sky

```text
chosen date  ──┐
time rate M  ──┼──►  planetPlaces(simDate)  on one AU scene
view width W ──┘         log camera: 1000 px = W km
                         motion bar reads the same W and M
```

- **View width** is the log camera. `z` from 3 to 10 is already a log zoom.
  Kilometres per pixel = `W / 1000`. Today `W` only feeds the bar. The √r
  chart ignores it. When the AU scene lands, drive the camera from `W`. Do
  not keep a second zoom.
- **Time rate** multiplies the scene clock. `useChartDate` is the seed:
  while the detail is open and `M > 1`, `simMillis += min(dt, 0.1) * M *
  1000`, and positions come from `planetPlaces`. At `M = 1` the chart is the
  widget date and does not run a private clock.
- **Chosen date** replaces the widget date as the anchor. Not built. See
  the ordered steps.

### Which stream owns what

| Stream | Owns | Does not own |
| --- | --- | --- |
| Chrome | `home-sky-motion.tsx`, `.home-sky-motion`, the reset key, slider thumbs. Restyle only inside the Moon dialog’s existing glass. | Kepler, camera math, star catalog |
| Chart drawing | Replace `toScreen` with heliocentric AU coordinates and a log camera fed by `viewWidthKm`. Keep `planetPlaces` / `orbitSamples`. | A second copy of the px/s formulas |
| Stars | A real star field, if one is wanted, in place of `STAR_DOTS`. | The motion rows |
| Heavier physics / sky tools | Date scrub, the scene clock (`M` on the Kepler date), and any later light-time. Thin out per-frame `moonGlance` if the Earth zoom stays. | A new physics package. No matter.js, no n-body beside `solar-system.ts` |

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

1. **Date anchor.** Add a scrub or a date-time control on the Moon detail.
   It sets the instant passed to `planetPlaces`. Default remains the widget
   date (live clock today, noon on another day). Persist it only if a saved
   “look at this date” is clearly wanted; the first version can be session
   state. Do not overload **Reset to real time** to mean “jump back to now.”
   Reset clears `M` to 1 and leaves both the view width and the chosen date.
   A separate **Now** control, if needed, returns the anchor to the widget
   date.
2. **Feed `W` to one camera.** When the AU scene exists, `viewWidthKm` is
   the width of the view in kilometres. Delete any leftover zoom that is not
   this slider. The Earth-and-Moon true-scale frame can stay as a mode; it
   is not a second view-width.
3. **Keep one clock.** The scene date is `anchor + elapsed * M`, with the
   0.1 s frame cap. Real time (`M = 1`) shows the anchor and does not spin a
   private timer. Elapsed time is not persisted.
4. **Draw on Kepler elements.** Positions and orbit samples stay
   `planetPlaces` / `orbitSamples`. If an element is wrong, fix it in
   `lib/solar-system.ts`. Do not fork a second ephemeris for the chart.
5. **Leave the bar’s math alone.** `motionReadout` is the readout of the
   same `W` and `M`. Extend it only if the reference set changes. Tests in
   `lib/sky-motion.test.ts` lock the screenshot.
6. **Chrome pass, then stars, then heavier tools.** Order above. Stars do
   not block the camera. Light-time and anything past Kepler wait until the
   one scene and the date anchor exist.

## What not to do

- Do not paste the reference HTML’s visual style into the dialog.
- Do not ignore `lib/solar-system.ts` and simulate orbits another way.
- Do not add a second physics engine, per-planet speed knobs, or a parallel
  settings store. `brain2-sky-motion` is the store.
- Do not make view width a decorative number once the log camera exists.
- Do not persist fast-forward elapsed time across reload. Persist the rate,
  the view width, and (only if step 1 decides to) the chosen date.
- Do not treat `docs/UI_NEXT.md` as the home for this work.
- Do not invent an entry in `docs/BRAIN2_FEATURE_IDEAS.md`.
