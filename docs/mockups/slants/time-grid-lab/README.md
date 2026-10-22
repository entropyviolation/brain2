# Time Grid studio

_Last mapped: 2026-10-21_

A Hipgnosis and retrofuturism mockup lab for Home → Tracking → Time Grid. 18 boards across the rule-break dial, plus a parts bin (every control in eight key families), a research page and a shelf of smaller ideas.

Live: https://claude.ai/artifact/K2Sri9GSvwZNzTeyBTCZhu (private).

**Status.** Planned. Nothing here is built in the app. This is an exploration. The polish plan is still [`docs/TRACKING_TIMEGRID_REDESIGN.md`](../../../TRACKING_TIMEGRID_REDESIGN.md).

## Files

- `time-grid-lab.html` is the built page. Open it from a local server (it loads Google Fonts).
- `src/` holds the parts. `build.sh` joins them: `00-head.html` (CSS, key families), `01-body.html`, `02-engine.js` (sample data, one `grid()` engine, control builders), `10`–`50-boards-d*.js` (one file per dial level), `90-main.js` (cards, filters, parts bin, events).
- Edit `src/`, then run `./build.sh`. Do not edit the built file.

## How it works

- All boards read one sample week: Mon Oct 19 (12h 45m) and Tue Oct 20, from the real screenshot. Wed Oct 21 is today with the clock at 12:42 AM, so it is empty. Views with data: Activity, Location, Mood, Screen. The others show the empty state.
- The bench sets span (Day or Week), cell size (day 5/10/15/30, week 15/30/60, as in the app), view, and day. Every board redraws.
- Clear day asks first ("Clears 12h 45m tracked on Mon, Oct 19, 2026"), then offers Undo. It is the confirm from the polish plan, mocked.
- Show the math adds the formulas under the readouts. Board 0C is the full derivation and a cumulative-minutes plot.
- Boards are 1040 px wide and scale to the page. Full size opens one at 1:1.

## Boards

| Dial | Boards |
|---|---|
| 0 | 0A Presence on the plot, 0B DSKY span panel, 0C The math, shown |
| 1 | 1A Storyboard week, 1B Helicorder day, 1C Long exposure, 1D Day Tubes (optional liquid and sand view) |
| 2 | 2A Escalator day, 2B Contact sheet, 2C Tank week, 2D Departures board |
| 3 | 3A LCARS elbow frame, 3B Green screen, 3C Prism and print |
| 4 | 4A Dune field, 4B Enhance, 4C The record, 4D This is a time grid |

Each card states what it keeps, what it breaks, and what data it carries.

## New research this round

Added beside `../hipgnosis/research*.md` and `../retrofuturism/research.md`. Links were searched on 2026-10-21.

- **Helicorders.** A drum recorder prints a day as stacked lines. NCEDC shows one line per hour, USGS 15 minutes per line. https://earthquake.usgs.gov/monitoring/seismograms/about.php, https://ncedc.org/waveformDisplayFAQ.html. Used in 1B.
- **Muybridge and Marey.** Muybridge: a grid of separate negatives. Marey: many exposures on one plate, and a careful graphic designer. https://harvardartmuseums.org/article/just-in-time. Used in 1A, 1C, 2B. No authoritative source on their effect on graphic design turned up; that link is a design argument.
- **Split-flap boards.** Solari boards, 1950s on. https://en.wikipedia.org/wiki/Split-flap_display. Used in 2D.
- **Apollo flight plans.** One shared clock, Ground Elapsed Time. https://www.nasa.gov/history/alsj/a11/a11-fltplan.htm. Shelf idea: a GET readout. Strip chart layouts were not found.
- **Not found.** Braun ET66 and Teenage Engineering design principles returned nothing usable.

## Ideas not given a board

Tool keys as line icons, Clear day as a retoucher's mask, Undo as develop-in, ghost view as a double exposure, sun lines in sky color, the active view named in words, grouped view keys (Mine / Phone), caution lamps for data quality, day summary as liner notes, week as a gatefold, a mission clock, phosphor persistence on date change. Full text is on the page.

## Known limits

- Painting, scissors and fill are not mocked. The tool keys set state only.
- Scroll ∞ shows a note. The infinite strip is not drawn.
- Only the sample week exists. Prev and next in Week view say so.
- Phone width: boards shrink to fit and are small. Use Full size.

