# Tracking redesign plan

Home → Tracking, Time Grid first. **Status:** the desk layout, materials, view deck with ghost LEDs, instrument column, glass/paper screen, day meters, lace, and the screw easter egg have shipped (see the "The desk" section of the Tracking README). Still open from this plan: merging the two Now strips into one row, the Unnamed places drawer, and the paint / erase / scissors / fill motions beyond the existing spark.
The room's behavior is [`components/Home/Tracking/README.md`](../components/Home/Tracking/README.md).
The house order is [`DESIGN_STYLE.md`](DESIGN_STYLE.md): failures, then layout,
then palette. Stills are [`DESIGN_REFS.md`](DESIGN_REFS.md).

---

## What the room is

One machine: you choose a pen, paint time onto a screen, and read back what
the week was. Four refs already describe that machine:

| Ref | What to take |
|-----|--------------|
| IRIX cattle console, `designrefs/designref1.jpg` | One big screen, a side column of instruments, small readouts under it. That is this room's layout. |
| Tek 465B, `designrefs/a898e04c534aeed3017938c701efdb2f.jpg` | A dark graticule screen in a silver case. TIME/DIV and the cell knob are already the scope's knobs. The grid is the CRT. |
| Winamp stack, `designrefs/7735cf78c857fd9187692b8d21999ad0.jpg` | Docked windows of one player: main, EQ, playlist. Here: Now, pen rack, screen. EQ sliders become day meters; ON/AUTO lamps become ghost lamps. |
| Gas tubes, `designrefs/w3caho3pypz61.jpg`, `61ildG1qWDL.jpg`, `Screenshot-2024-07-03-201409.webp` | Each element its own color of light. Pens are tubes. `noble-gas-tube.tsx` already exists. |

Supporting: the Sony handheld (`ffa2396fc4af38ae8e97e646029c2e2e.jpg`) and the
Pocket PC (`36bc1715c629f42e163d54abe8741ac6.jpg`) for silver body against dark
glass; FR4 traces (`d09ee9b9…`, `cfd93985…`, `e624b3ac…`) as engraved rules
for the pen tree; lace (`4fac4805…`, `d206bbff…`) once, around the week's
written summary — the paper inside the machine, like the Sharp word
processor (`a272dce1…`).

---

## Inventory and verdicts

Every band on the current screen, top to bottom. **Keep**, **move**,
**merge**, or **cut**.

### Above the room (global, not this plan)

Visual dashboard (was the Home overview strip), Home tabs, BRAIN2 header (Nav / Friend / Rituals /
System / Capture-Now), app tabs. Untouched. One note: the header's
Capture-Now well already shows the pen line, `11:39`, and Objectives. The
room's Now strip must not be a second copy of it (see 2).

### 1. Room header — `tracking-desk.tsx`
- `TRACKING` nameplate directly under a lit `TRACKING` Home tab. **Merge**:
  the plate becomes the room's orb or lamp only, no second word. Saves a
  word, not a row.
- Time Grid / Activity Log / Day Log / Tracking log + gear. **Keep.**

### 2. Now strip — `working-now-strip.tsx`, `pen-color-now-strip.tsx`
- Two strips that state the same moment: *Working on clean house* and
  *Pen color · Using Brain2 · Activity · since 2:13:34 PM · 11:39 ▶ ■ ·
  Objectives*. **Merge** into one instrument, one row:
  `● NOW [clean house ▾] → [▮ Brain2 · Activity] since 2:13 PM [11:39] ▶ ■ OBJECTIVES`.
- `WORKING ON THIS NOW` is a verb with an unclear object. **Check what it
  does**, then fold it into ▶ (start) if it is the same act.
- "No tracking tags — set them on the operation in Settings." **Move** to
  the status strip (setup message, not header).
- Difference from the global header: this one chooses the operation and
  the pen; the header only reports. If after the merge they still say the
  same thing, the room's copy hides when the header is visible.

### 3. Pen mode bar — `pen-mode-bar.tsx`, `depth-control.tsx`
- Show as: Country / Area / Place / Level 3 / 4 / 5 / Exact — seven peer
  keys for one scale. **Replace** with a detented rotary, the twin of the
  CELL knob (same amp dial as `cell-size-keys.tsx`). Readout beside it.
  Move it to the instrument column (5) because it changes what the screen
  reads, not which pen paints.
