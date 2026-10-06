# Counts as — nesting pens

**Brain2** Tracking: one pen can sit under another in the same view. *Taking out the
trash* counts as *Cleaning*. *Ocean Beach* counts as *San Diego*.

**What it is not:** a relabel. Assigning a parent never rewrites your paint.

That distinction is the whole feature, and the old wording in pen settings hid
it. It is also an order of abstraction. The painted pen is the lower order; a
parent is a higher label hung from it; **Show as** chooses which order to
display. The rollup is computed when you look, so a higher label never
overwrites the record. The same single-parent ladder for types, tags, and lists
is GS-8 in [`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md). Parallel
parents stay the unanswered design below. This file is the reference behind the
copy now shown in the dialog.

Implementation: `lib/pen-tree.ts` (pure graph),
`components/Home/Tracking/pen-parent-picker.tsx` (the control),
`components/Home/Tracking/pen-chain-visual.tsx` (the diagram),
`components/Home/Tracking/pen-settings-dialog.tsx` (the section).

---

## The rule

> Painting still writes **this** pen. The grid and Analytics can roll the time
> up to the parent when you ask them to.

Paint an afternoon with *Ocean Beach* and the stored block says Ocean Beach,
before and after you nest it under San Diego. What changes is that the app now
*knows* Ocean Beach is a kind of San Diego, so it can answer "how much time in
San Diego?" without you having painted a single San Diego block.

Which rung you see is **Show as** on the palette (`displayDepth`), set per view
and independently again on Analytics → Tracking:

| Show as | A block painted *Ocean Beach* draws as |
|---|---|
| Country (depth 0) | San Diego, in San Diego's color |
| Area (depth 1) | Ocean Beach, in Ocean Beach's color |
| Exact (`null`, default) | Ocean Beach — the pen actually painted |

A pen shallower than the depth you asked for stays itself: *San Diego* painted
directly as San Diego is still San Diego when you zoom into neighborhoods.

Three consequences worth stating, because each one surprised someone:

- **Nesting is retroactive.** Time painted last March rolls up the moment you
  assign the parent. Nothing is re-painted, because nothing needs to be — the
  rollup is computed from the tree at read time.
- **Nesting is reversible.** Clear the parent and the rollup stops. The blocks
  are untouched either way.
- **Nesting is not tagging.** A parent is *in-view rollup* — Ocean Beach is a
  kind of San Diego, and both are places. A tag is *cross-scope*, and is what
  joins Tracking to Habits. A pen can have both, and they do not interact.
  See the Tracking README, "Tags → habits".

## Choosing the parent

The old control was a native `<select>`: a system menu that listed every pen
flat and looked nothing like the rest of the app. It is now a sunken Win95
field that opens a list you can type into.

- **Search** filters as you type. Options show the ancestor path
  (`Home › Ocean Beach › San Diego`), and search matches those ancestors too —
  typing Mexico surfaces Balboa Park. This matters once a Location view has
  fifty places in it.
- **Nothing — this is a top-level X** is the first option and clears the parent.
- **Create new pen…** makes the parent on the spot, with a name and a color, so
  you can nest *Ocean Beach* under a *San Diego* that does not exist yet
  instead of abandoning the dialog to go make it first. The name sits in a dark
  inset field (same voice as the pen Name well) that fills the row beside the
  swatch and Create, so the letters stay visible while you type.
- A pen can never be nested under itself or under one of its own descendants —
  `validParents` / `wouldCycle` in `lib/pen-tree.ts` remove those from the list,
  so a loop is not something you can build by hand.

## The chain

Pen settings draws the nest rather than describing it. For *Home* (Home counts as Ocean Beach counts as San Diego):

```text
[●] Home (this)  →  [●] Ocean Beach  →  [●] San Diego
```

The pen you are editing on the left, root on the right — "counts as" reads left to right. Each node is that pen's color and a button that opens that pen's settings. The current pen is outlined and labelled.

On a **parent**, the same section also branches downward: every pen that counts
as it, nested as deep as the tree goes.

```text
[●] San Diego (this)
  ├ [●] Ocean Beach
  │   └ [●] Home
  └ [●] mission beach
```

The whole section collapses, and a pen that is neither nested nor a parent gets
a line of prose instead of an empty box.

---

## Details are the same ladder

A **detail** of a pen is a pen that counts as it. The chip list and the tree
are two doors on one fact (`lib/pen-detail-sync.ts`, persist **v13**).

| You do this | What also happens |
|---|---|
| Add **Walk** as a detail of Exercise | A Walk pen is created (or a same-name pen with no parent is adopted). Walk's parent is Exercise. |
| Set Walk's parent to Exercise | Walk shows up in Exercise's detail list. |
| Paint Exercise and tick Walk | The block stays Exercise, with Walk applied. Those minutes also count as the Walk pen. |
| Paint the Walk pen directly | Exercise's detail breakdown includes that time as Walk. California painted as California shows up in USA's states. |
| Remove the Walk detail | Walk no longer counts as Exercise. The Walk pen stays in the well. Painted minutes stay; the block just loses that label. |

Several details can still apply to the same minutes (Elijah and Rebecca on one
hour). That overlap is why details stay a list on the block, not a second
primary pen. **Show as** still chooses which rung of the tree the grid draws.

A same-name pen that already counts as something else is not stolen and not
forked. Cogs under Focus stays under Focus; a Computer work detail also named
Cogs remains a label until you nest them yourself.

Double-click a pen color — on a block, in the well, on a detail chip, in the
Activity Log, on the Day Log strip, or on an Analytics swatch — to open that
pen's settings. The chain in settings still opens a pen with one click.

---

## Parallel counts-as

A pen may count as several others. *Ocean Beach* can count as both *San Diego*
and *Beaches*.

`parentIds` is the full list. `parentId` is the display parent, and it is
always `parentIds[0]`. Persist **v14** copies a lone `parentId` into
`parentIds` and leaves `parentId` in place, so an old vault still paints.
`pen-parent-picker.tsx` is the multiselect. `assignParents` in `lib/pen-tree.ts`
writes both fields together.

**Show as** follows the display parent only (`ancestorChain` / `penAtDepth`),
so the grid keeps one color. Further chains are `ancestorChains`. At Exact the
painted pen gets the whole block. At a collapsed depth, each distinct ancestor
at that depth gets a share, and those shares sum to the block (`pensAtDepth`
plus `addSplit` in `lib/tracking-summary.ts`). An ancestor reached twice is
paid once. A secondary pen on the block still receives the full block — that
overlap is the same rule as before.

`wouldCycle` walks every parent. `ancestorChains` still stops a missing or
cyclic parent so a corrupt vault paints.

**Find** (`lib/tracking-search.ts`) searches counts-as names along with the
block's display name, notes, project, pen, secondary pens, and action-format
templates. The Time Grid bezel, the Activity Log, and Analytics → Tracking
all call it.

## Related

- [`components/Home/Tracking/README.md`](../components/Home/Tracking/README.md) — the tab
- [`docs/PEN_ACTION_FORMATS.md`](./PEN_ACTION_FORMATS.md) — the other new pen section
- [`docs/SPEC_MAPPING.md`](./SPEC_MAPPING.md) §12 — status
- [`docs/CANONICAL_FIELDS.md`](./CANONICAL_FIELDS.md) — `TrackPen` fields
- [`docs/ScienceandSanityBrain2.md`](./ScienceandSanityBrain2.md) — orders of abstraction; GS-8 extends this ladder past pens