## Liquid and sand view

_Last mapped: 2026-10-21._ **Planned.** Board 1D. A decorative, optional view, in the spirit of the other for-fun views in the app. Any single day can be turned into a graduated tube of liquid or sand and turned back to the grid with one key. The mock opens with Mon as sand and Tue as liquid to show it; the intended default for every day is the grid. All grid reverts everything. Layers sort by pen or by time of day (sand settles like sediment). Scale is 0 to 24 h, fill is tracked minutes over 1440. The grid stays the real tracking view and keeps all its function. It came from a comment asking for a lab-software, test-tube feel that meets 2C (Tank week) in the middle.

- `sample-rack.html` is board 1D alone, as its own page. `build-rack.sh` builds it from the same `src/` engine and board file.

_Board 1D and `sample-rack.html` show only the first five view keys (Activity, Location, Mood, Company, Discrete events) for now. Screen time and the three iPhone views are hidden, not removed: `viewKeys(true,5)` in `src/25-boards-d1b.js` and the bench chips in `src/rack-body.html`. Drop the limit to bring them back once their data is plugged in._

## Tube physics

_Last mapped: 2026-10-21._ The contents of the tubes in board 1D and `sample-rack.html` are a real particle simulation, not an animation. It is 2D, run in the tube's own frame, in `src/24-sim.js` (physics) and `src/26-tubeview.js` (drawing, loop, pointer). No three.js: the simulation is a side view, so a canvas fits, and the 3D turn is CSS perspective.

- **Liquid.** Position-based fluids. Density constraint C = rho/rho0 - 1, correction along the spiky kernel gradient, tensile-instability term, XSPH viscosity. Layers differ slightly in density, lowest densest, so a shaken mix separates again.
- **Sand.** Grains pushed apart on overlap, Coulomb friction between them (mu = 0.5, so the angle of repose is about 27 degrees), inelastic.
- **Tube frame.** Tilt theta, rate w and acceleration a come from a spring that follows the pointer. Each particle feels g_body = (g - a)(sin theta, cos theta) - alpha x r - 2 w x v + w^2 r.
- **Interaction.** Hover moves the light across the glass (a sharp highlight, a soft one, a mirrored window reflection on the far side, edge light and a hot spot in the round bottom, all following the pointer), and moving down opens the rim as if you looked from above. The tube itself no longer rotates flat, which read as a card. Drag tilts and shakes it. Letting go springs it back, underdamped, and the contents slosh and settle. A tap nudges it. A tube sleeps when everything has stopped.
- Show the math prints the equations under the board.
- When every day in view is a tube, the paint tools (except Point), flags, Glass/Paper and cell size are hidden, since they only act on the grid. They return as soon as one day is a grid.
- Cost: about 5 ms per frame for a liquid tube and 2.5 ms for a sand tube while awake. Tubes with no tracked time have no particles.
- Limits: tilted tubes extend past their column while dragged. A few grains can perch on the wall in the narrow tube, as in a real jam. Sample week only.
- **Sand coarseness.** A slider in board 1D and the standalone page sets the grain diameter from 0.8 to 8 px (default 3.3). Below about 2.6 px the sand switches to a grain-per-cell automaton (`src/24b-sandca.js`): thousands of real-sized grains, fast enough to run, with slumping that rests at about 22 to 45 degrees and a random jostle when shaken. Above that it is the particle solver, with round balls and Coulomb friction. It applies when you release the slider and the sand pours in again. Liquid ignores it. Added after a comment asking for it.
- **Start.** Liquid starts as neat layers on a hex lattice that relaxes into the tube. Sand falls from the top of the tube across most of its width, in order, so the layers build up flat.
- **Violent shaking.** The tube's tilt rate and shake acceleration are capped, particle speed is capped, and a cohesion term pulls stretched liquid back toward its neighbours, so hard shaking no longer breaks liquid into balls.
- **Locked bulk.** Sand deep in the pile stays put; only the free surface flows. In the particle solver, grains that have been still for a while go to sleep and are fixed in the tube. They wake when the grain beneath leaves, when hit hard, when they become the free surface at a new tilt, or when the tube is shaken hard. In the fine-sand automaton a grain may only move if fewer than about 15 px of sand lie on top of it, so a tilt erodes the pile from the top, layer by layer, and the layers underneath keep their bands. In tests, tilting by 1 rad moved 0 to 12 percent of the bottom half and left the bottom half of the fine sand exactly in place.
- Clear day is hidden when every day in view is a tube. The sand and liquid view is a toy on top of tracking, not a place to edit it.

