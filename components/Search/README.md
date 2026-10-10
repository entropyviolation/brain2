# Search — Global Command Palette

A Cmd/Ctrl-K command palette across **Brain2**. It searches items (tasks, notes, and
any unified `Item`) by title/description, tags, and free-text attributes/notes, plus
list and folder names. The palette is mounted from `app/page.tsx` (lazy, when the
hotkey opens it) and is available on every tab.

## Files

| File | Responsibility |
| --- | --- |
| `../../lib/search.ts` | **Pure, framework-free** ranked search. `searchItems(query, items, opts?)` returns `SearchResult[]` (`{ item, score, matchedOn }`). Case-insensitive, multi-term AND, deterministic. Also exports the `SearchResult` / `SearchField` types and a `displayTitle(item)` helper. No React / store / I/O dependencies. |
| `../../lib/search.test.ts` | Vitest unit tests for the ranker: title > tag > notes, multi-term AND, case-insensitivity, empty query → `[]`, tags, no-match, determinism, and `limit`. |
| `GlobalSearch.tsx` | The palette (`data-ui-name="Search"`). One dialog. Snapshots items, lists, and folders on open, runs `searchItems`, and renders the ranked hits. Up/Down move, Enter opens, Esc closes — from the field or anywhere in the palette that is not an Advanced control. |
| `search-chrome.css` | Milled fascia for `.b2-search`: sunken query well, result well, phosphor lamp on the active row. Same face tokens as the header (`--fascia-*`, `--hab-crt-green`). Imported from `app/layout.tsx` so the lazy palette does not paint unskinned. |
| `useGlobalSearchHotkey.ts` | `{ open, setOpen }`. Toggles on Cmd/Ctrl-K. Shift and Alt chords are ignored (Cmd/Ctrl-Shift-A opens Quick Add). Key repeat does not toggle. Mounts nothing by itself. The header magnifying glass calls the same `setOpen(true)`. |
| `GlobalSearch.test.tsx` | Palette behavior: empty copy, click and Enter open the right id and kind, highlight returns to the first hit when the query changes, arrows work from Advanced, rows show type / list / date, hidden-only empty state. |
| `useGlobalSearchHotkey.test.tsx` | Cmd/Ctrl-K toggles; Shift and Alt do not; repeat does not. |

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

The palette merges folder, list, and item hits with that same order and then
caps the list (default 20). It does not rescore them.

## What a row shows

Type, then the title, then the place and a date when the record already has them.

- **Item** — type name (Task, Note, …), list membership (`Seeds`, or `Seeds +2`), then scheduled date (`sched`), else deadline (`due`), else the created date.
- **List** — parent folder name, then created date.
- **Folder** — parent folder name when it is nested, then created date.

The active row is a CRT well with a lit lamp. The tooltip names the field the ranker matched.

## Component API

```tsx
<GlobalSearch
  open={open}
  onOpenChange={setOpen}
  onSelect={(selection) => {
    // selection is { id, kind } where kind is "item" | "list" | "folder"
  }}
  limit={20} // optional, default 20
/>
```

```ts
const { open, setOpen } = useGlobalSearchHotkey()
```

`app/page.tsx` owns both. Items open in the detail popup. Folders and lists call
`applyListsNavigation` and switch to the Lists tab; that event also clears a
full-page item so the desk is visible.

## Behavior

- The catalog is snapshotted when the palette opens, so typing does not re-read
  the store on every keystroke. If the vault finishes hydrating while the palette
  is open, the snapshot is taken again.
- Completed tasks and items hidden from To-Do are out of the list until
  **Include hidden items** is on. If they were the only matches, the empty line
  says so.
- Changing the query or the Advanced filters moves the highlight back to the
  first hit, so Enter opens the best match.
- Cmd/Ctrl-K toggles the palette. Cmd/Ctrl-Shift-A opens Quick Add and does not toggle search.