- Sort (Recent), Conceal/Expand. **Move** into the pen rack header.
- Look: Hide / View / Tags. **Check meaning**; if it is about pens, rack
  header; if it is about the plot, instrument column.
- Settings. **Keep**, in the rack header.

### 4. Pen palette — `pen-palette.tsx`, `pen-swatches.tsx`, `pen-tray-bg.*`
- Selected pen is stated four times: "Home — Selected pen for this view",
  the "Select the paint pen" field, "36 pens · Home", and the Draw hint.
  **Merge** into one nameplate at the top of the rack.
- 36 flat saturated beads in a full-width tray, three rows. **Move** to a
  left rack (see Layout). **Restyle** as tubes (see Materials).
- Seven unnamed `32.7xx,-117.2xx` pens, two identical. **Merge** into one
  `Unnamed places · 7` drawer at the foot of the rack; each opens pen
  settings to name it.
- New pen field + `+ New pen`. **Keep**, at the rack foot.
- DETAIL row (`32.738…`, Bedroom, Living Room, + Add). **Check**: if these
  are the selected pen's children, they belong under its nameplate as the
  branch; if secondary pens for the next stroke, keep as a row under the
  nameplate labeled for that.
- "36 pens · Home / sorted recent". **Keep** as the rack's footer count.

### 5. Tools rail — `tracking-tools-tray.tsx`, `tool-detail.tsx`, `trk-instrument.tsx`
- Draw / Erase / Scissors + tool detail. **Keep**, and add **Fill** as the
  fourth tool (see 9). Active tool = power lamp + CRT well, the fascia rule.
- This rail grows into the instrument column: tools, then TIME/DIV, CELL
  knob, SHOW AS knob, Find.

### 6. Layer tabs + 7. Ghost row — `superimpose-bar.tsx`, `ghost-layers.ts`
- The nine layers are listed twice. **Merge**: one row of cassette-deck
  keys (boom-box transport keys, chunky plastic with a front lip), each with
  a small LED set in the deck beneath it. The latched-down key is the layer
  you paint; it sits pushed down over its own LED, because the active view
  cannot be its own ghost. A lit blue LED under any other key = that layer
  is ghosted under the screen. Click the LED to toggle. `Off` is "no LEDs
  lit".
- `discrete events` casing in the ghost row. Goes away with the row.
- `+` and trash for views. **Keep** at the row's end, trash separated by a
  rule.
- `+ Log activity`. **Keep**, right end of the same row (it is the other
  way to write to the active layer).
- `Hide [Log flags]`, `☀☾`, raw `multi` and `advanced` checkboxes. Bare
  browser checkboxes are off-house. **Check meaning**, then make them lamp
  keys in the instrument column, or cut what no one uses.

### 8. Grid bezel — `time-grid.tsx` (`TrkPlotBezel`)
- TIME/DIV Day / Week / Infinite scroll. **Keep**, instrument column.
- CELL knob 5m. **Keep**, instrument column.
- Find. **Keep**, instrument column, bottom.

### 9. Period nav — `tracking-period-nav.tsx`
- ‹ and › far apart around a wide empty bevel. **Regroup**:
  `‹ [OCT 5 — OCT 11 2026] TODAY ›` as one period group, date in a CRT.
  "115h 54m tracked · 69% · 7 of 7 days" sits under the CRT as caption.
- `15m / 30m / 60m` next to a CELL knob reading `5m` reads as two controls
  for one thing. **Check what they set.** If it is row height (zoom), name
  it and give it a small rocker in the instrument column; if it duplicates
  the knob, cut.

### 10. Fill row — `fill-range-control.tsx`
- From / To / On M–S / Mon–Fri / All 7 / Fill 1 day with Home sits between
  the period nav and the day headers, cutting the screen from its own
  column heads. **Move**: Fill is a tool. Selecting Fill opens these fields
  in the tool-detail well. Ticking a day key can also be done by clicking
  a day header while Fill is armed.

### 11. Week screen — `week-grid.tsx`, `trk-time-markers.tsx`
- Untracked time is white glare (Thu, Sun). On a dark screen untracked is
  **unlit glass** with the graticule showing. Missing days still read at a
  glance — as dark, not as white.
- Sunrise/sunset labels repeat in all seven columns. **Move** the label to
  the hour gutter once per row; keep the gray line across (do not remove the
  lines, README).