## Chemistry lab

_Last mapped: 2026-10-22._ Moved out of this folder to [`../../experimental/chemistry-lab/`](../../experimental/chemistry-lab/README.md) so the liquid and sand tubes stay separate from it. It shares `src/24-sim.js` and `src/26-tubeview.js` with this lab.

## Tube shapes, replay, inspect

_Last mapped: 2026-10-22._ **Planned.** Not built in the app. In board 1D and `sample-rack.html`:

- **Ends.** Closed (rounded at both ends, the default) or Open (test tube with a rim). Both keep the same physics ceiling, so nothing spills.
- **Turn all the way round.** Dragging tilts without a limit, so a tube can be turned upside down. On release the angle is wrapped and the tube springs back the short way.
- **Shape.** Tube or Hourglass: two ellipse bulbs meeting at a neck (`makeProfile` in `src/24-sim.js`, used by the physics, the sand automaton, the glass drawing and the clip). The neck is at least 14 px wide, or 2.4 grains.
- **Day replay.** Hourglass with sand and Day span: one grain per tracked minute of the day, coloured by that minute's pen, released at the top when a digital clock (seven-segment, HH:MM) reaches that minute. Minutes with nothing tracked release no grain. Controls are a transport, not a row of buttons: a strip of the day's pens with a playhead you can drag to jump anywhere (the sand up to that minute is already poured in), a round Play/Pause button, a back-to-midnight button, and a speed slider with four detents (60, 30, 15 and 7.5 seconds per hour of the day). Grain size is chosen so the day fills about half the lower bulb. In tests all 460 grains of a sample day passed the neck at grain sizes 2.4 and 3.0.
- **Reset.** Pours everything in again and stands the tubes upright.
- **Point (inspect).** A toggle. Click a grain for its time block: pen, start and end, length, view and day. In a replay the grain is that exact minute. In an ordinary tube the grain stands for about (pen minutes / grains) minutes of one of the pen's blocks. Click a liquid and a long pipette goes in at that point, draws a sample (parcels within about 4 grain diameters), moves to a glass slide, drops it, scans it, and lists the pens detected with percentages and the minutes of each pen the sample represents. Esc closes the cards.
- Cost and limits: the hourglass in Week view is narrow (56 px). Tilted tubes still extend past their column while dragged. The inspect click is mapped through the tube's rotation, but not through the small hover tilt.

## Day Tubes: scopes and v2 engines
_Last mapped: 2026-10-22_

The 1D board is now called **Day Tubes**. Standalone page: `sample-rack.html` (built by `build-rack.sh`).

- **Scope** keys (`S.scope`): Days (one tube per day, the old view), Week (the whole week in one tube), Weeks (four week tubes side by side), Month (four weeks in one tube), Months (three 4-week months side by side). Liquid or Sand is picked with `S.sm`.
- `scopeSpecs()` and `scopeLayers()` in `src/25-boards-d1b.js` build the layers. Capacity is 1440 minutes × days, so fill shows tracked time against all hours. Scale ticks are days (week) or weeks (month). `tube(d,mat,W,Hh,o)` takes the scope spec as `o`.
- Only Oct 19–25 is real data. Other weeks are scaled copies (`wkF`, seeded by week and pen), so they are mock numbers. In a 4-week "month" the grains still link back to real blocks. The inspect card shows the day and date.
- Hourglass replay stays a Days-scope feature. In the scope tubes the hourglass shape shows a static pile.
- Engine keys: Before (classic), After (v2) and Compare, with a wipe slider. v2 is the swirlier liquid (per-particle colour and weight, vorticity) and the grainier sand (grain sizes, shading, sparkle). **Planned**: rolling resistance, soft pile surface, surface-tension curvature.

## Day Tubes: hourglass timer, All views
_Last mapped: 2026-10-22_

