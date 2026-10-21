# Tracking Time Grid: polish plan

Home → Tracking → Time Grid. _Last mapped: 2026-10-20._

**Status.** **Planned.** Nothing here is built. This is a narrow follow-up to
[`TRACKING_REDESIGN.md`](TRACKING_REDESIGN.md), which already shipped the desk
layout and lists the merge of the two Now strips as still open. It comes from a
review of one screenshot against [`DESIGN_STYLE.md`](DESIGN_STYLE.md) and five
stills in `designrefs/`. A first list of ten ideas was cut down after the
review was checked against the code. The cuts and the reasons are below, so
they are not proposed again by accident.

Room behavior is [`components/Home/Tracking/README.md`](../components/Home/Tracking/README.md).

**Rule: break nothing.** No verb, key, tool, pen state or test changes meaning.
Where a phase changes something you can see, it updates the test on purpose.
Redesign of the layout waits on the open questions at the end.

---

## Verified against the code

| Claim | Finding |
|-------|---------|
| Clear day has a confirm | **No.** `clearDay(dk, scope.id)` runs on click (`time-grid.tsx` ~933 and ~1224). |
| The second START is a dead control | **No.** It is disabled until a pen is selected, and its label switches to "Start this pen's clock" (`pen-color-now-strip.tsx` ~313). It is a state. What is unclear is the pair of strips, not the state. |
| The four paint tools share one glyph by mistake | **No.** `ToolKey` renders the same `ToolJewel` in each key, and the caption tells them apart (`tracking-tools-tray.tsx` ~53). A distinct mark per tool is a design choice, not a bug fix. |
| The orange block at 12:40 AM is the now marker | **Not known.** Not traced to its source. |
| The black bar above the grid is a dead instrument | **Not known.** Might be the probe plate (`TrkProbePlate`) or the ribbon. Not traced. |

---

## Phases

### 1. Type floor

Raise the smallest labels (GHOST, VIEW, MIN, TIME / DIV, the tick labels and
the knob legend, all about 9px) to a size that reads at a glance. Keep the
three-size scale from "Type size is the hierarchy". Do not add an engraved
highlight to labels that did not have one. Watch the fold: every label that
grows makes its rail taller, so measure the plot's first visible row before
and after.

### 2. Clear day gets a confirm

Add a confirm step before `clearDay`, using the same Save / Cancel / Exit
pattern family as `lib/unsaved-changes.ts` where it fits, or a small confirm
dialog if it does not. The confirm states a fact: "Clears 1h 26m tracked on
Mon, Oct 19". No "should", no "!". Keep the key beside the readouts for now.
Moving it is a separate question (see open questions). Distance is not safety.
The confirm is.

### 3. Trace the orange marker and the black bar

Find out what each is, in the code and on the running screen. If the orange
block is a stray non-chrome color, move it to the red now-line language
(`trk-time-markers.tsx`) or to the pen's own color. If it is a tracked event,
leave it and label it on hover. If the bar is a ribbon or probe that shows
nothing when empty, give it a caption or hide it when empty ("Dead
instruments").

### 4. Two Now strips

Already listed as open in `TRACKING_REDESIGN.md`. The screenshot shows
"NOW [clean house] START" and then a second field with its own START. Merge
them as that plan says, or label the two jobs. Both states stay: armed
(pen chosen) and idle (no pen). Do not remove the disabled state.

---

## Cut, and why

| Idea | Why it was cut |
|------|----------------|
| Remove zebra rows, keep only 15-minute hairlines | Zebra keeps the eye on a row across a wide plot. Hairlines only help columns. |
| Stipple for empty past hours | A second channel that competes with pen color. Costly to draw on a day grid. Hard to read at low contrast. The gain is mood. |
| Tick ruler, FIG. numerals and a day-overview strip around the plot | More chrome around the plot. Works against the goal of giving the grid the fold. |
| Merge RECENT / A-Z / TREE with HIDE / VIEW / TAGS in the pen rack | Sort and filter are different jobs. Breaks "related controls in one group". |
| Flatten the three-row view-key bay to one row | Likely three groups. Flattening trades discoverability for pixels. See collapsible chrome below. |
| Four new pixel tool marks | The shared jewel is intentional. Revisit only as a design decision, not a fix. |
| Thinner, smaller tab levels 2 and 3 | Conflicts with raising the type floor. Needs a measured pass, not a guess. |

---

## Open questions

- **Drive-time warning in Plan.** _Last mapped: 2026-10-20._ The block editor
  already says when the gap between two addressed blocks is shorter than the
  drive (`only M min fit between the blocks`), using `travelMinutes` and
  `trafficFactor` in `lib/transit-time.ts`. The same check should run over
  planned items: warn when a plan leaves less time than the estimated drive for
  that weekday and hour, and suggest the earliest leave time. Plan polarity
  stays prospective ([`TEMPORAL_POLARITY.md`](TEMPORAL_POLARITY.md)). Not built.

- **Fold.** The plot starts about 800px down a 1216px window. Is the fix a
  collapsible chrome (hide the view-key bay and period rows on demand)? That
  keeps every control and saves the pixels. Measure first.
- **Tab hierarchy.** Three levels of tabs share one key weight. Whether to
  differentiate them is open, and depends on the type-floor result.
- **Clear day placement.** After the confirm ships, decide whether to also
  move it past a rule at the end of the period row.
- **Pen tool marks.** Whether the four paint tools want distinct stamped marks.
  Needs a call from you.
- **Tracked and Of day readouts.** Could share one Dash glass pod
  ([Dash readouts outside the dashboard](DESIGN_STYLE.md#dash)). Not part of the
  first pass.

---

## Order of work

1. Phase 3 first. It is a read, and it settles two guesses.
2. Phase 2, then Phase 1.
3. Phase 4 with the open item in `TRACKING_REDESIGN.md`.
4. Re-open the open questions with the new screenshot in hand.

---

## Candidates from a second list

_Last mapped: 2026-10-20._ Not scheduled. Each needs a look at the running screen first. Taken from a second ten-point review; the rest were dropped or already covered.

- **Name the active view in words.** A readout such as "Viewing: Location · ghost: Activity" in the dark strip under the view keys. Likely the same strip as the unexplained black bar in Phase 3, so settle that first.
- **Group the view keys.** Mine (activity, location, mood, company) and Phone (screen time, calls, texts), split by a hairline and a small plate. Keeps all keys visible, unlike flattening the bay.
- **Empty state for a blank day.** The Screen view already has `ScreenTimeEmptyHint` (`time-grid.tsx` ~936). Check whether the other views need the same hint, stated as a fact, not an instruction.
- **Undo instead of, or beside, a confirm on Clear day.** An undo toast is the other way to make it safe. Pick one with Phase 2. Needs a store-level undo for `clearDay`.
- **Compact row density.** Cell-size keys exist (`cell-size-keys.tsx`). Check whether they already give a denser day before adding an option.
- **Focus rings and hover labels** on icon-only keys. The paint tools already carry `title`s (`tracking-tools-tray.tsx`). Audit the pen-rack mode keys and the gear.
- **Small-label contrast.** Fold into Phase 1: check GHOST, MIN, TRACKED, OF DAY and the hour column against AA while raising size.

Dropped: making the START buttons "win" (the disabled state is deliberate, see Phase 4), an 8px spacing sweep (low value alone), and dimming the side panels for focus (conflicts with one color family and the instrument-column design).
