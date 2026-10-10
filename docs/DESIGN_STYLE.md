# Brain2 design style

This file is how a screen is judged. Product features live in the spec mapping.
Major redesigns are planned. The three layers below are the order a change is
read in. Motif pictures are a material in the palette. They are not the first
screen. Inside layout, [the screen stays pleasing](#the-screen-stays-pleasing)
wins when a local note would make it ugly.

A room may be much more magical, esoteric, and beautiful in how it moves.
The house already has three of these, and wants more of this kind of thing:

- **Willpower gems and their physics** on Home → Habits. The plate is
  `components/Home/Habits/willpower-gems.tsx`, on the control panel
  `habits-control-panel.tsx`. The integrator is `lib/willpower-physics.ts`.
  The week’s stones come from `lib/willpower-stones.ts`.
- **Orbs in Lists.** Photographs in `public/orbs-removebackground/`, named by
  `lib/orbs-manifest.ts`, placed by `components/Lists/views/FolderViewIcons.tsx`,
  picked in `components/Icons/OrbPicker.tsx` (`OrbPickerDialog`).
- **Collapsing sand** on the Habit detail window. Add/Edit Habit
  (`components/Home/Habits/daily-task-form-dialog.tsx`, `data-ui-name="Habit form"`)
  closes through `useWindowSandClose` / `WindowSandClose`
  (`components/ui/window-sand-close.tsx`). The grains are
  `components/ui/window-sand-sim.ts`.

Person birthday cakes join that family later. The plaque on a person
(`components/People/person-detail.tsx`) ships now as a drawn pixel cake:
milled silver, a phosphor candle, the same machine as the fascia. The cake
will later be a photograph chosen from a folder of cute PNGs, the same idea
as willpower gemstones (`public/gems-removebackground/`) and list orbs
(`public/orbs-removebackground/`). That folder is not built in this step,
and the plaque does not load images.

The feel to add, through the whole house, is an old Nintendo DSi: pixel type,
hard pixel edges, and small glowing indicator lights. The retrofuturistic,
esoteric-technology vibe is the direction of the redesigns. These docs should
help that, not freeze a plainer costume.

[`DESIGN_REFS.md`](DESIGN_REFS.md) is the stills. [`UI_NEXT.md`](UI_NEXT.md) is
the open layout work.

---

## Failures

Four bugs. A screen that does one of these is wrong even when it is pretty.
They are bugs, not a style.

1. **Hidden doors.** Do not hide working chrome behind a File / Capture /
   Review menu, or behind a popover that swallows doors that are the chrome.
   The header’s capture, review, and system keys are the machine. A menu that
   replaces them is the bug.

2. **Card restack.** Do not restack a working instrument into floating white
   cards. Related numbers and tools stay one instrument. A white card on the
   desktop for each sibling stat is the bug.

3. **Sanded rooms.** Do not sand a module’s own interior into the shared kit.
   An installed room may keep its own furniture. Pulling that interior into
   `components/ui/` so two rooms match is the bug. Its records stay Items
   ([`MODULE_PLATFORM.md`](MODULE_PLATFORM.md)).

4. **Fake quotations.** Captions that teach Korzybski, Alan Watts, and Jung
   are welcome. The failure is unsourced, invented, or paraphrased-as-quote
   content. A quote or a teaching on screen must be real and verified, and it
   must carry a source. Do not avoid philosophy. Do not invent a line and set
   it in quotation marks.

A status line that reports an event, a date, and a count is still a good voice
for a count (“Pushed 9 times since Jul 3”). That voice is not a ban on a
teaching caption. The note on the count voice is
[`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md).

---

## Layout

Placement, before materials. These rules are how someone lays out a screen.
They are not a lecture on metal or phosphor.

<a id="the-screen-stays-pleasing"></a>

### The screen stays pleasing

Pleasingness is a requirement. A screen that is ugly is wrong even when a
room README, a packing comment, or a feature line asked for the cram, the
clip, or the wrap. That local note loses. Simplicity stays with the
requirement: do not add chrome to look busy.

**Gestalt.** Related controls sit together (proximity). Peers look like one
set (similarity). A row or a column is one path (continuity). A group reads
as finished (closure). One frame holds one job (common region). The simplest
figure that still tells the truth wins (prägnanz). Peer controls share one
baseline and one row when the container has room.

**Order.** Gaps inside one group are even. Edges that should match, match.
A frame and the panels inside it are one color family. Do not put a foreign
border color on the outside of a panel.

**No orphan wrap.** A row of peer buttons does not wrap as three with one
left alone underneath when a fourth fits on the first row, or when two and
two would be even. Tracking did this: Time Grid, Activity Log, and Day Log
on the first row, Tracking log alone on the second. That wrap is wrong.

**No clipped chrome.** A button bar or a submit control inside a bordered
panel needs inset padding on all four sides. Overflow must not shave the top
bevel or the outer buttons. Clipped toolbars have shown up in several
places. The day summary well used to be one: LIST, BULK, LATEST, COPY, and SUBMIT NOTE. That log is now a single retrospective textarea, so those keys are gone. When
you see a clipped toolbar, fix the padding first.

**Type.** The three sizes below still hold. The smallest hint has to be
readable at a glance. Do not specify a size so small the hint fails. A 9px
nameplate is a short engraved word on the mill. It is not a size for a
sentence. Collapsed overview cards left that size: Home tiles and Modules
catalog cards set their words in Karla, about 2px larger (plates 13px,
footers 11px). The date plate, Home panels, and opened instruments stay on
the pixel face.

**Dead instruments.** Hide a control that does not apply to the current
view. Leaving it up as a dead instrument is the miss. A door that still
works stays visible (failure 1).

**Clocks and popovers.** A clock and a popover belong to the instrument
panel: beveled chrome, phosphor for the selection. The closed field accepts
a typed time (`8:00 AM`, `16:02`, `1pm`); blur or Enter stores `HH:MM`. A
clock mark opens the panel. Now lives inside that panel. The popup receives
its own clicks inside a dialog, above the dialog and its backdrop. An armed
hour or minute holds the page still so the wheel steps that drum. The analog
face is the cream ceramic clock — rim and metal 12, 3, 6, and 9 — with ornate
silver hands on a small brass cap. Ceramic is the default dial. A small
control switches center paintings, shuffles them, or hides and restores one
for this browser. Confirm writes the drums. Cancel, Escape, and a click
outside close without changing the field. A double-clicked drum takes a typed
part. They are not the platform's flat blue picker.

### One job per region

Name the regions before decorating them. Each region answers one question:
where am I, what can I do, what am I looking at, what just happened.

A header does not also hold the document. A document well does not also hold
the room’s settings. A status strip reports counts; it does not grow a second
toolbar. A sidebar that is “things I can drop onto the document” does not
also become a settings form.

If a region has two jobs, split it. If two regions have the same job, they
are one region.

### Reading order

One path, top to bottom and left to right: identity, then the period or the
mode, then the work, then the utilities. The verb that opened the screen sits
on that path. The eye should not have to hunt for it.

The current day or current period is a state of a key or a column in that
same row — sunken, marked, obvious. It is not a second navigator floating
somewhere else, and it is not a balloon that changes the row’s height.

When a global date and a panel date can disagree, they are one cursor, or
they are labeled as two different jobs. Two unlabeled date bars are a broken
reading order.

Urgent content sits on the path. A queue with a count is not tucked behind a
disclosure while empty counters take the fold. The open task is in
[`UI_NEXT.md`](UI_NEXT.md).

### Shared alignment edges

Sibling controls share one left edge, one top edge, or one baseline. A row of
keys shares one height. A column of labels shares one width so the values
line up. Nested regions align to the parent’s content edge, not to a new
center. Do not center one control in a row of left-aligned siblings.

Sibling wells of one instrument share one height. Leftover width becomes
another module of that same height, or the row wraps. Do not stretch one pane
(`fr` plus `align-items: stretch`) so it eats the row. The Home top strip
already does the equal-height version (`home-overview.tsx`, `--home-tile-h`).
That wrap is for equal-height wells that do not fit. It is not permission
for an orphan button
([no orphan wrap](#the-screen-stays-pleasing)).

### Related controls in one group

Controls that change the same object sit in one group, in the order the hand
uses them. Sort sits with the view it sorts. A rocker sits with its sibling
rockers. Previous / next / today sit on the period they move. A destructive
action stays in that group, separated by space or a rule, still visible.

Do not split one verb across a toolbar, a popover, and a footer. Do not give
one group two different alignments. A control that does not apply to this
view is hidden, not left on the panel as a dead instrument.

Header, when the window is wide: title at the left, period or mode in the
center, utilities at the right — one strip. Stack that strip only when the
window is actually a phone. “Today” is a pressed state in the period group,
not a larger control.

### Empty space only as a pause

Leave empty space where the eye rests between regions: after the header,
before the document, between two different jobs. Inside one group, pack tight,
about 4–8px. Those gaps stay even. The pack is not a reason to drop the
inset that keeps a bevel intact. Do not open a wide gap between every
sibling, and do not crush two regions into one strip so the pause disappears.

Reserved empty furniture may stay when it is the place work will land — an
empty bucket, an empty queue, a column that is today’s and happens to be
clear. That space is a region with a job. It is not a hole, and it is not a
reason to collapse the region away.

### Type size is the hierarchy

Three sizes are enough.

- The largest type is the thing the region is for: the title, the value, the
  name.
- The next size is the control the hand uses.
- The smallest size is the caption, the count, and the basis of an estimate.

Sibling labels in one group share one size. Do not set a hint larger than the
value it explains. Do not give every label the same size and weight and hope
color will sort them. The smallest hint is still readable at a glance. A
size so small the hint fails is the wrong size.

Precious marks stay small, about 12–16px, so they do not become a second
caption. A pressable jewel may be a little larger (the Habits row edit stone
is 18px) and still not a toolbar icon.

### Laying out a room

1. Name each region and its one job.
2. Put the regions in one reading order.
3. Align siblings to one edge, one height, and one baseline. Peer buttons
   stay one row when they fit. If they must break, break even.
4. Put related controls in one group, in hand order. Hide a control that
   does not apply to this view.
5. Put a pause only between regions. Inside a group, keep the gaps even,
   and inset a button bar on all four sides.
6. Set the three type sizes. The smallest hint is still readable at a glance.
7. Then choose materials from the palette, or invent furniture. Invention is
   allowed when the layout above holds, including
   [the screen stays pleasing](#the-screen-stays-pleasing), and the four
   failures are avoided.

### Placement that already works

These are examples of where things sit. They are not furniture to clone onto
the next screen.

| Room | Regions | Where |
|------|---------|--------|
| Habits Daily | The grid is the document. One column holds the gauges, sort, rockers, and the willpower plate. | `habits-control-panel.tsx`, `.hab-desk` |
| Lists | Tree, desktop, inspector. Toolbar keys are grouped. The two status counts are labeled (this folder / tree). | `components/Lists/enhanced-list-view.tsx` |
| Home top strip | Date, review, points, and today’s progress are one instrument on all five Home tabs. Leftover width is equal-height squares. | `home-overview.tsx`, `home-chrome.css` |

### Dialogs

One body. The actions are one row at the foot, in the order of the decision.
One size ladder is enough: small, medium, large. The list picker on item
detail is secondary to the item body.

A dirty editor does not close as if it were clean. Cancel, close, ×, and
overlay-click prompt when the draft differs from the open baseline: **Save
changes**, **Cancel** (stay), **Exit without saving**. A clean editor closes
at once. Use `lib/unsaved-changes.ts` and
`components/ui/unsaved-changes-guard.tsx`. Auto-saving surfaces (Docs,
Tracking view prefs, global Settings fields) stay clean and close at once.

### Numbers the person did not type

A duration, a clock, or a time the app filled in is marked: a leading `~` and
a dashed amber **est.** chip. The tooltip states the basis in plain words
(“4 pages × 10 min each”) and the chip can confirm or correct it. The same
mark anywhere a derived value shows. Implementation:
`lib/estimated-values.ts`,
`components/Home/ToDo/CompletionTimeLine.tsx`.

The packing half of the old depth notes — one instrument, tight gaps inside a
group, equal-height siblings, one header strip — is this section. Nested
metal, hairlines, and phosphor are [Depth](#depth--spacing), below.

---

## Palette

Not a quota. These are materials a room **may** use. Home → Habits and Lists
are rooms that turned out well. They are not templates to clone onto the next
screen. A new room may invent its own furniture when the layout rules hold
and the four failures are avoided.

The direction is more magic, not less. More esoteric technology, more pixel,
more small lights, more interaction that is beautiful because it moves.
Object chrome, the milled fascia, phosphor, nested depth, and the willpower
plate are materials and examples. They are not a rule that the next room must
wear them.

### Magical interaction

Make more interactions in the family of the three already named at the top of
this file.

- Willpower gems: a photographed crystal in a chrome well; one habit gem per
  weekday completion; plate-click stirs a real integrator; grabbing a gem does
  not press the well. Detail:
  [Willpower gems](#willpower-gems--example-of-perfect-design).
- Lists orbs: personal photographed objects on velvet, dragged free, swept
  into a grid by auto-organize (`FolderViewIcons.tsx`,
  `lib/lists-icon-grid.ts`). The sweep can leave a trace. The objects are the
  beauty.
- Habit-form sand: the window becomes lit grains, heaps, then blows away
  (`useWindowSandClose`, about 4.8s). Reduced motion snaps shut.

A motion earns its place by being the verb: organize, open, drag, close,
complete. `prefers-reduced-motion` cuts to the end state. A looping sticker
on a white card is not this family. A rare dissolve, melt, or flock on a real
verb is.

### DSi pixel and lights

The wanted handheld feel is an old Nintendo DSi: chunky pixel type, hard pixel
edges, and small glowing indicator lights. The pixel face already in the app
is `public/fonts/w95fa.woff`. It is a Windows pixel font, not a DSi font file.
Use it as pixel type. The DSi part still to push is the lamp: a few pixels of
glow that say power, mode, or on.

Lights already in the house, to make more of:

- Yes/No cells: `HabitLedLamp` in `components/Home/Habits/habit-led-lamp.tsx`.
  Square plate, circular well, a visible die. **Small LEDs** (default on)
  keeps them at 15px.
- Round power lamps on fascia keys (a radial phosphor in a gunmetal ring).
  Active mode is that lamp plus a CRT well, not a sunken gray folder tab.
- The glass percent tube `percent-led-bar.tsx`, and the numeric luminaire
  `percent-led.tsx` when the loading bar is off.
- Grade meters: `noble-gas-tube.tsx` — glass finger-tubes, plasma length is
  the percent.

The stills do not include a DSi. What they do cover, and what they do not, is
in [`DESIGN_REFS.md`](DESIGN_REFS.md#gaps).

### Retrofuturistic esoteric technology

The house is a machine that is also an esoteric instrument: racks with
something living wired into them, stones set where solder would be, pixel
pointers that become a figure, a scrying glass, voltage drawn like an
engraving. That is the vibe of the redesigns. Win95 bevels
(`app/win95.css`) are one ancestor inside it — a quote of inset, navy focus,
and pixel type — not the costume every new room must keep, and not a ban on
leaving it.

<a id="chrome-and-black-mirror"></a>

### Object chrome

A material for a precious object. The willpower plate is the worked example,
not a piece to stamp onto every control.

- **Rim:** photoreal silver chrome. Stacked silver / pewter rings, a specular
  highlight on the top arc, a raised outer bevel. Milled, not a 1px outline
  on a gray pill.
- **Well:** black lacquer / black mirror. A dark radial glass. The object
  sits *in* a cavity.
- **Object:** a photograph (crystal, gem, orb), not a generic line icon.
  Y-sort and physics may treat it as a solid in the well.

Use this when the point of the control is the object. A room that is not
showing a jewel does not owe the plate a twin.

<a id="milled-fascia"></a>

### Milled fascia

A material for a row of instruments, when the room wants machined keys. Not
the required start for every new tab.

| Piece | What it is |
|-------|------------|
| **Bay** | Brushed mill (1px horizontal hairlines) on cool silver. Outer `#5c6064` stroke, white top lip, inset pewter, a soft inner shadow. Radius 2–3px. |
| **Nameplate** | 9–12px, weight 700, tracking ~0.14em, uppercase, ink `#2a2c2e`, engraved highlight `0 1px 0 rgba(255,255,255,0.78)`. A round power lamp may lead the label. Home overview plates and Modules catalog cards are the exception: Karla at 13px, because the 9px pixel plate was too small to read. |
| **CRT** | The value in black glass (`#040a08`–`#070c0a`), a faint phosphor bloom at the top, a gunmetal ring. One green: `--hab-crt-green` (`#7dffc4`) and `--hab-crt-glow`. Pad the glyphs (about 8px 14px). Do not paint phosphor straight on the mill. |
| **Label** | A padded silver chip (about 6px 9px), two lines at most. Sibling labels share one height. |
| **Key** | Raised metal: specular top lip, mill, pressed foot. Sibling keys share the bay equally. Active mode is the CRT plus the power lamp. |

A title-bar close key is an opaque raised metal key: solid `--chrome-face`
under the fascia key face, specular top lip, inset pressed foot. The painted
face and the hit target are the same 22px square (the ring is the border, so
a shadow foot cannot hang off the bottom and make the key taller than it is
wide). The × is a geometric 10px mark centered on that square — a font glyph’s
side bearings sit off the optical center. Every dialog that uses the house
title bar uses this key (`.b2-close-key` in `app/win95.css`). It sits in the
title bar. It is not a transparent pip, and it is not a smaller off-center
mark. The generic button hairline is only a lip — it must not be the close
key’s only paint, or the title bar shows through.

Home overview tiles (`home-chrome.css`, one rule shared with `.mod95` catalog
cards) paint that copy in Karla (`--font-karla` from `app/layout.tsx`), not
`w95fa`. Nameplates are 13px, footers and the old 9px labels are 11px, secondary
lines that were 10px are 12px, and CRT values the Habits sheet had pinned at
18px are 20px. Award stays 22px. The weather degree is 24px. Colors, bevels,
and phosphor stay. Detail handhelds, the date plate, and Home panels stay on
the pixel face.

Padding is part of the material. A nameplate, a CRT, and a label each need
air inside the bay so type does not touch the ring. A milled group keeps
horizontal inset so the first and last key are not clipped by the group edge.
A button bar or a submit row inside a bordered panel needs that inset on all
four sides
([no clipped chrome](#the-screen-stays-pleasing)). Gaps between sibling bays
stay near the header (about 8–14px).

`app/win95.css` `:root` exposes `--fascia-*` plus the CRT greens. Unskinned
dialogs, menus, buttons, and nested tabs already inherit that face. Module
CSS imported after `win95.css` still wins. Portaled private skins (`.set95`,
`.inbox-dialog`, `.id95`, `.hab-grade-sheet`, `.hpp95`, `.ops95-dialog`, …)
stay on their own faces. The face token is `--chrome-face`. Settings →
Window gray walks that face along specific computer-chrome grays from the
design refs (`lib/chrome-patina.ts`). It is a piecewise path through those
hexes. It is not a red/blue filter on an arbitrary gray.

Warmth, mix 0 → 100:

| Mix | Face | Where it was found |
|----:|------|--------------------|
| 0 | `#999683` | IRIX cattle, `designrefs/designref1.jpg` (3718 px). Warmest olive furniture. |
| 8 | `#999686` | Warmer olive on that same walk. |
| 16 | `#9a9889` | TENO console, `designrefs/5d58e7b46cf9bd493eb09f761340fb17.jpg` (2827 px). |
| 32 | `#c0c1b9` | Pocket PC silver, `designrefs/36bc1715c629f42e163d54abe8741ac6.jpg` (3641 px). |
| 40 | `#c0bfba` | Same Pocket PC (492 px) and Tek 465B `a898e04c534aeed3017938c701efdb2f.jpg` (39 px). |
| 50 | `#c0c0c0` | Display Properties `60d7202cb958e11734ce0567eb382868.jpg` (716520 px), Win95 MDI, and `app/win95.css`. Classic. |
| 75 | `#b7bcbf` | Cooler gray in the flower-CRT / gadget-wall family. |
| 100 | `#b8bbc0` | Flower CRTs `9d225800a3f631bc7559c83d11f1aaa2.jpg` (435 px). Cooler pole. |

Mix 50 is the **default** preset: the chrome colors measured in the app
before this path replaced the old warmth endpoints. **Default** writes those
tokens back and pauses, the same way Bouba/Kiki Default restores today’s
radii. Sheen, shadow, and highlight at each knot are the companions sampled
with that gray (IRIX and TENO olive ladders, the Pocket PC silver ladder, the
flower-CRT / gadget-wall cool ladder). Between knots the family interpolates
only from one of those palettes to the next. Ink `#404040` / `#3a3a3a` stays
the stored ink. A new room is not required to stay inside that gray. Habits
metal still must not freeze on `#c5c3bc`.

Settings → Bouba/Kiki is an experimental corner mix on shared radius tokens
(`lib/corner-mix.ts`). The **default** preset is the radii measured before
the mix (`--radius` `0.75rem`, fascia `2px` / `3px`, square `0`, the other
literals counted there, and the later GradSearch `11px` / `20px`). Mix 50
restores them and can sit paused. Fields, buttons, selects, windows,
dialogs, list / habit / plan / tracking / settings / header chrome, Tidy,
and the GradSearch shadow root follow those tokens. Tailwind `rounded-none`
is square chrome via `--r-0`. Circles, pills, elliptical lamps, and
non-chrome art (clock paintings, SVG animals, the noble-gas tube drawing)
stay put. CRT green stays put. Bay copy that says “Radius 2–3px” is that
snapshot, not a ban on the mix.

A timed manual shift, on warmth or on corners, previews only inside the
Settings panel. The panel’s own faces, fields, buttons, and edges move
through the in-between values. The rest of the app keeps the previous gray
or corners until that interval ends, then takes the new state and the drift
speed resumes. Instant applies to the whole app immediately. Pause holds.
`prefers-reduced-motion` finishes a timed shift at once, and that end state
is the whole app, because there is no in-between to preview.

Opening another popup does not change that speed, does not start a shift,
and does not ease the gray. Dialogs use `duration-200` for their enter/exit
animation. That utility also sets a transition duration, and the initial
transition property is `all`, so a dialog would fade `--chrome-face` on
mount and on every later token write. `app/win95.css` sets
`transition-property: none` on dialogs. Drift stays on the clock. Only the
Settings dialog, and only while a timed preview is running
(`.set95-drift-preview`), eases its own face between samples.

### Phosphor

One green for CRT values: `--hab-crt-green: #7dffc4`, glow
`--hab-crt-glow`. Readable. Overlay off by default (`.hab-crt`). Phosphor on
a trace is allowed to be the other green, `#3dff8a`, on Analytics line traces
only — not a dark CRT canvas, and not on metal readout values. Do not use CRT
grain as a chart that pretends the sample is larger than it is. A clock or a
popover uses this instrument for its selection: beveled chrome, phosphor on
the chosen drum. The closed field takes a typed time. Now is inside the
popup, and the popup receives its own clicks inside a dialog. The analog
face is the cream ceramic clock with ornate silver hands. Ceramic is the
default dial; other paintings switch in the center. Confirm writes the drums.
Cancel, Escape, and a click outside leave the field. A double-clicked
drum takes a typed part. An armed hour or minute keeps the page from
scrolling so the wheel steps that drum. It does not use the platform's flat
blue picker.

<a id="depth--spacing"></a>

### Depth

Nested metal is one way to build a region. The outer case is raised
(`--w95-raised`). Inside it, a sunken well (`--w95-sunken`) holds the document
or the readout. Controls on a sunken strip are raised again. Fields use
`--w95-field`. That stack is depth. A soft drop-shadow card is the floating
card in failure 2.

Fine grooves, pinstripes, engraved rules, and inset hairlines on furniture
are welcome. They are texture on the object, not clutter to sand off. Steal
FR4 traces as engraved rules, not as a circuit-board photograph pasted on the
grid.

Ink on a light surface stays dark (`#111`, or a true muted gray). Do not
inherit the desktop’s white muted text onto a pearl or gray field. Text-field
focus is navy `#000080` on every input (`win95.css` / `--ring`). A frame and
the panels inside it stay one color family. A foreign border on the outside
of a panel is the wrong paint.

The app page’s gutters stay the desktop field (`pcb-backdrop`; teal by
default). The BRAIN2 title bar spans the window. A room’s own field meets
those gutters. It does not paint a full-bleed sheet over the title
(`margin-left: calc(50% - 50vw)` was the white shifting block).

Where the mill already is, and which surfaces are still flatter, is
[Fascia rollout](#fascia-rollout). Using the mill there is a choice. Inventing
furniture is the other choice.

<a id="willpower-gems--example-of-perfect-design"></a>

### Willpower gems — example of perfect design

An interaction that turned out well. More of this kind of motion. Not a plate
to copy onto every jewel, and not a Habits skin to paste onto Plan.

The plate is a photoreal chrome and black-mirror oval
(`willpower-gems.tsx`). **Willpower gems** is the face. It is a real
push-button (`data-no95`, so the global bevel cannot flatten it). Press sinks
the face (`.is-pressed:not(.is-holding)` only — never CSS `:active`, so a gem
drag cannot fake a press) and stirs: a visible hop plus a short whirl. Each
stir uses a fresh seed.

- **Week satellites.** Each completion this week adds one copy of that habit’s
  photographed gem around the central crystal (`lib/willpower-stones.ts`,
  derived from completions). Undo that day and that copy leaves. At the
  compact panel, satellites stay about 12px. Physics enlarges the same
  handful on a larger oval. Gems do not tunnel through the crystal (solid XY
  cylinder). Stones behind the PNG paint behind it (Y-sort).
- **Invert.** The far-left row gem inverts while that habit has any completion
  on the visible week. Invert leaves when the last hit this week is undone.
- **Grab is not a press.** Pointer-down on a satellite, including through
  transparent PNG holes, does not fire the plate button. Grab lifts z; release
  keeps that height and the pointer velocity. Airborne gems skip the oval
  fence until they land. Gems paint outside the rim (`overflow: visible`).
  The photographed shape stays honest (no squash, no drop-shadow).
- **Physics lab.** Opens a wider window with a live twin plate on the same
  integrator (`lib/willpower-physics.ts`), mapped onto the larger oval. CRT
  wells name the step’s laws. Knobs are painted thumbs over a native range.
  The dialog does not spin at 60fps while idle. Edits persist until Reset.
  The crystal is a solid and the PNG is the occluder.
- **Settings changes the crystal.** Upload, knock-out, and restore live in
  Habits Settings (`WillpowerGemsSettingsField`). The plate is not a file
  picker.

The control column stays compact (196px). Open Physics to enlarge the plate.
Do not auto-grow the oval to hold a crowded Sunday. Later ideas stay in
[`components/Home/Habits/README.md`](../components/Home/Habits/README.md).

<a id="house-motifs"></a>

### House motifs

Three pictures are available materials. Use one when the region’s job is
that picture. Invent another picture when the layout holds and the four
failures are avoided.

| Picture | It can mean | Already nearby |
|---------|-------------|----------------|
| **Brain** | Memory, identity, the mind of the house. A hemisphere, folds, or copper traces in the shape of cortex. A photographed brain or an engraving. A face drawn on it is a mascot. | **BRAIN2** caption (`AppHeader`); Inbox brain key |
| **Light bulb** | A spark: capture, an idea, something just noticed. Glass, filament, screw base, a glow inside the glass. A flat yellow glyph is not this object. | Header pin-bar capture (`.hpp95`) |
| **Graph nodes** | Items, lists, folders, pens, or tasks that relate. Nodes (pads, jewels, small orbs) joined by traces or patch cables. Density is welcome when the edges stay traceable. | Scheduler Dependencies (`components/Scheduler/DependencyGraph.tsx`); counts-as chains; folder relations |

A motif may be engraved, phosphor-lit, or a photograph in a chrome well. It
sits beside the room’s own furniture. The frame does not become brain
wallpaper, a bulb theme, or a chart-library graph.

<a id="look-at-habits--how-to-extend"></a>

### Habits Daily — a room that turned out well

Open it to see one interior that went far. Do not clone `.hab95` onto the
next room. Do not extract its chrome into `components/ui/`.

| What is there | Where |
|---------------|--------|
| Control panel: gauges, sort, rockers, willpower plate in one column | `habits-control-panel.tsx`, `.hab-desk` |
| Cockpit rockers, metal sort plate, panel lamps, glass percent tube, noble-gas tubes | `cockpit-switch.tsx`, `habit-sort-control.tsx`, `habit-led-lamp.tsx`, `percent-led-bar.tsx`, `noble-gas-tube.tsx` |
| Willpower gems | [above](#willpower-gems--example-of-perfect-design) |
| CRT phosphor | `habit-chrome.css` |
| Period keys Daily / Weekly / Monthly above the sheet; active key is CRT plus a power lamp | `habit-chrome.css` |
| Day view: today plus the weekly % column. Heatmap: a light sidebar, not a dark board | `task-grid.tsx` |
| Sand close on Add/Edit Habit | `daily-task-form-dialog.tsx` |

Yes/No cells are the panel lamps. **Small LEDs** default on (15px); off lets
the lamp fill the cell. The loading bar defaults on (a thin glass tube plus a `%`). A background click, Escape, or the skip × leaves the Add/Edit Habit sand close immediately.
Sort sits on the control bar above the grid. Grade plasma hues are set
on each grade’s sheet (`.hab-grade-sheet`). Defaults: week-grade green
`#508b51`, perfect-output navy `#25366a`, percent LED `#7e14ff`. Today’s
column is a solid mint fill. Furniture metal is `--chrome-face` /
`--hab-metal`. The packing notes for this room stay in
[`components/Home/Habits/README.md`](../components/Home/Habits/README.md).

### Lists — a room that turned out well

A cabinet you can file things in. The Explorer verbs stay. The frame may be
milled. The interior is velvet and orbs, and it does not have to become a
Habits console.

- Folder **Icons**: crushed velvet (`public/newvelv.jpg`, `.fm-desktop.velvet`).
  Lists are orbs. Folders are photographed cut-outs (`folderFor` in
  `lib/folders-manifest.ts`). Labels stay utilitarian. The objects carry the
  beauty.
- **Auto-organize** sweeps icons into a grid (`FolderViewIcons.tsx`,
  `lib/lists-icon-grid.ts`). Freeform drag, an orb gallery, and uploads with
  knocked-out backgrounds (`lib/remove-background.ts`) are the same family.
- Inside a list, Default and Icons use the same contract: personal orbs on a
  working surface. A checklist still shows its checkbox.
- Frame skin: `components/Lists/filemanager98.css` (`.fm98`). Toolbar keys
  keep a reserved lamp gutter so the active lamp never shoves the label.

### Other rooms that invented their own furniture

These stay themselves. A redesign of a different room does not sand them to
match, and does not sand them into one shared kit.

- **Plan.** Milled frame (`.plan95`, `plan-chrome.css`) and opalescent event
  chips (mint / lilac / teal, user `CalendarEvent.color`, default `#8cd4a5`).
  The chips are the room’s objects. Cells breathe. Period nav is a nameplate
  with metal previous / next / today keys.
- **Analytics.** Range and the left index may use the mill
  (`analytics-chrome.css`). Every canvas stays a light instrument studio:
  Karla, ink `#000` on face gray, white plot wells, phosphor `#3dff8a` on
  traces only. Title bar and status bar keep the room in the house. Item
  Types stays the library surface; Settings still edits types. Tooltips say
  what a control or a blank cell means (`ANALYTICS_TAB_HELP` and per-control
  titles). Match that density of explanation when a control would otherwise
  leave someone guessing.
- **Tracking.** Milled frame, plain steel pen well, white plot. The red now
  line and the gray sunrise / sunset lines stay (`trk-time-markers.tsx`).
  Block editors open on the click.
- **Installed modules.** Tidy, Film DNA, and the other rooms may keep their
  own stylesheets, overlays, and motion. Failure 3. Shared components are for
  a shared verb (a period, a stroke, a confirm), not to make two rooms match.

<a id="fascia-rollout"></a>

### Where the mill already is

A catalog, not a rollout order. A surface on this list used the milled fascia.
A surface that is still flat may take the mill or invent furniture.

| Surface | Where |
|---------|--------|
| Unskinned dialogs, menus, buttons, nested tabs | `app/win95.css` |
| App tabs | `app/win95.css` |
| Pinned header bays | `components/shell-chrome.css` |
| Home date plate and overview tiles | `components/Home/home-chrome.css` |
| Home → Plan | `components/Home/Plan/plan-chrome.css` |
| Home → Tracking | `components/Home/Tracking/tracking-chrome.css` |
| Home → To Do | `components/Home/ToDo/todo-chrome.css` |
| Home → Goals | `components/Home/Goals/goals-chrome.css` |
| Home → Habits frame | `components/Home/Habits/habit-chrome.css` |
| Operations | `components/Operations/operations-chrome.css` |
| Settings | `components/Settings/settings-chrome.css` (`.set95`) |
| Lists settings | Same `.set95` fascia; navigator well in `components/Lists/lists-settings.css` |
| Inbox | `components/inbox.css` (`.inbox-dialog`) |
| Header pin-bar popups | `components/header-popup-chrome.css` (`.hpp95`) |
| Item detail | `components/ItemDetail/item-detail-chrome.css` |
| Lists Explorer frame | `components/Lists/filemanager98.css` (velvet and orbs stay) |
| Docs outer chrome | `components/Docs/docs.css` (white paper stays) |
| Week grade / Perfect output sheets | `.hab-grade-sheet` in `habit-chrome.css` |
| Analytics range and left index | `components/Analytics/analytics-chrome.css` |
| Scheduler frame | `components/Scheduler/scheduler-chrome.css` (`.sch95`) |
| Search palette | `components/Search/search-chrome.css` (`.b2-search`) |

Still flatter, as of this note: Modules catalog chrome
(`components/Modules/modules-chrome.css` — phosphor token there is `#3dff8a`),
the completion popup (`components/Completion/CompletionDialog.tsx`), and some bare
`components/ui/dialog.tsx` sheets. Module interiors stay their own. Friend
instrument and Needs Attention are already on a machine face.

<a id="easy-alignments"></a>
<a id="easy-alignments-not-started"></a>

### More interaction, some of it shipped

- **Sand close (shipped, opt-in).** Add/Edit Habit crumbles from the title-bar
  × into lit grains, heaps, then blows off (`useWindowSandClose`). Any other
  captioned window can use the same hook. Reduced motion snaps shut.
- **App tabs (shipped).** One brushed bay, equal keys, the active key a CRT
  with a round power lamp (`win95.css`). Home’s five sub-tabs use the same
  bay (`data-ui-name="Home tabs"`).
- **Lists auto-organize.** The sweep may leave a fading trace of snowflakes
  or cursor-pixels. Same grid tool (`FolderViewIcons.tsx`).
- **Today’s friend.** Opening the bubble may give that well a short power-on.
  Contained to the well.
- **Header keys.** The Friend / Review / System / Capture strip may become
  more like a held machine — pixel lamps, milled wells — without hiding the
  doors. Failure 1.

---

## Implementation map

| Concern | Where it lives |
|---------|----------------|
| Global furniture and pixel font | `app/win95.css`; `public/fonts/w95fa.woff`; `--chrome-face`, `--fascia-*`, `--hab-crt-*` |
| Chrome warmth and Bouba/Kiki | `lib/chrome-patina.ts`, `lib/drift-clock.ts`, `lib/corner-mix.ts`, `app/chrome-patina.css`, Settings → Window gray / Bouba/Kiki |
| Sand close | `components/ui/window-sand-close.tsx`, `components/ui/window-sand-sim.ts`; wired from `daily-task-form-dialog.tsx` |
| Willpower gems | `willpower-gems.tsx`, `lib/willpower-physics.ts`, `lib/willpower-stones.ts`, `habits-control-panel.tsx` |
| Habits lamps and tubes | `habit-led-lamp.tsx`, `percent-led-bar.tsx`, `percent-led.tsx`, `noble-gas-tube.tsx`, `cockpit-switch.tsx` |
| Lists orbs | `FolderViewIcons.tsx`, `lib/orbs-manifest.ts`, `lib/lists-icon-grid.ts`, `components/Icons/OrbPicker.tsx`, `public/orbs-removebackground/` |
| Person birthday cake | Drawn pixel SVG on `components/People/person-detail.tsx` (milled plaque, phosphor candle). A later folder of cute cake PNGs will work the same way as willpower gemstones and list orbs. That folder is not in the repo, and the plaque does not load images. |
| Velvet | `public/newvelv.jpg`, `.fm-desktop.velvet` |
| Folders | `public/folders-removebackground/`, `lib/folders-manifest.ts` |
| Gem photographs | `public/gems-removebackground/`, `lib/gems-manifest.ts` |
| Upload cutouts | `lib/remove-background.ts` |
| Unsaved edits | `lib/unsaved-changes.ts`, `components/ui/unsaved-changes-guard.tsx` |
| Estimated values | `lib/estimated-values.ts`, `components/Home/ToDo/CompletionTimeLine.tsx` |
| Stills | [`DESIGN_REFS.md`](DESIGN_REFS.md), `designrefs/` |

When a new room needs chrome, lay it out first. Then use a material from this
palette or invent the furniture. Identity for a list or an item may be an
orb. It may also be an object that room invented.

---

## Checklist before shipping UI

- [ ] None of the four failures: doors still visible, no floating-card restack,
      the room’s own interior not sanded into the shared kit, any quote real
      and sourced.
- [ ] Layout: one job per region, one reading order, shared edges, related
      controls in one group, empty space only as a pause, three type sizes.
- [ ] [The screen stays pleasing](#the-screen-stays-pleasing): peers share a
      baseline and one row when they fit, gaps are even, one color family,
      no orphan wrap, no clipped toolbar (padding first), the hint is
      readable, a dead control is hidden, clocks and popovers are the
      instrument. No chrome added to look busy.
- [ ] If it moves, it is a verb (or one rare gesture on that verb), and
      reduced motion snaps to the end state.
- [ ] A number the person did not type wears `~` and an **est.** chip.
- [ ] A dirty editor uses Save / Stay / Discard. A clean close is silent.
- [ ] Habits, Lists, Plan chips, and the Analytics studio were left as their
      own rooms. New furniture was invented here, or a palette material was
      used, without cloning `.hab95`.