- **One clock.** `S.hg.clock` is the replay time in minutes from the start of the period. The loop in `src/26-tubeview.js` advances it once per frame, and it waits while any hourglass still has a grain due. Every sim copies it, so hourglasses side by side stay in sync. The readout shows the clock, so it never runs backwards. Pause freezes it and the panel redraws from `S.hg.clock`, so it keeps the paused time. An earlier glitch came from the Before and After sims both writing the clock. Hourglass timelines now run a single sim.
- **Week and Month replay.** Hourglass plus Sand plus Week or Month runs a timer. One grain stands for `gm` minutes (about 1100 grains for one tube, 450 each in All views; six views, so the tubes are narrower). The clock shows the day, and the week number for a month. Speed is per period: the whole period takes about 24 s at the default.
- **All views.** `S.multi` draws one tube per view type (Activity, Location, Mood, Company, Events) for the chosen scope. Lined-up Weeks or Months are shown as Week or Month. The Location, Mood, Company and Events views have little or no mock data, so some tubes are empty.
- **Hourglass look.** Round bulbs that pinch at the neck (`makeProfile`, hourglass), shaded end caps with the period label, and two silver posts. The tick scale is hidden for hourglasses.
- The Before/After divider line only shows in Compare. The default engine is now After.
- **Planned**: timers for lined-up Weeks and Months, with a per-tube clock.

## Day Tubes: calmer liquid, thin sand stream, Ink
_Last mapped: 2026-10-22_

- **Liquid v2, less clumpy.** Colour now diffuses about eight times faster between neighbouring particles, so small blobs blend out quickly while larger swirls last. The render shades from a blurred copy of the density (`renderLiquid2`, `A2`), so single particles no longer make blotches or random highlights. Opacity is constant, so the liquid is see-through again.
- **Fine sand pour.** Fine sand (`SandCA`) used to rain from a curtain about 70% as wide as the tube. It is now a thin stream (`stw` cells wide) that sways slightly (`tt`), and it takes about 4 s to pour.
- **Ink.** In the bottom row, pick a colour swatch and press **Make denser** (or **Lighter**). It raises the heaviness (`hv`) of the particles near that colour, and a drift term in `stepLiquid` (`inkK`, `hvm2`) moves anything heavier than its smoothed surroundings down (lighter ones up). Pair diffusion of colour and `hv` spreads it. Plain gravity weighting did not work: position-based fluid with equal masses keeps a flat heavy-over-light interface still, so the drift term is what makes it sink. In a headless run a thin heavy layer sank through the bottom layer and settled in about 10 s. It works on After-engine liquid only. **Planned**: drop ink at the pointer instead of recolouring a whole layer.

### Day Tubes: shape, glow, steadier tilt
_Last mapped: 2026-10-22_

- The hourglass is a straight tube for most of each bulb, with a small corner radius and a short funnel to the neck (`makeProfile` in `src/24-sim.js`). Closed tube tops use a flatter corner than the bottom.
- The open-end rim is one faint ellipse. The second ring and most inner outlines are gone.
- Hover tilt and the light strip ease toward a target each frame (`aim`, `tgStep` in `src/26-tubeview.js`). Leaving a tube or a fast flick no longer snaps.
- The picked Ink colour glows in its own saturated colour wherever it is (`renderLiquid2`: a glow field, blurred for a halo). After-engine liquid only.
- The pipette bulb is a matte, squarer shape. A glass veil is drawn over it inside the tube so the tip reads as inside.

### Day Tubes: mixing slider, zero-g, round tops
_Last mapped: 2026-10-22_

- **Mixing** slider (`S.mix`, 0 to 100, default 50) scales how fast neighbouring particles swap colour (`mixK` in `mixV2`, `src/24-sim.js`). 0 never blends. 100 blends about four times faster than the default. Shaking still helps, because it brings different colours into contact.
- **Zero-g** (`S.zg`, Gravity keys in the date row, hidden for hourglass): gravity is off and each particle sits at its own minute on the ruler, held by a soft spring (`placeZG`, `zy` in `24-sim.js`). Fine sand uses the particle branch in this mode, not the cellular one.
- Closed tube tops are now full round, like the bottoms. The liquid's top-edge sheen is mostly removed.
- Fixed a script error (a quote inside the slide card's font string) that stopped every tube from drawing.
