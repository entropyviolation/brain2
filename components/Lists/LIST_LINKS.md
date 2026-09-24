# Connected lists (membership links)

Two lists can **share items** without one being a child of the other. This is
membership — the same item record appears on both lists — not nesting, not a
subset folder, and not `parentListId`.

Example: Module Lists A and B can both show the same chores even when neither
list lives under the other.

Settings (either list) → **Connected lists**. Pick the other list and a
direction. The other list’s settings show the same connection from the other
side.

## UX

The target list is chosen with the shared **`ListPicker`** — the same searchable
row list used when assigning an item **in lists**. Search filters; each list is
one readable row with a folder-colored glyph; the pending target shows as a
chip with remove; **New list** and **Selected (n)** sit at the foot. Connecting
is still **one list per Connect click**. Direction radios and the current
connections list (with **Remove**) are unchanged. Do not dump every list name
as wrapping inline chips.

## Data model

Canonical write is **outbound only**, on the source list:

```ts
List.linkedTargetListIds?: string[]  // A→B is stored on A as ["B"]
```

B does not store a reverse pointer. Opening B’s settings *derives* “receives
all items from A” by scanning lists whose `linkedTargetListIds` include B.
Configuring either side writes the same field on the source.

Item opt-outs live on the item:

```ts
Task.listMembershipExclusions?: string[]  // list ids this item must not auto-join
```

Membership itself is the existing `Task.lists: string[]` (an item may already
belong to many lists). Links only **add** ids to that array. They never set
`parentListId`.

Pure helpers: `lib/list-links.ts`. Store: `addListLink` / `removeListLink` on
`lib/task-store.ts`. `updateList` preserves `linkedTargetListIds` so saving
other list settings cannot clobber connections.

Virtual lists (folder **All Items**, Next Actions smart lists) cannot be linked.

## Directions

From list A’s settings, connecting to B:

| Choice | Stored as | A’s settings | B’s settings |
|--------|-----------|--------------|--------------|
| Every item in **this** list also appears on B | A → B | “Also shows these items on B” | “Receives all items from A” |
| Every item on **B** also appears here | B → A | “Receives all items from B” | “Also shows these items on A” |

Multiple outbound links are allowed (`A→B`, `A→C`, …). `A→B` and `B→A` may
both exist (union both ways).

## What joining does

- **Create a link:** every item already on the source is added to the target
  (idempotent), except items excluded from the target.
- **New items** added to the source later also join the target, through
  `addTask` / `updateTask`.
- **Chains are transitive.** If A→B and B→C, an item on A also lands on C
  (membership follows the directed graph, cycle-safe via a set).
- Joining is **membership only**: no type change, no default-attribute copy, no
  folder move.

## Exclusions (manual remove)

If the user **manually removes** an item from a list, that list id is recorded
on `listMembershipExclusions`. Links will not put it back. List Settings →
**Clear list** is the same remove-from-this-list write for every member (via
`updateTask`), so linked lists cannot put those items back.

- Stays removed even if it is still on the source list, and even if a later
  resync / new link would otherwise add it.
- **Explicitly adding** the item back to that list clears the exclusion. It can
  live on both lists again. Remove it again → excluded again.
- A **new** item on the source still auto-joins the target (it has no
  exclusion).
- Exclusion is per `(item, list)`, not per link.

## Unlink

Removing a link **stops future auto-adds**. Items that were already on both
lists **stay** on both. Nothing is mass-deleted. The user removes leftover
membership by hand if they want it gone.

Exclusions are kept (harmless) so a later re-link still honors a past opt-out.

Deleting a list drops it from every other list’s `linkedTargetListIds`. Item
rows are not rewritten (same as today’s delete-list behavior).

## Loops

`A→B` plus `B→A` is a union: each item on either list joins the other, still
honoring per-list exclusions. Longer cycles (`A→B→C→A`) use the same set
closure and cannot loop forever.

## What this is not

- Not nesting / sublists (`parentListId`, `lib/list-tree.ts`).
- Not Module Lists Tidy projection (`lib/module-list-import*`). Linking two
  module-created lists is allowed and does not change how Tidy upserts.
- Not a live filter / “show but don’t copy” view. Items really join
  `Task.lists`.

## Future plans

- **Show but don’t copy** — a view overlay that *displays* the other list’s
  items without writing `Task.lists`.
- **Filters** — only join items matching an attribute / type / rule
  (e.g. “Kitchen chores where priority ≥ 3”).
- **One-shot copy** — copy current membership once without a lasting link.
- **Link badges** in list chrome so a connected list is obvious before opening
  settings (without touching default-row checkbox chrome).
- Per-category export including the other list’s id (today a single-list
  export carries outbound `linkedTargetListIds` but not the sibling list
  document).