- Day header totals (`23h 25m`). **Restyle** as a meter (see Materials).

### 12. Under the screen — `tracking-summaries.tsx`, `TrkRibbon`, `TrkTagStrip`, `tracking-day-notes.tsx`
- The day totals row repeats the headers. **Cut.**
- Day summary cells, week summary, ribbon legend, tagged minutes, Day
  Summary well (Day / Week / Month / Season / Year, Collapse). **Keep**,
  in that order. Ribbon and tagged minutes are readouts of the screen above
  — they sit directly under it. The writing (day summaries, week summary,
  Day Summary well) comes after, as one region: the paper.

---

## Layout

```
┌ TRACKING  [Time Grid][Activity Log][Day Log][Tracking log] ⚙ ─────────────┐
├ ● NOW [clean house ▾] → ▮ Brain2·Activity  since 2:13 PM [11:39] ▶ ■ OBJ ─┤
├ PEN RACK ─────┬ [ACTIVITY●][LOCATION◉][MOOD]…[IPHONE TEXTS] + 🗑 │+ Log ─┬ TOOLS ───┤
│ ▮ Home      3 │ ‹ [ OCT 5 — OCT 11 2026 ] TODAY ›                      │◉ Draw    │
│ Recent ▾  ⋯ ⚙ │   115h 54m · 69% · 7/7 days                            │○ Erase   │
│ ─ USA         │  Mon  Tue  Wed  Thu  Fri  Sat  Sun                     │○ Scissors│
│   ├ California│  ▮▮▮  ▮▮▮  ▮▮▮  ▮··  ▮▮·  ▮▮▮  ▮··   ← day meters      │○ Fill    │
│   │ └ San D…  │ ┌──────────────────────────────────────────────┐       │ detail   │
│   │   ├ Ocean │ │                                              │       ├ TIME/DIV │
│ ─ Mexico      │ │          dark graticule screen               │       │ D W ∞    │
│ ─ Tokyo …     │ │          lit blocks = tracked                │       │ CELL ◔5m │
│ Unnamed · 7 ▸ │ │          unlit glass = untracked             │       │ SHOW ◔   │
│ [new pen…] +  │ └──────────────────────────────────────────────┘       │ Find [ ] │
│ 36 pens       │  ribbon ▬▬▬▬▬▬▬▬▬▬▬▬  tagged minutes                   │ flags ●● │
├───────────────┴─────────────────────────────────────────────────────────┴──────────┤
│ ✿ lace ✿  day summaries ×7 · week summary · Day/Week/Month/Season/Year ✿ lace ✿    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

- Reading order: identity → now → pens → period → screen → readouts →
  writing. Utilities on the right.
- The screen starts at about one third of the viewport instead of below the
  fold.
- Rack and column are equal-height wells with the screen (shared top edge,
  shared foot). Rack scrolls internally with the Win95 bar.
- Narrow window: rack collapses to one row of tubes above the screen (the
  current one-row "Expand" behavior), column becomes one bar under the
  layer row. Phone only stacks.

---

## Materials

Case: mill silver at the room's `--chrome-face`. Lights are green, blue, or
purple only — no orange or amber LEDs ([DESIGN_STYLE.md](DESIGN_STYLE.md#dsi-pixel-and-lights)).
Nothing new invented where the house already has the part.

| Part | Material | Existing piece |
|------|----------|----------------|
| Screen (grid well) | Two faces, a view setting remembered per view: **Paper** (today's white and gray grid; the default for Day) and **Glass** (black `#040a08`, faint graticule every hour and day, gunmetal ring). Blocks are flat pen color in both; labels use `inkOnFill`. | `TrkPlotBezel`, `tracking-view-prefs.ts` |
| Untracked | Paper: white. Glass: unlit glass, graticule visible. Assumed time keeps its hatch. | `cellPaintClass` |
| Now line | Red stays red. Sunrise/sunset lines dim phosphor, label in gutter. | `trk-time-markers.tsx` |
| Pens | **Flat** color swatches, no glow, in the rack, the ribbon, and on the screen. The selected pen is marked by the rack's nameplate and a phosphor edge on its row, not by lighting its color. Count as a tiny pixel digit. | `pen-swatches.tsx` |
| Pen tree | FR4 traces as engraved rules between parent and child tubes. | new, CSS only |
| Period | CRT readout in `--hab-crt-green`, pixel face. | fascia CRT |
| Day meters | Per day, a glass loading bar under the date, fill = share of 24h tracked. Green; purple when under half. Replaces the bare `23h 25m` as the figure; the number stays as caption. (Liked in review — keep.) | `percent-led-bar.tsx` |
| Layer keys | Cassette-deck keys with an LED beneath each (see 6). Active key latched down over its LED; ghost LED is ice blue. | new; `HabitLedLamp` for the LED |
| Tools | Round power lamp per tool; active = lit + CRT well. | fascia |
| Instrument column | Built like a bench oscilloscope front panel (Crotech 3132 / Tek 465B): pale gray panel, printed scales, pale-green section bands (TIME BASE, DISPLAY). | new |
| Knobs | TIME/DIV (Day / Week / ∞), CELL, SHOW AS: black fluted knobs with a silver cap and a white index line, on a scale printed around them; click a scale mark to jump, wheel to step. | `cell-size-keys.tsx` |
| Switches | Row size and Paper/Glass as small slide switches. | new |
| Tools and flags | Cream latching push-buttons in a vertical stack with the label printed beside each, like the scope's trigger keys. Tools interlock (one in); flags (multi, advanced, hide log flags, day/night) latch independently. No browser checkboxes. | new |
| Transport | ▶ ■ stay `DvdTransportKey`. | `dvd-transport-keys.tsx` |
| Writing well | Gunmetal well, white textarea (README), lace border once around the region. | `tracking-day-notes.tsx` |

