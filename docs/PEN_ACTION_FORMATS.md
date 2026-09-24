# Default action formats — a painted block becomes a done thing

**Brain2** Tracking: paint 1:00–1:15 on the *Walking* pen and **"Went for a walk"** appears in
Home → To Do → **Done today**, without typing anything.

That is the whole feature. A pen can carry one or more **templates**; when a
block of that pen exists, the best-matching template names a Done row, and the
row stays in step with the block for as long as both exist.

This is **separate from habit links**. A tag says *this time counts toward a
goal*. An action format says *this time was a thing I did, and here is what to
call it*. A pen can have both, neither, or either.

Implementation: `lib/pen-action-format.ts` (pure template math),
`lib/pen-action-sync.ts` (store → task repository bridge),
`components/Home/Tracking/pen-action-format-editor.tsx` (pen settings section).

---

## Writing templates

One line per situation. Add as many as you like.

```text
Went for a walk
Went for a {minutes} minute walk at {location}
```

A 15-minute *Walking* block at Ocean Beach logs **"Went for a 15 minute walk at
Ocean Beach"**. The same block with nothing in the Location view logs **"Went
for a walk"**.

### Which template wins

> The **most specific** template whose variables all have values. Equal
> specificity **ties on list order** — the first listed wins.

Specificity is simply how many variables the template uses. A template whose
variables are all always-available can never be skipped, which is what makes it
a safe fallback — so give every pen one plain line with no optional variables,
or a block with thin data logs nothing at all. Reordering the list is already
a real control for ties; a drag handle is not built yet.

This is how "and if the project name is not given, just say *Worked*" is
expressed — as two templates rather than a conditional:

```text
Worked
Worked for {hours} hours
Worked on {project} for {hours} hours
```

### The variables

**Always available** — every block has these, so they never cause a template to
be skipped:

| Variable | Is |
|---|---|
| `{minutes}`, `{x}` | Length in minutes — `15` |
| `{hours}` | Length in decimal hours — `0.25`, `1.5` |
| `{duration}` | Human length — `15m`, `1h 30m` |
| `{name}` | The block's display name, or the pen's name if it has none |
| `{pen}` | The pen's name |
| `{start}`, `{end}` | Clock times — `1:00 PM`, `1:15 PM` |

**Only sometimes available** — a template using one of these is **skipped**
when the value is missing, which is exactly how you get different phrasings for
different amounts of information:

| Variable | Comes from |
|---|---|
| `{location}` | Any pen in the **Location** view overlapping these minutes. Several become "A / B". |
| `{project}`, `{project name}` | The block's project field |

Variable names ignore case and extra spaces, so `{Project Name}` and
`{project name}` are the same thing.

### Preview

The editor shows what a 15-minute block with no location and no project would
log, so a template that can never fire is visible before you close the dialog.

---

## What happens to the Done row

The row is a real logged action (`LOGGED_ACTION_TYPE_ID`, tagged `tracking`)
with a deterministic id derived from the block, so it is created once and
updated thereafter rather than duplicated.

| You do this | The Done row does this |
|---|---|
| Paint a block of a pen with templates | Appears, named from the winning template |
| Drag it longer, or retime it | Duration, start and completion time follow; the name re-renders, so `{minutes}` updates |
| Fill in the Location view over those minutes | Re-renders — a more specific template can now win |
| Set or change the block's project | Re-renders, so `{project}` is correct |
| Rename the block | `{name}` follows |
| Delete the block | The row is removed |
| **Rename the Done row yourself** | Your name is kept forever. Times and duration still follow the block. |

That last row is the important one: the template names the thing, it does not
own it. The sync remembers what it generated and only rewrites the title while
the title is still what it generated.

A block that crosses midnight is stored as two slices sharing a `spanId`; it
produces **one** Done row covering the whole span, not one per day.

Sleep-derived blocks are skipped — `lib/sleep-sync.ts` already writes their
Done row ("Slept 7h 30m"), and two systems logging the same night would
double-count.

## Secondary pens log too

A block carries one primary pen and any number of secondaries. If **any**
assigned pen has templates, the block logs. This is consistent with how
secondary pens already work for tags and habits: they are not cosmetic.

## Where the rows surface

Anywhere completed work is read, because they are ordinary completed tasks:

- Home → **To Do** → *Done today*
- Home → **Tracking** → Activity Log → *Done this day*
- Analytics' completion counts and points
- Reviews, which read the day's done items

## When it runs

`usePenActionSync()` subscribes to the tracking store and reconciles whenever
entries or scopes change. It is idempotent — ids are deterministic and a
customised title is never overwritten — so it is safe to mount on several
surfaces and safe to call repeatedly.

---

## Not implemented

- **Per-scope location source.** `{location}` finds the Location view by id or
  name. A renamed view means `{location}` stops resolving; letting a pen name
  which view feeds the variable would fix it.
- **Drag-to-reorder templates.** Equal-specificity already ties on list order
  (first listed wins). There is no drag handle yet — the list is the order.
- **Variables from other scopes** — `{mood}`, `{company}` — the same mechanism
  as `{location}`, not generalized yet.

## Related

- [`components/Home/Tracking/README.md`](../components/Home/Tracking/README.md) — the tab
- [`docs/COUNTS_AS.md`](./COUNTS_AS.md) — the other new pen section
- [`components/Home/ToDo/README.md`](../components/Home/ToDo/README.md) — where the rows land
- [`docs/SPEC_MAPPING.md`](./SPEC_MAPPING.md) §12 — status
