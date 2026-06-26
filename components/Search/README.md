# Search — Global Command Palette (Phase 6a)

A Cmd/Ctrl-K command palette that searches across all items (tasks, notes, and
any unified `Item`) by title/description, tags, and free-text attributes/notes.

## Files

| File | Responsibility |
| --- | --- |
| `../../lib/search.ts` | **Pure, framework-free** ranked search. `searchItems(query, items, opts?)` returns `SearchResult[]` (`{ item, score, matchedOn }`). Case-insensitive, multi-term AND, deterministic. Also exports the `SearchResult` / `SearchField` types and a `displayTitle(item)` helper. No React / store / I/O dependencies. |
| `../../lib/search.test.ts` | Vitest unit tests: ranking order (title > tag > notes), multi-term AND across fields, case-insensitivity, empty query → `[]`, tag matches, no-match, determinism, and the `limit` option. |
| `GlobalSearch.tsx` | The palette UI. Built on the shadcn `dialog` + `input` primitives (no `command` primitive exists in `components/ui/`). Reads items via `taskRepository.getAll()`, runs `searchItems`, and renders ranked results with Up/Down/Enter/Esc keyboard navigation. |
| `useGlobalSearchHotkey.ts` | Self-contained hook returning `{ open, setOpen }`, toggling on Cmd/Ctrl-K via a single `keydown` listener. Mounts nothing globally. |

## Ranking design

Each item exposes searchable text grouped into three field tiers, weighted:

1. **title** (`Item.title` / `Task.description`) — weight `100`
2. **tag** (`Item.tags[]`) — weight `40`
3. **attribute** (`Task.notes`, `taskDescription`, `why`, `consequences`,
   `context`, and any `Item.attributes` values) — weight `10`

The query is lowercased and split on whitespace into terms combined with **AND**
(every term must match somewhere). An item's score is the sum, over each term,
of the **highest-weighted field** that term matched. Position bonuses break ties:
exact field match `+50`, prefix `+20`, word-boundary `+10`. Results are stably
sorted by score (desc), then title (asc), then id (asc), so identical inputs
always yield identical ordering. An empty/whitespace query returns `[]`.

## Component API

```tsx
<GlobalSearch
  open={open}
  onOpenChange={setOpen}
  onSelect={(itemId) => { /* open the item */ }}
  limit={20} // optional, default 20
/>
```

```ts
const { open, setOpen } = useGlobalSearchHotkey()
```

## Integration TODO (for the parent — NOT wired up yet)

These files are intentionally **not** mounted anywhere. To finish Phase 6a, the
parent should wire them into the app shell (e.g. `app/page.tsx` or a top-level
client layout component) as follows:

1. Import the pieces near the app root:

   ```tsx
   import { GlobalSearch } from "@/components/Search/GlobalSearch"
   import { useGlobalSearchHotkey } from "@/components/Search/useGlobalSearchHotkey"
   ```

2. Call the hook in a top-level **client** component and render the palette once,
   near the app root (so Cmd/Ctrl-K works from anywhere):

   ```tsx
   const { open, setOpen } = useGlobalSearchHotkey()

   return (
     <>
       {/* …existing app shell… */}
       <GlobalSearch
         open={open}
         onOpenChange={setOpen}
         onSelect={(itemId) => {
           // Route selection to the existing item-detail flow, e.g. set the
           // selected task id / open the ItemDetail popup used elsewhere in the
           // app (see components/ItemDetail/*). For tasks today that likely
           // means opening the task-detail popup with taskRepository.getById(itemId).
         }}
       />
     </>
   )
   ```

3. Optionally surface a visible affordance (a search button in the header) that
   also calls `setOpen(true)`.

Notes for the integrator:
- `GlobalSearch` snapshots `taskRepository.getAll()` each time it opens, so it
  reflects current store state without re-reading on every keystroke.
- If/when a non-task `Item` source exists, pass a merged list into a thin wrapper
  or extend `GlobalSearch` to accept an `items` prop; the underlying
  `searchItems` already works on any `Item[]`.