Type: pixel face (`w95fa`) on plates, keys, CRTs. Three sizes: block names
and the period (largest), keys and pen names, captions and counts.

---

## Motion

One motion per real verb, cut by `prefers-reduced-motion`. Same family as
gems, orbs, and sand.

- **Paint** — cells flicker on and settle to flat color. About 200ms.
- **Erase** — phosphor decay: the block fades through afterglow to unlit
  glass. About 400ms.
- **Scissors** — a bright trace line runs across the cut, then the halves
  part by a pixel.
- **Fill** — a scope-trace sweep down each ticked day.
- **New pen** — its tube strikes on in the rack.

No idle loops.

---

## Phases

Each phase ships alone, passes tests, and leaves the room pleasing.

1. **Check the unknowns.** `WORKING ON THIS NOW`, `15m / 30m / 60m`,
   DETAIL row, Look Hide/View/Tags, `multi`, `advanced`, `☀☾`,
   `Log flags`. Write each one's job into the README. Cut what has none.
2. **Merge duplicates, no new paint.** One Now strip; one selected-pen
   plate; ghost lamps on layer keys (drop the Ghost row); cut the repeated
   day totals row; sunrise label to gutter; Fill as a tool; Show as as a
   knob; unnamed-places drawer. Files: `working-now-strip.tsx`,
   `pen-color-now-strip.tsx`, `pen-palette.tsx`, `superimpose-bar.tsx`,
   `fill-range-control.tsx`, `tracking-tools-tray.tsx`,
   `depth-control.tsx`, `week-grid.tsx`, `tracking-summaries.tsx`.
3. **Three-bay desk.** Rack | screen | instrument column in
   `tracking-desk.tsx` / `TrkChromeStack`; equal-height wells; narrow
   fallback. Check Activity Log, Day Log, Tracking log still sit right in
   the center bay.
4. **Materials.** Dark screen and unlit untracked; period CRT; day meters;
   tube pens; FR4 tree rules; lamp keys; lace around the writing.
   `tracking-chrome.css`, `pen-tray-bg.css`.
5. **Motion.** Strike, decay, cut trace, fill sweep, new-pen strike.
   Reduced-motion tests.
6. **Docs.** README, `DESIGN_STYLE.md` "Placement that already works" row
   for Tracking, screenshot reel.

---

## Open questions

- Dark screen vs the pale Visual dashboard above it: the case stays silver,
  only the screen is dark, so the room still belongs to Home. Confirm by
  mockup before phase 4.
- Do Activity Log, Day Log, and Tracking log also get the dark screen, or
  only the Time Grid? Proposed: only the grid and the week boards.
- Pen colors chosen for a white grid may need a brightness floor on black
  glass. Proposed: no recolor; a minimum lightness only for drawing the
  tube's plasma, never the stored color.
