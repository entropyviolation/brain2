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
  instead of abandoning the dialog to go make it first.
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

## Planned: parallel counts-as chains

**Not implemented.** Written down so the data model does not drift away from it.

Today `TrackPen.parentId` is a single optional id: one pen, one parent, one
chain to the root. The obvious next want is **multiselect** — *Ocean Beach*
counting as both *San Diego* and *Beaches*, two chains in parallel.

The storage migration is small: `parentId?: string` becomes
`parentIds?: string[]`, with a persist step wrapping each existing `parentId`
in an array and a compatibility getter so nothing has to change at once. The
UI is already shaped for it: `PenParentPicker` owns selection behind a
`value / onSelect` interface, and `PenChainVisual` already renders a branching
diagram downward — showing two chains upward is the same component run twice.

The hard parts are not storage, and are why this is not shipping yet:

1. **Depth stops being a number.** `displayDepth` assumes one path to the root,
   so "depth 1" is unambiguous. With two parents at different heights, a block
   has two depth-1 ancestors and the grid must pick a color. Options: a
   designated *primary* parent for display (mirroring how a block already has a
   primary pen), or depth becoming per-chain.
2. **Occupancy must not double-count.** `lib/tracking-summary.ts` counts a
   minute once. A pen rolling up into two parents must add its minutes to both
   parent totals while still contributing one minute to the day — the same
   union the tag rollup already does, but applied to the pen tree.
3. **Cycle detection gets harder.** `wouldCycle` walks one chain. With several
   parents it becomes a graph reachability check over all of them.

Until those are answered, one parent per pen is the honest model, and the
single-parent code should stay readable rather than being pre-generalized.

### A related note on robustness

`ancestorChain` guards against a cyclic `parentId` on purpose — "a corrupt
vault should still paint". Anything new that walks the pen graph, in either
direction, should carry the same guard. `wouldCycle` protects the write path;
it does nothing about a cycle that arrived from an import, a partial migration,
or a future `parentIds` conversion.

---

## Next step (not implemented)

Using this model — chains, block names, secondary pens — to **hide, show,
search and index** time in the Tracker and the Analytics Tracking tab.

## Related

- [`components/Home/Tracking/README.md`](../components/Home/Tracking/README.md) — the tab
- [`docs/PEN_ACTION_FORMATS.md`](./PEN_ACTION_FORMATS.md) — the other new pen section
- [`docs/SPEC_MAPPING.md`](./SPEC_MAPPING.md) §12 — status
- [`docs/CANONICAL_FIELDS.md`](./CANONICAL_FIELDS.md) — `TrackPen` fields
- [`docs/ScienceandSanityBrain2.md`](./ScienceandSanityBrain2.md) — orders of abstraction; GS-8 extends this ladder past pens
